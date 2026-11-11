import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createProjectService,
  changeMemberRoleService,
  removeMemberService,
} from "@/services/projects";
import { ProjectRole } from "@prisma/client";
import { AppError } from "@/lib/api-response";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    project: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    projectMember: {
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/permissions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/permissions")>();
  return {
    ...actual,
    requireUser: vi.fn().mockResolvedValue({
      id: "owner-user-1",
      email: "owner@example.com",
      name: "Owner 1",
    }),
    requireProjectAccess: vi.fn().mockResolvedValue({
      user: { id: "owner-user-1", email: "owner@example.com", name: "Owner 1" },
      projectId: "proj-1",
      role: "OWNER",
    }),
  };
});

describe("Projects Domain Service & Business Rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Last-OWNER Rule Enforcement", () => {
    it("refuses to demote the sole remaining OWNER of a project", async () => {
      const { prisma } = await import("@/lib/db");

      // Current member is an OWNER
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "mem-1",
        projectId: "proj-1",
        userId: "target-owner-id",
        role: ProjectRole.OWNER,
        joinedAt: new Date(),
      });

      // There is only 1 owner left in the project
      vi.mocked(prisma.projectMember.count).mockResolvedValueOnce(1);

      await expect(
        changeMemberRoleService("proj-1", "target-owner-id", ProjectRole.REVIEWER)
      ).rejects.toThrow("Cannot demote the last owner of a project");
    });

    it("allows demoting an OWNER if another OWNER exists", async () => {
      const { prisma } = await import("@/lib/db");

      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "mem-1",
        projectId: "proj-1",
        userId: "target-owner-id",
        role: ProjectRole.OWNER,
        joinedAt: new Date(),
      });

      // 2 owners exist
      vi.mocked(prisma.projectMember.count).mockResolvedValueOnce(2);
      vi.mocked(prisma.projectMember.update).mockResolvedValueOnce({
        id: "mem-1",
        projectId: "proj-1",
        userId: "target-owner-id",
        role: ProjectRole.REVIEWER,
        joinedAt: new Date(),
        user: { id: "target-owner-id", name: "Target", email: "target@example.com" },
      } as any);

      const updated = await changeMemberRoleService("proj-1", "target-owner-id", ProjectRole.REVIEWER);
      expect(updated.role).toBe(ProjectRole.REVIEWER);
    });

    it("refuses to remove the sole remaining OWNER of a project", async () => {
      const { prisma } = await import("@/lib/db");

      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "mem-1",
        projectId: "proj-1",
        userId: "target-owner-id",
        role: ProjectRole.OWNER,
        joinedAt: new Date(),
      });

      // Sole owner
      vi.mocked(prisma.projectMember.count).mockResolvedValueOnce(1);

      await expect(
        removeMemberService("proj-1", "target-owner-id")
      ).rejects.toThrow("Cannot remove the last owner of a project");
    });

    it("allows removing a member when they are not the last owner", async () => {
      const { prisma } = await import("@/lib/db");

      // Removing a REVIEWER
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "mem-2",
        projectId: "proj-1",
        userId: "reviewer-id",
        role: ProjectRole.REVIEWER,
        joinedAt: new Date(),
      });

      vi.mocked(prisma.projectMember.delete).mockResolvedValueOnce({} as any);

      const result = await removeMemberService("proj-1", "reviewer-id");
      expect(result.success).toBe(true);
      expect(prisma.projectMember.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("createProjectService Transaction", () => {
    it("atomically creates project and creates OWNER membership in transaction", async () => {
      const { prisma } = await import("@/lib/db");

      vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: any) => {
        const txMock = {
          project: {
            create: vi.fn().mockResolvedValue({
              id: "new-proj-id",
              name: "New Test Project",
              description: "Test description",
              createdBy: "owner-user-1",
              status: "ACTIVE",
              members: [
                {
                  id: "mem-new",
                  userId: "owner-user-1",
                  role: "OWNER",
                  user: { id: "owner-user-1", name: "Owner 1", email: "owner@example.com" },
                },
              ],
            }),
          },
        };
        return callback(txMock);
      });

      const project = await createProjectService({
        name: "New Test Project",
        description: "Test description",
      });

      expect(project.id).toBe("new-proj-id");
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
