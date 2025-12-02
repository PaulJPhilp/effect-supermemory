import { Effect, Stream } from "effect";
import type { HttpRequestOptions } from "../httpClient/api.js";
import { HttpClientImpl } from "../httpClient/service.js";
import {
  MemoryValidationError,
  type MemoryError,
} from "../memoryClient/errors.js";
import type { SearchError } from "../searchClient/errors.js";
import { SearchOptions, SearchResult } from "../searchClient/types.js";
import { MemoryStreamClient } from "./api.js";
import { StreamReadError, type StreamError } from "./errors.js";
import { MemoryStreamClientConfigType } from "./types.js";

export class MemoryStreamClientImpl extends Effect.Service<MemoryStreamClientImpl>()(
  "MemoryStreamClient",
  {
    effect: Effect.fn(function* (config: MemoryStreamClientConfigType) {
      const { namespace, baseUrl, apiKey, timeoutMs } = config;

      const httpClientLayer = HttpClientImpl.Default({
        baseUrl,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Supermemory-Namespace": namespace,
          "Content-Type": "application/json",
        },
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      });

      return {
        listAllKeys: (): Effect.Effect<
          Stream.Stream<string, MemoryError | StreamError>,
          MemoryError | StreamError
        > => {
          return Effect.gen(function* () {
            const httpClient = yield* HttpClientImpl.pipe(
              Effect.provide(httpClientLayer)
            );
            const keysPath = `/v1/keys/${encodeURIComponent(namespace)}`;

            const options: HttpRequestOptions = {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/x-ndjson",
              },
            };

            const response = yield* httpClient
              .request<string>(keysPath, options)
              .pipe(
                Effect.mapError((error): MemoryError | StreamError => {
                  if (error._tag === "HttpError") {
                    return new MemoryValidationError({
                      message: `HTTP ${error.status}: ${error.message}`,
                    });
                  }
                  if (error._tag === "NetworkError") {
                    return new StreamReadError({
                      message: `Network error: ${error.message}`,
                      cause: error,
                    });
                  }
                  return new StreamReadError({
                    message: `HTTP client error: ${error._tag}`,
                    cause: error,
                  });
                })
              );

            if (response.status >= 400) {
              return yield* new StreamReadError({
                message: `HTTP ${response.status}: Failed to fetch keys`,
              });
            }

            // Handle response body as string that needs to be parsed as NDJSON
            if (typeof response.body !== "string") {
              return yield* new StreamReadError({
                message: `Expected string response body, got ${typeof response.body}: ${JSON.stringify(response.body)}`,
              });
            }

            const responseBody = response.body;
            const lines = responseBody.split("\n").filter((line) => line.trim().length > 0);

            return Stream.fromIterable(lines).pipe(
              Stream.mapEffect((line) =>
                Effect.try({
                  try: () => {
                    const parsed = JSON.parse(line) as { key: string };
                    return parsed.key;
                  },
                  catch: (error) =>
                    new StreamReadError({
                      message: `Failed to parse key from line "${line}": ${
                        error instanceof Error ? error.message : String(error)
                      }`,
                      cause:
                        error instanceof Error
                          ? error
                          : new Error(String(error)),
                    }),
                })
              )
            );
          });
        },

        streamSearch: (
          query: string,
          options?: SearchOptions
        ): Effect.Effect<
          Stream.Stream<SearchResult, SearchError | StreamError>,
          SearchError | StreamError
        > => {
          return Effect.gen(function* () {
            const httpClient = yield* HttpClientImpl.pipe(
              Effect.provide(httpClientLayer)
            );
            const searchPath = `/v1/search/${encodeURIComponent(namespace)}/stream`;

            // Build query parameters
            const params = new URLSearchParams();
            params.set("q", query);

            if (options?.limit) {
              params.set("limit", options.limit.toString());
            }

            if (options?.filters) {
              Object.entries(options.filters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                  value.forEach((v) => params.append(key, v.toString()));
                } else {
                  params.set(key, value.toString());
                }
              });
            }

            const fullPath = `${searchPath}?${params.toString()}`;

            const requestOptions: HttpRequestOptions = {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/x-ndjson",
              },
            };

            const response = yield* httpClient
              .request<string>(fullPath, requestOptions)
              .pipe(
                Effect.mapError((error): SearchError | StreamError => {
                  if (error._tag === "HttpError") {
                    return new StreamReadError({
                      message: `HTTP ${error.status}: ${error.message}`,
                      cause: error,
                    });
                  }
                  if (error._tag === "NetworkError") {
                    return new StreamReadError({
                      message: `Network error: ${error.message}`,
                      cause: error,
                    });
                  }
                  return new StreamReadError({
                    message: `HTTP client error: ${error._tag}`,
                    cause: error,
                  });
                })
              );

            if (response.status >= 400) {
              return yield* new StreamReadError({
                message: `HTTP ${response.status}: Search request failed`,
              });
            }

            // Handle response body as string that needs to be parsed as NDJSON
            if (typeof response.body !== "string") {
              return yield* new StreamReadError({
                message: `Expected string response body, got ${typeof response.body}`,
              });
            }

            const responseBody = response.body;
            const lines = responseBody.split("\n").filter((line) => line.trim().length > 0);

            return Stream.fromIterable(lines).pipe(
              Stream.mapEffect((line) =>
                Effect.try({
                  try: () => {
                    return JSON.parse(line) as SearchResult;
                  },
                  catch: (error) =>
                    new StreamReadError({
                      message: `Failed to parse search result from line "${line}": ${
                        error instanceof Error ? error.message : String(error)
                      }`,
                      cause:
                        error instanceof Error
                          ? error
                          : new Error(String(error)),
                    }),
                })
              )
            );
          });
        },
      } satisfies MemoryStreamClient;
    }),
  }
) {}
