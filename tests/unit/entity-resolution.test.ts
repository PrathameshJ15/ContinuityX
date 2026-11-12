// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EntityCreator, EntityType, ProjectRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  normalizeEntityKey,
  computeEntitySimilarity,
  isAmbiguousPersonMention,
  resolveSubjectEntity,
} from "@/services/entities/resolution";
import { mergeEntitiesService, updateEntityService, createManualEntityService } from "@/services/entities";
import { createEntitySchema } from "@/services/entities/schema";
import { AppError } from "@/lib/api-response";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: { findUnique: vi.fn() },
    projectMember: { findUnique: vi.fn() },
    entity: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), findUniqueOrThrow: vi.fn(), create: vi.fn() },
    entityAlias: { findFirst: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn(), create: vi.fn(), upsert: vi.fn() },
    claim: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Phase 3 Entity Resolution, Ambiguity Guard & Reviewer Merging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves Authentication Module, Auth module, and login service consistently", async () => {
    expect(normalizeEntityKey("AuthService")).toBe("auth service");
    expect(computeEntitySimilarity("Authentication Module", "Auth module")).toBeGreaterThanOrEqual(0.86);
    expect(computeEntitySimilarity("Authentication Module", "login service")).toBeGreaterThanOrEqual(0.86);

    const upsertedAliases: string[] = [];
    const mockDb = {
      entity: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "ent-auth",
            canonicalName: "Authentication Module",
            normalizedId: "authentication module",
            type: EntityType.COMPONENT,
            mergedIntoId: null,
            needsReview: false,
            aliases: [
              { id: "al-1", alias: "Authentication Module", normalizedAlias: "authentication module" },
            ],
          },
        ]),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      entityAlias: {
        upsert: vi.fn().mockImplementation(async ({ create }) => {
          upsertedAliases.push(create.alias);
          return create;
        }),
      },
    };

    const r1 = await resolveSubjectEntity(mockDb as never, {
      projectId: "proj-1",
      proposedEntityId: "NEW",
      proposedName: "Auth module",
      proposedType: EntityType.COMPONENT,
    });
    expect(r1.entityId).toBe("ent-auth");
    expect(r1.createdNew).toBe(false);
    expect(r1.resolutionMethod).toBe("FUZZY_MATCH");

    const r2 = await resolveSubjectEntity(mockDb as never, {
      projectId: "proj-1",
      proposedEntityId: "NEW",
      proposedName: "login service",
      proposedType: EntityType.COMPONENT,
    });
    expect(r2.entityId).toBe("ent-auth");
    expect(r2.createdNew).toBe(false);
    expect(upsertedAliases).toEqual(["Auth module", "login service"]);
  });

  it("flags same-first-name PERSON ambiguity (Arjun vs Arjun Mehta & Arjun Verma) without merging", async () => {
    const registry = [
      {
        id: "ent-arjun-m",
        canonicalName: "Arjun Mehta",
        normalizedId: "arjun mehta",
        type: EntityType.PERSON,
        mergedIntoId: null,
        needsReview: false,
        aliases: [],
      },
      {
        id: "ent-arjun-v",
        canonicalName: "Arjun Verma",
        normalizedId: "arjun verma",
        type: EntityType.PERSON,
        mergedIntoId: null,
        needsReview: false,
        aliases: [],
      },
    ];

    expect(isAmbiguousPersonMention("Arjun", EntityType.PERSON, registry)).toBe(true);
    expect(isAmbiguousPersonMention("Arjun Mehta", EntityType.PERSON, registry)).toBe(false);

    const mockDb = {
      entity: {
        findMany: vi.fn().mockResolvedValue(registry),
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue({
          id: "ent-arjun-ambig",
          canonicalName: "Arjun",
          needsReview: true,
        }),
      },
      entityAlias: { upsert: vi.fn() },
    };

    const res = await resolveSubjectEntity(mockDb as never, {
      projectId: "proj-1",
      proposedEntityId: "ent-arjun-m", // even if model guessed one, single-token same-first-name guard stops silent merge
      proposedName: "Arjun",
      proposedType: EntityType.PERSON,
    });

    expect(res.entityId).toBe("ent-arjun-ambig");
    expect(res.createdNew).toBe(true);
    expect(res.needsReview).toBe(true);
    expect(res.resolutionMethod).toBe("AMBIGUOUS_PERSON");
  });

  it("ignores invalid or cross-project model-proposed entity IDs safely", async () => {
    const mockDb = {
      entity: {
        findMany: vi.fn().mockResolvedValue([]),
        // Returns null because proposed ID belongs to another project
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: "ent-new-1",
          canonicalName: "RFID Gateway",
          needsReview: false,
        }),
      },
      entityAlias: { upsert: vi.fn() },
    };

    const res = await resolveSubjectEntity(mockDb as never, {
      projectId: "proj-1",
      proposedEntityId: "cross_project_secret_id",
      proposedName: "RFID Gateway",
      proposedType: EntityType.COMPONENT,
    });

    expect(res.entityId).toBe("ent-new-1");
    expect(res.createdNew).toBe(true);
    expect(res.resolutionMethod).toBe("NEW_ENTITY");
  });

  it("supports reviewer soft merge and alias editing with audit log entries", async () => {
    const { prisma } = await import("@/lib/db");
    const { getCurrentUser } = await import("@/lib/auth");

    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "rev-1",
      email: "rev@example.com",
      name: "Reviewer",
    });
    vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
      id: "pm-1",
      projectId: "proj-1",
      userId: "rev-1",
      role: ProjectRole.REVIEWER,
      joinedAt: new Date(),
      project: { id: "proj-1", status: "ACTIVE" },
    } as never);

    vi.mocked(prisma.entity.findFirst)
      .mockResolvedValueOnce({
        id: "ent-src",
        projectId: "proj-1",
        canonicalName: "AuthService",
        normalizedId: "auth service",
        type: EntityType.COMPONENT,
        mergedIntoId: null,
        aliases: [{ id: "a1", alias: "AuthService", normalizedAlias: "auth service" }],
      } as never)
      .mockResolvedValueOnce({
        id: "ent-tgt",
        projectId: "proj-1",
        canonicalName: "Authentication Module",
        normalizedId: "authentication module",
        type: EntityType.COMPONENT,
        createdBy: EntityCreator.MODEL,
        mergedIntoId: null,
        aliases: [{ id: "a2", alias: "Authentication Module", normalizedAlias: "authentication module" }],
      } as never);

    const movedClaimUpdates: unknown[] = [];
    const createdTargetAliases: string[] = [];
    const updatedEntities: Array<{ id: string; mergedIntoId?: string }> = [];

    vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({
          claim: {
            updateMany: async (payload: unknown) => {
              movedClaimUpdates.push(payload);
              return { count: 2 };
            },
          },
          entityAlias: {
            create: async ({ data }: { data: { alias: string } }) => {
              createdTargetAliases.push(data.alias);
              return data;
            },
          },
          entity: {
            update: async ({ where, data }: { where: { id: string }; data: { mergedIntoId?: string } }) => {
              updatedEntities.push({ id: where.id, mergedIntoId: data.mergedIntoId });
              return {};
            },
          },
        });
      }
      return [];
    });

    const mergeRes = await mergeEntitiesService("proj-1", "ent-src", "ent-tgt");
    expect(mergeRes).toEqual({
      merged: true,
      sourceEntityId: "ent-src",
      targetEntityId: "ent-tgt",
    });
    expect(movedClaimUpdates).toHaveLength(1);
    expect(createdTargetAliases).toContain("AuthService");
    expect(updatedEntities.some((u) => u.id === "ent-src" && u.mergedIntoId === "ent-tgt")).toBe(true);
    expect(prisma.auditLog.create).toHaveBeenCalled();

    // Verify alias edit clearing needsReview
    vi.mocked(prisma.entity.findFirst).mockResolvedValueOnce({
      id: "ent-tgt",
      projectId: "proj-1",
      canonicalName: "Authentication Module",
      normalizedId: "authentication module",
      mergedIntoId: null,
      aliases: [],
    } as never);
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (arg: unknown) => {
      if (typeof arg === "function") {
        return arg({
          entity: {
            update: async () => ({}),
            findUniqueOrThrow: async () => ({
              id: "ent-tgt",
              canonicalName: "Authentication Module",
              needsReview: false,
              aliases: [
                { id: "x1", alias: "Authentication Module", normalizedAlias: "authentication module" },
                { id: "x2", alias: "SSO Core", normalizedAlias: "sso core" },
              ],
            }),
          },
          entityAlias: {
            deleteMany: async () => ({ count: 0 }),
            createMany: async () => ({ count: 2 }),
          },
        });
      }
      return null;
    });

    const edited = await updateEntityService("proj-1", "ent-tgt", {
      aliases: ["SSO Core"],
      needsReview: false,
    });
    expect(edited.needsReview).toBe(false);
    expect(edited.aliases.map((a) => a.alias)).toContain("SSO Core");
  });

  describe("Entity Creation Validation (Item 4)", () => {
    it("rejects purely numeric names like '12345678' via Zod schema", () => {
      const result = createEntitySchema.safeParse({
        canonicalName: "12345678",
        type: EntityType.SYSTEM,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("must contain at least one letter");
      }
    });

    it("rejects names shorter than 2 characters via Zod schema ('a')", () => {
      const result = createEntitySchema.safeParse({
        canonicalName: "a",
        type: EntityType.COMPONENT,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 2 characters");
      }
    });

    it("rejects whitespace-only names via Zod schema", () => {
      const result = createEntitySchema.safeParse({
        canonicalName: "    ",
        type: EntityType.COMPONENT,
      });
      expect(result.success).toBe(false);
    });

    it("rejects HTML tags / non-plain-text via Zod schema", () => {
      const result = createEntitySchema.safeParse({
        canonicalName: "<script>alert(1)</script>",
        type: EntityType.COMPONENT,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("plain text");
      }
    });

    it("accepts valid trimmed names and valid aliases", () => {
      const result = createEntitySchema.safeParse({
        canonicalName: "  Auth Module V2  ",
        type: EntityType.COMPONENT,
        aliases: ["Authentication", "Auth Service"],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.canonicalName).toBe("Auth Module V2");
        expect(result.data.aliases).toEqual(["Authentication", "Auth Service"]);
      }
    });

    it("rejects invalid aliases via Zod schema ('12345678', 'x', '<tag>')", () => {
      const numericAlias = createEntitySchema.safeParse({
        canonicalName: "Auth Engine",
        type: EntityType.COMPONENT,
        aliases: ["12345678"],
      });
      expect(numericAlias.success).toBe(false);

      const shortAlias = createEntitySchema.safeParse({
        canonicalName: "Auth Engine",
        type: EntityType.COMPONENT,
        aliases: ["x"],
      });
      expect(shortAlias.success).toBe(false);
    });

    it("throws VALIDATION_ERROR in createManualEntityService for pure numeric names", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "u-1",
        name: "Alice",
        email: "alice@example.com",
      } as never);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
        id: "pm-1",
        projectId: "proj-1",
        userId: "u-1",
        role: ProjectRole.REVIEWER,
        project: { id: "proj-1", status: "ACTIVE" },
      } as never);

      await expect(
        createManualEntityService(
          "proj-1",
          { canonicalName: "12345678", type: EntityType.SYSTEM },
          "u-1"
        )
      ).rejects.toThrow(AppError);
    });

    it("throws CONFLICT in createManualEntityService when duplicate normalized name exists", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "u-1",
        name: "Alice",
        email: "alice@example.com",
      } as never);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
        id: "pm-1",
        projectId: "proj-1",
        userId: "u-1",
        role: ProjectRole.REVIEWER,
        project: { id: "proj-1", status: "ACTIVE" },
      } as never);

      vi.mocked(prisma.entity.findFirst).mockResolvedValue({
        id: "ent-auth",
        canonicalName: "Auth Engine",
        normalizedId: "auth engine",
        projectId: "proj-1",
      } as never);

      await expect(
        createManualEntityService(
          "proj-1",
          { canonicalName: "auth-engine", type: EntityType.COMPONENT },
          "u-1"
        )
      ).rejects.toThrow("already exists in this project");
    });

    it("throws VALIDATION_ERROR in createManualEntityService when duplicate alias is provided", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "u-1",
        name: "Alice",
        email: "alice@example.com",
      } as never);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
        id: "pm-1",
        projectId: "proj-1",
        userId: "u-1",
        role: ProjectRole.REVIEWER,
        project: { id: "proj-1", status: "ACTIVE" },
      } as never);
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.entityAlias.findFirst).mockResolvedValue(null);

      await expect(
        createManualEntityService(
          "proj-1",
          {
            canonicalName: "Database Layer",
            type: EntityType.COMPONENT,
            aliases: ["DB Core", "db-core"], // duplicates after normalization
          },
          "u-1"
        )
      ).rejects.toThrow("Duplicate normalized alias");
    });

    it("allows the same entity name in another project", async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: "u-1",
        name: "Alice",
        email: "alice@example.com",
      } as never);
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValue({
        id: "pm-2",
        projectId: "proj-2",
        userId: "u-1",
        role: ProjectRole.REVIEWER,
        project: { id: "proj-2", status: "ACTIVE" },
      } as never);

      // In proj-2, there is no collision
      vi.mocked(prisma.entity.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.entityAlias.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.entity.create).mockResolvedValue({
        id: "ent-proj2-auth",
        projectId: "proj-2",
        canonicalName: "Auth Engine",
        normalizedId: "auth engine",
        type: EntityType.COMPONENT,
        createdBy: EntityCreator.REVIEWER,
        needsReview: false,
        aliases: [{ id: "al-1", alias: "Auth Engine", normalizedAlias: "auth engine" }],
      } as never);

      const created = await createManualEntityService(
        "proj-2",
        { canonicalName: "Auth Engine", type: EntityType.COMPONENT },
        "u-1"
      );

      expect(created.id).toBe("ent-proj2-auth");
      expect(created.projectId).toBe("proj-2");
      expect(prisma.entity.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: "proj-2", normalizedId: "auth engine" },
        })
      );
    });
  });
});
