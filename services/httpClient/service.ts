import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { HttpClient, HttpRequestOptions, HttpResponse } from "./api.js";
import { HttpClientConfigType } from "./types.js";
import * as Errors from "./errors.js";

// Use platform's global fetch by default, allow override for testing
const defaultFetch = globalThis.fetch;

export class HttpClientImpl extends Effect.Service<HttpClientImpl>()(
  "HttpClient",
  {
    // Configure HttpClient with a base URL, headers, and optional fetch implementation
    effect: Effect.fn(function* (config: HttpClientConfigType) {
      const { baseUrl, headers: defaultHeaders, timeoutMs, fetch: customFetch } = config;
      const effectiveFetch = customFetch || defaultFetch;

      return {
        request: <T = unknown>(
          path: string,
          options: HttpRequestOptions
        ): Effect.Effect<HttpResponse<T>, Errors.HttpClientError> =>
          Effect.tryPromise({
            try: async () => {
              const url = new URL(path, baseUrl); // Handle relative paths
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

              const bodyContent =
                typeof options.body === "object" && options.body !== null
                  ? JSON.stringify(options.body)
                  : options.body?.toString();

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

              const response = await effectiveFetch(url.toString(), requestInit);

              if (timeoutId) {
                clearTimeout(timeoutId);
              }

              let responseBody: T;
              try {
                const contentType = response.headers.get("Content-Type");
                if (contentType?.includes("application/json")) {
                  responseBody = (await response.json()) as T;
                } else if (contentType?.includes("text/")) {
                  responseBody = (await response.text()) as T;
                } else {
                  responseBody = null as T; // Or handle other content types, e.g., ArrayBuffer
                }
              } catch (parseError) {
                // If JSON parsing fails but request was successful, still return the response object
                // The body might just be empty or malformed non-JSON for successful status
                responseBody = null as T;
              }


              if (!response.ok) {
                // Handle HTTP error statuses (4xx, 5xx)
                if (response.status === 401 || response.status === 403) {
                  throw new Errors.AuthorizationError({
                    reason: `Unauthorized: ${response.statusText}`,
                    url: url.toString(),
                  });
                }
                if (response.status === 429) {
                  const retryAfter = response.headers.get("Retry-After");
                  const errorObj: { url: string; retryAfterSeconds?: number } = { url: url.toString() };
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
            },
            catch: (error: unknown) => {
              if (error instanceof Errors.HttpError || error instanceof Errors.NetworkError || error instanceof Errors.RequestError || error instanceof Errors.AuthorizationError || error instanceof Errors.TooManyRequestsError) {
                return error;
              }
              if (error instanceof Error) {
                if (error.name === "AbortError") {
                  return new Errors.NetworkError({
                    cause: new Error("Request timed out or aborted"),
                    url: new URL(path, baseUrl).toString(),
                  });
                }
                return new Errors.NetworkError({ cause: error, url: new URL(path, baseUrl).toString() });
              }
              return new Errors.RequestError({ cause: new Error("Unknown request error"), details: error });
            },
          }).pipe(Effect.flatMap(result => {
            if (result instanceof Errors.HttpError || result instanceof Errors.NetworkError || result instanceof Errors.RequestError || result instanceof Errors.AuthorizationError || result instanceof Errors.TooManyRequestsError) {
              return Effect.fail(result);
            } else {
              return Effect.succeed(result as HttpResponse<T>);
            }
          })),
      } satisfies HttpClient;
    }),
  }
) {}

// Layer for HttpClient, requires configuration
// Consumers will call HttpClientImpl.Default({ baseUrl: "...", ... })
