import { prisma } from "../src/lib/db";

async function inspectAudit() {
  console.log("=== INSPECTING AUDIT LOGS ===");
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  for (const l of logs) {
    console.log(`[${l.createdAt.toISOString()}] Action: ${l.action}, Entity: ${l.entityType} (${l.entityId}), Project: ${l.projectId}`);
  }
}

inspectAudit().catch(console.error).finally(() => prisma.$disconnect());
