import * as Effect from "effect/Effect";
import { HttpClientImpl } from "../httpClient/service.js";
import { MemoryValidationError } from "../memoryClient/errors.js";
import { SearchQueryError } from "./errors.js";
import * as Utils from "./helpers.js";
// Helper to encode filters
function encodeFilters(filters) {
  if (!filters) {
    return {};
  }
  const params = {};
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (params[`filter.${key}`]) {
          params[`filter.${key}`] += `,${v.toString()}`;
        } else {
          params[`filter.${key}`] = v.toString();
        }
      });
    } else {
      params[`filter.${key}`] = value.toString();
    }
  }
  return params;
}
export class SearchClientImpl extends Effect.Service()("SearchClient", {
  effect: Effect.fn(function* (_config) {
    const httpClient = yield* HttpClientImpl;
    const makeRequest = (path, options) =>
      httpClient.request(path, options).pipe(
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
      search: (query, options) =>
        makeRequest("/api/v1/search", {
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
            response.results.map((item) => ({
              memory: {
                key: item.id,
                value: Utils.fromBase64(item.value),
              },
              relevanceScore: item.relevanceScore,
            }))
          )
        ),
    };
  }),
}) {}
