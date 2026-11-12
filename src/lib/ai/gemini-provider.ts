import { env } from "@/lib/env";
import {
  LLMGenerationRequest,
  LLMGenerationResponse,
  LLMProvider,
  LLMProviderError,
} from "./provider";

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

/**
 * Isolated server-side Gemini REST adapter.
 * Zero client-side exposure; zero tool/function declarations granted to the model.
 */
export class GeminiLLMProvider implements LLMProvider {
  readonly name = "gemini";

  async generateStructuredText(request: LLMGenerationRequest): Promise<LLMGenerationResponse> {
    try {
      return await this.executeCall(request);
    } catch (err: unknown) {
      // Fallback: If primary model hit timeout, rate limit, or 503, retry once with fast gemini-3.5-flash-lite
      const requestedModel = request.model || env.GEMINI_EXTRACTION_MODEL;
      if (requestedModel !== "gemini-3.5-flash-lite") {
        console.warn(`[GeminiLLMProvider] Model ${requestedModel} failed, retrying with fast fallback gemini-3.5-flash-lite...`);
        return await this.executeCall({
          ...request,
          model: "gemini-3.5-flash-lite",
        });
      }
      throw err;
    }
  }

  private async executeCall(request: LLMGenerationRequest): Promise<LLMGenerationResponse> {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new LLMProviderError("GEMINI_API_KEY is not configured on the server.", {
        statusCode: 503,
        isRetryable: false,
      });
    }

    const model = request.model || env.GEMINI_EXTRACTION_MODEL;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`;

    const generationConfig: Record<string, unknown> = {
      temperature: request.temperature ?? 0,
      responseMimeType: "application/json",
    };

    if (request.responseJsonSchema) {
      generationConfig.responseJsonSchema = request.responseJsonSchema;
    }

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        signal: AbortSignal.timeout(request.timeoutMs ?? 45000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: request.systemInstruction }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: request.userPrompt }],
            },
          ],
          generationConfig,
        }),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error calling Gemini API.";
      throw new LLMProviderError(msg, { statusCode: 503, isRetryable: true });
    }

    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const retryAfterMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : undefined;

    let payload: GeminiApiResponse;
    try {
      payload = (await response.json()) as GeminiApiResponse;
    } catch {
      throw new LLMProviderError(
        `Gemini API returned non-JSON response (HTTP ${response.status}).`,
        {
          statusCode: response.status,
          isRetryable: response.status === 429 || response.status >= 500,
          retryAfterMs,
        }
      );
    }

    if (!response.ok) {
      const msg = payload?.error?.message || `Gemini API failed with status ${response.status}`;
      const isRetryable = response.status === 429 || response.status >= 500;
      throw new LLMProviderError(msg, {
        statusCode: response.status,
        isRetryable,
        retryAfterMs,
      });
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("\n")
        .trim() ?? "";

    if (!text) {
      throw new LLMProviderError("Gemini API returned empty content.", {
        statusCode: 502,
        isRetryable: true,
      });
    }

    return {
      text,
      model,
      usage: payload.usageMetadata
        ? {
            promptTokens: payload.usageMetadata.promptTokenCount,
            candidateTokens: payload.usageMetadata.candidatesTokenCount,
            totalTokens: payload.usageMetadata.totalTokenCount,
          }
        : undefined,
    };
  }
}

export function getDefaultLLMProvider(): LLMProvider {
  return new GeminiLLMProvider();
}
