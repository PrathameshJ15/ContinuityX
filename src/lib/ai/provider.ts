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
  readonly quotaLimit?: string;
  readonly errorDetails?: unknown;
  readonly status?: string;

  constructor(
    message: string,
    opts?: {
      statusCode?: number;
      isRetryable?: boolean;
      retryAfterMs?: number;
      quotaLimit?: string;
      errorDetails?: unknown;
      status?: string;
    }
  ) {
    super(message);
    this.name = "LLMProviderError";
    this.statusCode = opts?.statusCode;
    this.isRetryable = opts?.isRetryable ?? false;
    this.retryAfterMs = opts?.retryAfterMs;
    this.quotaLimit = opts?.quotaLimit;
    this.errorDetails = opts?.errorDetails;
    this.status = opts?.status;
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
 * Executes an LLM operation sequentially with bounded exponential backoff and jitter on retryable errors.
 * Immediately rethrows non-retryable errors (e.g. HTTP 400, 401, 403, 404).
 */
export async function executeWithRetryBackoff<T>(
  operation: (attempt: number) => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 3);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 1000);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 30000);
  const sleep = options.sleep ?? defaultSleep;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation(attempt);
    } catch (error: unknown) {
      lastError = error;
      const isRetryable = error instanceof LLMProviderError ? error.isRetryable : false;

      // Do NOT retry non-retryable errors (e.g. 400, 401, 403, 404)
      if (!isRetryable || attempt >= maxAttempts) {
        if (error instanceof LLMProviderError && error.statusCode === 429) {
          const quotaStr = error.quotaLimit ? ` (quota: ${error.quotaLimit})` : "";
          throw new LLMProviderError(
            `Rate limit exceeded${quotaStr}. Please retry in a few moments.`,
            {
              statusCode: 429,
              isRetryable: false,
              retryAfterMs: error.retryAfterMs,
              quotaLimit: error.quotaLimit,
              errorDetails: error.errorDetails,
              status: error.status,
            }
          );
        }
        if (error instanceof LLMProviderError && error.statusCode === 503) {
          throw new LLMProviderError(
            "Groq API is temporarily unavailable (high demand / service unavailable). Please retry in a few moments.",
            {
              statusCode: 503,
              isRetryable: false,
              errorDetails: error.errorDetails,
              status: error.status,
            }
          );
        }
        throw error;
      }

      // Compute delay using Retry-After / RetryInfo if available, otherwise exponential backoff with jitter
      const retryAfter =
        error instanceof LLMProviderError && typeof error.retryAfterMs === "number"
          ? error.retryAfterMs
          : undefined;

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const computedDelay = retryAfter !== undefined ? retryAfter : exponentialDelay;

      // Add randomized jitter (0.8x to 1.2x) to avoid thundering herd problem
      const jitter = 0.8 + Math.random() * 0.4;
      const delayMs = Math.min(maxDelayMs, Math.max(0, Math.round(computedDelay * jitter)));

      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("LLM operation failed after retries.");
}
