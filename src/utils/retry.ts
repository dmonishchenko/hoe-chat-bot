import { logger } from './logger.js';

interface RetryOptions {
  readonly attempts: number;
  readonly delayMs: number;
  readonly onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  attempts: 3,
  delayMs: 5000,
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const { attempts, delayMs, onRetry } = { ...DEFAULT_OPTIONS, ...options };

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < attempts) {
        logger.warn(`Attempt ${attempt}/${attempts} failed, retrying...`, {
          error: lastError.message,
          nextRetryIn: `${delayMs}ms`,
        });

        onRetry?.(lastError, attempt);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}
