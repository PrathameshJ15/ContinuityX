-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('VERIFIED', 'WEAK_SUPPORT', 'CONFLICTING', 'UNVERIFIED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "GateOutcome" AS ENUM ('PASS', 'FAIL');

-- CreateEnum
CREATE TYPE "SemanticSupportOutcome" AS ENUM ('SUPPORTS', 'NEUTRAL', 'CONTRADICTS', 'INSUFFICIENT_CONTEXT');

-- CreateEnum
CREATE TYPE "ConflictType" AS ENUM ('STATUS_CONFLICT', 'OWNERSHIP_CONFLICT', 'DECISION_CONFLICT', 'TIMELINE_CONFLICT', 'VALUE_CONFLICT');

-- CreateEnum
CREATE TYPE "ConflictResolutionState" AS ENUM ('OPEN', 'POSSIBLY_SUPERSEDED', 'RESOLVED_MUTUAL_ACCEPT', 'RESOLVED_ONE_ACCEPTED', 'RESOLVED_BOTH_REJECTED', 'RESOLVED_EDITED');

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "status" "EvidenceStatus" NOT NULL,
    "sourceGate" "GateOutcome" NOT NULL,
    "sourceGateReason" TEXT,
    "quoteGate" "GateOutcome" NOT NULL,
    "quoteGateReason" TEXT,
    "quoteSimilarity" DOUBLE PRECISION,
    "semanticGate" "SemanticSupportOutcome",
    "semanticReason" TEXT,
    "contradictionGate" "GateOutcome" NOT NULL,
    "contradictionCount" INTEGER NOT NULL DEFAULT 0,
    "ruleSetVersion" TEXT NOT NULL DEFAULT 'v3.2',
    "judgeModel" TEXT,
    "judgePromptVersion" TEXT,
    "rawJudgeOutput" JSONB,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conflict" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subjectEntityId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "claimAId" TEXT NOT NULL,
    "claimBId" TEXT NOT NULL,
    "conflictType" "ConflictType" NOT NULL,
    "status" "ConflictResolutionState" NOT NULL DEFAULT 'OPEN',
    "resolutionNotes" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Verification_claimId_idx" ON "Verification"("claimId");

-- CreateIndex
CREATE INDEX "Verification_status_idx" ON "Verification"("status");

-- CreateIndex
CREATE INDEX "Verification_verifiedAt_idx" ON "Verification"("verifiedAt");

-- CreateIndex
CREATE INDEX "Conflict_projectId_status_idx" ON "Conflict"("projectId", "status");

-- CreateIndex
CREATE INDEX "Conflict_subjectEntityId_attributeKey_idx" ON "Conflict"("subjectEntityId", "attributeKey");

-- CreateIndex
CREATE INDEX "Conflict_claimAId_idx" ON "Conflict"("claimAId");

-- CreateIndex
CREATE INDEX "Conflict_claimBId_idx" ON "Conflict"("claimBId");

-- CreateIndex
CREATE UNIQUE INDEX "Conflict_claimAId_claimBId_key" ON "Conflict"("claimAId", "claimBId");

-- AddForeignKey
ALTER TABLE "Verification" ADD CONSTRAINT "Verification_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_subjectEntityId_fkey" FOREIGN KEY ("subjectEntityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_claimAId_fkey" FOREIGN KEY ("claimAId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conflict" ADD CONSTRAINT "Conflict_claimBId_fkey" FOREIGN KEY ("claimBId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
