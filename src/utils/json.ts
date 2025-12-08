/**
 * JSON utility functions for effect-supermemory.
 *
 * Provides convenient wrappers for JSON parsing/stringifying using effect-json.
 * Uses effect-json backends for proper Effect error handling.
 *
 * @since 1.0.0
 * @module utils/json
 */

import type { Effect } from "effect";
import {
  jsonBackend,
  jsoncBackend,
  ParseError,
  StringifyError,
  ValidationError,
} from "effect-json";

// Re-export error types from effect-json
export { ParseError, StringifyError, ValidationError };

/**
 * Parse JSON string.
 *
 * @param input - JSON string to parse
 * @returns Effect that succeeds with parsed value or fails with ParseError
 *
 * @example
 * ```typescript
 * const result = await parseJson('{"key": "value"}').pipe(Effect.runPromise);
 * ```
 *
 * @since 1.0.0
 * @category Parsing
 */
export const parseJson = (
  input: string | Buffer
): Effect.Effect<unknown, ParseError> => jsonBackend.parse(input);

/**
 * Parse JSONC (JSON with Comments) string.
 *
 * @param input - JSONC string to parse
 * @returns Effect that succeeds with parsed value or fails with ParseError
 *
 * @example
 * ```typescript
 * const jsonc = `{
 *   // Comment
 *   "key": "value"
 * }`;
 * const result = await parseJsonc(jsonc).pipe(Effect.runPromise);
 * ```
 *
 * @since 1.0.0
 * @category Parsing
 */
export const parseJsonc = (
  input: string | Buffer
): Effect.Effect<unknown, ParseError> => jsoncBackend.parse(input);

/**
 * Stringify value to JSON.
 *
 * @param value - Value to stringify
 * @param options - Optional stringify options (indent, etc.)
 * @returns Effect that succeeds with JSON string or fails with StringifyError
 *
 * @example
 * ```typescript
 * const json = await stringifyJson({ key: "value" }, { indent: 2 }).pipe(Effect.runPromise);
 * ```
 *
 * @since 1.0.0
 * @category Stringification
 */
export const stringifyJson = (
  value: unknown,
  options?: { indent?: number }
): Effect.Effect<string, StringifyError> =>
  jsonBackend.stringify(value, options);
