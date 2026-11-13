import { prisma } from "../src/lib/db";
import { computeContinuityIntelligenceService } from "../src/services/intelligence/score";

async function measure() {
  console.log("=== MEASURING CONTINUITYX API & DB PERFORMANCE ===");

  // Step 1: Initial connection / cold start
  const t0 = performance.now();
  const user = await prisma.user.findFirst();
  const t1 = performance.now();
  console.log(`[1] Initial prisma.user.findFirst(): ${(t1 - t0).toFixed(2)} ms`);

  const project = await prisma.project.findFirst({
    where: { name: { contains: "Smart Attendance" } },
  });
  if (!project || !user) {
    console.log("No test project or user found!");
    return;
  }
  console.log(`Target Project: ${project.name} (${project.id})`);
  console.log(`Target User: ${user.name} (${user.id})`);

  // Step 2: Measure individual Prisma queries that intelligence service performs
  console.log("\n--- Individual Query Breakdown ---");
  
  const q1Start = performance.now();
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true },
  });
  const q1End = performance.now();
  console.log(`[Q1] prisma.user.findUnique: ${(q1End - q1Start).toFixed(2)} ms`);

  const q2Start = performance.now();
  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId: project.id,
        userId: user.id,
      },
    },
    select: { role: true },
  });
  const q2End = performance.now();
  console.log(`[Q2] prisma.projectMember.findUnique: ${(q2End - q2Start).toFixed(2)} ms`);

  const q3Start = performance.now();
  const entities = await prisma.entity.findMany({
    where: { projectId: project.id, mergedIntoId: null },
  });
  const q3End = performance.now();
  console.log(`[Q3] prisma.entity.findMany (${entities.length} entities): ${(q3End - q3Start).toFixed(2)} ms`);

  const q4Start = performance.now();
  const claims = await prisma.claim.findMany({
    where: { projectId: project.id, reviewState: { not: "REJECTED" } },
    include: {
      subjectEntity: true,
      verifications: { orderBy: { verifiedAt: "desc" }, take: 1 },
      evidence: true,
    },
  });
  const q4End = performance.now();
  console.log(`[Q4] prisma.claim.findMany with includes (${claims.length} claims): ${(q4End - q4Start).toFixed(2)} ms`);

  const q5Start = performance.now();
  const openConflicts = await prisma.conflict.findMany({
    where: {
      projectId: project.id,
      status: { in: ["OPEN", "POSSIBLY_SUPERSEDED", "UNDER_REVIEW", "REQUIRES_CLARIFICATION"] },
    },
  });
  const q5End = performance.now();
  console.log(`[Q5] prisma.conflict.findMany (${openConflicts.length} conflicts): ${(q5End - q5Start).toFixed(2)} ms`);

  // Step 3: Run the full computeContinuityIntelligenceService
  console.log("\n--- Full Service Execution ---");
  const sStart = performance.now();
  const result = await computeContinuityIntelligenceService(project.id, user.id);
  const sEnd = performance.now();
  console.log(`[Service] computeContinuityIntelligenceService: ${(sEnd - sStart).toFixed(2)} ms`);
  console.log(`Score: ${result.score.score}, Status: ${result.score.status}`);

  // Step 4: Test Concurrent Execution (Simulating 6 concurrent API calls)
  console.log("\n--- Simulating 6 Concurrent Queries to Neon Pooler ---");
  const cStart = performance.now();
  await Promise.all([
    prisma.project.findUnique({ where: { id: project.id } }),
    prisma.project.findMany({ take: 10 }),
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.entity.findMany({ where: { projectId: project.id } }),
    prisma.claim.findMany({ where: { projectId: project.id }, take: 50 }),
    prisma.conflict.findMany({ where: { projectId: project.id } }),
  ]);
  const cEnd = performance.now();
  console.log(`[Concurrent 6 Queries]: ${(cEnd - cStart).toFixed(2)} ms`);

  // Step 5: Test Sequential 6 Queries
  console.log("\n--- Simulating 6 Sequential Queries to Neon Pooler ---");
  const seqStart = performance.now();
  await prisma.project.findUnique({ where: { id: project.id } });
  await prisma.project.findMany({ take: 10 });
  await prisma.user.findUnique({ where: { id: user.id } });
  await prisma.entity.findMany({ where: { projectId: project.id } });
  await prisma.claim.findMany({ where: { projectId: project.id }, take: 50 });
  await prisma.conflict.findMany({ where: { projectId: project.id } });
  const seqEnd = performance.now();
  console.log(`[Sequential 6 Queries]: ${(seqEnd - seqStart).toFixed(2)} ms`);
}

measure()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
