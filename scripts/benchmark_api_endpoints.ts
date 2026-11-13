import { prisma } from "../src/lib/db";
import { computeContinuityIntelligenceService } from "../src/services/intelligence/score";
import { computeRadarAlertsService } from "../src/services/radar";
import { getReviewQueueService } from "../src/services/reviews";
import { getProjectService } from "../src/services/projects";

async function benchmark() {
  console.log("=== CONTINUITYX POST-OPTIMIZATION ENDPOINT BENCHMARK ===");

  const user = await prisma.user.findFirst();
  const project = await prisma.project.findFirst({
    where: { name: { contains: "Smart Attendance" } },
  });

  if (!user || !project) {
    console.log("No test user or project found!");
    return;
  }

  console.log(`Target: ${project.name} (${project.id})`);
  console.log(`User: ${user.name} (${user.id})\n`);

  // 1. Intelligence
  const tIntelStart = performance.now();
  const intelResult = await computeContinuityIntelligenceService(project.id, user.id);
  const tIntelEnd = performance.now();
  console.log(`[POST-OPT] computeContinuityIntelligenceService: ${(tIntelEnd - tIntelStart).toFixed(2)} ms (Score: ${intelResult.score.score}, Status: ${intelResult.score.status})`);

  // 2. Radar
  const tRadarStart = performance.now();
  const radarResult = await computeRadarAlertsService(project.id, user.id);
  const tRadarEnd = performance.now();
  console.log(`[POST-OPT] computeRadarAlertsService: ${(tRadarEnd - tRadarStart).toFixed(2)} ms (Alerts: ${radarResult.alerts.length})`);

  // 3. Review Queue
  const tQueueStart = performance.now();
  const queueResult = await getReviewQueueService(project.id, user.id);
  const tQueueEnd = performance.now();
  console.log(`[POST-OPT] getReviewQueueService: ${(tQueueEnd - tQueueStart).toFixed(2)} ms (Claims in Queue: ${queueResult.queue.length})`);

  // 4. Project Details
  const tProjStart = performance.now();
  const projResult = await getProjectService(project.id, user.id);
  const tProjEnd = performance.now();
  console.log(`[POST-OPT] getProjectService: ${(tProjEnd - tProjStart).toFixed(2)} ms (Role: ${projResult.currentUserRole})`);

  // 5. Parallel Execution (Simulating dashboard loading)
  console.log("\n--- Simulating Parallel Dashboard Loading ---");
  const tAllStart = performance.now();
  await Promise.all([
    computeContinuityIntelligenceService(project.id, user.id),
    computeRadarAlertsService(project.id, user.id),
    getReviewQueueService(project.id, user.id),
    getProjectService(project.id, user.id),
  ]);
  const tAllEnd = performance.now();
  console.log(`[POST-OPT] All 4 Dashboard Services in Parallel: ${(tAllEnd - tAllStart).toFixed(2)} ms`);
}

benchmark()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
