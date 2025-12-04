/**
 * Helper functions for the memory stream client service.
 *
 * This module provides utility functions for stream processing, NDJSON decoding,
 * and data transformation operations used in memory streaming.
 */

import { Effect, Exit, Stream } from "effect";
import type { HttpClientError } from "../httpClient/errors.js";
import { isHttpError, isNetworkError } from "../httpClient/helpers.js";
import type { HttpRequestOptions } from "../httpClient/types.js";
import type { SearchResult } from "../searchClient/types.js";
import { StreamReadError } from "./errors.js";

// Re-export error types for use in other modules
// Note: ParseError and ValidationError are now aliased to StreamReadError
// for simplicity. If you need distinct error types, create custom error classes.
export type ParseError = StreamReadError;
export type ValidationError = StreamReadError;

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
export const ndjsonDecoder = (
  byteStream: Stream.Stream<Uint8Array, StreamReadError>
): Stream.Stream<unknown, StreamReadError> => {
  let buffer = ""; // Buffer to hold incomplete lines

  return byteStream.pipe(
    Stream.decodeText("utf-8"), // Decode bytes to text
    Stream.flatMap((chunk: string) => {
      buffer += chunk;
      const lines = buffer.split("\n");

      // Keep the last part in buffer if it's an incomplete line
      buffer = lines.pop() || "";

      // Parse each complete line
      return Stream.fromIterable(lines);
    }),
    Stream.filter((line: string) => line.trim().length > 0),
    Stream.mapEffect((line: string) =>
      Effect.try({
        try: () => JSON.parse(line) as unknown,
        catch: (error) => {
          const message = `Failed to parse JSON: ${
            error instanceof Error ? error.message : String(error)
          }`;
          return new StreamReadError({ message });
        },
      })
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
export const decodeUint8Array = (chunk: Uint8Array): string =>
  new TextDecoder().decode(chunk);

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
export const validateUtf8Chunk = (
  chunk: Uint8Array
): Effect.Effect<Uint8Array, StreamReadError> =>
  Effect.try({
    try: () => {
      new TextDecoder().decode(chunk);
      return chunk;
    },
    catch: (e): StreamReadError =>
      new StreamReadError({
        message: `Invalid UTF-8 encoding: ${
          e instanceof Error ? e.message : String(e)
        }`,
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
export const splitIntoLines = (
  chunk: string,
  buffer: string
): [string[], string] => {
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
export const validateJson = (
  str: string
): Effect.Effect<unknown, StreamReadError> =>
  Effect.try({
    try: () => JSON.parse(str) as unknown,
    catch: (error) => {
      const message = `Invalid JSON: ${
        error instanceof Error ? error.message : String(error)
      }`;
      return new StreamReadError({ message });
    },
  });

/**
 * Checks if a string represents a complete JSON object (synchronous boolean version).
 *
 * This is a lightweight synchronous utility for quick checks. For full Effect-based
 * validation with proper error handling, use validateJson() instead.
 *
 * Uses Effect.trySync internally to avoid try/catch blocks.
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
export const isCompleteJson = (str: string): boolean =>
  Exit.match(
    Effect.runSyncExit(
      Effect.try({
        try: () => JSON.parse(str),
        catch: () => new Error("Invalid JSON"),
      })
    ),
    {
      onFailure: () => false,
      onSuccess: () => true,
    }
  );

/**
 * Builds request options for list keys requests.
 */
export const buildKeysRequestOptions = (): HttpRequestOptions => ({
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/x-ndjson",
  },
});

/**
 * Builds request options for search requests.
 */
export const buildSearchRequestOptions = (
  query: string,
  options?: {
    limit?: number;
    filters?: Record<string, string | number | boolean | readonly string[]>;
  }
): HttpRequestOptions => ({
  method: "GET",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/x-ndjson",
  },
  queryParams: buildSearchQueryParams(query, options),
});

/**
 * Builds query parameters from search options.
 */
export const buildSearchQueryParams = (
  query: string,
  options?: {
    limit?: number;
    filters?: Record<string, string | number | boolean | readonly string[]>;
  }
): Record<string, string> => {
  const params = new URLSearchParams();
  params.set("q", query);

  if (options?.limit) {
    params.set("limit", options.limit.toString());
  }
  if (options?.filters) {
    for (const [key, value] of Object.entries(options.filters)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          params.append(key, v.toString());
        }
      } else {
        params.set(key, value.toString());
      }
    }
  }

  return Object.fromEntries(params.entries());
};

/**
 * Translates HTTP client errors to stream errors.
 */
export const translateHttpClientError = (
  error: HttpClientError
): StreamReadError => {
  if (isHttpError(error)) {
    return new StreamReadError({
      message: `HTTP ${error.status}: ${error.message}`,
      cause: error as unknown,
    });
  }
  if (isNetworkError(error)) {
    return new StreamReadError({
      message: `Network error: ${error.message}`,
      cause: error as unknown,
    });
  }
  return new StreamReadError({
    message: `HTTP client error: ${error._tag}`,
    cause: error as unknown,
  });
};

/**
 * Validates HTTP response status and body type.
 */
export const validateStreamResponse = (
  response: { status: number; body: unknown },
  expectedBodyType: string
): Effect.Effect<string, StreamReadError> => {
  if (response.status >= 400) {
    return Effect.fail(
      new StreamReadError({
        message: `HTTP ${response.status}: ${expectedBodyType} request failed`,
      })
    );
  }

  if (typeof response.body !== "string") {
    return Effect.fail(
      new StreamReadError({
        message: `Expected string response body, got ${typeof response.body}`,
      })
    );
  }

  return Effect.succeed(response.body);
};

/**
 * Parses a single line as a SearchResult.
 */
export const parseSearchResultLine = (
  line: string
): Effect.Effect<SearchResult, StreamReadError> =>
  Effect.try({
    try: () => JSON.parse(line) as SearchResult,
    catch: (error) =>
      new StreamReadError({
        message: `Failed to parse search result from line "${line}": ${
          error instanceof Error ? error.message : String(error)
        }`,
        cause: error instanceof Error ? error : new Error(String(error)),
      }),
  });

/**
 * Parses NDJSON lines into a stream of parsed objects.
 */
export const parseNdjsonLines = <T>(
  responseBody: string,
  parseLine: (line: string) => Effect.Effect<T, StreamReadError>
): Stream.Stream<T, StreamReadError> => {
  const lines = responseBody
    .split("\n")
    .filter((line) => line.trim().length > 0);

  return Stream.fromIterable(lines).pipe(Stream.mapEffect(parseLine));
};
