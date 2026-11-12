import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { getStorageProvider } from "@/lib/storage";
import {
  validateDocumentFile,
  computeSha256,
  MAX_FILES_PER_PROJECT,
} from "./validation";
import { getParserForMimeType, ParsedSegment } from "./parsers";
import { createStructureAwareChunks } from "./chunking";
import { AppError } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";
import {
  DocumentProcessingStatus,
  Prisma,
  ProcessingJobState,
  SourceDateBasis,
} from "@prisma/client";

export interface UploadDocumentInput {
  projectId: string;
  originalFileName: string;
  fileBuffer: Buffer;
  reportedMimeType?: string | null;
  userProvidedDate?: string | null;
  explicitUserId?: string;
}

function sanitizeErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "Document processing failed.";
  // Strip file paths or connection strings if any slipped into error messages
  return raw.replace(/[A-Za-z]:\\[^\s]+/g, "[path]").slice(0, 500);
}

export async function uploadDocumentService(input: UploadDocumentInput) {
  const { user } = await requireProjectAccess(
    input.projectId,
    "documents:upload_or_delete",
    input.explicitUserId
  );

  // 1. Enforce max documents per project
  const activeCount = await prisma.document.count({
    where: { projectId: input.projectId, deletedAt: null },
  });

  if (activeCount >= MAX_FILES_PER_PROJECT) {
    throw new AppError(
      "BAD_REQUEST",
      `Project document limit reached (${MAX_FILES_PER_PROJECT} documents). Delete unused documents before uploading more.`,
      400
    );
  }

  // 2. Validate file format, MIME type, size, and magic bytes
  const validated = await validateDocumentFile(
    input.originalFileName,
    input.fileBuffer,
    input.reportedMimeType
  );

  // 3. Duplicate detection within the same project (among non-deleted docs)
  const existingDoc = await prisma.document.findFirst({
    where: {
      projectId: input.projectId,
      checksum: validated.checksum,
      deletedAt: null,
    },
    select: { id: true, fileName: true },
  });

  if (existingDoc) {
    throw new AppError(
      "CONFLICT",
      `A document with identical content has already been uploaded as '${existingDoc.fileName}'.`,
      409,
      { existingDocumentId: existingDoc.id, existingFileName: existingDoc.fileName }
    );
  }

  // 4. Process optional source document date (never infer from upload/file metadata)
  let sourceDate: Date | null = null;
  let sourceDateBasis: SourceDateBasis = SourceDateBasis.UNKNOWN;

  if (input.userProvidedDate && input.userProvidedDate.trim()) {
    const parsedDate = new Date(input.userProvidedDate);
    if (isNaN(parsedDate.getTime())) {
      throw new AppError("VALIDATION_ERROR", "Invalid document date format.", 400);
    }
    sourceDate = parsedDate;
    sourceDateBasis = SourceDateBasis.USER_PROVIDED;
  }

  // 5. Save to private storage with a generated project-scoped UUID key
  const storageKey = `${input.projectId}/${randomUUID()}${validated.extension}`;
  const storage = getStorageProvider();
  await storage.put(storageKey, input.fileBuffer, validated.mimeType);

  // 6. Create database records atomically
  const doc = await prisma.$transaction(async (tx) => {
    const createdDoc = await tx.document.create({
      data: {
        projectId: input.projectId,
        uploadedBy: user.id,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        storageKey,
        fileSize: validated.size,
        checksum: validated.checksum,
        sourceDate,
        sourceDateBasis,
        processingStatus: DocumentProcessingStatus.UPLOADED,
      },
    });

    await tx.processingJob.create({
      data: {
        documentId: createdDoc.id,
        state: ProcessingJobState.PENDING,
      },
    });

    return createdDoc;
  });

  await writeAudit({
    projectId: input.projectId,
    userId: user.id,
    action: "DOCUMENT_UPLOADED",
    entityType: "DOCUMENT",
    entityId: doc.id,
    metadata: {
      fileName: doc.fileName,
      size: doc.fileSize,
      checksum: doc.checksum,
      sourceDateBasis: doc.sourceDateBasis,
    },
  });

  return doc;
}

/**
 * Executes ONE bounded, idempotent step of the document processing state machine:
 * UPLOADED/VALIDATING -> EXTRACTING -> CHUNKING -> READY_FOR_AI
 * Lease lock ensures two workers never execute the same step concurrently.
 */
