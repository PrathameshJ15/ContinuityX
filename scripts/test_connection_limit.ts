import { PrismaClient } from "@prisma/client";

async function testConnectionLimit() {
  const basePoolerUrl = process.env.DATABASE_URL!;
  console.log("Current URL has connection_limit?", basePoolerUrl.includes("connection_limit"));

  const tunedUrl = basePoolerUrl.includes("connection_limit")
    ? basePoolerUrl
    : `${basePoolerUrl}&connection_limit=20`;

  console.log("Testing with tuned connection_limit=20...");
  const prismaTuned = new PrismaClient({
    datasources: { db: { url: tunedUrl } },
  });

  const start = performance.now();
  await prismaTuned.$connect();
  const connectTime = performance.now() - start;
  console.log(`Prisma $connect took: ${connectTime.toFixed(2)} ms`);

  // Run 6 concurrent queries
  const qStart = performance.now();
  await Promise.all([
    prismaTuned.$queryRaw`SELECT 1`,
    prismaTuned.$queryRaw`SELECT 2`,
    prismaTuned.$queryRaw`SELECT 3`,
    prismaTuned.$queryRaw`SELECT 4`,
    prismaTuned.$queryRaw`SELECT 5`,
    prismaTuned.$queryRaw`SELECT 6`,
  ]);
  const qEnd = performance.now();
  console.log(`6 concurrent $queryRaw queries took: ${(qEnd - qStart).toFixed(2)} ms`);

  await prismaTuned.$disconnect();
}

testConnectionLimit().catch(console.error);
