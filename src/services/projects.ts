import { z } from "zod";
import { prisma } from "@/lib/db";
import { ProjectRole, ProjectStatus } from "@prisma/client";
import { requireUser, requireProjectAccess } from "@/lib/permissions";
import { AppError } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(100),
  description: z.string().trim().max(1000).optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().trim().min(2, "Project name must be at least 2 characters").max(100).optional(),
  description: z.string().trim().max(1000).optional(),
});

export const AddMemberSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
  role: z.nativeEnum(ProjectRole).default(ProjectRole.VIEWER),
});

export const ChangeRoleSchema = z.object({
  role: z.nativeEnum(ProjectRole),
});

export async function createProjectService(input: z.infer<typeof CreateProjectSchema>, explicitUserId?: string) {
  const validated = CreateProjectSchema.parse(input);
  const user = explicitUserId
    ? await prisma.user.findUniqueOrThrow({ where: { id: explicitUserId } })
    : await requireUser();

  // Atomically create the project and assign creator as OWNER
  const project = await prisma.$transaction(async (tx) => {
    const newProject = await tx.project.create({
      data: {
        name: validated.name,
        description: validated.description ?? null,
        createdBy: user.id,
        status: ProjectStatus.ACTIVE,
        members: {
          create: {
            userId: user.id,
            role: ProjectRole.OWNER,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    return newProject;
  });

  await writeAudit({
    projectId: project.id,
    userId: user.id,
    action: "PROJECT_CREATED",
    entityType: "PROJECT",
    entityId: project.id,
    metadata: { name: project.name },
  });

  return project;
}

export async function listMyProjectsService(page: number = 1, limit: number = 10, explicitUserId?: string) {
  const user = explicitUserId
    ? await prisma.user.findUniqueOrThrow({ where: { id: explicitUserId } })
    : await requireUser();

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(50, Math.max(1, limit));
  const skip = (safePage - 1) * safeLimit;

  const where = {
    members: {
      some: {
        userId: user.id,
      },
    },
  };

  const [total, memberships] = await Promise.all([
    prisma.project.count({ where }),
    prisma.projectMember.findMany({
      where: { userId: user.id },
      skip,
      take: safeLimit,
      include: {
        project: {
          include: {
            _count: {
              select: {
                members: true,
                claims: { where: { reviewState: "PENDING" } },
              },
            },
            handovers: {
              where: { approvedAt: { not: null } },
              orderBy: { approvedAt: "desc" },
              take: 1,
              select: { version: true, approvedAt: true },
            },
          },
        },
      },
      orderBy: {
        joinedAt: "desc",
      },
    }),
  ]);

  const projects = memberships.map((m) => ({
    id: m.project.id,
    name: m.project.name,
    description: m.project.description,
    status: m.project.status,
    role: m.role,
    createdAt: m.project.createdAt,
    updatedAt: m.project.updatedAt,
    memberCount: m.project._count.members,
    pendingReviews: m.project._count.claims ?? 0,
    recentHandover: m.project.handovers?.[0]?.approvedAt
      ? {
          version: m.project.handovers[0].version,
          approvedAt: m.project.handovers[0].approvedAt.toISOString(),
        }
      : null,
  }));

  return {
    projects,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  };
}

export async function getProjectService(projectId: string, explicitUserId?: string) {
  const { role } = await requireProjectAccess(projectId, "project:read", explicitUserId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      createdByUser: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!project) {
    throw new AppError("NOT_FOUND", "Project not found or you do not have permission to access it.", 404);
  }

  return {
    ...project,
    currentUserRole: role,
  };
}

export async function updateProjectService(
  projectId: string,
  input: z.infer<typeof UpdateProjectSchema>,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(projectId, "project:update", explicitUserId);
  const validated = UpdateProjectSchema.parse(input);

  const updated = await prisma.project.update({
    where: { id: projectId },
    data: {
      ...(validated.name !== undefined ? { name: validated.name } : {}),
      ...(validated.description !== undefined ? { description: validated.description } : {}),
    },
  });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "PROJECT_UPDATED",
    entityType: "PROJECT",
    entityId: projectId,
    metadata: validated,
  });

  return updated;
}

export async function archiveProjectService(projectId: string, explicitUserId?: string) {
  const { user } = await requireProjectAccess(projectId, "project:archive", explicitUserId);

  const archived = await prisma.project.update({
    where: { id: projectId },
    data: { status: ProjectStatus.ARCHIVED },
  });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "PROJECT_ARCHIVED",
    entityType: "PROJECT",
    entityId: projectId,
  });

  return archived;
}

export async function addMemberService(
  projectId: string,
  input: z.infer<typeof AddMemberSchema>,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(projectId, "members:manage", explicitUserId);
  const validated = AddMemberSchema.parse(input);

  const targetUser = await prisma.user.findUnique({
    where: { email: validated.email.toLowerCase() },
  });

  if (!targetUser) {
    throw new AppError("NOT_FOUND", `User with email '${validated.email}' was not found. Please ask them to register first.`, 404);
  }

  const existingMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUser.id,
      },
    },
  });

  if (existingMember) {
    throw new AppError("CONFLICT", "User is already a member of this project.", 409);
  }

  const membership = await prisma.projectMember.create({
    data: {
      projectId,
      userId: targetUser.id,
      role: validated.role,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "MEMBER_ADDED",
    entityType: "PROJECT_MEMBER",
    entityId: membership.id,
    metadata: { addedUserId: targetUser.id, role: validated.role },
  });

  return membership;
}

