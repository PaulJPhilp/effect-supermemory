/**
 * Helper functions for the supermemory client service.
 *
 * This module provides utility functions for encoding and decoding base64 strings
 * used in supermemory operations and API communications.
 */
/** biome-ignore-all assist/source/organizeImports: <> */

import { ENCODING, ERROR_MESSAGES, HTTP_STATUS } from "@/Constants.js";
import type { HttpClientError } from "@services/httpClient/errors.js";
import {
  isAuthorizationError,
  isHttpError,
  isHttpErrorWithStatus,
} from "@services/httpClient/helpers.js";
import type { MemoryError } from "@services/inMemoryClient/errors.js";
import {
  MemoryNotFoundError,
  MemoryValidationError,
} from "@services/inMemoryClient/errors.js";
import type { MemoryKey } from "@services/inMemoryClient/types.js";
import { Duration, Effect, Exit, Option, Schedule } from "effect";
import type { SupermemoryClientApi } from "./api.js";
import type { RetryScheduleConfig } from "./types.js";

/**
 * Converts a string to base64 encoding.
 *
 * This function is commonly used for encoding API keys, authentication tokens,
 * and other sensitive data that needs to be transmitted safely over HTTP.
 *
 * @param str - The string to encode
 * @returns The base64-encoded string
 *
 * @example
 * ```typescript
 * const encoded = toBase64("api-key-123");
 * console.log(encoded); // "YXBpLWtleS0xMjM="
 * ```
 */
export const toBase64 = (str: string): string =>
  Buffer.from(str).toString(ENCODING.BASE64);

/**
 * Decodes a base64-encoded string back to its original form.
 *
 * This function is commonly used for decoding API keys, authentication tokens,
 * and other data that was encoded using base64.
 *
 * @param b64 - The base64-encoded string to decode
 * @returns The decoded UTF-8 string
 *
 * @example
 * ```typescript
 * const decoded = fromBase64("YXBpLWtleS0xMjM=");
 * console.log(decoded); // "api-key-123"
 * ```
 */
export const fromBase64 = (b64: string): string =>
  Buffer.from(b64, ENCODING.BASE64).toString(ENCODING.UTF8);

/**
 * Validates that a string is valid base64 using Effect.try.
 *
 * @param str - The string to validate
 * @returns Effect that succeeds if valid base64, fails with Error if invalid
 *
 * @example
 * ```typescript
 * const result = await validateBase64("YXBpLWtleS0xMjM=").pipe(
 *   Effect.runPromise
 * ); // succeeds
 * ```
 */
export const validateBase64 = (str: string): Effect.Effect<void, Error> =>
  Effect.try({
    try: () => {
      Buffer.from(str, ENCODING.BASE64).toString(ENCODING.UTF8);
    },
    catch: () => new Error(`${ERROR_MESSAGES.INVALID_BASE64_STRING}: ${str}`),
  });

/**
 * Validates that a string is valid base64 (synchronous boolean version).
 *
 * Uses Effect.trySync internally to avoid try/catch blocks.
 *
 * @param str - The string to validate
 * @returns True if the string is valid base64, false otherwise
 *
 * @example
 * ```typescript
 * console.log(isValidBase64("YXBpLWtleS0xMjM=")); // true
 * console.log(isValidBase64("invalid-base64")); // false
 * ```
 */
export const isValidBase64 = (str: string): boolean =>
  Exit.match(
    Effect.runSyncExit(
      Effect.try({
        try: () => Buffer.from(str, ENCODING.BASE64).toString(ENCODING.UTF8),
        catch: () => new Error(ERROR_MESSAGES.INVALID_BASE64_STRING),
      })
    ),
    {
      onFailure: () => false,
      onSuccess: () => true,
    }
  );

/**
 * Encodes authentication credentials for HTTP Basic Auth.
 *
 * @param username - The username for authentication
 * @param password - The password for authentication
 * @returns The base64-encoded credentials string
 *
 * @example
 * ```typescript
 * const authHeader = encodeBasicAuth("user", "pass");
 * console.log(authHeader); // "dXNlcjpwYXNz"
 * ```
 */
export const encodeBasicAuth = (username: string, password: string): string =>
  toBase64(`${username}:${password}`);

/**
 * Safely encodes a string to base64 with error handling.
 *
 * @param str - The string to encode
 * @returns Effect that produces the base64 string or fails with Error
 *
 * @example
 * ```typescript
 * const result = await safeToBase64("hello").pipe(
 *   Effect.runPromise
 * );
 * ```
 */
export const safeToBase64 = (str: string): Effect.Effect<string, Error> =>
  Effect.try({
    try: () => toBase64(str),
    catch: (e) =>
      new Error(
        `${ERROR_MESSAGES.FAILED_TO_ENCODE_TO_BASE64}: ${
          e instanceof Error ? e.message : String(e)
        }`
      ),
  });

