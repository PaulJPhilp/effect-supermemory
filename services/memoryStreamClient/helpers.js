/**
 * Helper functions for the memory stream client service.
 *
 * This module provides utility functions for stream processing, NDJSON decoding,
 * and data transformation operations used in memory streaming.
 */
import { Effect, Schema, Stream } from "effect";
import { ParseError, parse, ValidationError } from "effect-json";
import { StreamReadError } from "./errors.js";
// Re-export error types for use in other modules
export { ParseError, ValidationError };
/**
 * A Stream decoder for NDJSON (Newline-Delimited JSON) / JSONL format.
 *
 * This function takes a Stream of Uint8Array and returns a Stream of parsed JSON
 * objects. It handles partial lines and ensures each emitted element is a
 * complete JSON object.
 *
 * @param byteStream - The stream of Uint8Array chunks to decode
 * @returns A Stream of parsed JSON objects with potential parsing errors
 *
 * @example
 * ```typescript
 * const byteStream = Stream.fromIterable([
 *   new TextEncoder().encode('{"key": "value"}\\n'),
 *   new TextEncoder().encode('{"another": "json"}')
 * ]);
 *
 * const jsonStream = ndjsonDecoder(byteStream);
 * const results = await Stream.runCollect(jsonStream).pipe(
 *   Effect.runPromise
 * );
 * ```
 */
export const ndjsonDecoder = (byteStream) => {
  let buffer = ""; // Buffer to hold incomplete lines
  return byteStream.pipe(
    Stream.decodeText("utf-8"), // Decode bytes to text
    Stream.flatMap((chunk) => {
      buffer += chunk;
      const lines = buffer.split("\n");
      // Keep the last part in buffer if it's an incomplete line
      buffer = lines.pop() || "";
      // Parse each complete line
      return Stream.fromIterable(lines);
    }),
    Stream.filter((line) => line.trim().length > 0),
    Stream.mapEffect((line) =>
      // Use effect-json with unknown schema for maximum flexibility
      parse(Schema.Unknown, line)
    )
  );
};
/**
 * Helper function to convert Uint8Array to text string.
 *
 * This utility is primarily used for testing purposes to convert binary
 * chunks back to readable text for assertions and debugging.
 *
 * @param chunk - The Uint8Array to decode
 * @returns The decoded UTF-8 string
 *
 * @example
 * ```typescript
 * const chunk = new TextEncoder().encode("hello world");
 * const text = decodeUint8Array(chunk);
 * console.log(text); // "hello world"
 * ```
 */
export const decodeUint8Array = (chunk) => new TextDecoder().decode(chunk);
/**
 * Validates that a chunk contains valid UTF-8 text.
 *
 * @param chunk - The Uint8Array to validate
 * @returns Effect that succeeds if valid, fails with StreamReadError if invalid
 *
 * @example
 * ```typescript
 * const result = await validateUtf8Chunk(chunk).pipe(
 *   Effect.runPromise
 * );
 * ```
 */
export const validateUtf8Chunk = (chunk) =>
  Effect.try({
    try: () => {
      new TextDecoder().decode(chunk);
      return chunk;
    },
    catch: (e) =>
      new StreamReadError({
        message: `Invalid UTF-8 encoding: ${e instanceof Error ? e.message : String(e)}`,
      }),
  });
/**
 * Splits a text chunk into complete lines, handling partial lines.
 *
 * @param chunk - The text chunk to split
 * @param buffer - The current buffer containing partial data from previous chunks
 * @returns Tuple of [complete lines, remaining buffer]
 *
 * @example
 * ```typescript
 * const [lines, remainingBuffer] = splitIntoLines(
 *   "line1\\nline2\\npartial",
 *   ""
 * );
 * console.log(lines); // ["line1", "line2"]
 * console.log(remainingBuffer); // "partial"
 * ```
 */
export const splitIntoLines = (chunk, buffer) => {
  const combined = buffer + chunk;
  const lines = combined.split("\n");
  // Keep the last part in buffer if it doesn't end with newline
  const remainingBuffer = combined.endsWith("\n") ? "" : lines.pop() || "";
  return [lines, remainingBuffer];
};
/**
 * Validates that a string represents complete JSON using effect-json.
 *
 * @param str - The string to validate
 * @returns Effect that succeeds with parsed JSON if valid, fails with ParseError or ValidationError if invalid
 *
 * @example
 * ```typescript
 * const result = await validateJson('{"key": "value"}').pipe(
 *   Effect.runPromise
 * ); // succeeds with parsed object
 * ```
 */
export const validateJson = (str) => parse(Schema.Unknown, str);
/**
 * Checks if a string represents a complete JSON object (synchronous boolean version).
 *
 * This is a lightweight synchronous utility for quick checks. For full Effect-based
 * validation with proper error handling, use validateJson() instead.
 *
 * @param str - The string to check
 * @returns True if the string appears to be complete JSON
 *
 * @example
 * ```typescript
 * console.log(isCompleteJson('{"key": "value"}')); // true
 * console.log(isCompleteJson('{"key": "value')); // false
 * ```
 */
export const isCompleteJson = (str) => {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
};
