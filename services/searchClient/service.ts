import * as Effect from "effect/Effect";
import { HttpRequestOptions } from "../httpClient/api.js";
import { HttpClientImpl } from "../httpClient/service.js";
import { MemoryValidationError } from "../memoryClient/errors.js";
import { SearchClient } from "./api.js";
import { SearchQueryError } from "./errors.js";
import {
  SearchOptions,
  SearchResult,
  SupermemoryClientConfigType,
} from "./types.js";
import * as Utils from "./utils.js";

// Helper to encode filters
function encodeFilters(
  filters?: Record<string, string | number | boolean | string[]>
): Record<string, string> {
  if (!filters) return {};
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (!params[`filter.${key}`]) params[`filter.${key}`] = v.toString();
        else params[`filter.${key}`] += `,${v.toString()}`;
      });
    } else {
      params[`filter.${key}`] = value.toString();
    }
  }
  return params;
}

export class SearchClientImpl extends Effect.Service<SearchClientImpl>()(
  "SearchClient",
  {
    effect: Effect.fn(function* (config: SupermemoryClientConfigType) {
      const httpClient = yield* HttpClientImpl;

      const makeRequest = <T = unknown>(
        path: string,
        options: HttpRequestOptions
      ) =>
        httpClient.request<T>(path, options).pipe(
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
              id: string;
              value: string;
              relevanceScore: number;
              namespace: string;
              metadata?: Record<string, unknown>;
              createdAt: string;
              updatedAt: string;
            }>;
            total: number;
          }>(`/api/v1/search`, {
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
              response.body.results.map(
                (item): SearchResult => ({
                  memory: {
                    key: item.id,
                    value: Utils.fromBase64(item.value),
                  },
                  relevanceScore: item.relevanceScore,
                })
              )
            )
          ),
      } satisfies SearchClient;
    }),
  }
) { }
