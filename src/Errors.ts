/**
 * @since 1.0.0
 * @module Errors
 *
 * Typed error hierarchy for effect-supermemory.
 * All errors are Effect Data classes for proper structural equality
 * and pattern matching.
 */
import { Data } from "effect";

/**
 * Base error type for all Supermemory errors.
 * Consumers can catch this to handle any library error.
 *
 * @since 1.0.0
 * @category Errors
 */
export type SupermemoryError =
  | SupermemoryAuthenticationError
  | SupermemoryRateLimitError
  | SupermemoryValidationError
  | SupermemoryServerError;

/**
 * Authentication failed (401/403).
 * The API key is invalid, expired, or lacks required permissions.
 *
 * @since 1.0.0
 * @category Errors
 */
export class SupermemoryAuthenticationError extends Data.TaggedError(
  "SupermemoryAuthenticationError"
)<{
  readonly message: string;
  readonly status: 401 | 403;
}> {}

/**
 * Rate limit exceeded (429).
 * Contains retry-after information when available.
 *
 * @since 1.0.0
 * @category Errors
 */
export class SupermemoryRateLimitError extends Data.TaggedError(
  "SupermemoryRateLimitError"
)<{
  readonly message: string;
  readonly retryAfterMs: number | undefined;
}> {}

/**
 * Request validation failed.
 * Either the input failed schema validation, or the API returned
 * a response that doesn't match our expected schema (API drift).
 *
 * @since 1.0.0
 * @category Errors
 */
export class SupermemoryValidationError extends Data.TaggedError(
  "SupermemoryValidationError"
)<{
  readonly message: string;
  readonly details?: unknown;
}> {}

/**
 * Server-side error (5xx).
 * The Supermemory API encountered an internal error.
 *
 * @since 1.0.0
 * @category Errors
 */
export class SupermemoryServerError extends Data.TaggedError(
  "SupermemoryServerError"
)<{
  readonly message: string;
  readonly status: number;
}> {}
