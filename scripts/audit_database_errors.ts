import { prisma } from "../src/lib/db";

async function auditErrors() {
  console.log("=== ERROR INVESTIGATION FROM NEON DATABASE ===");

  // 1. ProcessingJob errors
  const failedJobs = await prisma.processingJob.findMany({
    where: {
      OR: [
        { state: "FAILED" },
        { lastError: { not: null } }
      ]
    },
    include: { document: true },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  console.log(`\n1. ProcessingJob records with errors: ${failedJobs.length}`);
  for (const j of failedJobs) {
    console.log(`- Job ${j.id}: doc=${j.document?.fileName} (${j.documentId}), state=${j.state}, attempts=${j.attempts}, error=${j.lastError}, updated=${j.updatedAt}`);
  }

  // 2. ExtractionRun errors
  const failedRuns = await prisma.extractionRun.findMany({
    where: {
      OR: [
        { status: "FAILED" },
        { error: { not: null } }
      ]
    },
    include: { document: true },
    orderBy: { startedAt: "desc" },
    take: 20
  });
  console.log(`\n2. ExtractionRun records with errors: ${failedRuns.length}`);
  for (const r of failedRuns) {
    console.log(`- Run ${r.id}: doc=${r.document?.fileName} (${r.documentId}), status=${r.status}, model=${r.model}, error=${r.error}, duration=${r.finishedAt ? r.finishedAt.getTime() - r.startedAt.getTime() : "N/A"}ms`);
  }

  // 3. AuditLog error events
  const errorAudit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { contains: "FAIL" } },
        { action: { contains: "ERROR" } }
      ]
    },
    orderBy: { createdAt: "desc" },
    take: 20
  });
  console.log(`\n3. AuditLog error actions: ${errorAudit.length}`);
  for (const a of errorAudit) {
    console.log(`- Audit ${a.id}: action=${a.action}, entity=${a.entityType}:${a.entityId}, metadata=${JSON.stringify(a.metadata)}, time=${a.createdAt}`);
  }

  // 4. Verifications with ERROR semanticGate or UNKNOWN status
  const errorVerifs = await prisma.verification.findMany({
    where: {
      OR: [
        { semanticGate: null },
        { status: "UNKNOWN" }
      ]
    },
    include: { claim: true },
    orderBy: { verifiedAt: "desc" },
    take: 10
  });
  console.log(`\n4. Verifications with UNKNOWN or null semanticGate: ${errorVerifs.length}`);
  for (const v of errorVerifs) {
    console.log(`- Verif ${v.id}: claim=${v.claim.valueRaw.slice(0, 30)}, status=${v.status}, quoteGate=${v.quoteGate}, semanticGate=${v.semanticGate}, semanticReason=${v.semanticReason}, rawOutput=${JSON.stringify(v.rawJudgeOutput)}`);
  }
}

auditErrors().catch(console.error).finally(() => prisma.$disconnect());
