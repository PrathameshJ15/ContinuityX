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
  const startTime = performance.now();
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

    const [conflicts, totalProjectClaims, allConflictsForCounts] = await Promise.all([
      prisma.conflict.findMany({
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
      }),
      prisma.claim.count({ where: { projectId } }),
      prisma.conflict.findMany({
        where: { projectId },
        select: { status: true },
      }),
    ]);

    const counts = {
      ALL: allConflictsForCounts.length,
      OPEN: allConflictsForCounts.filter((c) => !c.status.startsWith("RESOLVED_")).length,
      POSSIBLY_SUPERSEDED: allConflictsForCounts.filter((c) => c.status === "POSSIBLY_SUPERSEDED").length,
      REQUIRES_CLARIFICATION: allConflictsForCounts.filter((c) => c.status === "REQUIRES_CLARIFICATION").length,
      RESOLVED: allConflictsForCounts.filter((c) => c.status.startsWith("RESOLVED_")).length,
    };

    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/${projectId}/conflicts completed in ${duration.toFixed(2)} ms`);

    const response = jsonSuccess({ conflicts, totalProjectClaims, counts });
    response.headers.set("Server-Timing", `total;dur=${duration.toFixed(2)}`);
    return response;
  } catch (error) {
    const duration = performance.now() - startTime;
    console.log(`[API Timing] GET /api/projects/conflicts failed after ${duration.toFixed(2)} ms`);
    return handleApiError(error);
  }
}
