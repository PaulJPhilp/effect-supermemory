/** @effect-diagnostics classSelfMismatch:skip-file */
/** biome-ignore-all assist/source/organizeImports: <> */
/**
 * @since 1.0.0
 * @module Search
 */

import {
  API_ENDPOINTS,
  ERROR_MESSAGES,
  SPANS,
  TELEMETRY_ATTRIBUTES,
} from "@/Constants.js";
import { SupermemoryValidationError, type SupermemoryError } from "@/Errors.js";
import { SupermemoryHttpClientService } from "@services/client/service.js";
import { Effect, Schema } from "effect";
import type { SearchServiceOps } from "./api.js";
import { buildSearchParams } from "./helpers.js";
import type {
  DocumentChunk,
  SearchDocumentsResponse,
  SearchMemoriesResponse,
  SearchOptions,
  SupermemoryMemory,
} from "./types.js";

/**
 * Create the search service implementation.
 *
 * @since 1.0.0
 * @category Constructors
 */
const makeSearchService = Effect.gen(function* () {
  const httpClient = yield* SupermemoryHttpClientService;

  const searchDocuments = (
    query: string,
    options?: SearchOptions
  ): Effect.Effect<readonly DocumentChunk[], SupermemoryError> =>
    Effect.gen(function* () {
      // Validate query (must be non-empty string)
      const validatedQuery = yield* Schema.decodeUnknown(
        Schema.String.pipe(Schema.minLength(1))
      )(query).pipe(
        Effect.mapError(
          (error) =>
            new SupermemoryValidationError({
              message: ERROR_MESSAGES.QUERY_MUST_BE_NON_EMPTY_STRING,
              details: error,
            })
        )
      );

      // Build request body
      const body = buildSearchParams(validatedQuery, options);

      // Make request to v3 search endpoint
      const response = yield* httpClient.requestV3<
        SearchDocumentsResponse,
        unknown,
        never
      >("POST", API_ENDPOINTS.V3.SEARCH, {
        body,
      });

      return response.results;
    }).pipe(
      Effect.withSpan(SPANS.SEARCH_DOCUMENTS, {
        attributes: {
          [TELEMETRY_ATTRIBUTES.QUERY_LENGTH]: query.length,
          [TELEMETRY_ATTRIBUTES.TOP_K]: options?.topK,
          [TELEMETRY_ATTRIBUTES.THRESHOLD]: options?.threshold,
          [TELEMETRY_ATTRIBUTES.HAS_FILTERS]: options?.filters !== undefined,
        },
      })
    );

  const searchMemories = (
    query: string,
    options?: SearchOptions
  ): Effect.Effect<readonly SupermemoryMemory[], SupermemoryError> =>
    Effect.gen(function* () {
      // Validate query (must be non-empty string)
      const validatedQuery = yield* Schema.decodeUnknown(
        Schema.String.pipe(Schema.minLength(1))
      )(query).pipe(
        Effect.mapError(
          (error) =>
            new SupermemoryValidationError({
              message: ERROR_MESSAGES.QUERY_MUST_BE_NON_EMPTY_STRING,
              details: error,
            })
        )
      );

      // Build request body
      const body = buildSearchParams(validatedQuery, options);

      // Make request to v4 search endpoint
      const response = yield* httpClient.requestV4<
        SearchMemoriesResponse,
        unknown,
        never
      >("POST", API_ENDPOINTS.V4.SEARCH, {
        body,
      });

      return response.results;
    }).pipe(
      Effect.withSpan(SPANS.SEARCH_MEMORIES, {
        attributes: {
          [TELEMETRY_ATTRIBUTES.QUERY_LENGTH]: query.length,
          [TELEMETRY_ATTRIBUTES.TOP_K]: options?.topK,
          [TELEMETRY_ATTRIBUTES.THRESHOLD]: options?.threshold,
          [TELEMETRY_ATTRIBUTES.HAS_FILTERS]: options?.filters !== undefined,
        },
      })
    );

  return {
    searchDocuments,
    searchMemories,
  } satisfies SearchServiceOps;
});

/**
 * Context tag and Service for SearchService.
 *
 * @since 1.0.0
 * @category Services
 */
export class SearchService extends Effect.Service<SearchServiceOps>()(
  "@effect-supermemory/Search",
  {
    accessors: true,
    effect: makeSearchService,
  }
) {}

/**
 * Live layer for SearchService.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SearchServiceLive = SearchService.Default;
