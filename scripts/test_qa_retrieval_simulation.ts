import { prisma } from "../src/lib/db";

function extractAttributeKeywords(questionLower: string): string[] {
  const matchedAttributes = new Set<string>();

  if (/(why|how|reason|rationale|decid|decis|choice|chose|select|tech|architect)/i.test(questionLower)) {
    matchedAttributes.add("rationale");
    matchedAttributes.add("selected_technology");
  }
  if (/(who|owner|lead|assign|responsible|team|contact|person)/i.test(questionLower)) {
    matchedAttributes.add("owner");
  }
  if (/(status|progress|state|pending|done|finish|completed|complete|wip|active|task|todo)/i.test(questionLower)) {
    matchedAttributes.add("status");
  }
  if (/(risk|block|issue|impediment|hazard|delay)/i.test(questionLower)) {
    matchedAttributes.add("risk");
  }
  if (/(depend|prereq|require|relies|need)/i.test(questionLower)) {
    matchedAttributes.add("depends_on");
  }
  if (/(question|unknown|open|clarif)/i.test(questionLower)) {
    matchedAttributes.add("open_question");
  }

  return Array.from(matchedAttributes);
}

function extractCategoryKeywords(questionLower: string): string[] {
  const matchedCategories = new Set<string>();

  if (/(task|action|todo|progress|work item|wip|deliverable|completed|finish|pending)/i.test(questionLower)) {
    matchedCategories.add("TASK");
  }
  if (/(decision|rationale|architect|technology|choice|selected|chose|decid|decis)/i.test(questionLower)) {
    matchedCategories.add("DECISION");
  }
  if (/(owner|ownership|lead|assign|responsible|team|contact|person)/i.test(questionLower)) {
    matchedCategories.add("OWNERSHIP");
  }

  return Array.from(matchedCategories);
}

async function simulateRetrieval() {
  const project = await prisma.project.findFirst({
    where: { name: "Smart Attendance System (Synthetic Demo)" },
  });
  if (!project) throw new Error("Project not found");

  const claims = await prisma.claim.findMany({
    where: { projectId: project.id },
    include: {
      subjectEntity: {
        include: { aliases: true },
      },
      verifications: true,
      evidence: {
        include: { document: true },
      },
    },
  });

  const testQuestions = [
    "What tasks are currently in progress or completed?",
    "What tasks are currently in progress?",
    "Which tasks are completed?",
    "Who owns the authentication module?",
    "What decisions have been approved?",
  ];

  console.log("=== SIMULATING RETRIEVAL LOGIC ON CLAIMS (assuming approved) ===");
  for (const q of testQuestions) {
    console.log(`\n--------------------------------------------------`);
    console.log(`QUESTION: "${q}"`);
    const cleanQuestion = q.trim();
    const questionLower = cleanQuestion.toLowerCase();

    const matchedAttributes = extractAttributeKeywords(questionLower);
    const matchedCategories = extractCategoryKeywords(questionLower);
    console.log(`Matched Attributes:`, matchedAttributes);
    console.log(`Matched Categories:`, matchedCategories);

    const questionTokens = questionLower
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2);
    console.log(`Question Tokens:`, questionTokens);

    const scoredClaims = claims
      .map((claim) => {
        let score = 0;
        const entityName = claim.subjectEntity.canonicalName.toLowerCase();
        const entityAliases = claim.subjectEntity.aliases.map((a) => a.alias.toLowerCase());
        const valueRawLower = claim.valueRaw.toLowerCase();
        const valueNormLower = (claim.valueNormalized || "").toLowerCase();
        const categoryLower = claim.category.toLowerCase();
        const attributeKeyLower = claim.attributeKey.toLowerCase();

        // Entity match
        let entityMatched = false;
        if (questionLower.includes(entityName)) {
          score += 10;
          entityMatched = true;
        }
        for (const alias of entityAliases) {
          if (questionLower.includes(alias)) {
            score += 8;
            entityMatched = true;
          }
        }

        // Attribute intent match
        let attrMatched = false;
        if (matchedAttributes.includes(claim.attributeKey)) {
          score += 5;
          attrMatched = true;
        }

        // Category intent match
        let catMatched = false;
        if (matchedCategories.includes(claim.category)) {
          score += 5;
          catMatched = true;
        }

        // Token overlap in value
        let tokenOverlapCount = 0;
        for (const token of questionTokens) {
          if (entityName.includes(token)) { score += 3; tokenOverlapCount++; }
          if (valueRawLower.includes(token)) { score += 4; tokenOverlapCount++; }
          if (valueNormLower && valueNormLower.includes(token)) { score += 4; tokenOverlapCount++; }
          if (categoryLower.includes(token)) { score += 2; tokenOverlapCount++; }
          if (attributeKeyLower.includes(token)) { score += 2; tokenOverlapCount++; }
        }

        return { claim, score, entityMatched, attrMatched, catMatched, tokenOverlapCount };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    console.log(`Retrieved claims count: ${scoredClaims.length}`);
    for (const sc of scoredClaims) {
      console.log(
        `  -> Score ${sc.score} | Subj: "${sc.claim.subjectEntity.canonicalName}" | Attr: "${sc.claim.attributeKey}" | Val: "${sc.claim.valueRaw}" (EntityMatch: ${sc.entityMatched}, AttrMatch: ${sc.attrMatched}, TokenOverlap: ${sc.tokenOverlapCount})`
      );
    }
  }
}

simulateRetrieval()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
