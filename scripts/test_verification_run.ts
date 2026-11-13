import { prisma } from "../src/lib/db";
import { verifyClaimService } from "../src/services/verification";

async function testVerification() {
  const project = await prisma.project.findFirst({
    where: { name: "Smart Attendance System (Synthetic Demo)" },
  });
  if (!project) throw new Error("Project not found");

  const claims = await prisma.claim.findMany({
    where: { projectId: project.id },
  });

  const lead = await prisma.user.findUnique({
    where: { email: "lead@continuityx.demo" },
  });
  if (!lead) throw new Error("Lead user not found");

  console.log(`Testing verification for ${claims.length} claims in project ${project.id}...`);
  for (const c of claims) {
    console.log(`\nVerifying claim ${c.id} (${c.attributeKey}: "${c.valueRaw}")...`);
    try {
      const result = await verifyClaimService(project.id, c.id, { userId: lead.id });
      console.log(` -> Verification status: ${result.verification.status}`);
      console.log(` -> Gate 1 (source): ${result.verification.sourceGate}`);
      console.log(` -> Gate 2 (quote): ${result.verification.quoteGate}`);
      console.log(` -> Gate 3 (semantic): ${result.verification.semanticGate}`);
      console.log(` -> Gate 4 (conflict): ${result.verification.contradictionGate}`);
    } catch (err) {
      console.error(` -> Verification error:`, err);
    }
  }
}

testVerification()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