export async function processDocumentNextStepService(
  projectId: string,
  documentId: string,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(
    projectId,
    "documents:upload_or_delete",
    explicitUserId
  );

  const document = await prisma.document.findFirst({
    where: { id: documentId, projectId, deletedAt: null },
    include: {
      processingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!document) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }

  const job = document.processingJobs[0];
  if (!job) {
    throw new AppError("BAD_REQUEST", "No processing job exists for this document.", 400);
  }

  if (document.processingStatus === DocumentProcessingStatus.READY_FOR_AI) {
    return { status: document.processingStatus, state: ProcessingJobState.COMPLETED, document };
  }

  if (
    document.processingStatus === DocumentProcessingStatus.VALIDATION_FAILED ||
    document.processingStatus === DocumentProcessingStatus.EXTRACTION_FAILED
  ) {
    return {
      status: document.processingStatus,
      state: ProcessingJobState.FAILED,
      lastError: job.lastError,
    };
  }

  // Acquire exclusive 30s lease atomically
  const now = new Date();
  if (job.leaseExpiresAt && job.leaseExpiresAt > now && job.state === ProcessingJobState.RUNNING) {
    return {
      status: document.processingStatus,
      state: "LEASED",
      message: "Processing step is currently in progress by another worker.",
    };
  }

  const leaseExpiresAt = new Date(now.getTime() + 30000);
  await prisma.processingJob.update({
    where: { id: job.id },
    data: {
      state: ProcessingJobState.RUNNING,
      attempts: { increment: 1 },
      leaseExpiresAt,
    },
  });

  const storage = getStorageProvider();

  try {
    // STEP 1: UPLOADED or VALIDATING -> validate stored bytes & checksum -> EXTRACTING
    if (
      document.processingStatus === DocumentProcessingStatus.UPLOADED ||
      document.processingStatus === DocumentProcessingStatus.VALIDATING
    ) {
      await prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: DocumentProcessingStatus.VALIDATING },
      });

      const fileBuffer = await storage.get(document.storageKey);
      await validateDocumentFile(document.fileName, fileBuffer, document.mimeType);

      if (computeSha256(fileBuffer) !== document.checksum) {
        throw new Error("Stored file checksum mismatch.");
      }

      await prisma.$transaction([
        prisma.document.update({
          where: { id: document.id },
          data: { processingStatus: DocumentProcessingStatus.EXTRACTING },
        }),
        prisma.processingJob.update({
          where: { id: job.id },
          data: {
            state: ProcessingJobState.PENDING,
            leaseExpiresAt: null,
            lastError: null,
          },
        }),
      ]);

      return {
        status: DocumentProcessingStatus.EXTRACTING,
        state: ProcessingJobState.PENDING,
      };
    }

    // STEP 2: EXTRACTING -> parse text & locations, compute quality -> CHUNKING
    if (document.processingStatus === DocumentProcessingStatus.EXTRACTING) {
      const fileBuffer = await storage.get(document.storageKey);
      const parser = getParserForMimeType(document.mimeType);
      const parseResult = await parser.parse(fileBuffer);

      await prisma.$transaction([
        prisma.document.update({
          where: { id: document.id },
          data: {
            pageCount: parseResult.pageCount,
            textQuality: parseResult.textQuality,
            processingStatus: DocumentProcessingStatus.CHUNKING,
          },
        }),
        prisma.processingJob.update({
          where: { id: job.id },
          data: {
            state: ProcessingJobState.PENDING,
            stepData: { segments: parseResult.segments } as unknown as Prisma.InputJsonValue,
            leaseExpiresAt: null,
            lastError: null,
          },
        }),
      ]);

      return {
        status: DocumentProcessingStatus.CHUNKING,
        state: ProcessingJobState.PENDING,
        pageCount: parseResult.pageCount,
        textQuality: parseResult.textQuality,
      };
    }

    // STEP 3: CHUNKING -> create structure-aware chunks idempotently -> READY_FOR_AI
    if (document.processingStatus === DocumentProcessingStatus.CHUNKING) {
      const stepData = job.stepData as { segments?: ParsedSegment[] } | null;
      let segments = stepData?.segments;

      if (!segments) {
        // Idempotent recovery if stepData was absent
        const fileBuffer = await storage.get(document.storageKey);
        const parser = getParserForMimeType(document.mimeType);
        const parseResult = await parser.parse(fileBuffer);
        segments = parseResult.segments;
      }

      const chunks = createStructureAwareChunks(segments);

      await prisma.$transaction(async (tx) => {
        await tx.documentChunk.deleteMany({
          where: { documentId: document.id },
        });

        if (chunks.length > 0) {
          await tx.documentChunk.createMany({
            data: chunks.map((c) => ({
              documentId: document.id,
              chunkIndex: c.chunkIndex,
              content: c.content,
              pageNumber: c.pageNumber ?? null,
              sectionTitle: c.sectionTitle ?? null,
              rowStart: c.rowStart ?? null,
              rowEnd: c.rowEnd ?? null,
            })),
          });
        }

        await tx.document.update({
          where: { id: document.id },
          data: { processingStatus: DocumentProcessingStatus.READY_FOR_AI },
        });

        await tx.processingJob.update({
          where: { id: job.id },
          data: {
            state: ProcessingJobState.COMPLETED,
            stepData: Prisma.DbNull,
            leaseExpiresAt: null,
            lastError: null,
          },
        });
      });

      await writeAudit({
        projectId,
        userId: user.id,
        action: "DOCUMENT_PROCESSED",
        entityType: "DOCUMENT",
        entityId: document.id,
        metadata: {
          chunkCount: chunks.length,
          pageCount: document.pageCount,
          textQuality: document.textQuality,
        },
      });

      return {
        status: DocumentProcessingStatus.READY_FOR_AI,
        state: ProcessingJobState.COMPLETED,
        chunksCreated: chunks.length,
      };
    }

    return { status: document.processingStatus, state: job.state };
  } catch (err: unknown) {
    const errorMessage = sanitizeErrorMessage(err);
    const failedStatus =
      document.processingStatus === DocumentProcessingStatus.UPLOADED ||
      document.processingStatus === DocumentProcessingStatus.VALIDATING
        ? DocumentProcessingStatus.VALIDATION_FAILED
        : DocumentProcessingStatus.EXTRACTION_FAILED;

    await prisma.$transaction([
      prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: failedStatus },
      }),
      prisma.processingJob.update({
        where: { id: job.id },
        data: {
          state: ProcessingJobState.FAILED,
          lastError: errorMessage,
          leaseExpiresAt: null,
        },
      }),
    ]);

    await writeAudit({
      projectId,
      userId: user.id,
      action: "DOCUMENT_PROCESSING_FAILED",
      entityType: "DOCUMENT",
      entityId: document.id,
      metadata: { stage: failedStatus, error: errorMessage },
    });

    throw new AppError("BAD_REQUEST", `Document processing failed: ${errorMessage}`, 400);
  }
}

