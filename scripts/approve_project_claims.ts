import { prisma } from "../src/lib/db";
import { reviewClaimService } from "../src/services/reviews";

async function approveProjectClaims() {
  const project = await prisma.project.findFirst({
    where: { name: "Smart Attendance System (Synthetic Demo)" },
  });
  if (!project) throw new Error("Project not found");

  const lead = await prisma.user.findUnique({
    where: { email: "lead@continuityx.demo" },
  });
  if (!lead) throw new Error("Lead user not found");

  const claims = await prisma.claim.findMany({
    where: { projectId: project.id, reviewState: "PENDING" },
  });

  console.log(`Found ${claims.length} pending claims to review and approve...`);
  for (const c of claims) {
    console.log(`Reviewing claim ${c.id}: [${c.attributeKey}] "${c.valueRaw}"`);
    await reviewClaimService({
      projectId: project.id,
      claimId: c.id,
      expectedVersion: c.version,
      decision: "ACCEPTED",
      reason: "Approved from cited design_doc.pdf for project demo",
      userId: lead.id,
    });
  }

  const approvedCount = await prisma.claim.count({
    where: { projectId: project.id, reviewState: "ACCEPTED" },
  });
  console.log(`Total approved claims now: ${approvedCount}`);
}

approveProjectClaims()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
