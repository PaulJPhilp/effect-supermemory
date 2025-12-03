import { Effect, Stream } from "effect";

import type { HttpClient } from "./api.js";
import { type HttpClientError, NetworkError, RequestError } from "./errors.js";
import {
  buildUrlWithQuery,
  createRequestHeaders,
  createStreamReader,
  handleErrorResponse,
  handleFetchError,
  parseResponseBody,
} from "./helpers.js";
import type {
  HttpClientConfigType,
  HttpPath,
  HttpRequestOptions,
  HttpResponse,
  HttpUrl,
} from "./types.js";

// Use platform's global fetch by default, allow override for testing
const defaultFetch = globalThis.fetch;

// Helper to stringify body
const stringifyBody = (
  body: unknown
): Effect.Effect<string | undefined, RequestError> => {
  if (body === undefined || body === null) {
    return Effect.succeed(undefined);
  }
  if (typeof body === "string") {
    return Effect.succeed(body);
  }
  return Effect.try({
    try: () => JSON.stringify(body),
    catch: () =>
      new RequestError({ cause: new Error("Failed to stringify body") }),
  });
};

export class HttpClientImpl extends Effect.Service<HttpClientImpl>()(
  "HttpClient",
  {
    // Configure HttpClient with a base URL, headers, and optional fetch implementation
    effect: Effect.fn(function* (config: HttpClientConfigType) {
      const {
        baseUrl,
        headers: defaultHeaders,
        timeoutMs,
        fetch: customFetch,
      } = config;
      const effectiveFetch = customFetch || defaultFetch;

      return {
        request: <T = unknown>(
          path: HttpPath,
          options: HttpRequestOptions
        ): Effect.Effect<HttpResponse<T>, HttpClientError> =>
          Effect.gen(function* () {
            const url = buildUrlWithQuery(baseUrl, path, options.queryParams);

            const bodyContent = yield* stringifyBody(options.body);
            const requestHeaders = createRequestHeaders(
              defaultHeaders,
              options.headers,
              !!bodyContent
            );

            const controller = new AbortController();
            const timeoutId = timeoutMs
              ? setTimeout(() => controller.abort(), timeoutMs)
              : undefined;

            const requestInit: RequestInit = {
              method: options.method,
              headers: requestHeaders,
              signal: controller.signal,
              ...(bodyContent ? { body: bodyContent } : {}),
            };

            const response = yield* Effect.tryPromise({
              try: () => effectiveFetch(url.toString(), requestInit),
              catch: (error: unknown) => {
                const httpError = handleFetchError(
                  error,
                  url.toString() as HttpUrl
                );
                if (httpError instanceof RequestError) {
                  return httpError;
                }
                return httpError;
              },
            });

            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            // Parse response body using Effect.try
            const responseBody: T = yield* Effect.tryPromise({
              try: async () => parseResponseBody<T>(response),
              catch: () => null as T,
            });

            if (!response.ok) {
              return yield* handleErrorResponse(
                response,
                url.toString() as HttpUrl,
                responseBody
              );
            }

            return {
              status: response.status,
              headers: response.headers,
              body: responseBody,
            };
          }).pipe(
            Effect.catchAll((error) => Effect.fail(error as HttpClientError))
          ),

        requestStream: (
          path: HttpPath,
          options: HttpRequestOptions
        ): Effect.Effect<
          Stream.Stream<Uint8Array, HttpClientError>,
          HttpClientError
        > =>
          Effect.gen(function* () {
            const url = buildUrlWithQuery(baseUrl, path, options.queryParams);

            const bodyContent = yield* stringifyBody(options.body);
            const requestHeaders = createRequestHeaders(
              defaultHeaders,
              options.headers,
              !!bodyContent
            );

            const response = yield* Effect.tryPromise({
              try: () =>
                effectiveFetch(url.toString(), {
                  method: options.method,
                  headers: requestHeaders,
                  ...(bodyContent ? { body: bodyContent } : {}),
                }),
              catch: (error: unknown): HttpClientError => {
                if (error instanceof Error && error.name === "AbortError") {
                  return new NetworkError({
                    cause: new Error("Request timed out or aborted"),
                    url: url.toString() as HttpUrl,
                  });
                }
                return new NetworkError({
                  cause:
                    error instanceof Error ? error : new Error(String(error)),
                  url: url.toString() as HttpUrl,
                });
              },
            });

            if (!response.ok) {
              return yield* handleErrorResponse(
                response,
                url.toString() as HttpUrl
              );
            }

            if (!response.body) {
              return Stream.empty as Stream.Stream<Uint8Array, HttpClientError>;
            }

            const reader = response.body.getReader();
            const streamUrl = url.toString() as HttpUrl;

            return Stream.async<Uint8Array, HttpClientError>((emit) => {
              const read = createStreamReader(reader, streamUrl, emit);
              read();
            });
          }).pipe(
            Effect.catchAll((error) => Effect.fail(error as HttpClientError))
          ),
      } satisfies HttpClient;
    }),
  }
) {}
