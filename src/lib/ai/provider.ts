export interface LLMGenerationRequest {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
  responseJsonSchema?: Record<string, unknown>;
  timeoutMs?: number;
}

export interface LLMGenerationResponse {
  text: string;
  model: string;
  usage?: {
    promptTokens?: number;
    candidateTokens?: number;
    totalTokens?: number;
  };
}

export interface LLMProvider {
  readonly name: string;
  generateStructuredText(request: LLMGenerationRequest): Promise<LLMGenerationResponse>;
}

export class LLMProviderError extends Error {
  readonly statusCode?: number;
  readonly isRetryable: boolean;
  readonly retryAfterMs?: number;

  constructor(
    message: string,
    opts?: { statusCode?: number; isRetryable?: boolean; retryAfterMs?: number }
  ) {
    super(message);
    this.name = "LLMProviderError";
    this.statusCode = opts?.statusCode;
    this.isRetryable = opts?.isRetryable ?? false;
    this.retryAfterMs = opts?.retryAfterMs;
  }
}

export interface BackoffOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Executes an LLM operation sequentially with bounded exponential backoff on retryable errors (e.g. HTTP 429 / 503).
 */
export async function executeWithRetryBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 1000);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 15000);
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error: unknown) {
      lastError = error;
      const isRetryable = error instanceof LLMProviderError ? error.isRetryable : false;

      if (!isRetryable || attempt >= maxAttempts) {
        throw error;
      }

      const retryAfter =
        error instanceof LLMProviderError && typeof error.retryAfterMs === "number"
          ? error.retryAfterMs
          : undefined;
      const computedDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const delayMs = retryAfter !== undefined ? Math.min(maxDelayMs, retryAfter) : computedDelay;

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM operation failed after retries.");
}
