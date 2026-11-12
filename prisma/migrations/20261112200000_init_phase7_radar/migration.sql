-- AlterTable
ALTER TABLE "Entity" ADD COLUMN "isCritical" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RadarDismissal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "alertKey" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dismissedById" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadarDismissal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RadarDismissal_projectId_alertKey_key" ON "RadarDismissal"("projectId", "alertKey");

-- CreateIndex
CREATE INDEX "RadarDismissal_projectId_idx" ON "RadarDismissal"("projectId");

-- CreateIndex
CREATE INDEX "RadarDismissal_ruleId_idx" ON "RadarDismissal"("ruleId");

-- AddForeignKey
ALTER TABLE "RadarDismissal" ADD CONSTRAINT "RadarDismissal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RadarDismissal" ADD CONSTRAINT "RadarDismissal_dismissedById_fkey" FOREIGN KEY ("dismissedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
