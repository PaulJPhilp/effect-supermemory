/**
 * Memory Stream Client Service API
 *
 * @since 1.0.0
 * @module MemoryStreamClient
 */

import type { MemoryError } from "@services/inMemoryClient/errors.js";
import type { SearchError } from "@services/searchClient/errors.js";
import type {
  SearchOptions,
  SearchResult,
} from "@services/searchClient/types.js";
import type { Effect, Stream } from "effect";
import type { StreamError } from "./errors.js";

/**
 * Memory stream client interface.
 *
 * Provides streaming operations for large datasets using Effect.Stream.
 * All operations return streams that emit data incrementally, making them
 * suitable for processing large result sets without loading everything into
 * memory at once. Responses are expected in NDJSON (Newline-Delimited JSON)
 * format from the Supermemory API.
 *
 * @since 1.0.0
 * @category Services
 */
export type MemoryStreamClientApi = {
  /**
   * Streams all keys in the current namespace.
   *
   * Returns a stream that emits keys one at a time as they are received
   * from the API. The response is expected to be in NDJSON format, where
   * each line contains a JSON object with a `key` property.
   *
   * This is useful for iterating over all keys in a namespace without
   * loading them all into memory at once. The stream can be consumed using
   * `Stream.runCollect`, `Stream.runForEach`, or other stream operations.
   *
   * @returns Effect that produces a Stream of string keys, or fails with MemoryError or StreamError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* MemoryStreamClient;
   *   const keyStream = yield* client.listAllKeys();
   *
   *   // Process keys one at a time
   *   yield* Stream.runForEach(keyStream, (key) =>
   *     Effect.log(`Found key: ${key}`)
   *   );
   *
   *   // Or collect all keys into an array
   *   const allKeys = yield* Stream.runCollect(keyStream);
   *   return Chunk.toReadonlyArray(allKeys);
   * }).pipe(Effect.provide(MemoryStreamClient.Default({
   *   namespace: Namespace("my-namespace"),
   *   baseUrl: ValidatedHttpUrl("https://api.supermemory.dev"),
   *   apiKey: ApiKey("sk-..."),
   * })));
   * ```
   */
  readonly listAllKeys: () => Effect.Effect<
    Stream.Stream<string, MemoryError | StreamError>,
    MemoryError | StreamError
  >;

  /**
   * Streams search results for a given query.
   *
   * Performs a semantic search query against the Supermemory API and returns
   * a stream of search results. The response is expected to be in NDJSON format,
   * where each line contains a JSON object representing a search result.
   *
   * This is useful for processing large search result sets incrementally without
   * loading all results into memory at once. Results are emitted as they are
   * received from the API.
   *
   * @param query - The search query string to match against memories
   * @param options - Optional search options including filters, relevance thresholds, and pagination
   * @returns Effect that produces a Stream of SearchResult objects, or fails with SearchError or StreamError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* MemoryStreamClient;
   *   const resultStream = yield* client.streamSearch("user preferences", {
   *     limit: 100,
   *     minRelevanceScore: 0.7,
   *   });
   *
   *   // Process results one at a time
   *   yield* Stream.runForEach(resultStream, (result) =>
   *     Effect.log(`Found: ${result.memory.key} (score: ${result.relevanceScore})`)
   *   );
   *
   *   // Or collect all results
   *   const allResults = yield* Stream.runCollect(resultStream);
   *   return Chunk.toReadonlyArray(allResults);
   * }).pipe(Effect.provide(MemoryStreamClient.Default({
   *   namespace: Namespace("my-namespace"),
   *   baseUrl: ValidatedHttpUrl("https://api.supermemory.dev"),
   *   apiKey: ApiKey("sk-..."),
   * })));
   * ```
   */
  readonly streamSearch: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<
    Stream.Stream<SearchResult, SearchError | StreamError>,
    SearchError | StreamError
  >;
};
