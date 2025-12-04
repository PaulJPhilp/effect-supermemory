/**
 * Helper functions for the supermemory client service.
 *
 * This module provides utility functions for encoding and decoding base64 strings
 * used in supermemory operations and API communications.
 */

import { Effect, Exit, Option } from "effect";
import type { MemoryKey } from "../inMemoryClient/types.js";
import type { SupermemoryClientApi } from "./api.js";
import type { MemoryError } from "./errors.js";

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
  Buffer.from(str).toString("base64");

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
  Buffer.from(b64, "base64").toString("utf8");

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
      Buffer.from(str, "base64").toString("utf8");
    },
    catch: () => new Error(`Invalid base64 string: ${str}`),
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
        try: () => Buffer.from(str, "base64").toString("utf8"),
        catch: () => new Error("Invalid base64"),
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
        `Failed to encode to base64: ${
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
        `Failed to decode from base64: ${
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
