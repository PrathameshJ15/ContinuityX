// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  LLMProvider,
  LLMProviderError,
  executeWithRetryBackoff,
} from "@/lib/ai/provider";
import { GroqLLMProvider } from "@/lib/ai/groq-provider";
import { runSemanticJudge } from "@/lib/ai/judge-caller";
import {
  parsePdfDocument,
  parseDocxDocument,
  parseCsvDocument,
} from "@/services/documents/parsers";
import { validateDocumentFile } from "@/services/documents/validation";
import { createStructureAwareChunks } from "@/services/documents/chunking";
import { extractDocumentClaimsService } from "@/services/extraction";
import { verifyClaimService } from "@/services/verification";
import {
  DocumentProcessingStatus,
  EntityType,
  ExtractionRunStatus,
  ProjectRole,
} from "@prisma/client";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    projectMember: { findUnique: vi.fn() },
    document: { findFirst: vi.fn(), update: vi.fn() },
    documentChunk: { update: vi.fn() },
    extractionRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    entity: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    entityAlias: { upsert: vi.fn(), create: vi.fn() },
    claim: { create: vi.fn(), count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
    verification: { create: vi.fn(), findMany: vi.fn() },
    conflict: { findFirst: vi.fn(), count: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Phase 8 Hermetic Reliability Test Suite (12 Core Acceptance Tests)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GROQ_API_KEY = "mock-groq-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // 1. Valid PDF extraction
  it("1. extracts text and generates structure-aware chunks from valid PDF", async () => {
    // Standard minimal single-page PDF binary
    const minimalPdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >> endobj
4 0 obj << /Length 53 >> stream
BT /F1 12 Tf 72 712 Td (PostgreSQL DB with 120ms latency) Tj ET
endstream endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer << /Root 1 0 R /Size 5 >>
startxref
318
%%EOF`;
    const buf = Buffer.from(minimalPdf);
    const parsed = await parsePdfDocument(buf);
    expect(parsed.pageCount).toBe(1);
    expect(parsed.segments.length).toBeGreaterThanOrEqual(1);

    const chunks = createStructureAwareChunks(parsed.segments);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].pageNumber).toBe(1);
  });

  // 2. Valid DOCX extraction
  it("2. extracts text and preserves headings from valid DOCX", async () => {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`
    );
    zip.file(
      "word/document.xml",
      `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Architecture Section</w:t></w:r></w:p><w:p><w:r><w:t>JWT Authentication with RSA-256 keys.</w:t></w:r></w:p></w:body></w:document>`
    );
    const buf = await zip.generateAsync({ type: "nodebuffer" });

    const parsed = await parseDocxDocument(buf);
    expect(parsed.segments.length).toBeGreaterThanOrEqual(1);
    expect(parsed.rawTextLength).toBeGreaterThan(0);
    const chunks = createStructureAwareChunks(parsed.segments);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  // 3. Valid CSV extraction
  it("3. extracts text preserving columns and row ranges from valid CSV", async () => {
    const csvContent = "Module,Status,Owner\nAuth,DONE,Alice\nBilling,BLOCKED,Bob";
    const buf = Buffer.from(csvContent, "utf-8");
    const parsed = await parseCsvDocument(buf);

    expect(parsed.segments.length).toBeGreaterThanOrEqual(1);
    expect(parsed.segments[0].rowStart).toBe(2);
    expect(parsed.segments[0].content).toContain("Columns: Module, Status, Owner");
    expect(parsed.segments[0].content).toContain("Auth | DONE | Alice");
  });

  // 4. Empty document rejection
  it("4. rejects empty documents at validation gate without invoking Groq API", async () => {
    const emptyBuf = Buffer.alloc(0);
    await expect(validateDocumentFile("empty.pdf", emptyBuf, "application/pdf")).rejects.toThrow();
  });

  // 5. Corrupted document rejection
  it("5. rejects corrupted document binaries with clean validation errors", async () => {
    const corruptedBuf = Buffer.from("NOT_A_REAL_PDF_OR_DOCX_STREAM_CORRUPT");
    await expect(validateDocumentFile("test.docx", corruptedBuf, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).rejects.toThrow();
  });

  // 6. Oversized document handling
  it("6. rejects oversized documents exceeding configured limits", async () => {
    // 11 MB buffer exceeds 10 MB default limit
    const oversizedBuf = Buffer.alloc(11 * 1024 * 1024, 0);
    await expect(validateDocumentFile("large.pdf", oversizedBuf, "application/pdf")).rejects.toThrow(
      /exceeds the maximum limit/i
    );
  });

  // 7. Simulated 429 rate limit with RetryInfo parsing & backoff
  it("7. parses RetryInfo.retryDelay and quotaLimit on HTTP 429 errors", async () => {
    process.env.GROQ_API_KEY = "dummy-key";
    let attempts = 0;

    global.fetch = vi.fn().mockImplementation(async () => {
      attempts++;
      return {
        ok: false,
        status: 429,
        headers: new Headers({ "retry-after": "1.5" }),
        json: async () => ({
          error: {
            code: "rate_limit_exceeded",
            message: "Rate limit reached for requests",
            type: "tokens",
          },
        }),
      } as unknown as Response;
    });

    const provider = new GroqLLMProvider();

    try {
      await provider.generateStructuredText({
        model: "openai/gpt-oss-120b",
        systemInstruction: "test",
        userPrompt: "test",
      });
      expect.fail("Should have thrown LLMProviderError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(LLMProviderError);
      const providerErr = err as LLMProviderError;
      expect(providerErr.statusCode).toBe(429);
      expect(providerErr.isRetryable).toBe(true);
      expect(providerErr.retryAfterMs).toBe(1500);
      expect(providerErr.quotaLimit).toBe("rate_limit");
    }
  });

  // 8. Simulated 503 high demand with backoff and recovery
  it("8. retries transient 503 Service Unavailable and recovers successfully", async () => {
    let callCount = 0;
    const sleeps: number[] = [];

    const mockOp = async (attempt: number) => {
      callCount++;
      if (attempt === 1) {
        throw new LLMProviderError("High demand spike", {
          statusCode: 503,
          isRetryable: true,
        });
      }
      return { success: true };
    };

    const res = await executeWithRetryBackoff(mockOp, {
      maxAttempts: 3,
      baseDelayMs: 10,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    expect(res.success).toBe(true);
    expect(callCount).toBe(2);
    expect(sleeps.length).toBe(1);
    expect(sleeps[0]).toBeGreaterThan(0);
  });

  // 9. Verification retry with transient judge recovery
  it("9. retries transient error during semantic judge evaluation", async () => {
    let attempts = 0;
    const mockProvider: LLMProvider = {
      name: "mock-judge",
      generateStructuredText: vi.fn().mockImplementation(async () => {
        attempts++;
        if (attempts === 1) {
          throw new LLMProviderError("Temporary 503 High Demand", {
            statusCode: 503,
            isRetryable: true,
          });
        }
        return {
          model: "groq-3.5-flash",
          text: JSON.stringify({
            outcome: "SUPPORTS",
            reason: "Excerpt confirms claim.",
          }),
        };
      }),
    };

    const res = await runSemanticJudge(
      {
        claim: {
          subject: "Auth Subsystem",
          attribute: "protocol",
          value: "OAuth2",
        },
        excerpt: "The Auth Subsystem employs OAuth2 protocol.",
      },
      mockProvider
    );

    expect(res.outcome).toBe("SUPPORTS");
    expect(attempts).toBe(2);
  });

  // 10. Duplicate extraction prevention on retry
  it("10. prevents duplicate claim creation when extraction is safely retried", async () => {
    const { prisma } = await import("@/lib/db");
    const { getCurrentUser } = await import("@/lib/auth");

    const reviewerUser = { id: "u-rev", email: "rev@example.com", name: "Reviewer" };
    vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      projectId: "proj-1",
      userId: reviewerUser.id,
      role: ProjectRole.REVIEWER,
      joinedAt: new Date(),
      project: { id: "proj-1", status: "ACTIVE" },
    } as never);

    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-dedup",
      projectId: "proj-1",
      fileName: "spec.pdf",
      checksum: "sha256-dedup",
      processingStatus: DocumentProcessingStatus.READY_FOR_AI,
      chunks: [
        {
          id: "chunk-dedup-1",
          chunkIndex: 0,
          content: "Database is PostgreSQL.",
          pageNumber: 1,
          sectionTitle: null,
          rowStart: null,
          rowEnd: null,
          injectionFlag: false,
        },
      ],
    } as never);

    vi.mocked(prisma.extractionRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.extractionRun.create).mockResolvedValue({ id: "run-dedup" } as never);
    vi.mocked(prisma.entity.findMany).mockResolvedValue([]);

    let claimCreateCalls = 0;
    vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === "function") {
        return arg({
          entity: {
            findMany: async () => [],
            findFirst: async () => null,
            create: async () => ({ id: "ent-db", canonicalName: "Database", needsReview: false }),
          },
          entityAlias: { upsert: async () => ({}) },
          claim: {
            // Simulate that claim already exists from prior run
            findFirst: async () => ({ id: "existing-claim-id" }),
            create: async () => {
              claimCreateCalls++;
              return { id: "cl-new" };
            },
          },
        });
      }
      return [];
    });

    const mockProvider: LLMProvider = {
      name: "mock",
      generateStructuredText: vi.fn().mockResolvedValue({
        model: "mock-model",
        text: JSON.stringify({
          claims: [
            {
              proposedSubjectEntityId: "NEW",
              proposedSubjectName: "Database",
              proposedSubjectType: EntityType.COMPONENT,
              attributeKey: "selected_technology",
              valueRaw: "PostgreSQL",
              category: "DECISION",
              chunkId: "chunk-dedup-1",
              sourceLocation: "page 1",
              excerpt: "Database is PostgreSQL.",
              evidenceType: "DIRECT_QUOTE",
              confidence: 0.95,
            },
          ],
        }),
      }),
    };

    const res = await extractDocumentClaimsService("proj-1", "doc-dedup", {
      llmProvider: mockProvider,
      retryBaseDelayMs: 0,
    });

    // Existing claim was detected, so 0 new duplicates were created
    expect(res.claimsCreated).toBe(0);
    expect(claimCreateCalls).toBe(0);
  });

  // 11. Database persistence of claims, evidence, and extraction runs
  it("11. persists claims, evidence relations, and completed extraction run cleanly", async () => {
    const { prisma } = await import("@/lib/db");
    const { getCurrentUser } = await import("@/lib/auth");

    const reviewerUser = { id: "u-rev", email: "rev@example.com", name: "Reviewer" };
    vi.mocked(getCurrentUser).mockResolvedValue(reviewerUser);
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      projectId: "proj-1",
      userId: reviewerUser.id,
      role: ProjectRole.REVIEWER,
      joinedAt: new Date(),
      project: { id: "proj-1", status: "ACTIVE" },
    } as never);

    vi.mocked(prisma.document.findFirst).mockResolvedValue({
      id: "doc-persist",
      projectId: "proj-1",
      fileName: "notes.txt",
      checksum: "sha256-persist",
      processingStatus: DocumentProcessingStatus.READY_FOR_AI,
      chunks: [
        {
          id: "chunk-persist-1",
          chunkIndex: 0,
          content: "System timeout is 30 seconds.",
          pageNumber: 1,
          sectionTitle: null,
          rowStart: null,
          rowEnd: null,
          injectionFlag: false,
        },
      ],
    } as never);

    vi.mocked(prisma.extractionRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.extractionRun.create).mockResolvedValue({ id: "run-persist-1" } as never);
    vi.mocked(prisma.entity.findMany).mockResolvedValue([]);

    const createdClaims: any[] = [];
    vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg);
      if (typeof arg === "function") {
        return arg({
          entity: {
            findMany: async () => [],
            findFirst: async () => null,
            create: async () => ({ id: "ent-sys", canonicalName: "System", needsReview: false }),
          },
          entityAlias: { upsert: async () => ({}) },
          claim: {
            findFirst: async () => null,
            create: async ({ data }: any) => {
              createdClaims.push(data);
              return { id: "cl-created", ...data };
            },
          },
        });
      }
      return [];
    });

    const mockProvider: LLMProvider = {
      name: "mock",
      generateStructuredText: vi.fn().mockResolvedValue({
        model: "mock-model",
        text: JSON.stringify({
          claims: [
            {
              proposedSubjectEntityId: "NEW",
              proposedSubjectName: "System",
              proposedSubjectType: EntityType.COMPONENT,
              attributeKey: "status",
              valueRaw: "ACTIVE",
              category: "TASK",
              chunkId: "chunk-persist-1",
              sourceLocation: "page 1",
              excerpt: "System timeout is 30 seconds.",
              evidenceType: "DIRECT_QUOTE",
              confidence: 0.99,
            },
          ],
        }),
      }),
    };

    const res = await extractDocumentClaimsService("proj-1", "doc-persist", {
      llmProvider: mockProvider,
      retryBaseDelayMs: 0,
    });

    expect(res.claimsCreated).toBe(1);
    expect(createdClaims).toHaveLength(1);
    expect(createdClaims[0].attributeKey).toBe("status");
    expect(createdClaims[0].valueRaw).toBe("ACTIVE");
    expect(createdClaims[0].evidence.create.chunkId).toBe("chunk-persist-1");
  });

  // 12. Groq structured JSON response and usage metadata parsing
  it("12. correctly parses Groq structured JSON response and usage metadata", async () => {
    process.env.GROQ_API_KEY = "dummy-key";

    global.fetch = vi.fn().mockImplementation(async () => {
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          id: "chatcmpl-test",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  status: "OK",
                  verified: true,
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: {
            prompt_tokens: 15,
            completion_tokens: 10,
            total_tokens: 25,
          },
        }),
      } as unknown as Response;
    });

    const provider = new GroqLLMProvider();
    const result = await provider.generateStructuredText({
      model: "openai/gpt-oss-120b",
      systemInstruction: "test instruction",
      userPrompt: "test prompt",
    });

    expect(result.model).toBe("openai/gpt-oss-120b");
    expect(JSON.parse(result.text)).toEqual({
      status: "OK",
      verified: true,
    });
    expect(result.usage?.totalTokens).toBe(25);
  });
});
