import { prisma } from "../src/lib/db";

async function inspectAuditAndClaims() {
  const claims = await prisma.claim.findMany({
    select: {
      id: true,
      createdAt: true,
      attributeKey: true,
      reviewState: true,
      verifications: true,
    },
  });
  console.log("Claims:", claims);

  const audits = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  console.log("Recent audits:", audits);
}

inspectAuditAndClaims()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
