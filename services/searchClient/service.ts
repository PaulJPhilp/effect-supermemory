import { Effect } from "effect";
import { HttpClientImpl } from "../httpClient/service.js";
import type { HttpPath, HttpRequestOptions } from "../httpClient/types.js";
import { MemoryValidationError } from "../memoryClient/errors.js";
import type { SupermemoryClientConfigType } from "../supermemoryClient/types.js";
import type { SearchClient } from "./api.js";
import { type SearchError, SearchQueryError } from "./errors.js";
import { encodeFilters, fromBase64 } from "./helpers.js";
import type {
  ID,
  MemoryValue,
  Metadata,
  Namespace,
  RelevanceScore,
  SearchOptions,
  SearchResult,
  Timestamp,
} from "./types.js";

export class SearchClientImpl extends Effect.Service<SearchClientImpl>()(
  "SearchClient",
  {
    effect: Effect.fn(function* (_config: SupermemoryClientConfigType) {
      const httpClient = yield* HttpClientImpl;

      const makeRequest = <T = unknown>(
        path: HttpPath,
        options: HttpRequestOptions
      ): Effect.Effect<T, SearchError> =>
        httpClient.request<T>(path, options).pipe(
          Effect.map((response) => response.body),
          Effect.mapError((error) => {
            if (error._tag === "HttpError" && error.status === 400) {
              return new SearchQueryError({
                message: `Search query error: ${error.message}`,
                details: error.body,
              });
            }
            return new MemoryValidationError({
              message: `Search request failed: ${error._tag} - ${error.message}`,
            });
          })
        );

      return {
        search: (query: string, options?: SearchOptions) =>
          makeRequest<{
            results: Array<{
              id: ID;
              value: MemoryValue;
              relevanceScore: RelevanceScore;
              namespace: Namespace;
              metadata?: Metadata;
              createdAt: Timestamp;
              updatedAt: Timestamp;
            }>;
            total: number;
          }>("/api/v1/search", {
            method: "GET",
            queryParams: {
              q: query,
              ...(options?.limit !== undefined && {
                limit: options.limit.toString(),
              }),
              ...(options?.offset !== undefined && {
                offset: options.offset.toString(),
              }),
              ...(options?.minRelevanceScore !== undefined && {
                minRelevanceScore: options.minRelevanceScore.toString(),
              }),
              ...(options?.maxAgeHours !== undefined && {
                maxAgeHours: options.maxAgeHours.toString(),
              }),
              ...encodeFilters(options?.filters),
            },
          }).pipe(
            Effect.map((response) =>
              response.results.map(
                (item: {
                  id: ID;
                  value: MemoryValue;
                  relevanceScore: RelevanceScore;
                  namespace: Namespace;
                  metadata?: Metadata;
                  createdAt: Timestamp;
                  updatedAt: Timestamp;
                }): SearchResult => ({
                  memory: {
                    key: item.id,
                    value: fromBase64(item.value),
                  },
                  relevanceScore: item.relevanceScore,
                })
              )
            )
          ),
      } satisfies SearchClient;
    }),
  }
) {}
