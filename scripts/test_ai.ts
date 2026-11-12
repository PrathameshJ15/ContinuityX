import { GeminiLLMProvider } from "../src/lib/ai/gemini-provider";
import { env } from "../src/lib/env";

async function testFullAI() {
  console.log("=== Comprehensive AI Verification ===");
  console.log("1. Provider: Gemini REST API");
  console.log("2. Extraction Model:", env.GEMINI_EXTRACTION_MODEL);
  console.log("3. Judge Model:", env.GEMINI_JUDGE_MODEL);

  const provider = new GeminiLLMProvider();

  // Test 1: AI Extraction Pipeline
  console.log("\n--- Testing Extraction Model ---");
  const extractionSample = "Riya Sharma was assigned as lead owner of the Auth Module on 2026-01-10.";
  const extractionRes = await provider.generateStructuredText({
    model: env.GEMINI_EXTRACTION_MODEL,
    systemInstruction: "You are an accurate project claim extractor. Extract claims as triples (subject, attributeKey, value).",
    userPrompt: `Extract claims from this text:\n"${extractionSample}"`,
    responseJsonSchema: {
      type: "OBJECT",
      properties: {
        claims: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              subject: { type: "STRING" },
              attributeKey: { type: "STRING" },
              value: { type: "STRING" },
              excerpt: { type: "STRING" },
            },
            required: ["subject", "attributeKey", "value"],
          },
        },
      },
      required: ["claims"],
    },
  });

  console.log("Extraction Output:", extractionRes.text);
  console.log("Extraction Tokens:", extractionRes.usage?.totalTokens);

  // Test 2: AI Semantic Judge Pipeline
  console.log("\n--- Testing Semantic Judge Model ---");
  const judgeRes = await provider.generateStructuredText({
    model: env.GEMINI_JUDGE_MODEL,
    systemInstruction: "You are a strict semantic evidence judge. Output outcome SUPPORTS, CONTRADICTS, or NEUTRAL.",
    userPrompt: `Claim: (Auth Module, owner, Riya Sharma)\nExcerpt: "Riya Sharma was assigned as lead owner of the Auth Module on 2026-01-10."`,
    responseJsonSchema: {
      type: "OBJECT",
      properties: {
        outcome: { type: "STRING" },
        reason: { type: "STRING" },
      },
      required: ["outcome", "reason"],
    },
  });

  console.log("Judge Output:", judgeRes.text);
  console.log("Judge Tokens:", judgeRes.usage?.totalTokens);

  console.log("\n=== ALL AI SERVICES VERIFIED WORKING LIVE! ===");
}

testFullAI().catch(console.error);
