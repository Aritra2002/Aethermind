/**
 * @file retry.ts
 * @description Exponential backoff retry utility with jitter for resilient AI provider API calls.
 * Automatically recovers from transient network failures, HTTP 429 rate limits, and 5xx gateway errors.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3). */
  maxRetries?: number;
  /** Initial delay in milliseconds before first retry (default: 800ms). */
  initialDelayMs?: number;
  /** Maximum delay cap in milliseconds (default: 6000ms). */
  maxDelayMs?: number;
  /** Backoff multiplier factor (default: 2.0). */
  backoffFactor?: number;
  /** Optional AbortSignal to cancel pending retries. */
  signal?: AbortSignal;
  /** Predicate to determine if an error is retryable. */
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Checks if an error is a retryable network or rate-limit exception.
 */
export const defaultIsRetryable = (error: unknown): boolean => {
  if (!error) return false;
  
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Check for HTTP status codes
    if (msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')) {
      return true;
    }
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      return true;
    }
    if (msg.includes('networkerror') || msg.includes('failed to fetch') || msg.includes('timeout') || msg.includes('econnreset')) {
      return true;
    }
  }

  // Inspect status code on response-like error objects
  const status = (error as { status?: number; statusCode?: number })?.status ||
                 (error as { status?: number; statusCode?: number })?.statusCode;
  if (status === 429 || (status !== undefined && status >= 500 && status <= 504)) {
    return true;
  }

  return false;
};

/**
 * Wraps an asynchronous operation with exponential backoff and randomized jitter.
 *
 * @param fn - The asynchronous function to execute.
 * @param options - Configuration options for retry behavior.
 * @returns A promise resolving to the result of the function call.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 800,
    maxDelayMs = 6000,
    backoffFactor = 2.0,
    signal,
    isRetryable = defaultIsRetryable
  } = options;

  let attempt = 0;
  let delay = initialDelayMs;

  while (true) {
    if (signal?.aborted) {
      throw new Error('Operation aborted');
    }

    try {
      return await fn(attempt);
    } catch (error) {
      attempt++;

      if (attempt > maxRetries || !isRetryable(error)) {
        throw error;
      }

      if (signal?.aborted) {
        throw new Error('Operation aborted', { cause: error });
      }

      // Compute delay with +/- 20% randomized jitter
      const jitter = delay * 0.2 * (Math.random() * 2 - 1);
      const sleepDuration = Math.min(maxDelayMs, delay + jitter);

      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, sleepDuration);
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Operation aborted'));
          }, { once: true });
        }
      });

      delay = Math.min(maxDelayMs, delay * backoffFactor);
    }
  }
}
