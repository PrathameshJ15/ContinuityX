import { prisma } from "../src/lib/db";

async function inspectDbCounts() {
  console.log("=== INSPECTING DATABASE COUNTS ===");
  const [
    users,
    projects,
    members,
    documents,
    chunks,
    entities,
    aliases,
    claims,
    evidences,
    verifications,
    conflicts,
    handovers,
    auditLogs
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.projectMember.count(),
    prisma.document.count(),
    prisma.documentChunk.count(),
    prisma.entity.count(),
    prisma.entityAlias.count(),
    prisma.claim.count(),
    prisma.claimEvidence.count(),
    prisma.verification.count(),
    prisma.conflict.count(),
    prisma.handover.count(),
    prisma.auditLog.count()
  ]);

  console.log(`Users: ${users}`);
  console.log(`Projects: ${projects}`);
  console.log(`ProjectMembers: ${members}`);
  console.log(`Documents: ${documents}`);
  console.log(`Chunks: ${chunks}`);
  console.log(`Entities: ${entities}`);
  console.log(`EntityAliases: ${aliases}`);
  console.log(`Claims: ${claims}`);
  console.log(`Evidences: ${evidences}`);
  console.log(`Verifications: ${verifications}`);
  console.log(`Conflicts: ${conflicts}`);
  console.log(`Handovers: ${handovers}`);
  console.log(`AuditLogs: ${auditLogs}`);

  const allProjects = await prisma.project.findMany({
    include: {
      _count: {
        select: {
          documents: true,
          entities: true,
          claims: true,
          conflicts: true,
          members: true
        }
      }
    }
  });

  console.log("\nProjects breakdown:");
  for (const p of allProjects) {
    console.log(`- Project "${p.name}" (${p.id}):`);
    console.log(`    Documents: ${p._count.documents}`);
    console.log(`    Entities: ${p._count.entities}`);
    console.log(`    Claims: ${p._count.claims}`);
    console.log(`    Conflicts: ${p._count.conflicts}`);
    console.log(`    Members: ${p._count.members}`);
  }
}

inspectDbCounts().catch(console.error).finally(() => prisma.$disconnect());
