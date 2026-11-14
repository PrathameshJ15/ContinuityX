import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/api-response";
import { LLMProvider } from "@/lib/ai/provider";
import { runSemanticJudge } from "@/lib/ai/judge-caller";
import { deriveEvidenceStatus } from "./algorithm";
import { checkEntityInText, verifyQuoteExistence } from "./quote-matcher";
import {
  claimHasOpenConflict,
  detectConflictsForClaim,
} from "../conflicts/detection";
import { SemanticSupportOutcome } from "@prisma/client";

export type ClaimJudgeResult = {
  outcome: SemanticSupportOutcome | "ERROR";
  reason: string;
  judgeModel: string | null;
  judgePromptVersion: string | null;
  rawJudgeOutput: unknown;
};

export interface VerifyClaimOptions {
  provider?: LLMProvider;
  userId?: string;
  concurrency?: number;
  preloadedClaim?: {
    id: string;
    projectId: string;
    subjectEntityId: string;
    attributeKey: string;
    valueRaw: string;
    valueNormalized: string | null;
    category: import("@prisma/client").ClaimCategory;
    subjectEntity: {
      id: string;
      canonicalName: string;
      aliases: Array<{ alias: string }>;
    };
    evidence: Array<{
      id: string;
      excerpt: string;
      sourceLocation?: string | null;
      document?: {
        id: string;
        fileName: string;
        deletedAt: Date | null;
      } | null;
      chunk?: {
        id: string;
        chunkIndex: number;
        content: string;
        sectionTitle?: string | null;
        pageNumber?: number | null;
        rowStart?: number | null;
      } | null;
    }>;
  } | null;
  judgeCache?: Map<string, ClaimJudgeResult>;
  skipAuthCheck?: boolean;
}

/**
 * Runs the 4-gate verification pipeline for a single claim.
 * Follows SPEC.md V3.2:
 * Gate 1: Source exists
 * Gate 2: Quote exists
 * Gate 3: Semantic support (only runs if Gate 1 and Gate 2 pass)
 * Gate 4: Contradiction / Conflict scan
 */
