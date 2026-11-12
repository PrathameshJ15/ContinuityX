-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('DRAFT', 'APPROVED');

-- CreateTable
CREATE TABLE "Handover" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "HandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Handover_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverSnapshot" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "canonicalJson" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "canonicalisationVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoverReceipt" (
    "id" TEXT NOT NULL,
    "handoverId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "previousReceiptHash" TEXT,
    "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "canonicalisationVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "HandoverReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Handover_projectId_version_key" ON "Handover"("projectId", "version");

-- CreateIndex
CREATE INDEX "Handover_projectId_status_idx" ON "Handover"("projectId", "status");

-- CreateIndex
CREATE INDEX "Handover_projectId_version_idx" ON "Handover"("projectId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverSnapshot_handoverId_key" ON "HandoverSnapshot"("handoverId");

-- CreateIndex
CREATE INDEX "HandoverSnapshot_handoverId_idx" ON "HandoverSnapshot"("handoverId");

-- CreateIndex
CREATE UNIQUE INDEX "HandoverReceipt_handoverId_key" ON "HandoverReceipt"("handoverId");

-- CreateIndex
CREATE INDEX "HandoverReceipt_handoverId_idx" ON "HandoverReceipt"("handoverId");

-- CreateIndex
CREATE INDEX "HandoverReceipt_snapshotHash_idx" ON "HandoverReceipt"("snapshotHash");

-- CreateIndex
CREATE INDEX "HandoverReceipt_version_idx" ON "HandoverReceipt"("version");

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Handover" ADD CONSTRAINT "Handover_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverSnapshot" ADD CONSTRAINT "HandoverSnapshot_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverReceipt" ADD CONSTRAINT "HandoverReceipt_handoverId_fkey" FOREIGN KEY ("handoverId") REFERENCES "Handover"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoverReceipt" ADD CONSTRAINT "HandoverReceipt_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
