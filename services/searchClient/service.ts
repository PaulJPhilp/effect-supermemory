import {
  API_ENDPOINTS,
  ERROR_MESSAGES,
  HTTP_METHODS,
  HTTP_STATUS,
  QUERY_PARAMS,
} from "@/Constants.js";
import { isHttpErrorWithStatus } from "@services/httpClient/helpers.js";
import { HttpClient } from "@services/httpClient/service.js";
import type {
  HttpPath,
  HttpRequestOptions,
} from "@services/httpClient/types.js";
import { MemoryValidationError } from "@services/inMemoryClient/errors.js";
import type { SupermemoryClientConfigType } from "@services/supermemoryClient/types.js";
import { Effect } from "effect";
import type { SearchClientApi } from "./api.js";
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

export class SearchClient extends Effect.Service<SearchClient>()(
  "SearchClient",
  {
    effect: Effect.fn(function* (_config: SupermemoryClientConfigType) {
      const httpClient = yield* HttpClient;

      const makeRequest = <T = unknown>(
        path: HttpPath,
        options: HttpRequestOptions
      ): Effect.Effect<T, SearchError> =>
        httpClient.request<T>(path, options).pipe(
          Effect.map((response) => response.body),
          Effect.mapError((error) => {
            if (isHttpErrorWithStatus(error, HTTP_STATUS.BAD_REQUEST)) {
              return new SearchQueryError({
                message: `Search query error: ${error.message}`,
                details: error.body,
              });
            }
            return new MemoryValidationError({
              message: `${ERROR_MESSAGES.SEARCH_REQUEST_FAILED}: ${error._tag} - ${error.message}`,
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
          }>(API_ENDPOINTS.V1.SEARCH, {
            method: HTTP_METHODS.GET,
            queryParams: {
              [QUERY_PARAMS.QUERY]: query,
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
      } satisfies SearchClientApi;
    }),
  }
) {}
