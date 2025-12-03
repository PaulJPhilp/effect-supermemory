import { Effect, Stream } from "effect";
import { HttpClientImpl } from "../httpClient/service.js";
import type { HttpPath, HttpUrl } from "../httpClient/types.js";
import {
  type MemoryError,
  MemoryValidationError,
} from "../memoryClient/errors.js";
import type { SearchError } from "../searchClient/errors.js";
import type { SearchOptions, SearchResult } from "../searchClient/types.js";
import type { MemoryStreamClient } from "./api.js";
import { type StreamError, StreamReadError } from "./errors.js";
import {
  buildKeysRequestOptions,
  buildSearchRequestOptions,
  parseNdjsonLines,
  parseSearchResultLine,
  translateHttpClientError,
  validateStreamResponse,
} from "./helpers.js";
import type { MemoryStreamClientConfigType } from "./types.js";

export class MemoryStreamClientImpl extends Effect.Service<MemoryStreamClientImpl>()(
  "MemoryStreamClient",
  {
    effect: Effect.fn(function* (config: MemoryStreamClientConfigType) {
      const { namespace, baseUrl, apiKey, timeoutMs } = config;

      const httpClientConfigBase = {
        baseUrl: baseUrl as HttpUrl,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Supermemory-Namespace": namespace,
          "Content-Type": "application/json",
        },
      };
      const httpClientConfig =
        timeoutMs !== undefined
          ? { ...httpClientConfigBase, timeoutMs }
          : httpClientConfigBase;
      const httpClientLayer = HttpClientImpl.Default(httpClientConfig);

      return {
        listAllKeys: (): Effect.Effect<
          Stream.Stream<string, MemoryError | StreamError>,
          MemoryError | StreamError
        > => {
          return Effect.gen(function* () {
            const httpClient = yield* HttpClientImpl.pipe(
              Effect.provide(httpClientLayer)
            );
            const keysPath = `/v1/keys/${encodeURIComponent(
              namespace
            )}` as HttpPath;

            const response = yield* httpClient
              .request<string>(keysPath, buildKeysRequestOptions())
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
                message: `Expected string response body, got ${typeof response.body}: ${JSON.stringify(
                  response.body
                )}`,
              });
            }

            const responseBody = response.body;
            const lines = responseBody
              .split("\n")
              .filter((line) => line.trim().length > 0);

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
        > =>
          Effect.gen(function* () {
            const httpClient = yield* HttpClientImpl.pipe(
              Effect.provide(httpClientLayer)
            );
            const searchPath = `/v1/search/${encodeURIComponent(
              namespace
            )}/stream` as HttpPath;

            const response = yield* httpClient
              .request<string>(
                searchPath,
                buildSearchRequestOptions(query, options)
              )
              .pipe(
                Effect.mapError((error): SearchError | StreamError =>
                  translateHttpClientError(error)
                )
              );

            const responseBody = yield* validateStreamResponse(
              response,
              "Search"
            );

            return parseNdjsonLines(responseBody, parseSearchResultLine);
          }),
      } satisfies MemoryStreamClient;
    }),
  }
) {}
