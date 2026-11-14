import { prisma } from "../src/lib/db";

async function investigatePhase1() {
  console.log("=== PHASE 1 DATABASE INVESTIGATION ===");

  const projects = await prisma.project.findMany({
    include: {
      members: {
        include: { user: true },
      },
    },
  });

  console.log(`Found ${projects.length} project(s):`);
  for (const p of projects) {
    console.log(`\nProject: "${p.name}" (ID: ${p.id})`);
    console.log("Members:");
    for (const m of p.members) {
      console.log(`  - ${m.user.name || m.user.email} (${m.user.email}): Role ${m.role}`);
    }

    const totalClaims = await prisma.claim.count({
      where: { projectId: p.id },
    });
    console.log(`Total extracted claims: ${totalClaims}`);

    const allClaims = await prisma.claim.findMany({
      where: { projectId: p.id },
      include: {
        subjectEntity: true,
        verifications: {
          orderBy: { verifiedAt: "desc" },
          take: 1,
        },
        evidence: {
          include: {
            document: true,
            chunk: true,
          },
        },
      },
    });

    // Verification status grouping
    const statusCounts: Record<string, number> = {};
    for (const c of allClaims) {
      const vStatus = c.verifications[0]?.status || "UNVERIFIED (NO VERIFICATION RECORD)";
      statusCounts[vStatus] = (statusCounts[vStatus] || 0) + 1;
    }
    console.log("\nClaims grouped by verification status:");
    for (const [st, count] of Object.entries(statusCounts)) {
      console.log(`  - ${st}: ${count}`);
    }

    // Review state grouping & approved claims
    const reviewStateCounts: Record<string, number> = {};
    for (const c of allClaims) {
      reviewStateCounts[c.reviewState] = (reviewStateCounts[c.reviewState] || 0) + 1;
    }
    console.log("\nClaims grouped by review state:");
    for (const [rs, count] of Object.entries(reviewStateCounts)) {
      console.log(`  - ${rs}: ${count}`);
    }
    const approvedClaims = allClaims.filter((c) =>
      ["ACCEPTED", "EDITED"].includes(c.reviewState)
    );
    console.log(`Total approved claims (reviewState in ACCEPTED, EDITED): ${approvedClaims.length}`);

    // Category grouping
    const categoryCounts: Record<string, number> = {};
    for (const c of allClaims) {
      categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    }
    console.log("\nClaims grouped by category:");
    for (const [cat, count] of Object.entries(categoryCounts)) {
      console.log(`  - ${cat}: ${count}`);
    }
    const taskCategoryClaims = allClaims.filter((c) => c.category === "TASK");
    console.log(`Number of task-related claims (category === 'TASK'): ${taskCategoryClaims.length}`);

    // Attributes breakdown
    const attributeCounts: Record<string, number> = {};
    for (const c of allClaims) {
      attributeCounts[c.attributeKey] = (attributeCounts[c.attributeKey] || 0) + 1;
    }
    console.log("\nClaims grouped by attributeKey:");
    for (const [attr, count] of Object.entries(attributeCounts)) {
      console.log(`  - ${attr}: ${count}`);
    }

    console.log(`\nClaims with 'status' attribute: ${attributeCounts["status"] || 0}`);
    console.log(`Claims with 'owner' attribute: ${attributeCounts["owner"] || 0}`);
    console.log(`Claims with 'task' attribute: ${attributeCounts["task"] || 0}`);

    // Evidence references validation
    let validEvidenceCount = 0;
    let missingEvidenceCount = 0;
    for (const c of allClaims) {
      const hasEvidence = c.evidence.length > 0;
      const hasValidDoc = hasEvidence && c.evidence.every((e) => e.document && !e.document.deletedAt && e.excerpt);
      if (hasValidDoc) {
        validEvidenceCount++;
      } else {
        missingEvidenceCount++;
      }
    }
    console.log(`\nEvidence verification:`);
    console.log(`  - Claims with valid evidence references: ${validEvidenceCount}`);
    console.log(`  - Claims with missing/invalid evidence references: ${missingEvidenceCount}`);

    // Detailed dump of all claims
    console.log("\n--- DETAILED CLAIMS IN PROJECT ---");
    for (const c of allClaims) {
      const vStatus = c.verifications[0]?.status || "NONE";
      const ev = c.evidence[0];
      console.log(
        `[ID: ${c.id}] Subj: "${c.subjectEntity.canonicalName}" | Attr: "${c.attributeKey}" | ValRaw: "${c.valueRaw}" | ValNorm: "${c.valueNormalized}" | Cat: ${c.category} | Review: ${c.reviewState} | VerifStatus: ${vStatus} | EvDoc: "${ev?.document?.fileName || "NONE"}" | EvLoc: "${ev?.sourceLocation || "NONE"}" | Excerpt: "${ev?.excerpt || "NONE"}"`
      );
    }
  }
}

investigatePhase1()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
