import { PrismaClient } from "@prisma/client";

let queryLog: Array<{ query: string; duration: number }> = [];

const prismaWithLogging = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: [
    { emit: "event", level: "query" },
    { emit: "stdout", level: "error" },
  ],
});

prismaWithLogging.$on("query", (e: { query: string; duration: number }) => {
  queryLog.push({ query: e.query, duration: e.duration });
});

// Set global singleton before services are loaded
(globalThis as unknown as { prisma: PrismaClient }).prisma = prismaWithLogging;

async function traceQueries() {
  console.log("=== PRISMA QUERY COUNT & DURATION AUDIT ===");

  const { requireProjectAccess } = await import("../src/lib/permissions");
  const { computeContinuityIntelligenceService } = await import("../src/services/intelligence/score");
  const { computeRadarAlertsService } = await import("../src/services/radar");
  const { getReviewQueueService } = await import("../src/services/reviews");
  const { listClaimsService } = await import("../src/services/claims");
  const { listEntitiesService } = await import("../src/services/entities");
  const { listDocumentsService } = await import("../src/services/documents");

  const PROJECT_ID = "cmwdiir940003t1c4i0b29dtg";

  const lead = await prismaWithLogging.user.findUnique({
    where: { email: "lead@continuityx.demo" },
  });
  if (!lead) throw new Error("Lead user not found");

  const services = [
    {
      name: "requireProjectAccess (Authz baseline)",
      run: () => requireProjectAccess(PROJECT_ID, "project:read", lead.id),
    },
    {
      name: "computeContinuityIntelligenceService",
      run: () => computeContinuityIntelligenceService(PROJECT_ID, lead.id),
    },
    {
      name: "computeRadarAlertsService",
      run: () => computeRadarAlertsService(PROJECT_ID, lead.id),
    },
    {
      name: "getReviewQueueService",
      run: () => getReviewQueueService(PROJECT_ID, lead.id),
    },
    {
      name: "listClaimsService (page 1, limit 20)",
      run: () => listClaimsService(PROJECT_ID, { page: 1, limit: 20 }, lead.id),
    },
    {
      name: "listEntitiesService",
      run: () => listEntitiesService(PROJECT_ID, false, lead.id),
    },
    {
      name: "listDocumentsService (page 1, limit 10)",
      run: () => listDocumentsService(PROJECT_ID, 1, 10, lead.id),
    },
  ];

  const auditReport: Array<{
    service: string;
    totalMs: number;
    prismaQueryCount: number;
    dbWaitMs: number;
  }> = [];

  for (const s of services) {
    queryLog = [];
    const t0 = performance.now();
    await s.run();
    const totalMs = performance.now() - t0;
    const dbWaitMs = queryLog.reduce((acc, q) => acc + q.duration, 0);

    auditReport.push({
      service: s.name,
      totalMs: Math.round(totalMs),
      prismaQueryCount: queryLog.length,
      dbWaitMs: Math.round(dbWaitMs),
    });
  }

  console.table(auditReport);

  // Print sample queries for inspect
  console.log("\nSample Prisma queries executed during getReviewQueueService:");
  queryLog = [];
  await getReviewQueueService(PROJECT_ID, lead.id);
  for (let i = 0; i < queryLog.length; i++) {
    console.log(`\nQuery ${i + 1} (${queryLog[i].duration} ms):`);
    console.log(queryLog[i].query.slice(0, 300) + (queryLog[i].query.length > 300 ? "..." : ""));
  }

  await prismaWithLogging.$disconnect();
}

traceQueries().catch(console.error);
