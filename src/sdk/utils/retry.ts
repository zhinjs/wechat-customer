export interface RetryOptions {
  maxAttempts?: number;   // Default: 3
  initialDelay?: number;  // Default: 1000ms
  maxDelay?: number;      // Default: 30000ms
  backoffFactor?: number; // Default: 2
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 3;
  const initialDelay = options?.initialDelay ?? 1000;
  const maxDelay = options?.maxDelay ?? 30000;
  const backoffFactor = options?.backoffFactor ?? 2;

  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === maxAttempts) break;
      const nextDelay = Math.min(initialDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);
      options?.onRetry?.(attempt, lastError, nextDelay);
      await delay(nextDelay);
    }
  }
  throw lastError!;
}