export async function verifyClaimService(
  projectId: string,
  claimId: string,
  options: VerifyClaimOptions = {}
) {
  if (!options.skipAuthCheck) {
    await requireProjectAccess(
      projectId,
      "ai:run_extraction_verification",
      options.userId
    );
  }

  // Use preloaded claim if already populated with subjectEntity & evidence, otherwise query DB
  const claim =
    options.preloadedClaim?.subjectEntity && options.preloadedClaim?.evidence
      ? options.preloadedClaim
      : await prisma.claim.findFirst({
          where: { id: claimId, projectId },
          include: {
            subjectEntity: {
              include: { aliases: true },
            },
            evidence: {
              include: {
                document: true,
                chunk: true,
              },
            },
          },
        });

  if (!claim) {
    throw new AppError("NOT_FOUND", "Claim not found.", 404);
  }

  const primaryEvidence = claim.evidence[0];

  // ==========================================
  // GATE 1: Source Exists
  // ==========================================
  let sourceGatePassed = false;
  let sourceGateReason = "";

  if (!primaryEvidence) {
    sourceGatePassed = false;
    sourceGateReason = "No evidence link attached to this claim.";
  } else if (!primaryEvidence.document) {
    sourceGatePassed = false;
    sourceGateReason = "Referenced source document could not be found.";
  } else if (primaryEvidence.document.deletedAt !== null) {
    sourceGatePassed = false;
    sourceGateReason = "Referenced source document was deleted.";
  } else if (!primaryEvidence.chunk || !primaryEvidence.chunk.content) {
    sourceGatePassed = false;
    sourceGateReason = "Referenced source document chunk text is missing.";
  } else {
    sourceGatePassed = true;
    sourceGateReason = `Verified existence of document '${primaryEvidence.document.fileName}' and chunk #${primaryEvidence.chunk.chunkIndex}.`;
  }

  // ==========================================
  // GATE 2: Quote Exists
  // ==========================================
  let quoteGatePassed = false;
  let quoteSimilarity = 0;
  let quoteGateReason = "";

  if (!sourceGatePassed || !primaryEvidence || !primaryEvidence.chunk || !primaryEvidence.chunk.content) {
    quoteGatePassed = false;
    quoteSimilarity = 0;
    quoteGateReason = "Quote check skipped because source gate failed.";
  } else {
    const quoteCheck = verifyQuoteExistence(
      primaryEvidence.excerpt,
      primaryEvidence.chunk.content
    );
    quoteGatePassed = quoteCheck.passed;
    quoteSimilarity = quoteCheck.similarity;
    quoteGateReason = quoteCheck.reason;
  }

  // ==========================================
  // GATE 3: Semantic Support Judge
  // (CRITICAL RULE: Do not run judge if Gate 1 or Gate 2 fails)
  // ==========================================
  let judgeResult: {
    outcome: SemanticSupportOutcome | "ERROR";
    reason: string;
    judgeModel: string | null;
    judgePromptVersion: string | null;
    rawJudgeOutput: unknown;
  };

  if (!sourceGatePassed || !quoteGatePassed || !primaryEvidence) {
    judgeResult = {
      outcome: "ERROR",
      reason: "Semantic judge skipped because source or quote gate failed.",
      judgeModel: null,
      judgePromptVersion: null,
      rawJudgeOutput: { skipped: true, reason: "gate1_or_gate2_failed" },
    };
  } else {
    // Check judge deduplication cache across the batch
    const cacheKey = `${claim.subjectEntity.canonicalName}|${claim.attributeKey}|${claim.valueRaw}|${primaryEvidence.excerpt}`;
    if (options.judgeCache && options.judgeCache.has(cacheKey)) {
      judgeResult = options.judgeCache.get(cacheKey)!;
    } else {
      const semanticEval = await runSemanticJudge(
        {
          claim: {
            subject: claim.subjectEntity.canonicalName,
            attribute: claim.attributeKey,
            value: claim.valueRaw,
            category: claim.category,
          },
          excerpt: primaryEvidence.excerpt,
          context: {
            documentFileName: primaryEvidence.document?.fileName,
            sectionTitle: primaryEvidence.chunk?.sectionTitle || undefined,
            pageNumber: primaryEvidence.chunk?.pageNumber,
            rowNumber: primaryEvidence.chunk?.rowStart,
          },
        },
        options.provider
      );

      judgeResult = {
        outcome: semanticEval.outcome,
        reason: semanticEval.reason,
        judgeModel: semanticEval.judgeModel,
        judgePromptVersion: semanticEval.judgePromptVersion,
        rawJudgeOutput: semanticEval.rawJudgeOutput,
      };

      if (options.judgeCache) {
        options.judgeCache.set(cacheKey, judgeResult);
      }
    }
  }

  // ==========================================
  // GATE 4: Contradiction / Conflict Scan
  // ==========================================
  await detectConflictsForClaim(projectId, claim.id);
  const hasOpenConflict = await claimHasOpenConflict(claim.id);

  const activeConflictsCount = await prisma.conflict.count({
    where: {
      OR: [{ claimAId: claim.id }, { claimBId: claim.id }],
    },
  });

  // Check if subject or alias is mentioned in excerpt
  const aliasList = (claim.subjectEntity.aliases as Array<{ alias: string }>).map((a) => a.alias);
  const subjectFoundInExcerpt = primaryEvidence
    ? checkEntityInText(
        claim.subjectEntity.canonicalName,
        aliasList,
        primaryEvidence.excerpt
      )
    : false;

  // ==========================================
  // STATUS DERIVATION (V3.2 First-Match Table)
  // ==========================================
  const derived = deriveEvidenceStatus({
    sourceGatePassed,
    quoteGatePassed,
    judgeResult,
    subjectFoundInExcerpt,
    hasOpenConflict,
  });

  // ==========================================
  // PERSIST VERIFICATION RECORD
  // ==========================================
  const verification = await prisma.verification.create({
    data: {
      claimId: claim.id,
      status: derived.status,
      sourceGate: sourceGatePassed ? "PASS" : "FAIL",
      sourceGateReason,
      quoteGate: quoteGatePassed ? "PASS" : "FAIL",
      quoteGateReason,
      quoteSimilarity,
      semanticGate:
        judgeResult.outcome === "ERROR" ? null : judgeResult.outcome,
      semanticReason: judgeResult.reason,
      contradictionGate: hasOpenConflict ? "FAIL" : "PASS",
      contradictionCount: activeConflictsCount,
      ruleSetVersion: "v3.2",
      judgeModel: judgeResult.judgeModel,
      judgePromptVersion: judgeResult.judgePromptVersion,
      rawJudgeOutput: judgeResult.rawJudgeOutput as object,
    },
  });

  await writeAudit({
    projectId,
    userId: options.userId,
    action: "CLAIM_VERIFIED",
    entityType: "Claim",
    entityId: claim.id,
    metadata: {
      status: derived.status,
      ruleNumber: derived.ruleNumber,
      ruleDescription: derived.ruleDescription,
      hasOpenConflict,
    },
  });

  return {
    claimId: claim.id,
    status: derived.status,
    ruleNumber: derived.ruleNumber,
    ruleDescription: derived.ruleDescription,
    verification,
  };
}

