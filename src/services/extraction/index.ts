import crypto from "crypto";
import {
  DocumentProcessingStatus,
  ExtractionRunStatus,
  ReviewState,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/api-response";
import { env } from "@/lib/env";
import {
  LLMProvider,
  executeWithRetryBackoff,
} from "@/lib/ai/provider";
import { getDefaultLLMProvider } from "@/lib/ai/gemini-provider";
import {
  EXTRACTOR_PROMPT_VERSION,
  PromptRegistryEntity,
  buildExtractorSystemInstruction,
  buildExtractorUserPrompt,
} from "@/lib/ai/prompts/extractor-v1";
import {
  EXTRACTION_RESPONSE_JSON_SCHEMA,
  EXTRACTOR_SCHEMA_VERSION,
  ExtractedClaimCandidate,
  parseAndValidateExtractionResponse,
} from "@/lib/ai/schemas";
import { detectPromptInjection } from "@/lib/ai/injection-detector";
import { normalizeClaimValue } from "@/lib/ai/vocabulary";
import { resolveSubjectEntity } from "@/services/entities/resolution";

export interface ExtractDocumentOptions {
  model?: string;
  llmProvider?: LLMProvider;
  retryBaseDelayMs?: number;
  explicitUserId?: string;
}

export interface ExtractDocumentResult {
  cached: boolean;
  extractionRunId: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  claimsCreated: number;
  flaggedChunks: number;
  flaggedClaims: number;
}

export function computeExtractionInputChecksum(
  documentChecksum: string,
  chunks: Array<{ id: string; chunkIndex: number; content: string }>
): string {
  const hash = crypto.createHash("sha256");
  hash.update(documentChecksum);
  for (const c of chunks) {
    hash.update(`|${c.id}:${c.chunkIndex}:${c.content}`);
  }
  return hash.digest("hex");
}

export function formatChunkSourceLocation(chunk: {
  pageNumber: number | null;
  sectionTitle: string | null;
  rowStart: number | null;
  rowEnd: number | null;
}): string {
  const parts: string[] = [];
  if (chunk.pageNumber !== null && chunk.pageNumber !== undefined) {
    parts.push(`page ${chunk.pageNumber}`);
  }
  if (chunk.sectionTitle) {
    parts.push(`section ${chunk.sectionTitle}`);
  }
  if (chunk.rowStart !== null && chunk.rowStart !== undefined) {
    if (chunk.rowEnd !== null && chunk.rowEnd !== undefined && chunk.rowEnd !== chunk.rowStart) {
      parts.push(`rows ${chunk.rowStart}-${chunk.rowEnd}`);
    } else {
      parts.push(`row ${chunk.rowStart}`);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "document excerpt";
}

function sanitizeAiError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "AI extraction failed.";
  return msg.replace(/AIza[0-9A-Za-z_-]+|AQ\.[0-9A-Za-z_.-]+/g, "[REDACTED]").slice(0, 500);
}

/**
 * Extracts validated candidate claim triples from a parsed document's chunks sequentially.
 * - Caches by (projectId, documentId, inputChecksum, promptVersion, model, schemaVersion).
 * - Never persists unvalidated JSON.
 * - Flags prompt-injection patterns while still safely processing real data.
 */
export async function extractDocumentClaimsService(
  projectId: string,
  documentId: string,
  opts: ExtractDocumentOptions = {}
): Promise<ExtractDocumentResult> {
  const { user } = await requireProjectAccess(
    projectId,
    "ai:run_extraction_verification",
    opts.explicitUserId
  );

  const document = await prisma.document.findFirst({
    where: { id: documentId, projectId, deletedAt: null },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
      },
    },
  });

  if (!document) {
    throw new AppError("NOT_FOUND", "Document not found.", 404);
  }

  if (
    document.processingStatus !== DocumentProcessingStatus.READY_FOR_AI &&
    document.processingStatus !== DocumentProcessingStatus.AI_COMPLETED &&
    document.processingStatus !== DocumentProcessingStatus.AI_PROCESSING_FAILED
  ) {
    throw new AppError(
      "BAD_REQUEST",
      `Document must finish text extraction and chunking before running AI extraction (current status: ${document.processingStatus}).`,
      400
    );
  }

  if (document.chunks.length === 0) {
    throw new AppError(
      "BAD_REQUEST",
      "Document has no extracted text chunks for AI claim extraction.",
      400
    );
  }

  const model = opts.model?.trim() || env.GEMINI_EXTRACTION_MODEL;
  const promptVersion = EXTRACTOR_PROMPT_VERSION;
  const schemaVersion = EXTRACTOR_SCHEMA_VERSION;
  const inputChecksum = computeExtractionInputChecksum(document.checksum, document.chunks);
  const llmProvider = opts.llmProvider ?? getDefaultLLMProvider();

  // 1. Check ExtractionRun cache cleanly before invoking LLM
  const cachedRun = await prisma.extractionRun.findFirst({
    where: {
      projectId,
      documentId: document.id,
      inputChecksum,
      promptVersion,
      schemaVersion,
      model,
      status: ExtractionRunStatus.COMPLETED,
    },
    orderBy: { finishedAt: "desc" },
  });

  if (cachedRun) {
    const recordedCacheRun = await prisma.extractionRun.create({
      data: {
        projectId,
        documentId: document.id,
        model,
        promptVersion,
        schemaVersion,
        inputChecksum,
        status: ExtractionRunStatus.CACHED,
        finishedAt: new Date(),
      },
    });

    if (document.processingStatus !== DocumentProcessingStatus.AI_COMPLETED) {
      await prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: DocumentProcessingStatus.AI_COMPLETED },
      });
    }

    return {
      cached: true,
      extractionRunId: recordedCacheRun.id,
      model,
      promptVersion,
      schemaVersion,
      claimsCreated: 0,
      flaggedChunks: document.chunks.filter((c) => c.injectionFlag).length,
      flaggedClaims: 0,
    };
  }

  // 2. Start new ExtractionRun and mark document AI_PROCESSING
  const run = await prisma.extractionRun.create({
    data: {
      projectId,
      documentId: document.id,
      model,
      promptVersion,
      schemaVersion,
      inputChecksum,
      status: ExtractionRunStatus.RUNNING,
    },
  });

  await prisma.document.update({
    where: { id: document.id },
    data: { processingStatus: DocumentProcessingStatus.AI_PROCESSING },
  });

  const systemInstruction = buildExtractorSystemInstruction();
  let claimsCreated = 0;
  let flaggedChunks = 0;
  let flaggedClaims = 0;

  try {
    // Process chunks sequentially so entity registry evolves deterministically across chunks
    for (const chunk of document.chunks) {
      const chunkInjection = detectPromptInjection(chunk.content);
      if (chunkInjection.flagged) {
        flaggedChunks++;
        await prisma.documentChunk.update({
          where: { id: chunk.id },
          data: { injectionFlag: true },
        });
      }

      const activeEntities = await prisma.entity.findMany({
        where: { projectId, mergedIntoId: null },
        include: { aliases: true },
        orderBy: { canonicalName: "asc" },
      });

      const registrySummary: PromptRegistryEntity[] = activeEntities.map((e) => ({
        id: e.id,
        canonicalName: e.canonicalName,
        type: e.type,
        aliases: e.aliases.map((a) => a.alias),
      }));

      const sourceLocation = formatChunkSourceLocation(chunk);

      // Call LLM with exponential backoff on transient/429 errors, then Zod validation + max 1 controlled schema retry
      const validatedClaims = await extractChunkWithControlledRetry({
        llmProvider,
        model,
        systemInstruction,
        chunkId: chunk.id,
        documentName: document.fileName,
        sourceLocation,
        chunkContent: chunk.content,
        registryEntities: registrySummary,
        retryBaseDelayMs: opts.retryBaseDelayMs ?? 1000,
      });

      if (validatedClaims.length > 0) {
        const chunkResult = await prisma.$transaction(async (tx) => {
          let createdHere = 0;
          let flaggedHere = 0;

          for (const candidate of validatedClaims) {
            const resolvedEntity = await resolveSubjectEntity(tx, {
              projectId,
              proposedEntityId: candidate.proposedSubjectEntityId,
              proposedName: candidate.proposedSubjectName,
              proposedType: candidate.proposedSubjectType,
            });

            const valueNormalized = normalizeClaimValue(
              candidate.attributeKey,
              candidate.valueRaw
            );

            const claimInjection = detectPromptInjection(
              `${candidate.valueRaw} ${candidate.excerpt}`
            );
            const isInjectionFlagged = chunkInjection.flagged || claimInjection.flagged;
            if (isInjectionFlagged) flaggedHere++;

            await tx.claim.create({
              data: {
                projectId,
                subjectEntityId: resolvedEntity.entityId,
                attributeKey: candidate.attributeKey,
                valueRaw: candidate.valueRaw.trim(),
                valueNormalized,
                category: candidate.category,
                reviewState: ReviewState.PENDING,
                version: 1,
                extractionRunId: run.id,
                injectionFlag: isInjectionFlagged,
                confidence:
                  typeof candidate.confidence === "number" ? candidate.confidence : null,
                evidence: {
                  create: {
                    documentId: document.id,
                    chunkId: chunk.id,
                    sourceLocation,
                    excerpt: candidate.excerpt.trim(),
                    evidenceType: candidate.evidenceType,
                  },
                },
              },
            });

            createdHere++;
          }

          return { createdHere, flaggedHere };
        }, { maxWait: 30000, timeout: 60000 });

        claimsCreated += chunkResult.createdHere;
        flaggedClaims += chunkResult.flaggedHere;
      }
    }

    await prisma.$transaction([
      prisma.extractionRun.update({
        where: { id: run.id },
        data: {
          status: ExtractionRunStatus.COMPLETED,
          finishedAt: new Date(),
        },
      }),
      prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: DocumentProcessingStatus.AI_COMPLETED },
      }),
    ]);

    await writeAudit({
      projectId,
      userId: user.id,
      action: "EXTRACTION_COMPLETED",
      entityType: "DOCUMENT",
      entityId: document.id,
      metadata: {
        extractionRunId: run.id,
        model,
        promptVersion,
        schemaVersion,
        claimsCreated,
        flaggedChunks,
        flaggedClaims,
      },
    });

    return {
      cached: false,
      extractionRunId: run.id,
      model,
      promptVersion,
      schemaVersion,
      claimsCreated,
      flaggedChunks,
      flaggedClaims,
    };
  } catch (err: unknown) {
    const safeMessage = sanitizeAiError(err);

    await prisma.$transaction([
      prisma.extractionRun.update({
        where: { id: run.id },
        data: {
          status: ExtractionRunStatus.FAILED,
          finishedAt: new Date(),
          error: safeMessage,
        },
      }),
      prisma.document.update({
        where: { id: document.id },
        data: { processingStatus: DocumentProcessingStatus.AI_PROCESSING_FAILED },
      }),
    ]);

    await writeAudit({
      projectId,
      userId: user.id,
      action: "EXTRACTION_FAILED",
      entityType: "DOCUMENT",
      entityId: document.id,
      metadata: {
        extractionRunId: run.id,
        model,
        error: safeMessage,
      },
    });

    throw new AppError("BAD_REQUEST", `AI claim extraction failed: ${safeMessage}`, 400);
  }
}

