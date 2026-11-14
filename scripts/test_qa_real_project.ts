import { prisma } from "../src/lib/db";
import { askHandoverQuestionService } from "../src/services/intelligence/qa";

async function testRealProjectQA() {
  console.log("=== PHASE 3: TESTING Q&A WITH REAL DATABASE DATA ===");

  const project = await prisma.project.findFirst({
    where: { name: "Smart Attendance System (Synthetic Demo)" },
  });
  if (!project) throw new Error("Project not found");

  const lead = await prisma.user.findUnique({
    where: { email: "lead@continuityx.demo" },
  });
  if (!lead) throw new Error("Lead user not found");

  const approvedCount = await prisma.claim.count({
    where: { projectId: project.id, reviewState: { in: ["ACCEPTED", "EDITED"] } },
  });
  console.log(`Using project: "${project.name}" (${project.id})`);
  console.log(`Approved claims in database: ${approvedCount}`);

  const questions = [
    "What tasks are currently in progress?",
    "Which tasks are completed?",
    "Who owns the authentication module?",
    "What decisions have been approved?",
    "What tasks are currently in progress or completed?", // also test original failure
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n==================================================`);
    console.log(`QUESTION ${i + 1}: "${q}"`);
    console.log(`==================================================`);

    try {
      const res = await askHandoverQuestionService({
        projectId: project.id,
        question: q,
        userId: lead.id,
      });

      console.log(`Answer:\n${res.answer}`);
      console.log(`\nSupported: ${res.supported}`);
      console.log(`Model Called: ${res.modelCalled}`);
      console.log(`Citations Count: ${res.citations.length}`);
      if (res.citations.length > 0) {
        console.log(`\nCitations:`);
        for (const c of res.citations) {
          console.log(
            `  - Claim [${c.claimId}]: ${c.subject} -> ${c.attribute}: "${c.value}"`
          );
          console.log(`    Status: ${c.evidenceStatus} | Doc: "${c.documentName}" | Loc: "${c.location}"`);
          console.log(`    Excerpt: "${c.excerpt}"`);
        }
      }
    } catch (err) {
      console.error(`Error answering question:`, err);
    }
  }
}

testRealProjectQA()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