export async function changeMemberRoleService(
  projectId: string,
  targetUserId: string,
  newRole: ProjectRole,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(projectId, "members:manage", explicitUserId);

  const currentMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUserId,
      },
    },
  });

  if (!currentMember) {
    throw new AppError("NOT_FOUND", "Project member not found.", 404);
  }

  // Last-OWNER rule: The last OWNER can never be demoted
  if (currentMember.role === ProjectRole.OWNER && newRole !== ProjectRole.OWNER) {
    const ownerCount = await prisma.projectMember.count({
      where: {
        projectId,
        role: ProjectRole.OWNER,
      },
    });

    if (ownerCount <= 1) {
      throw new AppError("BAD_REQUEST", "Cannot demote the last owner of a project. Transfer ownership or promote another member first.", 400);
    }
  }

  const updated = await prisma.projectMember.update({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUserId,
      },
    },
    data: { role: newRole },
    include: {
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "MEMBER_ROLE_CHANGED",
    entityType: "PROJECT_MEMBER",
    entityId: updated.id,
    metadata: { targetUserId, previousRole: currentMember.role, newRole },
  });

  return updated;
}

export async function removeMemberService(
  projectId: string,
  targetUserId: string,
  explicitUserId?: string
) {
  const { user } = await requireProjectAccess(projectId, "members:manage", explicitUserId);

  const currentMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUserId,
      },
    },
  });

  if (!currentMember) {
    throw new AppError("NOT_FOUND", "Project member not found.", 404);
  }

  // Last-OWNER rule: The last OWNER can never be removed
  if (currentMember.role === ProjectRole.OWNER) {
    const ownerCount = await prisma.projectMember.count({
      where: {
        projectId,
        role: ProjectRole.OWNER,
      },
    });

    if (ownerCount <= 1) {
      throw new AppError("BAD_REQUEST", "Cannot remove the last owner of a project. Assign another owner before leaving.", 400);
    }
  }

  await prisma.projectMember.delete({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUserId,
      },
    },
  });

  await writeAudit({
    projectId,
    userId: user.id,
    action: "MEMBER_REMOVED",
    entityType: "PROJECT_MEMBER",
    entityId: currentMember.id,
    metadata: { removedUserId: targetUserId, role: currentMember.role },
  });

  return { success: true };
}