/**
 * Safely decodes a base64 string with error handling.
 *
 * @param b64 - The base64-encoded string to decode
 * @returns Effect that produces the decoded string or fails with Error
 *
 * @example
 * ```typescript
 * const result = await safeFromBase64("aGVsbG8=").pipe(
 *   Effect.runPromise
 * );
 * ```
 */
export const safeFromBase64 = (b64: string): Effect.Effect<string, Error> =>
  Effect.try({
    try: () => fromBase64(b64),
    catch: (e) =>
      new Error(
        `${ERROR_MESSAGES.FAILED_TO_DECODE_FROM_BASE64}: ${
          e instanceof Error ? e.message : String(e)
        }`
      ),
  });

/**
 * Converts a SupermemoryClient.get() result to an Effect.Option.
 * Returns None if the value is undefined, Some(value) otherwise.
 *
 * @param client - The SupermemoryClientApi instance
 * @param key - The key to retrieve
 * @returns Effect that produces Option.Option<string>
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const client = yield* SupermemoryClient;
 *   const option = yield* getOption(client)("my-key");
 *   return Option.match(option, {
 *     onNone: () => "Key not found",
 *     onSome: (value) => `Found: ${value}`,
 *   });
 * });
 * ```
 */
export const getOption =
  (client: SupermemoryClientApi) =>
  (key: MemoryKey): Effect.Effect<Option.Option<string>, MemoryError> =>
    client.get(key).pipe(Effect.map(Option.fromNullable));

/**
 * Checks if an HttpClientError is a server error (5xx status code).
 *
 * Server errors are typically retryable as they indicate temporary issues
 * on the server side rather than client-side problems.
 *
 * @param error - The HttpClientError to check
 * @returns True if the error is an HTTP error with status code 500-599
 *
 * @example
 * ```typescript
 * if (isServerError(error)) {
 *   // Retry the request
 * }
 * ```
 */
export const isServerError = (error: HttpClientError): boolean =>
  isHttpError(error) &&
  error.status >= HTTP_STATUS.SERVER_ERROR_MIN &&
  error.status <= HTTP_STATUS.SERVER_ERROR_MAX;

/**
 * Creates a retry Schedule from a RetryScheduleConfig.
 *
 * The schedule tracks iteration count and is compatible with Effect.retry.
 * If no retry config is provided, returns undefined (no retries).
 *
 * @param retries - Optional retry configuration
 * @returns A Schedule for retries, or undefined if no retries configured
 *
 * @example
 * ```typescript
 * const schedule = createRetrySchedule({ attempts: 3, delayMs: 1000 });
 * const result = await myEffect.pipe(
 *   Effect.retry(schedule ?? Schedule.never)
 * );
 * ```
 */
export const createRetrySchedule = (
  retries: RetryScheduleConfig | undefined
): Schedule.Schedule<number, unknown, never> | undefined =>
  retries
    ? Schedule.addDelay(Schedule.recurs(retries.attempts - 1), () =>
        Duration.millis(retries.delayMs)
      )
    : undefined;

/**
 * Translates HttpClient errors to Memory errors.
 *
 * This helper function maps HTTP client errors to the appropriate memory error types,
 * handling authorization errors, 404 errors, and network errors appropriately.
 *
 * @param error - The HttpClientError to translate
 * @param key - Optional key for 404 error translation (MemoryNotFoundError)
 * @returns The appropriate MemoryError
 *
 * @example
 * ```typescript
 * const memoryError = translateHttpClientError(httpError, "my-key");
 * ```
 */
export const translateHttpClientError = (
  error: HttpClientError,
  key?: string
): MemoryError => {
  if (isAuthorizationError(error)) {
    // If we decide to introduce a distinct MemoryAuthError later, it would go here.
    // For now, mapping to MemoryValidationError as per CTO directive.
    return new MemoryValidationError({
      message: `${ERROR_MESSAGES.AUTHORIZATION_FAILED}: ${error.reason}`,
    });
  }
  if (isHttpErrorWithStatus(error, 404) && key) {
    // This should ideally be handled by the consuming method (get, exists)
    // but useful for direct error translation if a general API call expects an item.
    return new MemoryNotFoundError({ key });
  }
  // Generic mapping for other HttpClient errors to MemoryValidationError
  let errorMessage: string;
  if (error._tag === "NetworkError") {
    // NetworkError has a cause property with the actual error and a url property
    const causeMsg = error.cause.message || String(error.cause);
    const urlInfo = error.url ? ` (URL: ${error.url})` : "";
    errorMessage = `${causeMsg}${urlInfo}`;
  } else if ("message" in error && typeof error.message === "string") {
    errorMessage = error.message;
    if ("url" in error && typeof error.url === "string") {
      errorMessage += ` (URL: ${error.url})`;
    }
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else {
    errorMessage = String(error);
  }

  return new MemoryValidationError({
    message: `${ERROR_MESSAGES.API_REQUEST_FAILED}: ${error._tag} - ${errorMessage}`,
  });
};
