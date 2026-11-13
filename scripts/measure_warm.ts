import { prisma } from "../src/lib/db";
import { computeContinuityIntelligenceService } from "../src/services/intelligence/score";

async function measureWarm() {
  const user = await prisma.user.findFirst();
  const project = await prisma.project.findFirst({
    where: { name: { contains: "Smart Attendance" } },
  });

  if (!user || !project) {
    console.log("No user or project");
    return;
  }

  console.log("=== MEASURING WARM REPEATED EXECUTIONS ===");
  for (let i = 1; i <= 3; i++) {
    const start = performance.now();
    const res = await computeContinuityIntelligenceService(project.id, user.id);
    const dur = performance.now() - start;
    console.log(`[Run ${i}] computeContinuityIntelligenceService: ${dur.toFixed(2)} ms (Score: ${res.score.score})`);
  }
}

measureWarm()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
