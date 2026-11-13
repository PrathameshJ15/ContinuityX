import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { requireProjectAccess } from "@/lib/permissions";
import { jsonSuccess, handleApiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    await requireProjectAccess(projectId, "project:read");

    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const entityType = url.searchParams.get("entityType");
    const search = url.searchParams.get("search");

    const where: Prisma.AuditLogWhereInput = { projectId };
    if (action && action !== "ALL") {
      where.action = action;
    }
    if (entityType && entityType !== "ALL") {
      where.entityType = entityType;
    }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entityType: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
      ];
    }

    const auditLogs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return jsonSuccess({ auditLogs });
  } catch (error) {
    return handleApiError(error);
  }
}
