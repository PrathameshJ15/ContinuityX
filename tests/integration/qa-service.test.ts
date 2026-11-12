// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  askHandoverQuestionService,
  FIXED_REFUSAL_MESSAGE,
} from "@/services/intelligence/qa";
import { ProjectNotFoundError } from "@/lib/api-response";
import { GeminiLLMProvider } from "@/lib/ai/gemini-provider";

vi.mock("@/lib/db", () => ({
  prisma: {
    claim: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/audit", () => ({
  writeAudit: vi.fn().mockResolvedValue({ id: "audit-qa" }),
}));

describe("Phase 8 Handover Q&A Service Integration", () => {
  const viewerUser = { id: "u-view", email: "viewer@example.com", name: "Alice Viewer" };
  const nonMemberUser = { id: "u-stranger", email: "stranger@example.com", name: "Stranger" };

  const makeMembership = (userId: string, role: ProjectRole) =>
    ({
      id: `pm-${role.toLowerCase()}`,
      projectId: "proj-1",
      userId,
      role,
      joinedAt: new Date(),
      project: { id: "proj-1", name: "ContinuityX", status: "ACTIVE" },
    }) as never;

  let mockLLMProvider: GeminiLLMProvider;

  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.user.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.id === viewerUser.id) return viewerUser;
      if (where.id === nonMemberUser.id) return nonMemberUser;
      return null;
    });

    (prisma.projectMember.findUnique as any).mockImplementation(async ({ where }: any) => {
      if (where.projectId_userId?.userId === viewerUser.id) {
        return makeMembership(viewerUser.id, "VIEWER");
      }
      return null;
    });

    mockLLMProvider = {
      generateStructuredText: vi.fn(),
    } as unknown as GeminiLLMProvider;
  });

  it("1. returns fixed refusal and does NOT call model when no matching claims are retrieved", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);

    const response = await askHandoverQuestionService(
      {
        projectId: "proj-1",
        question: "What is the database used for session storage?",
        userId: viewerUser.id,
      },
      mockLLMProvider
    );

    expect(response.answer).toBe(FIXED_REFUSAL_MESSAGE);
    expect(response.supported).toBe(false);
    expect(response.modelCalled).toBe(false);
    expect(response.citations).toEqual([]);
    expect(mockLLMProvider.generateStructuredText).not.toHaveBeenCalled();
  });

  it("2. retrieves ONLY approved claims (ACCEPTED / EDITED) from the database", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);

    await askHandoverQuestionService(
      {
        projectId: "proj-1",
        question: "Who is the lead?",
        userId: viewerUser.id,
      },
      mockLLMProvider
    );

    expect(prisma.claim.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: "proj-1",
          reviewState: { in: ["ACCEPTED", "EDITED"] },
        }),
      })
    );
  });

  it("3. overrides response with refusal when model cites an unretrieved claim ID", async () => {
    const claim1 = {
      id: "claim-101",
      attributeKey: "owner",
      valueRaw: "Alice",
      valueNormalized: "Alice",
      subjectEntity: {
        canonicalName: "Auth Service",
        aliases: [{ alias: "Authentication" }],
      },
      verifications: [{ status: "VERIFIED" }],
      evidence: [
        {
          sourceLocation: "arch.md:12",
          excerpt: "Alice owns Auth Service",
          document: { id: "doc-1", fileName: "arch.md" },
        },
      ],
    };

    vi.mocked(prisma.claim.findMany).mockResolvedValue([claim1 as any]);

    // Model attempts hallucinated citation id 'claim-hallucinated-999'
    vi.mocked(mockLLMProvider.generateStructuredText).mockResolvedValue({
      text: JSON.stringify({
        answer: "Bob owns everything.",
        citedClaimIds: ["claim-hallucinated-999"],
        supported: true,
      }),
      model: "models/gemini-2.0-flash",
      usage: { promptTokens: 10, candidateTokens: 10, totalTokens: 20 },
    });

    const response = await askHandoverQuestionService(
      {
        projectId: "proj-1",
        question: "Who is the owner of Auth Service?",
        userId: viewerUser.id,
      },
      mockLLMProvider
    );

    expect(response.modelCalled).toBe(true);
    expect(response.supported).toBe(false);
    expect(response.answer).toBe(FIXED_REFUSAL_MESSAGE);
    expect(response.citations).toEqual([]);
  });

  it("4. returns refusal when model reports supported: false", async () => {
    const claim1 = {
      id: "claim-101",
      attributeKey: "owner",
      valueRaw: "Alice",
      valueNormalized: "Alice",
      subjectEntity: {
        canonicalName: "Auth Service",
        aliases: [],
      },
      verifications: [{ status: "VERIFIED" }],
      evidence: [],
    };

    vi.mocked(prisma.claim.findMany).mockResolvedValue([claim1 as any]);

    vi.mocked(mockLLMProvider.generateStructuredText).mockResolvedValue({
      text: JSON.stringify({
        answer: FIXED_REFUSAL_MESSAGE,
        citedClaimIds: [],
        supported: false,
      }),
      model: "models/gemini-2.0-flash",
      usage: { promptTokens: 10, candidateTokens: 10, totalTokens: 20 },
    });

    const response = await askHandoverQuestionService(
      {
        projectId: "proj-1",
        question: "Who owns Auth Service?",
        userId: viewerUser.id,
      },
      mockLLMProvider
    );

    expect(response.supported).toBe(false);
    expect(response.answer).toBe(FIXED_REFUSAL_MESSAGE);
  });

  it("5. successfully answers with verified citations when valid evidence exists", async () => {
    const claim1 = {
      id: "claim-101",
      attributeKey: "selected_technology",
      valueRaw: "PostgreSQL with Neon serverless",
      valueNormalized: "PostgreSQL",
      subjectEntity: {
        canonicalName: "Database Layer",
        aliases: [{ alias: "DB" }],
      },
      verifications: [{ status: "VERIFIED" }],
      evidence: [
        {
          sourceLocation: "db-spec.md:45",
          excerpt: "We selected PostgreSQL on Neon for ACID reliability",
          document: { id: "doc-1", fileName: "db-spec.md" },
        },
      ],
    };

    vi.mocked(prisma.claim.findMany).mockResolvedValue([claim1 as any]);

    vi.mocked(mockLLMProvider.generateStructuredText).mockResolvedValue({
      text: JSON.stringify({
        answer: "The Database Layer uses PostgreSQL with Neon serverless for ACID reliability.",
        citedClaimIds: ["claim-101"],
        supported: true,
      }),
      model: "models/gemini-2.0-flash",
      usage: { promptTokens: 10, candidateTokens: 10, totalTokens: 20 },
    });

    const response = await askHandoverQuestionService(
      {
        projectId: "proj-1",
        question: "Why did we select PostgreSQL for the Database Layer?",
        userId: viewerUser.id,
      },
      mockLLMProvider
    );

    expect(response.supported).toBe(true);
    expect(response.modelCalled).toBe(true);
    expect(response.answer).toContain("PostgreSQL with Neon serverless");
    expect(response.citations).toHaveLength(1);
    expect(response.citations[0]).toMatchObject({
      claimId: "claim-101",
      subject: "Database Layer",
      attribute: "selected_technology",
      value: "PostgreSQL with Neon serverless",
      evidenceStatus: "VERIFIED",
      documentName: "db-spec.md",
      location: "db-spec.md:45",
    });
  });

  it("6. permits VIEWER role to ask approved Q&A", async () => {
    vi.mocked(prisma.claim.findMany).mockResolvedValue([]);

    const res = await askHandoverQuestionService(
      {
        projectId: "proj-1",
        question: "What is this?",
        userId: viewerUser.id,
      },
      mockLLMProvider
    );

    expect(res).toBeDefined();
  });

  it("7. prevents non-member access by throwing ProjectNotFoundError (404 zero enumeration)", async () => {
    await expect(
      askHandoverQuestionService(
        {
          projectId: "proj-1",
          question: "Any secret data?",
          userId: nonMemberUser.id,
        },
        mockLLMProvider
      )
    ).rejects.toThrow(ProjectNotFoundError);
  });

  it("8. fails gracefully to fixed refusal when LLM provider exceeds timeout", async () => {
    const claim1 = {
      id: "claim-timeout-1",
      attributeKey: "owner",
      valueRaw: "Bob",
      valueNormalized: "Bob",
      subjectEntity: {
        canonicalName: "Billing Service",
        aliases: [],
      },
      verifications: [{ status: "VERIFIED" }],
      evidence: [],
    };

    vi.mocked(prisma.claim.findMany).mockResolvedValue([claim1 as any]);

    // Provider hangs longer than timeoutMs
    vi.mocked(mockLLMProvider.generateStructuredText).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 500))
    );

    const response = await askHandoverQuestionService(
      {
        projectId: "proj-1",
        question: "Who owns Billing Service?",
        userId: viewerUser.id,
        timeoutMs: 50, // 50ms short timeout
      },
      mockLLMProvider
    );

    expect(response.supported).toBe(false);
    expect(response.answer).toBe(FIXED_REFUSAL_MESSAGE);
    expect(response.modelCalled).toBe(true);
    expect(response.citations).toEqual([]);
  });
});
