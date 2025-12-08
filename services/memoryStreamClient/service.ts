// biome-ignore assist/source/organizeImports: <>
import { API_ENDPOINTS, HTTP_HEADERS, HTTP_VALUES } from "@/Constants.js";
import { HttpClient } from "@services/httpClient/service.js";
import type { HttpPath, HttpUrl } from "@services/httpClient/types.js";
import type { MemoryError } from "@services/inMemoryClient/errors.js";
import type { SearchError } from "@services/searchClient/errors.js";
import type {
  SearchOptions,
  SearchResult,
} from "@services/searchClient/types.js";
import { Effect, type Stream } from "effect";
import type { MemoryStreamClientApi } from "./api.js";
import type { StreamError } from "./errors.js";
import {
  buildKeysRequestOptions,
  buildSearchRequestOptions,
  parseKeyLine,
  parseNdjsonLines,
  parseSearchResultLine,
  translateHttpClientError,
  validateStreamResponse,
} from "./helpers.js";
import type { MemoryStreamClientConfigType } from "./types.js";

export class MemoryStreamClient extends Effect.Service<MemoryStreamClient>()(
  "MemoryStreamClient",
  {
    effect: Effect.fn(function* (config: MemoryStreamClientConfigType) {
      const { namespace, baseUrl, apiKey, timeoutMs } = config;

      const httpClientConfigBase = {
        baseUrl: baseUrl as HttpUrl, // ValidatedHttpUrl extends HttpUrl, cast for compatibility
      };
      const httpClientConfig =
        timeoutMs !== undefined
          ? { ...httpClientConfigBase, timeoutMs }
          : httpClientConfigBase;
      const httpClientLayer = HttpClient.Default(httpClientConfig);

      return {
        listAllKeys: (): Effect.Effect<
          Stream.Stream<string, MemoryError | StreamError>,
          MemoryError | StreamError
        > =>
          Effect.gen(function* () {
            const httpClient = yield* HttpClient.pipe(
              Effect.provide(httpClientLayer)
            );
            const keysPath = API_ENDPOINTS.STREAM.KEYS(namespace) as HttpPath;
            const baseOptions = buildKeysRequestOptions();

            const requestOptions = {
              ...baseOptions,
              headers: {
                ...baseOptions.headers,
                [HTTP_HEADERS.AUTHORIZATION]: `${HTTP_VALUES.BEARER_PREFIX}${apiKey}`,
                [HTTP_HEADERS.SUPERMEMORY_NAMESPACE]: namespace,
              },
            };

            const response = yield* httpClient
              .request<string>(keysPath, requestOptions)
              .pipe(
                Effect.mapError((error): MemoryError | StreamError =>
                  translateHttpClientError(error)
                )
              );

            const responseBody = yield* validateStreamResponse(
              response,
              "Keys"
            );

            return parseNdjsonLines(responseBody, parseKeyLine);
          }),

        streamSearch: (
          query: string,
          options?: SearchOptions
        ): Effect.Effect<
          Stream.Stream<SearchResult, SearchError | StreamError>,
          SearchError | StreamError
        > =>
          Effect.gen(function* () {
            const httpClient = yield* HttpClient.pipe(
              Effect.provide(httpClientLayer)
            );
            const searchPath = API_ENDPOINTS.STREAM.SEARCH(
              namespace
            ) as HttpPath;
            const baseOptions = buildSearchRequestOptions(query, options);

            const requestOptions = {
              ...baseOptions,
              headers: {
                ...baseOptions.headers,
                [HTTP_HEADERS.AUTHORIZATION]: `${HTTP_VALUES.BEARER_PREFIX}${apiKey}`,
                [HTTP_HEADERS.SUPERMEMORY_NAMESPACE]: namespace,
              },
            };

            const response = yield* httpClient
              .request<string>(searchPath, requestOptions)
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
      } satisfies MemoryStreamClientApi;
    }),
  }
) {}
