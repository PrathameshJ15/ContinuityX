// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createProjectService,
  getProjectService,
  updateProjectService,
  archiveProjectService,
  listMyProjectsService,
  addMemberService,
  changeMemberRoleService,
  removeMemberService,
} from "@/services/projects";
import { requireProjectAccess } from "@/lib/permissions";
import { ProjectNotFoundError, ForbiddenError, UnauthorizedError } from "@/lib/api-response";
import { ProjectRole, ProjectStatus } from "@prisma/client";

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
      count: vi.fn(),
    },
    projectMember: {
      findMany: vi.fn(),
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

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(),
}));

describe("Phase 1 Project Isolation & Role Security (Integration Tests)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Cross-Project Access Prevention (ID Guessing Attack)", () => {
    it("User B guessing Project A's ID receives 404 (same as non-existent project)", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      // User B is signed in
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-b",
        email: "user-b@example.com",
        name: "User B",
      });

      // User B has NO membership in Project A
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce(null);

      await expect(getProjectService("project-a-id")).rejects.toThrow(ProjectNotFoundError);
      await expect(
        updateProjectService("project-a-id", { name: "Hacked Name" })
      ).rejects.toThrow(ProjectNotFoundError);
      await expect(archiveProjectService("project-a-id")).rejects.toThrow(ProjectNotFoundError);
      await expect(
        addMemberService("project-a-id", { email: "attacker@example.com", role: "OWNER" })
      ).rejects.toThrow(ProjectNotFoundError);
    });

    it("User B listing projects only sees projects where User B is a member", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-b",
        email: "user-b@example.com",
        name: "User B",
      });

      vi.mocked(prisma.project.count).mockResolvedValueOnce(1);
      vi.mocked(prisma.projectMember.findMany).mockResolvedValueOnce([
        {
          id: "mem-b1",
          projectId: "proj-b",
          userId: "user-b",
          role: ProjectRole.OWNER,
          joinedAt: new Date(),
          project: {
            id: "proj-b",
            name: "User B's Own Project",
            description: null,
            status: ProjectStatus.ACTIVE,
            createdAt: new Date(),
            updatedAt: new Date(),
            _count: { members: 1 },
          },
        } as any,
      ]);

      const result = await listMyProjectsService(1, 10);
      expect(result.projects.length).toBe(1);
      expect(result.projects[0].name).toBe("User B's Own Project");
      // Prisma query specifically filtered by userId: "user-b"
      expect(prisma.projectMember.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "user-b" },
        })
      );
    });
  });

  describe("Role Enforcement & Privilege Escalation Prevention", () => {
    it("VIEWER cannot update project details (receives 403 Forbidden)", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-viewer",
        email: "viewer@example.com",
        name: "Viewer",
      });

      // User has VIEWER role
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "mem-v",
        projectId: "proj-1",
        userId: "user-viewer",
        role: ProjectRole.VIEWER,
        joinedAt: new Date(),
        project: { id: "proj-1", status: ProjectStatus.ACTIVE },
      } as any);

      await expect(
        updateProjectService("proj-1", { name: "Unauthorized Rename" })
      ).rejects.toThrow(ForbiddenError);
    });

    it("REVIEWER cannot archive a project (receives 403 Forbidden)", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-reviewer",
        email: "reviewer@example.com",
        name: "Reviewer",
      });

      // User has REVIEWER role
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "mem-r",
        projectId: "proj-1",
        userId: "user-reviewer",
        role: ProjectRole.REVIEWER,
        joinedAt: new Date(),
        project: { id: "proj-1", status: ProjectStatus.ACTIVE },
      } as any);

      await expect(archiveProjectService("proj-1")).rejects.toThrow(ForbiddenError);
    });

    it("Role changes take effect immediately on next query", async () => {
      const { prisma } = await import("@/lib/db");
      const { getCurrentUser } = await import("@/lib/auth");

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "user-target",
        email: "target@example.com",
        name: "Target User",
      });

      // First query: user is VIEWER -> cannot update
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "mem-t",
        projectId: "proj-1",
        userId: "user-target",
        role: ProjectRole.VIEWER,
        joinedAt: new Date(),
        project: { id: "proj-1", status: ProjectStatus.ACTIVE },
      } as any);

      await expect(requireProjectAccess("proj-1", "project:update")).rejects.toThrow(
        ForbiddenError
      );

      // Second query after promotion to OWNER: can update immediately
      vi.mocked(prisma.projectMember.findUnique).mockResolvedValueOnce({
        id: "mem-t",
        projectId: "proj-1",
        userId: "user-target",
        role: ProjectRole.OWNER,
        joinedAt: new Date(),
        project: { id: "proj-1", status: ProjectStatus.ACTIVE },
      } as any);

      const ctx = await requireProjectAccess("proj-1", "project:update");
      expect(ctx.role).toBe(ProjectRole.OWNER);
    });
  });

  describe("Unauthenticated Access Protection", () => {
    it("Unauthenticated request throws 401 Unauthorized", async () => {
      const { getCurrentUser } = await import("@/lib/auth");
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      await expect(listMyProjectsService()).rejects.toThrow(UnauthorizedError);
      await expect(createProjectService({ name: "Rogue Project" })).rejects.toThrow(
        UnauthorizedError
      );
    });
  });
});