/**
 * Batch verifies all active claims in a project workspace with bounded concurrency and request deduplication.
 */
export async function verifyAllProjectClaimsService(
  projectId: string,
  options: VerifyClaimOptions = {}
) {
  await requireProjectAccess(
    projectId,
    "ai:run_extraction_verification",
    options.userId
  );

  const claims = await prisma.claim.findMany({
    where: {
      projectId,
      reviewState: { not: "REJECTED" },
      supersededBy: { none: {} },
    },
    include: {
      subjectEntity: {
        include: { aliases: true },
      },
      evidence: {
        include: {
          document: true,
          chunk: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const summary = {
    total: claims.length,
    verified: 0,
    weakSupport: 0,
    conflicting: 0,
    unverified: 0,
    unknown: 0,
  };

  const judgeCache = new Map<string, ClaimJudgeResult>();
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const results: Array<Awaited<ReturnType<typeof verifyClaimService>>> = new Array(claims.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < claims.length) {
      const idx = currentIndex++;
      const c = claims[idx];
      results[idx] = await verifyClaimService(projectId, c.id, {
        ...options,
        preloadedClaim: c,
        judgeCache,
        skipAuthCheck: true,
      });
    }
  }

  const workerCount = Math.min(concurrency, claims.length);
  if (workerCount > 0) {
    const workers = Array.from({ length: workerCount }, () => worker());
    await Promise.all(workers);
  }

  for (const res of results) {
    if (!res) continue;
    switch (res.status) {
      case "VERIFIED":
        summary.verified++;
        break;
      case "WEAK_SUPPORT":
        summary.weakSupport++;
        break;
      case "CONFLICTING":
        summary.conflicting++;
        break;
      case "UNVERIFIED":
        summary.unverified++;
        break;
      case "UNKNOWN":
        summary.unknown++;
        break;
    }
  }

  return {
    summary,
    results,
  };
}

/**
 * Retrieves the verification history and latest verification report for a claim.
 */
export async function getClaimVerificationService(
  projectId: string,
  claimId: string,
  userId?: string
) {
  await requireProjectAccess(projectId, "claims:view_unapproved", userId);

  const verifications = await prisma.verification.findMany({
    where: {
      claimId,
      claim: { projectId },
    },
    orderBy: { verifiedAt: "desc" },
    take: 10,
  });

  const conflicts = await prisma.conflict.findMany({
    where: {
      projectId,
      OR: [{ claimAId: claimId }, { claimBId: claimId }],
    },
    include: {
      claimA: {
        select: {
          id: true,
          attributeKey: true,
          valueRaw: true,
          valueNormalized: true,
          reviewState: true,
        },
      },
      claimB: {
        select: {
          id: true,
          attributeKey: true,
          valueRaw: true,
          valueNormalized: true,
          reviewState: true,
        },
      },
    },
  });

  return {
    latest: verifications[0] || null,
    history: verifications,
    conflicts,
  };
}