export async function retryDocumentProcessingService(
  projectId: string,
  documentId: string,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(
    projectId,
    "documents:upload_or_delete",
    explicitUserId
  );

  const document = await prisma.document.findFirst({
    where: { id: documentId, projectId, deletedAt: null },
    include: {
      processingJobs: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!document) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }

  await prisma.$transaction([
    prisma.document.update({
      where: { id: document.id },
      data: { processingStatus: DocumentProcessingStatus.UPLOADED },
    }),
    prisma.processingJob.updateMany({
      where: { documentId: document.id },
      data: {
        state: ProcessingJobState.PENDING,
        attempts: 0,
        lastError: null,
        stepData: Prisma.DbNull,
        leaseExpiresAt: null,
      },
    }),
  ]);

  await writeAudit({
    projectId,
    userId: user.id,
    action: "DOCUMENT_PROCESSING_RETRIED",
    entityType: "DOCUMENT",
    entityId: document.id,
  });

  return { success: true };
}

export async function listDocumentsService(
  projectId: string,
  page: number = 1,
  limit: number = 10,
  explicitUserId?: string
) {
  await requireProjectAccess(projectId, "project:read", explicitUserId);

  const safePage = Math.max(1, Number.isFinite(page) ? page : 1);
  const safeLimit = Math.min(50, Math.max(1, Number.isFinite(limit) ? limit : 10));
  const skip = (safePage - 1) * safeLimit;

  const where = { projectId, deletedAt: null };

  const [total, documents] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { uploadedAt: "desc" },
      include: {
        _count: {
          select: { chunks: true },
        },
        processingJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            state: true,
            attempts: true,
            lastError: true,
          },
        },
        uploadedByUser: {
          select: { name: true, email: true },
        },
      },
    }),
  ]);

  return {
    documents: documents.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: doc.fileSize,
      checksum: doc.checksum,
      pageCount: doc.pageCount,
      textQuality: doc.textQuality,
      sourceDate: doc.sourceDate,
      sourceDateBasis: doc.sourceDateBasis,
      processingStatus: doc.processingStatus,
      uploadedAt: doc.uploadedAt,
      chunkCount: doc._count.chunks,
      uploadedBy: doc.uploadedByUser,
      lastJob: doc.processingJobs[0] ?? null,
    })),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

export async function getDocumentService(
  projectId: string,
  documentId: string,
  explicitUserId?: string
) {
  await requireProjectAccess(projectId, "project:read", explicitUserId);

  const document = await prisma.document.findFirst({
    where: { id: documentId, projectId, deletedAt: null },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
      },
      uploadedByUser: {
        select: { name: true, email: true },
      },
      processingJobs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!document) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }

  return document;
}

export async function softDeleteDocumentService(
  projectId: string,
  documentId: string,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(
    projectId,
    "documents:upload_or_delete",
    explicitUserId
  );

  const document = await prisma.document.findFirst({
    where: { id: documentId, projectId, deletedAt: null },
  });

  if (!document) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }

  await prisma.document.update({
    where: { id: document.id },
    data: { deletedAt: new Date() },
  });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "DOCUMENT_DELETED",
    entityType: "DOCUMENT",
    entityId: document.id,
    metadata: { fileName: document.fileName },
  });

  return { success: true };
}
