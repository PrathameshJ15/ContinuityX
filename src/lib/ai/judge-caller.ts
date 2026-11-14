import { env } from "@/lib/env";
import { GroqLLMProvider } from "./groq-provider";
import {
  buildJudgePrompt,
  JUDGE_PROMPT_VERSION,
  JudgeOutput,
  judgeOutputSchema,
  JudgePromptInput,
} from "./prompts/judge-v1";
import { LLMProvider, executeWithRetryBackoff } from "./provider";

export interface SemanticJudgeResult {
  outcome: "SUPPORTS" | "NEUTRAL" | "CONTRADICTS" | "INSUFFICIENT_CONTEXT" | "ERROR";
  reason: string;
  judgeModel: string;
  judgePromptVersion: string;
  rawJudgeOutput: unknown;
}

/**
 * Invokes the independent semantic verification judge.
 * Temperature is locked to 0 for maximum reproducibility.
 * Includes one controlled retry if JSON parsing/validation fails.
 */
export async function runSemanticJudge(
  input: JudgePromptInput,
  provider?: LLMProvider
): Promise<SemanticJudgeResult> {
  const llm = provider || new GroqLLMProvider();
  const judgeModel = env.GROQ_VERIFICATION_MODEL || "openai/gpt-oss-20b";
  const { systemPrompt, userPrompt } = buildJudgePrompt(input);

  const attemptEvaluation = async (): Promise<JudgeOutput> => {
    const response = await executeWithRetryBackoff(
      () =>
        llm.generateStructuredText({
          model: judgeModel,
          systemInstruction: systemPrompt,
          userPrompt,
          temperature: 0,
          timeoutMs: 15000,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
      }
    );

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.text);
    } catch {
      // Clean possible markdown code fences
      const cleaned = response.text.replace(/```(?:json)?/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    const validated = judgeOutputSchema.safeParse(parsed);
    if (!validated.success) {
      throw new Error(`Judge output schema validation failed: ${validated.error.message}`);
    }

    return validated.data;
  };

  try {
    // Attempt 1
    try {
      const result = await attemptEvaluation();
      return {
        outcome: result.outcome,
        reason: result.reason,
        judgeModel,
        judgePromptVersion: JUDGE_PROMPT_VERSION,
        rawJudgeOutput: result,
      };
    } catch {
      // Attempt 2 (One controlled retry)
      const retryResult = await attemptEvaluation();
      return {
        outcome: retryResult.outcome,
        reason: retryResult.reason,
        judgeModel,
        judgePromptVersion: JUDGE_PROMPT_VERSION,
        rawJudgeOutput: retryResult,
      };
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown judge evaluation failure";
    return {
      outcome: "ERROR",
      reason: `Semantic judge execution error: ${errorMsg.slice(0, 200)}`,
      judgeModel,
      judgePromptVersion: JUDGE_PROMPT_VERSION,
      rawJudgeOutput: { error: errorMsg },
    };
  }
}
