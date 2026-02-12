/**
 * Shutdown event from HOE API
 */
export interface ShutdownEvent {
  readonly id: string | number;
  readonly dateStart: string;
  readonly dateEnd: string;
  readonly type: string;
  readonly shutdownType: string;
  readonly queueGpv: string;
  readonly queueGav: string;
  readonly status: string;
  readonly comment?: string;
  readonly address?: string;
}

/**
 * Response from HOE API
 */
export interface HoeApiResponse {
  readonly success: boolean;
  readonly data?: ShutdownEvent[];
  readonly message?: string;
}

/**
 * Request body for HOE API
 */
export interface HoeApiRequest {
  readonly streetId: string;
  readonly house: string;
}

/**
 * Message role discriminated union
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Chat message model
 */
export interface ChatMessage {
  readonly id: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;
}

/**
 * Standard API response format
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
}

/**
 * Application error with code
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Shutdown check result
 */
export interface ShutdownCheckResult {
  readonly hasEvents: boolean;
  readonly events: readonly ShutdownEvent[];
  readonly formattedMessage: string;
  readonly contentHash: string;
}
