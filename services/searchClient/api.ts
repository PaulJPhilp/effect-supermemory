/**
 * Search Client Service API
 *
 * @since 1.0.0
 * @module SearchClient
 */

import type * as Effect from "effect/Effect";
import type { SearchError } from "./errors.js";
import type { SearchOptions, SearchResult } from "./types.js";

/**
 * API interface for the Search client service.
 *
 * This interface provides methods for performing semantic search operations
 * against the Supermemory API. Search results are ranked by relevance score
 * and can be filtered by various criteria including metadata filters, age,
 * and minimum relevance thresholds.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const client = yield* SearchClient;
 *   const results = yield* client.search("user preferences", {
 *     limit: 10,
 *     minRelevanceScore: 0.7,
 *     maxAgeHours: 24,
 *   });
 *   return results;
 * }).pipe(Effect.provide(SearchClient.Default({
 *   namespace: "my-namespace",
 *   baseUrl: "https://api.supermemory.dev",
 *   apiKey: "sk-...",
 * })));
 * ```
 */
// biome-ignore lint: Interface preferred for object contracts
export interface SearchClientApi {
  /**
   * Performs a semantic search query against the Supermemory API.
   *
   * Returns an array of search results ranked by relevance score (highest first).
   * Each result includes the memory data and its relevance score.
   *
   * @param query - The search query string (semantic search)
   * @param options - Optional search parameters
   * @param options.limit - Maximum number of results to return (default: API default)
   * @param options.offset - Number of results to skip for pagination (default: 0)
   * @param options.filters - Metadata filters to apply (e.g., key-value pairs)
   * @param options.minRelevanceScore - Minimum relevance score threshold (0.0-1.0)
   * @param options.maxAgeHours - Maximum age of memories in hours
   * @returns Effect that succeeds with an array of SearchResult, or fails with SearchError
   *
   * @example
   * ```typescript
   * // Simple search
   * const results = yield* client.search("user preferences");
   *
   * // Search with filters and relevance threshold
   * const filteredResults = yield* client.search("product recommendations", {
   *   limit: 20,
   *   minRelevanceScore: 0.8,
   *   filters: {
   *     category: "electronics",
   *     status: "active",
   *   },
   *   maxAgeHours: 48,
   * });
   * ```
   */
  readonly search: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<SearchResult[], SearchError>;
}
