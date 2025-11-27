/**
 * @since 1.0.0
 * @module Search
 *
 * Search service for querying Supermemory.
 * Provides separate methods for RAG (documents) and Chat (memories) paths.
 */
import { Context, Effect, Layer, Schema } from "effect";
import { SupermemoryHttpClientService } from "./Client.js";
import { Filter, toJSON } from "./FilterBuilder.js";
/**
 * Context tag for SearchService.
 *
 * @since 1.0.0
 * @category Context
 */
export class SearchServiceTag extends Context.Tag(
  "@effect-supermemory/Search"
)() {}
/**
 * Build query parameters from search options and filters.
 *
 * @since 1.0.0
 * @category Utilities
 */
const buildSearchParams = (query, options) => {
  const params = {
    query,
  };
  if (options?.topK !== undefined) {
    params.topK = options.topK;
  }
  if (options?.threshold !== undefined) {
    params.threshold = options.threshold;
  }
  if (options?.rerank) {
    params.rerank = options.rerank;
  }
  if (options?.filters) {
    params.filters = toJSON(options.filters);
  }
  return params;
};
/**
 * Create the search service implementation.
 *
 * @since 1.0.0
 * @category Constructors
 */
const makeSearchService = Effect.gen(function* () {
  const httpClient = yield* SupermemoryHttpClientService;
  const searchDocuments = (query, options) =>
    Effect.gen(function* () {
      // Validate query
      const validatedQuery = yield* Schema.decodeUnknown(Schema.String)(
        query
      ).pipe(
        Effect.mapError((error) => ({
          _tag: "SupermemoryValidationError",
          message: "Query must be a non-empty string",
          details: error,
        }))
      );
      // Build request body
      const body = buildSearchParams(validatedQuery, options);
      // Make request to v3 search endpoint
      const response = yield* httpClient.requestV3("POST", "/search", {
        body,
      });
      return response.results;
    }).pipe(
      Effect.withSpan("supermemory.search.documents", {
        attributes: {
          "supermemory.query_length": query.length,
          "supermemory.top_k": options?.topK,
          "supermemory.threshold": options?.threshold,
          "supermemory.has_filters": options?.filters !== undefined,
        },
      })
    );
  const searchMemories = (query, options) =>
    Effect.gen(function* () {
      // Validate query
      const validatedQuery = yield* Schema.decodeUnknown(Schema.String)(
        query
      ).pipe(
        Effect.mapError((error) => ({
          _tag: "SupermemoryValidationError",
          message: "Query must be a non-empty string",
          details: error,
        }))
      );
      // Build request body
      const body = buildSearchParams(validatedQuery, options);
      // Make request to v4 search endpoint
      const response = yield* httpClient.requestV4("POST", "/search", {
        body,
      });
      return response.results;
    }).pipe(
      Effect.withSpan("supermemory.search.memories", {
        attributes: {
          "supermemory.query_length": query.length,
          "supermemory.top_k": options?.topK,
          "supermemory.threshold": options?.threshold,
          "supermemory.has_filters": options?.filters !== undefined,
        },
      })
    );
  return {
    searchDocuments,
    searchMemories,
  };
});
/**
 * Live layer for SearchService.
 * Requires SupermemoryHttpClientService.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SearchServiceLive = Layer.effect(
  SearchServiceTag,
  makeSearchService
);
/**
 * Re-export Filter API for convenience.
 *
 * @since 1.0.0
 * @category Utilities
 */
export { Filter, toJSON };
