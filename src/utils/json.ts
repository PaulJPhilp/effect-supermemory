/**
 * JSON utility functions using effect-json library.
 *
 * Provides convenient wrappers around effect-json functions with Schema.Unknown
 * for untyped JSON parsing/stringifying, and error mapping utilities.
 */

import { type Effect, Schema } from "effect";
import * as Json from "effect-json";

// Create a schema for unknown values (no validation)
const UnknownSchema = Schema.Unknown;

/**
 * Parse JSON string with Schema.Unknown (no validation).
 *
 * @param input - JSON string to parse
 * @returns Effect that succeeds with parsed value or fails with ParseError
 *
 * @example
 * ```typescript
 * const result = await parseJson('{"key": "value"}').pipe(Effect.runPromise);
 * ```
 */
export const parseJson = (
  input: string | Buffer
): Effect.Effect<unknown, Json.ParseError | Json.ValidationError> =>
  Json.parse(UnknownSchema, input);

/**
 * Parse JSONC (JSON with Comments) string with Schema.Unknown (no validation).
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
 */
export const parseJsonc = (
  input: string | Buffer
): Effect.Effect<unknown, Json.ParseError | Json.ValidationError> =>
  Json.parseJsonc(UnknownSchema, input);

/**
 * Stringify value to JSON with Schema.Unknown (no validation).
 *
 * @param value - Value to stringify
 * @param options - Optional stringify options (indent, etc.)
 * @returns Effect that succeeds with JSON string or fails with StringifyError
 *
 * @example
 * ```typescript
 * const json = await stringifyJson({ key: "value" }, { indent: 2 }).pipe(Effect.runPromise);
 * ```
 */
export const stringifyJson = (
  value: unknown,
  options?: { indent?: number }
): Effect.Effect<string, Json.StringifyError | Json.ValidationError> =>
  Json.stringify(UnknownSchema, value, options);
