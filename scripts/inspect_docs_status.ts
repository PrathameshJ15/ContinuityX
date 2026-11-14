import { prisma } from "../src/lib/db";

async function check() {
  try {
    const docs = await prisma.document.findMany({
      select: { id: true, fileName: true, processingStatus: true, uploadedAt: true },
    });
    console.log("Docs count:", docs.length);
    for (const d of docs) {
      console.log(d.id, d.fileName, d.processingStatus);
    }
    const runs = await prisma.extractionRun.findMany({
      select: { id: true, documentId: true, status: true, error: true, startedAt: true },
      orderBy: { startedAt: "desc" },
      take: 10,
    });
    console.log("Runs count (last 10):", runs.length);
    for (const r of runs) {
      console.log(r.id, r.documentId, r.status, r.error);
    }
    const jobs = await prisma.processingJob.findMany({
      select: { id: true, documentId: true, state: true, attempts: true, lastError: true, leaseExpiresAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    console.log("Jobs count (last 10):", jobs.length);
    for (const j of jobs) {
      console.log(j.id, j.documentId, j.state, "attempts:", j.attempts, "lease:", j.leaseExpiresAt, "error:", j.lastError);
    }
    const claimCount = await prisma.claim.count();
    const approvedCount = await prisma.claim.count({
      where: { reviewState: { in: ["ACCEPTED", "EDITED"] } },
    });
    console.log("Total claims:", claimCount, "Approved claims:", approvedCount);
  } catch (e) {
    console.error("DB error:", e);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

check();