async function extractChunkWithControlledRetry(params: {
  llmProvider: LLMProvider;
  model: string;
  systemInstruction: string;
  chunkId: string;
  documentName: string;
  sourceLocation: string;
  chunkContent: string;
  registryEntities: PromptRegistryEntity[];
  retryBaseDelayMs: number;
}): Promise<ExtractedClaimCandidate[]> {
  let retryFeedback: string | undefined = undefined;

  // Initial attempt + maximum 1 controlled schema/grounding retry
  for (let validationAttempt = 0; validationAttempt < 2; validationAttempt++) {
    const userPrompt = buildExtractorUserPrompt({
      chunkId: params.chunkId,
      documentName: params.documentName,
      sourceLocation: params.sourceLocation,
      content: params.chunkContent,
      registryEntities: params.registryEntities,
      retryFeedback,
    });

    const response = await executeWithRetryBackoff(
      () =>
        params.llmProvider.generateStructuredText({
          model: params.model,
          systemInstruction: params.systemInstruction,
          userPrompt,
          temperature: 0,
          responseJsonSchema: EXTRACTION_RESPONSE_JSON_SCHEMA,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: params.retryBaseDelayMs,
      }
    );

    const validation = parseAndValidateExtractionResponse(
      response.text,
      params.chunkId,
      params.chunkContent
    );

    if (validation.ok) {
      return validation.data.claims;
    }

    retryFeedback = validation.errorSummary;
  }

  throw new Error(
    `Model response failed server validation after controlled retry: ${retryFeedback}`
  );
}
