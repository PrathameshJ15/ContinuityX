import { PrismaClient } from "@prisma/client";

async function measureDb() {
  console.log("=== DB COLD VS WARM MEASUREMENT ===");

  // Cold client & connection
  const coldStart = performance.now();
  const prismaCold = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } },
    log: ["warn", "error"],
  });
  await prismaCold.$connect();
  const coldConnectTime = performance.now() - coldStart;
  console.log(`Cold $connect time: ${coldConnectTime.toFixed(2)} ms`);

  // Cold first query
  const q1Start = performance.now();
  await prismaCold.$queryRaw`SELECT 1 as result`;
  const q1Time = performance.now() - q1Start;
  console.log(`Cold first query (SELECT 1): ${q1Time.toFixed(2)} ms`);

  // Warm queries
  const warmTimes: number[] = [];
  for (let i = 1; i <= 5; i++) {
    const start = performance.now();
    await prismaCold.$queryRaw`SELECT 1 as result`;
    warmTimes.push(performance.now() - start);
  }
  const avgWarm = warmTimes.reduce((a, b) => a + b, 0) / warmTimes.length;
  console.log(`Warm queries (SELECT 1 avg of 5): ${avgWarm.toFixed(2)} ms (individual: ${warmTimes.map(t => t.toFixed(0)).join(", ")} ms)`);

  // Real data query (Project findUnique)
  const pStart = performance.now();
  const project = await prismaCold.project.findFirst({ select: { id: true, name: true } });
  const pTime = performance.now() - pStart;
  console.log(`Warm indexed project query: ${pTime.toFixed(2)} ms (project: ${project?.name})`);

  await prismaCold.$disconnect();
}

measureDb().catch(console.error);
