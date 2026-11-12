import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { BadRequestError, NotFoundError } from "@/lib/api-response";
import { writeAudit } from "@/lib/audit";
import {
  HandoverSnapshotPayload,
  SnapshotClaimItem,
  SnapshotResolvedConflictItem,
  canonicalizeSnapshot,
  computeSnapshotHash,
} from "./canonical";
import { assembleHandoverSections } from "./sections";
import { generateHandoverPdf } from "./pdf-exporter";

/**
 * Returns a draft preview of the handover with blocking validation
 */
export async function getHandoverDraftPreviewService(projectId: string, userId: string) {
  await requireProjectAccess(projectId, "handover:approve", userId);

  // Fetch all accepted / edited claims
  const acceptedClaims = await prisma.claim.findMany({
    where: {
      projectId,
      reviewState: { in: ["ACCEPTED", "EDITED"] },
    },
    include: {
      subjectEntity: true,
      verifications: {
        orderBy: { verifiedAt: "desc" },
        take: 1,
      },
      evidence: {
        include: {
          document: {
            select: { id: true, fileName: true, checksum: true },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Check for OPEN conflicts in project
  const openConflicts = await prisma.conflict.findMany({
    where: {
      projectId,
      status: { in: ["OPEN", "POSSIBLY_SUPERSEDED", "UNDER_REVIEW", "REQUIRES_CLARIFICATION"] },
    },
    include: {
      subjectEntity: true,
    },
  });

  const openConflictClaimIds = new Set<string>();
  for (const c of openConflicts) {
    openConflictClaimIds.add(c.claimAId);
    openConflictClaimIds.add(c.claimBId);
  }

  const conflictingAcceptedClaims = acceptedClaims.filter((c) =>
    openConflictClaimIds.has(c.id)
  );

  const blockingReasons: string[] = [];
  if (acceptedClaims.length === 0) {
    blockingReasons.push("Cannot approve handover: No claims have been accepted or edited.");
  }
  if (conflictingAcceptedClaims.length > 0) {
    blockingReasons.push(
      `Cannot approve handover: ${conflictingAcceptedClaims.length} accepted claim(s) are currently involved in an active open conflict.`
    );
  }

  // Build document lookup map
  const documentMap = new Map<string, { fileName: string; checksum: string }>();
  for (const claim of acceptedClaims) {
    for (const ev of claim.evidence) {
      if (ev.document) {
        documentMap.set(ev.document.id, {
          fileName: ev.document.fileName,
          checksum: ev.document.checksum,
        });
      }
    }
  }

  // Get project details and latest version count
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  const latestHandover = await prisma.handover.findFirst({
    where: { projectId, status: "APPROVED" },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  const draftVersion = (latestHandover?.version ?? 0) + 1;

  // Format snapshot claim items
  const snapshotClaims: SnapshotClaimItem[] = acceptedClaims.map((claim) => {
    const latestVerif = claim.verifications[0];
    return {
      claimId: claim.id,
      claimVersion: claim.version,
      subject: {
        entityId: claim.subjectEntity.id,
        canonicalName: claim.subjectEntity.canonicalName,
      },
      attributeKey: claim.attributeKey,
      valueRaw: claim.valueRaw,
      valueNormalized: claim.valueNormalized,
      evidenceStatus: latestVerif?.status || "UNVERIFIED",
      reviewState: claim.reviewState,
      reviewerReason: null,
      evidence: claim.evidence.map((ev) => ({
        documentId: ev.documentId,
        documentChecksum: ev.document?.checksum || "",
        location: ev.sourceLocation,
        excerpt: ev.excerpt,
      })),
    };
  });

  const assembled = assembleHandoverSections({
    projectId,
    version: draftVersion,
    title: project ? `${project.name} Handover (Draft v${draftVersion})` : `Handover Draft v${draftVersion}`,
    claims: snapshotClaims,
    documentMap,
    unresolvedConflictCount: openConflicts.length,
  });

  return {
    canApprove: blockingReasons.length === 0,
    blockingReasons,
    unresolvedConflictCount: openConflicts.length,
    draft: assembled,
  };
}

/**
 * Approves a handover in ONE atomic transaction with SHA-256 canonical receipt
 * SPEC.md & TECH_DESIGN.md Invariant: Snapshot and receipt rows are created atomically and never updated.
 */
export async function approveHandoverService(projectId: string, userId: string, customTitle?: string) {
  await requireProjectAccess(projectId, "handover:approve", userId);

  // Pre-flight check outside transaction
  const acceptedClaims = await prisma.claim.findMany({
    where: {
      projectId,
      reviewState: { in: ["ACCEPTED", "EDITED"] },
    },
    include: {
      subjectEntity: true,
      verifications: {
        orderBy: { verifiedAt: "desc" },
        take: 1,
      },
      evidence: {
        include: {
          document: {
            select: { id: true, fileName: true, checksum: true },
          },
        },
      },
      reviews: {
        orderBy: { reviewedAt: "desc" },
        take: 1,
        include: { actions: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });

  if (acceptedClaims.length === 0) {
    throw new BadRequestError("Cannot approve handover: No claims have been accepted or edited.");
  }

  // Invariant: No included claim can be in an active open conflict
  const openConflicts = await prisma.conflict.findMany({
    where: {
      projectId,
      status: { in: ["OPEN", "POSSIBLY_SUPERSEDED", "UNDER_REVIEW", "REQUIRES_CLARIFICATION"] },
    },
  });

  const openClaimIds = new Set<string>();
  for (const c of openConflicts) {
    openClaimIds.add(c.claimAId);
    openClaimIds.add(c.claimBId);
  }

  const conflictingClaim = acceptedClaims.find((c) => openClaimIds.has(c.id));
  if (conflictingClaim) {
    throw new BadRequestError(
      `Cannot approve handover: Claim '${conflictingClaim.subjectEntity.canonicalName} -> ${conflictingClaim.attributeKey}' is in an open conflict.`
    );
  }

  // Fetch resolved conflicts
  const resolvedConflicts = await prisma.conflict.findMany({
    where: {
      projectId,
      status: { in: ["RESOLVED_MUTUAL_ACCEPT", "RESOLVED_ONE_ACCEPTED", "RESOLVED_BOTH_REJECTED", "RESOLVED_EDITED"] },
    },
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });

  // Execute in ONE atomic database transaction
  const result = await prisma.$transaction(
    async (tx) => {
      // Find latest approved handover to determine next version and previousReceiptHash chain
      const latestApproved = await tx.handover.findFirst({
        where: { projectId, status: "APPROVED" },
        orderBy: { version: "desc" },
        include: { receipt: true },
      });

      const nextVersion = (latestApproved?.version ?? 0) + 1;
      const previousReceiptHash = latestApproved?.receipt?.snapshotHash ?? null;

      // Build canonical Snapshot payload
      const snapshotClaims: SnapshotClaimItem[] = acceptedClaims.map((claim) => {
        const latestVerif = claim.verifications[0];
        const latestReviewAction = claim.reviews[0]?.actions[0];

        return {
          claimId: claim.id,
          claimVersion: claim.version,
          subject: {
            entityId: claim.subjectEntity.id,
            canonicalName: claim.subjectEntity.canonicalName,
          },
          attributeKey: claim.attributeKey,
          valueRaw: claim.valueRaw,
          valueNormalized: claim.valueNormalized,
          evidenceStatus: latestVerif?.status || "UNVERIFIED",
          reviewState: claim.reviewState,
          reviewerReason: latestReviewAction?.reason || null,
          evidence: claim.evidence.map((ev) => ({
            documentId: ev.documentId,
            documentChecksum: ev.document?.checksum || "",
            location: ev.sourceLocation,
            excerpt: ev.excerpt,
          })),
        };
      });

      const snapshotConflicts: SnapshotResolvedConflictItem[] = resolvedConflicts.map((c) => ({
        conflictId: c.id,
        type: c.conflictType,
        resolution: c.status,
        reason: c.resolutionNotes || "",
      }));

      const snapshotPayload: HandoverSnapshotPayload = {
        schemaVersion: 1,
        canonicalisationVersion: 1,
        projectId,
        handoverVersion: nextVersion,
        previousReceiptHash,
        claims: snapshotClaims,
        resolvedConflicts: snapshotConflicts,
      };

      // Canonicalize JSON and compute SHA-256 hash
      const canonicalJson = canonicalizeSnapshot(snapshotPayload);
      const snapshotHash = computeSnapshotHash(canonicalJson);

      const title =
        customTitle?.trim() ||
        (project ? `${project.name} Handover v${nextVersion}` : `Project Handover v${nextVersion}`);

      const summary = `Approved ${snapshotClaims.length} claims (${snapshotClaims.filter((c) => c.evidenceStatus === "VERIFIED").length} VERIFIED). Previous hash: ${previousReceiptHash ? previousReceiptHash.slice(0, 12) + "..." : "Genesis"}.`;

      // 1. Create Handover row
      const handover = await tx.handover.create({
        data: {
          projectId,
          version: nextVersion,
          status: "APPROVED",
          title,
          summary,
          approvedAt: new Date(),
          approvedById: userId,
        },
      });

      // 2. Create HandoverSnapshot row
      const snapshot = await tx.handoverSnapshot.create({
        data: {
          handoverId: handover.id,
          canonicalJson,
          schemaVersion: 1,
          canonicalisationVersion: 1,
        },
      });

      // 3. Create HandoverReceipt row
      const receipt = await tx.handoverReceipt.create({
        data: {
          handoverId: handover.id,
          version: nextVersion,
          snapshotHash,
          previousReceiptHash,
          approvedById: userId,
          approvedAt: new Date(),
          canonicalisationVersion: 1,
        },
        include: {
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // 4. Record Audit Log
      await tx.auditLog.create({
        data: {
          projectId,
          userId,
          action: "HANDOVER_APPROVED",
          entityType: "HANDOVER",
          entityId: handover.id,
          metadata: {
            version: nextVersion,
            snapshotHash,
            previousReceiptHash,
            claimsCount: snapshotClaims.length,
          },
        },
      });

      return { handover, snapshot, receipt };
    },
    { maxWait: 30000, timeout: 60000 }
  );

  return result;
}

/**
 * Lists all approved handovers for a project
 */
export async function listHandoversService(projectId: string, userId: string) {
  await requireProjectAccess(projectId, "handover:view_approved", userId);

  const handovers = await prisma.handover.findMany({
    where: { projectId, status: "APPROVED" },
    orderBy: { version: "desc" },
    include: {
      receipt: {
        include: {
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return handovers;
}

/**
 * Retrieves an approved handover by ID with full parsed sections
 */
export async function getHandoverByIdService(projectId: string, handoverId: string, userId: string) {
  await requireProjectAccess(projectId, "handover:view_approved", userId);

  const handover = await prisma.handover.findFirst({
    where: { id: handoverId, projectId },
    include: {
      snapshot: true,
      receipt: {
        include: {
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      },
      approvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  if (!handover || !handover.snapshot || !handover.receipt) {
    throw new NotFoundError("Handover or receipt not found.");
  }

  // Parse canonical snapshot JSON
  const payload = JSON.parse(handover.snapshot.canonicalJson) as HandoverSnapshotPayload;

  // Build document lookup map from project documents
  const documents = await prisma.document.findMany({
    where: { projectId },
    select: { id: true, fileName: true, checksum: true },
  });
  const documentMap = new Map<string, { fileName: string; checksum: string }>();
  for (const doc of documents) {
    documentMap.set(doc.id, { fileName: doc.fileName, checksum: doc.checksum });
  }

  const assembled = assembleHandoverSections({
    projectId,
    version: handover.version,
    title: handover.title,
    claims: payload.claims,
    documentMap,
    unresolvedConflictCount: 0,
    receiptData: {
      snapshotHash: handover.receipt.snapshotHash,
      previousReceiptHash: handover.receipt.previousReceiptHash,
      approvedBy: handover.receipt.approvedBy.name,
      approvedAt: handover.receipt.approvedAt.toISOString(),
      canonicalisationVersion: handover.receipt.canonicalisationVersion,
    },
  });

  return {
    handover,
    receipt: handover.receipt,
    assembled,
  };
}

/**
 * Verifies the integrity of a stored handover receipt
 * Check 1: Recompute hash from stored snapshot JSON vs receipt.snapshotHash
 * Check 2: Rebuild snapshot from live database accepted claims vs receipt.snapshotHash
 */
export async function verifyHandoverReceiptService(projectId: string, handoverId: string, userId: string) {
  await requireProjectAccess(projectId, "handover:view_approved", userId);

  const handover = await prisma.handover.findFirst({
    where: { id: handoverId, projectId },
    include: {
      snapshot: true,
      receipt: {
        include: {
          approvedBy: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  if (!handover || !handover.snapshot || !handover.receipt) {
    throw new NotFoundError("Handover or receipt not found.");
  }

  // Check 1: Stored Snapshot Integrity
  const storedHash = handover.receipt.snapshotHash;
  const computedSnapshotHash = computeSnapshotHash(handover.snapshot.canonicalJson);
  const snapshotIntegrity = computedSnapshotHash.toLowerCase() === storedHash.toLowerCase();

  // Check 2: Live Database Claims Integrity
  // Rebuild snapshot from current live accepted claims
  const liveAcceptedClaims = await prisma.claim.findMany({
    where: {
      projectId,
      reviewState: { in: ["ACCEPTED", "EDITED"] },
    },
    include: {
      subjectEntity: true,
      verifications: {
        orderBy: { verifiedAt: "desc" },
        take: 1,
      },
      evidence: {
        include: {
          document: { select: { id: true, checksum: true } },
        },
      },
      reviews: {
        orderBy: { reviewedAt: "desc" },
        take: 1,
        include: { actions: { orderBy: { createdAt: "desc" }, take: 1 } },
      },
    },
  });

  const liveResolvedConflicts = await prisma.conflict.findMany({
    where: {
      projectId,
      status: { in: ["RESOLVED_MUTUAL_ACCEPT", "RESOLVED_ONE_ACCEPTED", "RESOLVED_BOTH_REJECTED", "RESOLVED_EDITED"] },
    },
  });

  const liveClaims: SnapshotClaimItem[] = liveAcceptedClaims.map((claim) => {
    const latestVerif = claim.verifications[0];
    const latestReviewAction = claim.reviews[0]?.actions[0];
    return {
      claimId: claim.id,
      claimVersion: claim.version,
      subject: {
        entityId: claim.subjectEntity.id,
        canonicalName: claim.subjectEntity.canonicalName,
      },
      attributeKey: claim.attributeKey,
      valueRaw: claim.valueRaw,
      valueNormalized: claim.valueNormalized,
      evidenceStatus: latestVerif?.status || "UNVERIFIED",
      reviewState: claim.reviewState,
      reviewerReason: latestReviewAction?.reason || null,
      evidence: claim.evidence.map((ev) => ({
        documentId: ev.documentId,
        documentChecksum: ev.document?.checksum || "",
        location: ev.sourceLocation,
        excerpt: ev.excerpt,
      })),
    };
  });

  const liveConflicts: SnapshotResolvedConflictItem[] = liveResolvedConflicts.map((c) => ({
    conflictId: c.id,
    type: c.conflictType,
    resolution: c.status,
    reason: c.resolutionNotes || "",
  }));

  const livePayload: HandoverSnapshotPayload = {
    schemaVersion: handover.snapshot.schemaVersion,
    canonicalisationVersion: handover.snapshot.canonicalisationVersion,
    projectId,
    handoverVersion: handover.version,
    previousReceiptHash: handover.receipt.previousReceiptHash,
    claims: liveClaims,
    resolvedConflicts: liveConflicts,
  };

  const liveCanonicalJson = canonicalizeSnapshot(livePayload);
  const liveDataHash = computeSnapshotHash(liveCanonicalJson);
  const liveDataIntegrity = liveDataHash.toLowerCase() === storedHash.toLowerCase();

  const isFullyValid = snapshotIntegrity && liveDataIntegrity;

  await writeAudit({
    projectId,
    userId,
    action: "RECEIPT_VERIFIED",
    entityType: "HANDOVER",
    entityId: handover.id,
    metadata: {
      valid: isFullyValid,
      snapshotIntegrity,
      liveDataIntegrity,
      storedHash,
      computedSnapshotHash,
      liveDataHash,
    },
  });

  return {
    valid: isFullyValid,
    snapshotIntegrity,
    liveDataIntegrity,
    storedHash,
    computedSnapshotHash,
    liveDataHash,
    verifiedAt: new Date().toISOString(),
    explanation: !snapshotIntegrity
      ? "Tamper alert: Stored snapshot canonical JSON does not match receipt hash."
      : !liveDataIntegrity
      ? "Underlying claim drift: Database accepted claims have been altered or updated since handover was approved."
      : "Receipt verified: Snapshot matches receipt SHA-256 fingerprint and database accepted claims exactly.",
  };
}

/**
 * Generates and returns the PDF bytes for an approved handover
 */
export async function exportHandoverPdfService(projectId: string, handoverId: string, userId: string): Promise<Uint8Array> {
  const { assembled, receipt } = await getHandoverByIdService(projectId, handoverId, userId);

  return await generateHandoverPdf({
    handover: assembled,
    receipt: {
      snapshotHash: receipt.snapshotHash,
      previousReceiptHash: receipt.previousReceiptHash,
      approvedBy: receipt.approvedBy.name,
      approvedAt: receipt.approvedAt.toISOString(),
      canonicalisationVersion: receipt.canonicalisationVersion,
    },
  });
}
