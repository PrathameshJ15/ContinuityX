/**
 * Safe Test Data Cleanup Script (Item 6)
 *
 * BACKUP SAFEGUARDS:
 * - Before running against production, create a database snapshot (e.g., pg_dump / Neon branch snapshot).
 * - Target-restricted: Only deletes explicit temporary test entities and test projects ("DEV Phase 3*").
 * - Invariant: NEVER touch the seeded demo project "Smart Attendance System (Synthetic Demo)" (cmwdiir940003t1c4i0b29dtg).
 * - Invariant: NEVER touch demo user accounts (lead@continuityx.demo, member@continuityx.demo).
 * - Idempotent: Can be run multiple times safely without error.
 */
import { prisma } from "../src/lib/db";

async function cleanup() {
  console.log("=== ContinuityX Safe Test Data Cleanup ===");

  // 1. Remove invalid entity "12345678" if it still exists
  const invalidEntity = await prisma.entity.findFirst({
    where: { canonicalName: "12345678" },
  });

  if (invalidEntity) {
    console.log(`Found invalid entity: ${invalidEntity.canonicalName} (${invalidEntity.id})`);
    await prisma.entityAlias.deleteMany({
      where: { entityId: invalidEntity.id },
    });
    await prisma.entity.delete({
      where: { id: invalidEntity.id },
    });
    console.log(`Successfully deleted invalid entity "${invalidEntity.canonicalName}".`);
  } else {
    console.log("No entity named '12345678' found (already removed).");
  }

  // 2. Remove temporary project "DEV Phase 3 Live Check (Temp)"
  const tempProject = await prisma.project.findFirst({
    where: { name: { contains: "DEV Phase 3" } },
  });

  if (tempProject) {
    console.log(`Found temporary project: ${tempProject.name} (${tempProject.id})`);

    const docs = await prisma.document.findMany({ where: { projectId: tempProject.id } });
    for (const d of docs) {
      await prisma.claimEvidence.deleteMany({ where: { documentId: d.id } });
      await prisma.documentChunk.deleteMany({ where: { documentId: d.id } });
    }
    await prisma.extractionRun.deleteMany({ where: { projectId: tempProject.id } });
    await prisma.document.deleteMany({ where: { projectId: tempProject.id } });
    await prisma.projectMember.deleteMany({ where: { projectId: tempProject.id } });
    await prisma.auditLog.deleteMany({ where: { projectId: tempProject.id } });
    await prisma.project.delete({ where: { id: tempProject.id } });

    console.log(`Successfully deleted temporary project "${tempProject.name}".`);
  } else {
    console.log("No temporary project matching 'DEV Phase 3' found.");
  }

  // 3. Post-cleanup verification
  const remainingProjects = await prisma.project.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { members: true, documents: true, claims: true, entities: true } },
    },
  });
  console.log("\n=== Remaining Legitimate Projects ===");
  console.table(remainingProjects);

  const remainingEntities = await prisma.entity.findMany({
    where: { canonicalName: "12345678" },
  });
  console.log(`Remaining '12345678' entities: ${remainingEntities.length}`);
}

cleanup()
  .catch((err) => {
    console.error("Cleanup failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
