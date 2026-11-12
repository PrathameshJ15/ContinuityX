// @vitest-environment node
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import {
  DocumentProcessingStatus,
  ProcessingJobState,
  ProjectRole,
  SourceDateBasis,
  TextQuality,
} from "@prisma/client";
import {
  uploadDocumentService,
  processDocumentNextStepService,
  retryDocumentProcessingService,
  listDocumentsService,
  getDocumentService,
  softDeleteDocumentService,
} from "@/services/documents";
import { LocalStorageProvider } from "@/lib/storage";
import { computeSha256 } from "@/services/documents/validation";
import { AppError, ForbiddenError, ProjectNotFoundError } from "@/lib/api-response";

const tmpStorageDir = path.join(os.tmpdir(), `continuityx-doc-test-${Date.now()}`);
const testStorage = new LocalStorageProvider(tmpStorageDir);

vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    getStorageProvider: () => testStorage,
  };
});

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    projectMember: {
      findUnique: vi.fn(),
    },
    document: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    documentChunk: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    processingJob: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Phase 2 Document Service, State Machine & Authorization (Integration)", () => {
  const ownerUser = { id: "user-owner", email: "owner@example.com", name: "Owner" };
  const viewerUser = { id: "user-viewer", email: "viewer@example.com", name: "Viewer" };
  const outsiderUser = { id: "user-outsider", email: "outsider@example.com", name: "Outsider" };

  const makeMembership = (userId: string, role: ProjectRole) =>
    ({
      id: `pm-${role.toLowerCase()}`,
      projectId: "proj-1",
      userId,
      role,
      joinedAt: new Date(),
      project: { id: "proj-1", status: "ACTIVE" },
    }) as never;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await fs.rm(tmpStorageDir, { recursive: true, force: true });
  });

  describe("Role & Cross-Project Authorization", () => {
    it("blocks VIEWER from uploading, processing, retrying, or deleting documents", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(viewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(viewerUser.id, ProjectRole.VIEWER)
      );

      const csvBuf = Buffer.from("Task,Owner\nSetup,Arjun");
      await expect(
        uploadDocumentService({
          projectId: "proj-1",
          originalFileName: "tasks.csv",
          fileBuffer: csvBuf,
          reportedMimeType: "text/csv",
        })
      ).rejects.toThrow(ForbiddenError);

      await expect(processDocumentNextStepService("proj-1", "doc-1")).rejects.toThrow(
        ForbiddenError
      );
      await expect(retryDocumentProcessingService("proj-1", "doc-1")).rejects.toThrow(
        ForbiddenError
      );
      await expect(softDeleteDocumentService("proj-1", "doc-1")).rejects.toThrow(ForbiddenError);
    });

    it("allows VIEWER to list and inspect project documents", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(viewerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(viewerUser.id, ProjectRole.VIEWER)
      );

      vi.mocked(prisma.document.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.document.findMany).mockResolvedValueOnce([]);

      const listRes = await listDocumentsService("proj-1", 1, 10);
      expect(listRes.documents).toEqual([]);
      expect(listRes.pagination.total).toBe(0);

      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce(null);
      await expect(getDocumentService("proj-1", "missing-doc")).rejects.toThrow("Document not found");
    });

    it("returns uniform 404 for non-member guessing another project's ID", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(outsiderUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(null);

      await expect(listDocumentsService("other-proj")).rejects.toThrow(ProjectNotFoundError);
      await expect(getDocumentService("other-proj", "doc-1")).rejects.toThrow(ProjectNotFoundError);
      await expect(
        uploadDocumentService({
          projectId: "other-proj",
          originalFileName: "tasks.csv",
          fileBuffer: Buffer.from("a,b\n1,2"),
          reportedMimeType: "text/csv",
        })
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });

  describe("Upload Rules: Duplicate Checksum, Max Limit & Source Dates", () => {
    it("rejects duplicate upload with identical SHA-256 checksum inside the same project", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(ownerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(ownerUser.id, ProjectRole.OWNER)
      );
      vi.mocked(prisma.document.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce({
        id: "doc-existing",
        fileName: "tasks.csv",
      } as never);

      await expect(
        uploadDocumentService({
          projectId: "proj-1",
          originalFileName: "tasks_copy.csv",
          fileBuffer: Buffer.from("Task,Owner\nBuild API,Arjun\nWrite Tests,Riya"),
          reportedMimeType: "text/csv",
        })
      ).rejects.toThrow("already been uploaded as 'tasks.csv'");
    });

    it("blocks upload when project document limit is reached", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(ownerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(ownerUser.id, ProjectRole.OWNER)
      );
      vi.mocked(prisma.document.count).mockResolvedValueOnce(50);

      await expect(
        uploadDocumentService({
          projectId: "proj-1",
          originalFileName: "tasks.csv",
          fileBuffer: Buffer.from("Task,Owner\nBuild,Arjun"),
          reportedMimeType: "text/csv",
        })
      ).rejects.toThrow("Project document limit reached");
    });

    it("stores USER_PROVIDED date when given and UNKNOWN (null) when omitted (never guesses upload time)", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(ownerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(ownerUser.id, ProjectRole.OWNER)
      );

      const createdPayloads: Array<Record<string, unknown>> = [];
      vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => {
        if (typeof arg === "function") {
          return arg({
            document: {
              create: async ({ data }: { data: Record<string, unknown> }) => {
                createdPayloads.push(data);
                return { id: `doc-${createdPayloads.length}`, ...data };
              },
            },
            processingJob: {
              create: async () => ({ id: "job-1" }),
            },
          });
        }
        return [];
      });

      // 1. Without userProvidedDate -> UNKNOWN & null
      vi.mocked(prisma.document.count).mockResolvedValueOnce(0);
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce(null);
      const undated = await uploadDocumentService({
        projectId: "proj-1",
        originalFileName: "undated.csv",
        fileBuffer: Buffer.from("Task,Owner\nDocs,Riya"),
        reportedMimeType: "text/csv",
      });
      expect(undated.sourceDate).toBeNull();
      expect(undated.sourceDateBasis).toBe(SourceDateBasis.UNKNOWN);

      // 2. With userProvidedDate -> USER_PROVIDED
      vi.mocked(prisma.document.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce(null);
      const dated = await uploadDocumentService({
        projectId: "proj-1",
        originalFileName: "dated.csv",
        fileBuffer: Buffer.from("Task,Owner\nRelease,Arjun"),
        reportedMimeType: "text/csv",
        userProvidedDate: "2026-10-15",
      });
      expect(dated.sourceDateBasis).toBe(SourceDateBasis.USER_PROVIDED);
      expect(dated.sourceDate).toBeInstanceOf(Date);
    });
  });

  describe("Step-Wise State Machine, Lease Lock, Idempotency & Retry", () => {
    it("executes UPLOADED -> EXTRACTING -> CHUNKING -> READY_FOR_AI idempotently", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(ownerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(ownerUser.id, ProjectRole.OWNER)
      );

      const csvContent =
        "Task,Owner,Status\nDatabase Migration,Arjun,COMPLETED\nAPI Rate Limiter,Riya,IN_PROGRESS\n" +
        "Observability Dashboards,Vikram,BLOCKED\nSecurity Review,Priya,NOT_STARTED";
      const buf = Buffer.from(csvContent, "utf8");
      const storageKey = "proj-1/step-test.csv";
      await testStorage.put(storageKey, buf, "text/csv");

      let currentStatus: DocumentProcessingStatus = DocumentProcessingStatus.UPLOADED;
      let currentPageCount: number | null = null;
      let currentTextQuality: TextQuality | null = null;
      let currentStepData: unknown = null;
      let savedChunks: Array<{ chunkIndex: number; content: string }> = [];

      vi.mocked(prisma.document.findFirst).mockImplementation((async () => ({
        id: "doc-step-1",
        projectId: "proj-1",
        fileName: "tasks.csv",
        mimeType: "text/csv",
        storageKey,
        fileSize: buf.length,
        checksum: computeSha256(buf),
        pageCount: currentPageCount,
        textQuality: currentTextQuality,
        processingStatus: currentStatus,
        processingJobs: [
          {
            id: "job-step-1",
            documentId: "doc-step-1",
            state: ProcessingJobState.PENDING,
            attempts: 0,
            lastError: null,
            stepData: currentStepData,
            leaseExpiresAt: null,
            createdAt: new Date(),
          },
        ],
      })) as never);

      vi.mocked(prisma.processingJob.update).mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
        if ("stepData" in data) currentStepData = data.stepData;
        return {};
      }) as never);
      vi.mocked(prisma.document.update).mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
        if (data.processingStatus) currentStatus = data.processingStatus as DocumentProcessingStatus;
        if (typeof data.pageCount === "number") currentPageCount = data.pageCount;
        if (data.textQuality) currentTextQuality = data.textQuality as TextQuality;
        return {};
      }) as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => {
        if (Array.isArray(arg)) {
          return Promise.all(arg);
        }
        if (typeof arg === "function") {
          return arg({
            documentChunk: {
              deleteMany: async () => {
                savedChunks = [];
                return { count: 0 };
              },
              createMany: async ({ data }: { data: Array<{ chunkIndex: number; content: string }> }) => {
                savedChunks.push(...data);
                return { count: data.length };
              },
            },
            document: prisma.document,
            processingJob: prisma.processingJob,
          });
        }
        return [];
      });

      // Step 1: UPLOADED -> EXTRACTING
      const s1 = await processDocumentNextStepService("proj-1", "doc-step-1");
      expect(s1.status).toBe(DocumentProcessingStatus.EXTRACTING);

      // Step 2: EXTRACTING -> CHUNKING
      const s2 = await processDocumentNextStepService("proj-1", "doc-step-1");
      expect(s2.status).toBe(DocumentProcessingStatus.CHUNKING);
      expect(currentPageCount).toBe(1);

      // Step 3: CHUNKING -> READY_FOR_AI
      const s3 = await processDocumentNextStepService("proj-1", "doc-step-1");
      expect(s3.status).toBe(DocumentProcessingStatus.READY_FOR_AI);
      expect(savedChunks.length).toBeGreaterThanOrEqual(1);
      const chunkCountAfterRun1 = savedChunks.length;

      // Re-running CHUNKING clears prior chunks before creating (zero duplicates)
      currentStatus = DocumentProcessingStatus.CHUNKING;
      await processDocumentNextStepService("proj-1", "doc-step-1");
      expect(savedChunks.length).toBe(chunkCountAfterRun1);

      // Running when READY_FOR_AI returns completed cleanly
      const s4 = await processDocumentNextStepService("proj-1", "doc-step-1");
      expect(s4.status).toBe(DocumentProcessingStatus.READY_FOR_AI);
      expect(s4.state).toBe(ProcessingJobState.COMPLETED);
    });

    it("skips execution when another worker holds an active lease lock", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(ownerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(ownerUser.id, ProjectRole.OWNER)
      );

      vi.mocked(prisma.document.findFirst).mockResolvedValueOnce({
        id: "doc-leased",
        projectId: "proj-1",
        processingStatus: DocumentProcessingStatus.EXTRACTING,
        processingJobs: [
          {
            id: "job-leased",
            state: ProcessingJobState.RUNNING,
            leaseExpiresAt: new Date(Date.now() + 20_000),
          },
        ],
      } as never);

      const res = await processDocumentNextStepService("proj-1", "doc-leased");
      expect(res.state).toBe("LEASED");
      expect(prisma.processingJob.update).not.toHaveBeenCalled();
    });

    it("records VALIDATION_FAILED on checksum mismatch and resets state on retry", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue(ownerUser);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue(
        makeMembership(ownerUser.id, ProjectRole.OWNER)
      );

      const storageKey = "proj-1/tampered.csv";
      await testStorage.put(storageKey, Buffer.from("Task,Owner\nTampered,Bob"), "text/csv");

      let status: DocumentProcessingStatus = DocumentProcessingStatus.UPLOADED;
      let jobState: ProcessingJobState = ProcessingJobState.PENDING;

      vi.mocked(prisma.document.findFirst).mockImplementation((async () => ({
        id: "doc-bad",
        projectId: "proj-1",
        fileName: "tampered.csv",
        mimeType: "text/csv",
        storageKey,
        checksum: "0000000000000000000000000000000000000000000000000000000000000000",
        processingStatus: status,
        processingJobs: [
          {
            id: "job-bad",
            state: jobState,
            leaseExpiresAt: null,
            lastError: null,
          },
        ],
      })) as never);

      vi.mocked(prisma.document.update).mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
        if (data.processingStatus) status = data.processingStatus as DocumentProcessingStatus;
        return {};
      }) as never);
      vi.mocked(prisma.processingJob.update).mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
        if (data.state) jobState = data.state as ProcessingJobState;
        return {};
      }) as never);
      vi.mocked(prisma.processingJob.updateMany).mockImplementation((async ({ data }: { data: Record<string, unknown> }) => {
        if (data.state) jobState = data.state as ProcessingJobState;
        return { count: 1 };
      }) as never);
      vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg);
        return [];
      });

      await expect(processDocumentNextStepService("proj-1", "doc-bad")).rejects.toThrow(AppError);
      expect(status).toBe(DocumentProcessingStatus.VALIDATION_FAILED);
      expect(jobState).toBe(ProcessingJobState.FAILED);

      await retryDocumentProcessingService("proj-1", "doc-bad");
      expect(status).toBe(DocumentProcessingStatus.UPLOADED);
      expect(jobState).toBe(ProcessingJobState.PENDING);
    });
  });
});
