import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { jsonSuccess, handleApiError, UnauthorizedError } from "@/lib/api-response";
import { requireProjectAccess } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ConflictResolutionState } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new UnauthorizedError();

    const { id: projectId } = await params;
    await requireProjectAccess(projectId, "claims:view_unapproved", user.id);

    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const status =
      statusParam &&
      Object.values(ConflictResolutionState).includes(statusParam as ConflictResolutionState)
        ? (statusParam as ConflictResolutionState)
        : undefined;

    const where: { projectId: string; status?: ConflictResolutionState } = { projectId };
    if (status) where.status = status;

    const conflicts = await prisma.conflict.findMany({
      where,
      orderBy: [{ createdAt: "desc" }],
      include: {
        subjectEntity: {
          select: { id: true, canonicalName: true, type: true },
        },
        claimA: {
          select: {
            id: true,
            attributeKey: true,
            valueRaw: true,
            valueNormalized: true,
            reviewState: true,
            evidence: {
              select: {
                id: true,
                sourceLocation: true,
                excerpt: true,
                document: {
                  select: { id: true, fileName: true, sourceDate: true, sourceDateBasis: true },
                },
              },
              take: 1,
            },
          },
        },
        claimB: {
          select: {
            id: true,
            attributeKey: true,
            valueRaw: true,
            valueNormalized: true,
            reviewState: true,
            evidence: {
              select: {
                id: true,
                sourceLocation: true,
                excerpt: true,
                document: {
                  select: { id: true, fileName: true, sourceDate: true, sourceDateBasis: true },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    const totalProjectClaims = await prisma.claim.count({ where: { projectId } });

    return jsonSuccess({ conflicts, totalProjectClaims });
  } catch (error) {
    return handleApiError(error);
  }
}
