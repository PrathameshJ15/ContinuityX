-- CreateEnum
CREATE TYPE "ExtractionRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CACHED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PERSON', 'COMPONENT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EntityCreator" AS ENUM ('MODEL', 'REVIEWER');

-- CreateEnum
CREATE TYPE "ClaimCategory" AS ENUM ('DECISION', 'TASK', 'OWNERSHIP', 'DEPENDENCY', 'RISK', 'OPEN_QUESTION', 'FACT');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('PENDING', 'ACCEPTED', 'EDITED', 'REJECTED');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('DIRECT_QUOTE', 'TABLE_ROW', 'SECTION_EXCERPT');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DocumentProcessingStatus" ADD VALUE 'AI_PROCESSING';
ALTER TYPE "DocumentProcessingStatus" ADD VALUE 'AI_COMPLETED';
ALTER TYPE "DocumentProcessingStatus" ADD VALUE 'AI_PROCESSING_FAILED';

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "injectionFlag" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ExtractionRun" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL,
    "inputChecksum" TEXT NOT NULL,
    "status" "ExtractionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "ExtractionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entity" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "normalizedId" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "createdBy" "EntityCreator" NOT NULL DEFAULT 'MODEL',
    "mergedIntoId" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntityAlias" (
    "id" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntityAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subjectEntityId" TEXT NOT NULL,
    "attributeKey" TEXT NOT NULL,
    "valueRaw" TEXT NOT NULL,
    "valueNormalized" TEXT,
    "category" "ClaimCategory" NOT NULL,
    "reviewState" "ReviewState" NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedesClaimId" TEXT,
    "extractionRunId" TEXT,
    "injectionFlag" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaimEvidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "sourceLocation" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "evidenceType" "EvidenceType" NOT NULL DEFAULT 'DIRECT_QUOTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClaimEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExtractionRun_projectId_documentId_idx" ON "ExtractionRun"("projectId", "documentId");

-- CreateIndex
CREATE INDEX "ExtractionRun_inputChecksum_promptVersion_model_schemaVersi_idx" ON "ExtractionRun"("inputChecksum", "promptVersion", "model", "schemaVersion");

-- CreateIndex
CREATE INDEX "ExtractionRun_status_idx" ON "ExtractionRun"("status");

-- CreateIndex
CREATE INDEX "Entity_projectId_type_idx" ON "Entity"("projectId", "type");

-- CreateIndex
CREATE INDEX "Entity_mergedIntoId_idx" ON "Entity"("mergedIntoId");

-- CreateIndex
CREATE INDEX "Entity_needsReview_idx" ON "Entity"("needsReview");

-- CreateIndex
CREATE UNIQUE INDEX "Entity_projectId_normalizedId_key" ON "Entity"("projectId", "normalizedId");

-- CreateIndex
CREATE INDEX "EntityAlias_normalizedAlias_idx" ON "EntityAlias"("normalizedAlias");

-- CreateIndex
CREATE UNIQUE INDEX "EntityAlias_entityId_normalizedAlias_key" ON "EntityAlias"("entityId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "Claim_projectId_subjectEntityId_attributeKey_idx" ON "Claim"("projectId", "subjectEntityId", "attributeKey");

-- CreateIndex
CREATE INDEX "Claim_projectId_category_reviewState_idx" ON "Claim"("projectId", "category", "reviewState");

-- CreateIndex
CREATE INDEX "Claim_extractionRunId_idx" ON "Claim"("extractionRunId");

-- CreateIndex
CREATE INDEX "Claim_injectionFlag_idx" ON "Claim"("injectionFlag");

-- CreateIndex
CREATE INDEX "Claim_supersedesClaimId_idx" ON "Claim"("supersedesClaimId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_claimId_idx" ON "ClaimEvidence"("claimId");

-- CreateIndex
CREATE INDEX "ClaimEvidence_documentId_chunkId_idx" ON "ClaimEvidence"("documentId", "chunkId");

-- CreateIndex
CREATE INDEX "DocumentChunk_injectionFlag_idx" ON "DocumentChunk"("injectionFlag");

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractionRun" ADD CONSTRAINT "ExtractionRun_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entity" ADD CONSTRAINT "Entity_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntityAlias" ADD CONSTRAINT "EntityAlias_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Entity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_subjectEntityId_fkey" FOREIGN KEY ("subjectEntityId") REFERENCES "Entity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_supersedesClaimId_fkey" FOREIGN KEY ("supersedesClaimId") REFERENCES "Claim"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_extractionRunId_fkey" FOREIGN KEY ("extractionRunId") REFERENCES "ExtractionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaimEvidence" ADD CONSTRAINT "ClaimEvidence_chunkId_fkey" FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;

