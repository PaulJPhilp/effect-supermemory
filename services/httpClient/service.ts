import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { HttpClient, HttpRequestOptions, HttpResponse } from "./api.js";
import * as Errors from "./errors.js";
import { HttpClientConfigType } from "./types.js";

// Use platform's global fetch by default, allow override for testing
const defaultFetch = globalThis.fetch;

// Helper to stringify body
const stringifyBody = (
  body: unknown
): Effect.Effect<string | undefined, Errors.RequestError> => {
  if (body === undefined || body === null) {
    return Effect.succeed(undefined);
  }
  if (typeof body === "string") {
    return Effect.succeed(body);
  }
  return Effect.try({
    try: () => JSON.stringify(body),
    catch: () =>
      new Errors.RequestError({ cause: new Error("Failed to stringify body") }),
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
          path: string,
          options: HttpRequestOptions
        ): Effect.Effect<HttpResponse<T>, Errors.HttpClientError> =>
          Effect.gen(function* () {
            const url = new URL(path, baseUrl);
            if (options.queryParams) {
              Object.entries(options.queryParams).forEach(([key, value]) => {
                url.searchParams.append(key, value);
              });
            }

            const requestHeaders = { ...defaultHeaders, ...options.headers };

            const controller = new AbortController();
            const timeoutId = timeoutMs
              ? setTimeout(() => controller.abort(), timeoutMs)
              : undefined;

            const bodyContent = yield* stringifyBody(options.body);

            const requestInit: RequestInit = {
              method: options.method,
              headers: bodyContent
                ? { "Content-Type": "application/json", ...requestHeaders }
                : requestHeaders,
              signal: controller.signal,
            };

            if (bodyContent) {
              requestInit.body = bodyContent;
            }

            const response = yield* Effect.tryPromise({
              try: () => effectiveFetch(url.toString(), requestInit),
              catch: (error: unknown) => {
                if (
                  error instanceof Errors.HttpError ||
                  error instanceof Errors.NetworkError ||
                  error instanceof Errors.RequestError ||
                  error instanceof Errors.AuthorizationError ||
                  error instanceof Errors.TooManyRequestsError
                ) {
                  return error;
                }
                if (error instanceof Error) {
                  if (error.name === "AbortError") {
                    return new Errors.NetworkError({
                      cause: new Error("Request timed out or aborted"),
                      url: url.toString(),
                    });
                  }
                  return new Errors.NetworkError({
                    cause: error,
                    url: url.toString(),
                  });
                }
                return new Errors.RequestError({
                  cause: new Error("Unknown request error"),
                  details: error,
                });
              },
            });

            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            let responseBody: T;
            try {
              const contentType = response.headers.get("Content-Type");
              if (contentType?.includes("application/json")) {
                responseBody = (yield* Effect.tryPromise({
                  try: () => response.json(),
                  catch: () => null as T,
                })) as T;
              } else if (contentType?.includes("text/")) {
                responseBody = (yield* Effect.tryPromise({
                  try: () => response.text(),
                  catch: () => null as T,
                })) as T;
              } else {
                responseBody = null as T;
              }
            } catch (parseError) {
              responseBody = null as T;
            }

            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                throw new Errors.AuthorizationError({
                  reason: `Unauthorized: ${response.statusText}`,
                  url: url.toString(),
                });
              }
              if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After");
                const errorObj: { url: string; retryAfterSeconds?: number } = {
                  url: url.toString(),
                };
                if (retryAfter) {
                  errorObj.retryAfterSeconds = parseInt(retryAfter, 10);
                }
                throw new Errors.TooManyRequestsError(errorObj);
              }
              throw new Errors.HttpError({
                status: response.status,
                message: response.statusText,
                url: url.toString(),
                body: responseBody,
              });
            }

            return {
              status: response.status,
              headers: response.headers,
              body: responseBody,
            };
          }).pipe(
            Effect.catchAll((error) =>
              Effect.fail(error as Errors.HttpClientError)
            )
          ),

        requestStream: (
          path: string,
          options: HttpRequestOptions
        ): Effect.Effect<
          Stream.Stream<Uint8Array, Errors.HttpClientError>,
          Errors.HttpClientError
        > =>
          Effect.gen(function* () {
            const url = new URL(path, baseUrl);
            if (options.queryParams) {
              Object.entries(options.queryParams).forEach(([key, value]) => {
                url.searchParams.append(key, value);
              });
            }

            const requestHeaders = { ...defaultHeaders, ...options.headers };

            const bodyContent = yield* stringifyBody(options.body);

            const response = yield* Effect.tryPromise({
              try: () =>
                effectiveFetch(url.toString(), {
                  method: options.method,
                  headers: bodyContent
                    ? { "Content-Type": "application/json", ...requestHeaders }
                    : requestHeaders,
                  ...(bodyContent ? { body: bodyContent } : {}),
                }),
              catch: (error: unknown): Errors.HttpClientError => {
                if (error instanceof Error && error.name === "AbortError") {
                  return new Errors.NetworkError({
                    cause: new Error("Request timed out or aborted"),
                    url: url.toString(),
                  });
                }
                return new Errors.NetworkError({
                  cause:
                    error instanceof Error ? error : new Error(String(error)),
                  url: url.toString(),
                });
              },
            });

            if (!response.ok) {
              if (response.status === 401 || response.status === 403) {
                return yield* Effect.fail(
                  new Errors.AuthorizationError({
                    reason: `Unauthorized: ${response.statusText}`,
                    url: url.toString(),
                  })
                );
              }
              if (response.status === 429) {
                const retryAfter = response.headers.get("Retry-After");
                const retryAfterSeconds = retryAfter
                  ? parseInt(retryAfter, 10)
                  : undefined;
                return yield* Effect.fail(
                  new Errors.TooManyRequestsError({
                    ...(retryAfterSeconds !== undefined
                      ? { retryAfterSeconds }
                      : {}),
                    url: url.toString(),
                  })
                );
              }
              return yield* Effect.fail(
                new Errors.HttpError({
                  status: response.status,
                  message: response.statusText,
                  url: url.toString(),
                })
              );
            }

            if (!response.body) {
              return Stream.empty as Stream.Stream<
                Uint8Array,
                Errors.HttpClientError
              >;
            }

            const reader = response.body.getReader();

            return Stream.async<Uint8Array, Errors.HttpClientError>((emit) => {
              const read = async () => {
                try {
                  const { value, done } = await reader.read();
                  if (done) {
                    emit.end();
                  } else if (value && value.length > 0) {
                    emit.single(value);
                    read();
                  } else {
                    read();
                  }
                } catch (e) {
                  emit.fail(
                    new Errors.NetworkError({
                      cause: e instanceof Error ? e : new Error(String(e)),
                      url: url.toString(),
                    })
                  );
                }
              };
              read();
            });
          }).pipe(
            Effect.catchAll((error) =>
              Effect.fail(error as Errors.HttpClientError)
            )
          ),
      } satisfies HttpClient;
    }),
  }
) {}

// Layer for HttpClient, requires configuration
// Consumers will call HttpClientImpl.Default({ baseUrl: "...", ... })
