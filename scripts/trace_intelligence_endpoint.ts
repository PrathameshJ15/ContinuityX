import { prisma } from "../src/lib/db";
import { getCurrentUser, createSessionToken } from "../src/lib/auth";
import { requireProjectAccess } from "../src/lib/permissions";
import { computeContinuityIntelligenceService } from "../src/services/intelligence/score";

async function trace() {
  console.log("=== DETAILED INTELLIGENCE ENDPOINT TRACING ===");

  const user = await prisma.user.findFirst();
  const project = await prisma.project.findFirst({
    where: { name: { contains: "Smart Attendance" } },
  });

  if (!user || !project) {
    console.log("User or Project not found!");
    return;
  }

  console.log(`User: ${user.name} (${user.id})`);
  console.log(`Project: ${project.name} (${project.id})\n`);

  // Stage 1: Auth Token Verification & User DB Check
  const token = await createSessionToken({ id: user.id, email: user.email, name: user.name });
  
  console.log("--- 1. Measuring Auth Verification ---");
  const tAuthStart = performance.now();
  // Simulating getCurrentUser with DB lookup:
  const tDbUserStart = performance.now();
  const authUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true },
  });
  const tDbUserEnd = performance.now();
  console.log(`[Stage 1] Auth User DB verification took: ${(tDbUserEnd - tDbUserStart).toFixed(2)} ms`);

  // Stage 2: Authorization (requireProjectAccess)
  console.log("\n--- 2. Measuring Project Access Authorization ---");
  const tAuthzStart = performance.now();
  const access = await requireProjectAccess(project.id, "project:read", user.id);
  const tAuthzEnd = performance.now();
  console.log(`[Stage 2] requireProjectAccess took: ${(tAuthzEnd - tAuthzStart).toFixed(2)} ms (Role: ${access.role})`);

  // Stage 3: Inside computeContinuityIntelligenceService - Individual DB steps
  console.log("\n--- 3. Measuring Intelligence Service Individual DB Queries ---");
  
  const tEntStart = performance.now();
  const entities = await prisma.entity.findMany({
    where: { projectId: project.id, mergedIntoId: null },
  });
  const tEntEnd = performance.now();
  console.log(`[Stage 3a] prisma.entity.findMany (${entities.length} items): ${(tEntEnd - tEntStart).toFixed(2)} ms`);

  const tClaimStart = performance.now();
  const claims = await prisma.claim.findMany({
    where: { projectId: project.id, reviewState: { not: "REJECTED" } },
    include: {
      subjectEntity: true,
      verifications: { orderBy: { verifiedAt: "desc" }, take: 1 },
      evidence: true,
    },
  });
  const tClaimEnd = performance.now();
  console.log(`[Stage 3b] prisma.claim.findMany with includes (${claims.length} items): ${(tClaimEnd - tClaimStart).toFixed(2)} ms`);

  const tConfStart = performance.now();
  const openConflicts = await prisma.conflict.findMany({
    where: {
      projectId: project.id,
      status: { in: ["OPEN", "POSSIBLY_SUPERSEDED", "UNDER_REVIEW", "REQUIRES_CLARIFICATION"] },
    },
  });
  const tConfEnd = performance.now();
  console.log(`[Stage 3c] prisma.conflict.findMany (${openConflicts.length} items): ${(tConfEnd - tConfStart).toFixed(2)} ms`);

  // Stage 4: In-Memory Intelligence Algorithm (Continuity Score + Bus Factor)
  console.log("\n--- 4. Measuring Pure In-Memory Computation ---");
  const tCompStart = performance.now();

  const claimsByEntity = new Map<string, typeof claims>();
  for (const c of claims) {
    const list = claimsByEntity.get(c.subjectEntityId) || [];
    list.push(c);
    claimsByEntity.set(c.subjectEntityId, list);
  }

  const inboundDependencies = new Set<string>();
  for (const c of claims) {
    if (c.attributeKey === "depends_on") {
      if (c.valueNormalized) inboundDependencies.add(c.valueNormalized.toLowerCase());
      if (c.valueRaw) inboundDependencies.add(c.valueRaw.toLowerCase());
    }
  }

  const components = entities.filter((e) => e.type === "COMPONENT");
  const criticalComponents = components.filter((comp) => {
    if (comp.isCritical) return true;
    const cList = claimsByEntity.get(comp.id) || [];
    if (cList.length >= 3) return true;
    if (inboundDependencies.has(comp.canonicalName.toLowerCase())) return true;
    return false;
  });

  // Serialization benchmark
  const testPayload = { entities, claims, openConflicts };
  const tSerStart = performance.now();
  const jsonStr = JSON.stringify(testPayload);
  const tSerEnd = performance.now();
  console.log(`[Stage 4] In-memory calculations took: ${(tSerStart - tCompStart).toFixed(4)} ms`);
  console.log(`[Stage 4] JSON.stringify (${jsonStr.length} bytes) took: ${(tSerEnd - tSerStart).toFixed(4)} ms`);

  // Stage 5: Full computeContinuityIntelligenceService call
  console.log("\n--- 5. Full End-to-End Service Execution ---");
  const tFullStart = performance.now();
  const fullResult = await computeContinuityIntelligenceService(project.id, user.id);
  const tFullEnd = performance.now();
  console.log(`[Stage 5] Full computeContinuityIntelligenceService: ${(tFullEnd - tFullStart).toFixed(2)} ms`);
}

trace()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
