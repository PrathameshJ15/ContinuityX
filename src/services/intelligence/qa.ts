import { prisma } from "@/lib/db";
import { requireProjectAccess } from "@/lib/permissions";
import { GeminiLLMProvider } from "@/lib/ai/gemini-provider";
import { env } from "@/lib/env";
import { writeAudit } from "@/lib/audit";

export const FIXED_REFUSAL_MESSAGE =
  "No supporting evidence was found in the approved project knowledge. This question requires clarification from the project owner.";

export interface QARequest {
  projectId: string;
  question: string;
  userId: string;
}

export interface QACitation {
  claimId: string;
  subject: string;
  attribute: string;
  value: string;
  evidenceStatus: string;
  documentName?: string;
  location?: string;
  excerpt?: string;
}

export interface QAResponse {
  answer: string;
  supported: boolean;
  modelCalled: boolean;
  citations: QACitation[];
  question: string;
  timestamp: string;
}

/**
 * Deterministic attribute intent matcher for natural language questions
 */
function extractAttributeKeywords(questionLower: string): string[] {
  const matchedAttributes = new Set<string>();

  if (/(why|how|reason|rationale|decid|choice|chose|select)/i.test(questionLower)) {
    matchedAttributes.add("rationale");
    matchedAttributes.add("selected_technology");
  }
  if (/(who|owner|lead|assign|responsible|team|contact)/i.test(questionLower)) {
    matchedAttributes.add("owner");
  }
  if (/(status|progress|state|pending|done|finish|completed|wip|active|task)/i.test(questionLower)) {
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

/**
 * Hardened Handover Q&A Service.
 * Implements SPEC.md V3.2 Hardening rules:
 * 1. Reads APPROVED claims only (reviewState ACCEPTED or EDITED).
 * 2. If nothing is retrieved deterministically, returns FIXED_REFUSAL_MESSAGE without model call.
 * 3. Model receives strictly retrieved claims enclosed in untrusted tags with structured JSON output.
 * 4. Server-side validation: If any citedClaimId is not in retrieved set or supported=false, returns refusal.
 */
export async function askHandoverQuestionService(
  request: QARequest,
  llmProvider: GeminiLLMProvider = new GeminiLLMProvider()
): Promise<QAResponse> {
  const { projectId, question, userId } = request;
  await requireProjectAccess(projectId, "qa:ask_approved", userId);

  const cleanQuestion = question.trim();
  const questionLower = cleanQuestion.toLowerCase();

  // 1. Fetch only APPROVED/ACCEPTED claims from project
  const approvedClaims = await prisma.claim.findMany({
    where: {
      projectId,
      reviewState: { in: ["ACCEPTED", "EDITED"] },
    },
    include: {
      subjectEntity: {
        include: { aliases: true },
      },
      verifications: {
        orderBy: { verifiedAt: "desc" },
        take: 1,
      },
      evidence: {
        include: {
          document: { select: { id: true, fileName: true } },
        },
      },
    },
  });

  // If no claims are approved in the project, refuse immediately without calling model
  if (approvedClaims.length === 0) {
    return {
      answer: FIXED_REFUSAL_MESSAGE,
      supported: false,
      modelCalled: false,
      citations: [],
      question: cleanQuestion,
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Deterministic retrieval matching: Entity, Aliases, Attribute, Keywords
  const matchedAttributes = extractAttributeKeywords(questionLower);
  const questionTokens = questionLower
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scoredClaims = approvedClaims
    .map((claim) => {
      let score = 0;
      const entityName = claim.subjectEntity.canonicalName.toLowerCase();
      const entityAliases = claim.subjectEntity.aliases.map((a) => a.alias.toLowerCase());
      const valueRawLower = claim.valueRaw.toLowerCase();
      const valueNormLower = (claim.valueNormalized || "").toLowerCase();

      // Entity match
      if (questionLower.includes(entityName)) {
        score += 10;
      }
      for (const alias of entityAliases) {
        if (questionLower.includes(alias)) {
          score += 8;
        }
      }

      // Attribute intent match
      if (matchedAttributes.includes(claim.attributeKey)) {
        score += 5;
      }

      // Token overlap in value
      for (const token of questionTokens) {
        if (entityName.includes(token)) score += 3;
        if (valueRawLower.includes(token)) score += 4;
        if (valueNormLower && valueNormLower.includes(token)) score += 4;
      }

      return { claim, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  // Take top 8 most relevant claims
  const retrievedClaims = scoredClaims.slice(0, 8).map((sc) => sc.claim);
  const retrievedClaimIdSet = new Set(retrievedClaims.map((c) => c.id));

  // Invariant 2: If nothing was retrieved, return fixed refusal WITHOUT calling model
  if (retrievedClaims.length === 0) {
    return {
      answer: FIXED_REFUSAL_MESSAGE,
      supported: false,
      modelCalled: false,
      citations: [],
      question: cleanQuestion,
      timestamp: new Date().toISOString(),
    };
  }

  // 3. Build untrusted structured data for Gemini model call
  const serializedClaims = retrievedClaims.map((c) => ({
    claimId: c.id,
    subject: c.subjectEntity.canonicalName,
    attribute: c.attributeKey,
    value: c.valueRaw,
    normalizedValue: c.valueNormalized,
    evidenceExcerpt: c.evidence[0]?.excerpt || null,
  }));

  const systemInstruction = `You are a strict, proof-carrying handover assistant.
Answer the user's question ONLY using the facts present in the provided untrusted approved claims data.
Never assume, interpolate, or invent information not explicitly stated in the claims.
If the provided claims do NOT contain sufficient information to answer the question, set "supported": false and answer with the exact refusal message:
"${FIXED_REFUSAL_MESSAGE}"

You must return valid JSON matching the schema:
{
  "answer": "string",
  "citedClaimIds": ["string"],
  "supported": true | false
}`;

  const userPrompt = `User Question: "${cleanQuestion}"

<untrusted_approved_claims>
${JSON.stringify(serializedClaims, null, 2)}
</untrusted_approved_claims>

Answer based strictly on the approved claims above. If supported, list the exact claimId(s) supporting your answer in citedClaimIds.`;

  const responseJsonSchema = {
    type: "OBJECT",
    properties: {
      answer: { type: "STRING" },
      citedClaimIds: {
        type: "ARRAY",
        items: { type: "STRING" },
      },
      supported: { type: "BOOLEAN" },
    },
    required: ["answer", "citedClaimIds", "supported"],
  };

  try {
    const llmResponse = await llmProvider.generateStructuredText({
      model: env.GEMINI_JUDGE_MODEL || env.GEMINI_EXTRACTION_MODEL,
      systemInstruction,
      userPrompt,
      temperature: 0,
      responseJsonSchema,
    });

    const parsed = JSON.parse(llmResponse.text) as {
      answer?: string;
      citedClaimIds?: string[];
      supported?: boolean;
    };

    // 4. Server-Side Validation: Verify every cited claim ID was in the retrieved set
    const citedIds = parsed.citedClaimIds || [];
    const allCitationsValid =
      citedIds.length > 0 && citedIds.every((id) => retrievedClaimIdSet.has(id));

    if (!parsed.supported || !allCitationsValid || !parsed.answer) {
      return {
        answer: FIXED_REFUSAL_MESSAGE,
        supported: false,
        modelCalled: true,
        citations: [],
        question: cleanQuestion,
        timestamp: new Date().toISOString(),
      };
    }

    // Build verified citations list
    const citations: QACitation[] = citedIds.map((id) => {
      const claim = retrievedClaims.find((c) => c.id === id)!;
      const ev = claim.evidence[0];
      return {
        claimId: claim.id,
        subject: claim.subjectEntity.canonicalName,
        attribute: claim.attributeKey,
        value: claim.valueRaw,
        evidenceStatus: claim.verifications[0]?.status || "UNVERIFIED",
        documentName: ev?.document?.fileName,
        location: ev?.sourceLocation,
        excerpt: ev?.excerpt,
      };
    });

    await writeAudit({
      projectId,
      userId,
      action: "QA_QUESTION_ANSWERED",
      entityType: "QA_SESSION",
      entityId: `qa-${Date.now()}`,
      metadata: {
        questionLength: cleanQuestion.length,
        retrievedCount: retrievedClaims.length,
        citedCount: citations.length,
      },
    });

    return {
      answer: parsed.answer,
      supported: true,
      modelCalled: true,
      citations,
      question: cleanQuestion,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    console.error("[Hardened QA Service Error]", err);
    // On model or parsing failure, fail-closed to the refusal message
    return {
      answer: FIXED_REFUSAL_MESSAGE,
      supported: false,
      modelCalled: true,
      citations: [],
      question: cleanQuestion,
      timestamp: new Date().toISOString(),
    };
  }
}
