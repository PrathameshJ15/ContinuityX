import { env } from "@/lib/env";
import {
  LLMGenerationRequest,
  LLMGenerationResponse,
  LLMProvider,
  LLMProviderError,
} from "./provider";

interface GroqChatCompletionResponse {
  id?: string;
  choices?: Array<{
    index?: number;
    message?: {
      role?: string;
      content?: string;
    };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

/**
 * Isolated server-side Groq REST adapter.
 * Zero client-side exposure; zero tool/function declarations granted to the model.
 * Uses Groq's high-speed LPU inference API.
 */
export class GroqLLMProvider implements LLMProvider {
  readonly name = "groq";

  async generateStructuredText(request: LLMGenerationRequest): Promise<LLMGenerationResponse> {
    const primaryModel = request.model || env.GROQ_EXTRACTION_MODEL;
    return await this.executeCall({ ...request, model: primaryModel });
  }

  private async executeCall(request: LLMGenerationRequest): Promise<LLMGenerationResponse> {
    const apiKey = env.GROQ_API_KEY?.trim() || process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new LLMProviderError("GROQ_API_KEY is not configured on the server.", {
        statusCode: 503,
        isRetryable: false,
      });
    }

    const model = request.model || env.GROQ_EXTRACTION_MODEL;
    const endpoint = "https://api.groq.com/openai/v1/chat/completions";

    const messages = [
      {
        role: "system",
        content: request.systemInstruction,
      },
      {
        role: "user",
        content: request.userPrompt,
      },
    ];

    const bodyPayload: Record<string, unknown> = {
      model,
      messages,
      temperature: request.temperature ?? 0,
      response_format: { type: "json_object" },
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(request.timeoutMs ?? 30000),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(bodyPayload),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error calling Groq API.";
      throw new LLMProviderError(msg, { statusCode: 503, isRetryable: true });
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const retryAfterMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : undefined;

    let payload: GroqChatCompletionResponse;
    try {
      payload = (await response.json()) as GroqChatCompletionResponse;
    } catch {
      const isClientNonRetryable =
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404;

      throw new LLMProviderError(
        `Groq API returned non-JSON response (HTTP ${response.status}).`,
        {
          statusCode: response.status,
          isRetryable: !isClientNonRetryable && (response.status === 429 || response.status >= 500),
          retryAfterMs,
        }
      );
    }

    if (!response.ok) {
      const errorObj = payload?.error;
      const msg = errorObj?.message || `Groq API failed with status ${response.status}`;
      const codeStr = errorObj?.code;

      const isClientNonRetryable =
        response.status === 400 ||
        response.status === 401 ||
        response.status === 403 ||
        response.status === 404;

      const isRetryable =
        !isClientNonRetryable && (response.status === 429 || response.status >= 500);

      throw new LLMProviderError(msg, {
        statusCode: response.status,
        isRetryable,
        retryAfterMs,
        quotaLimit: codeStr === "rate_limit_exceeded" ? "rate_limit" : undefined,
        errorDetails: errorObj,
        status: codeStr,
      });
    }

    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";

    if (!text) {
      throw new LLMProviderError("Groq API returned empty content.", {
        statusCode: 502,
        isRetryable: true,
      });
    }

    return {
      text,
      model,
      usage: payload.usage
        ? {
            promptTokens: payload.usage.prompt_tokens,
            candidateTokens: payload.usage.completion_tokens,
            totalTokens: payload.usage.total_tokens,
          }
        : undefined,
    };
  }
}

export function getDefaultLLMProvider(): LLMProvider {
  return new GroqLLMProvider();
}
