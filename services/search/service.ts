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
import { Duration, Effect, Schema } from "effect";
import type { SearchServiceOps } from "./api.js";
import { buildSearchParams } from "./helpers.js";
import type {
  DocumentChunk,
  SearchDocumentsResponse,
  SearchExecuteResponse,
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
    Effect.timed(
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

        // Make request to search documents endpoint
        const response = yield* httpClient.request<
          SearchDocumentsResponse,
          unknown,
          never
        >("POST", API_ENDPOINTS.SEARCH.DOCUMENTS, {
          body,
        });

        return response.results;
      })
    ).pipe(
      Effect.flatMap(([duration, results]) =>
        Effect.gen(function* () {
          const latencyMs = Duration.toMillis(duration);
          const resultCount = results.length;

          // Log metrics for observability
          yield* Effect.log({
            message: "Search operation completed",
            [TELEMETRY_ATTRIBUTES.LATENCY]: latencyMs,
            [TELEMETRY_ATTRIBUTES.RESULT_COUNT]: resultCount,
          }).pipe(Effect.asVoid);

          return results;
        })
      ),
      Effect.withSpan(SPANS.SEARCH_DOCUMENTS, {
        attributes: {
          [TELEMETRY_ATTRIBUTES.QUERY_LENGTH]: query.length,
          [TELEMETRY_ATTRIBUTES.TOP_K]: options?.topK,
          [TELEMETRY_ATTRIBUTES.THRESHOLD]: options?.threshold,
          [TELEMETRY_ATTRIBUTES.HAS_FILTERS]: options?.filters !== undefined,
        },
      })
    );

  const execute = (
    query: string,
    options?: SearchOptions
  ): Effect.Effect<readonly DocumentChunk[], SupermemoryError> =>
    Effect.timed(
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

        // Make request to search execute endpoint
        const response = yield* httpClient.request<
          SearchExecuteResponse,
          unknown,
          never
        >("POST", API_ENDPOINTS.SEARCH.EXECUTE, {
          body,
        });

        return response.results;
      })
    ).pipe(
      Effect.flatMap(([duration, results]) =>
        Effect.gen(function* () {
          const latencyMs = Duration.toMillis(duration);
          const resultCount = results.length;

          // Log metrics for observability
          yield* Effect.log({
            message: "Search execute operation completed",
            [TELEMETRY_ATTRIBUTES.LATENCY]: latencyMs,
            [TELEMETRY_ATTRIBUTES.RESULT_COUNT]: resultCount,
          }).pipe(Effect.asVoid);

          return results;
        })
      ),
      Effect.withSpan(SPANS.SEARCH_EXECUTE, {
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
    Effect.timed(
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

        // Make request to search memories endpoint
        const response = yield* httpClient.request<
          SearchMemoriesResponse,
          unknown,
          never
        >("POST", API_ENDPOINTS.SEARCH.MEMORIES, {
          body,
        });

        return response.results;
      })
    ).pipe(
      Effect.flatMap(([duration, results]) =>
        Effect.gen(function* () {
          const latencyMs = Duration.toMillis(duration);
          const resultCount = results.length;

          // Log metrics for observability
          yield* Effect.log({
            message: "Search memories operation completed",
            [TELEMETRY_ATTRIBUTES.LATENCY]: latencyMs,
            [TELEMETRY_ATTRIBUTES.RESULT_COUNT]: resultCount,
          }).pipe(Effect.asVoid);

          return results;
        })
      ),
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
    execute,
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
