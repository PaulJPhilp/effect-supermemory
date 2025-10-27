import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import * as Schedule from "effect/Schedule"; // Import Schedule for retries
import * as Duration from "effect/Duration";
import { HttpClientImpl } from "../httpClient/service.js";
import { SupermemoryClient } from "./api.js";
import { SupermemoryClientConfigType, SupermemoryApiMemory, SupermemoryId, RetryScheduleConfig } from "./types.js"; // Import RetryScheduleConfig
import * as Utils from "./utils.js";
import * as SupermemoryErrors from "./errors.js";
import { MemoryNotFoundError } from "./errors.js";
import { HttpClientError, HttpError, NetworkError, AuthorizationError as HttpClientAuthorizationError, TooManyRequestsError } from "../httpClient/errors.js";
import { HttpRequestOptions } from "../httpClient/api.js";

export const SupermemoryClientConfig = Context.Tag<SupermemoryClientConfigType>("SupermemoryClientConfig")

// Helper function to determine if an HttpClientError should trigger a retry
const shouldRetryHttpClientError = (error: HttpClientError): boolean => {
  // Retry on Network errors, 5xx responses, and 429 Too Many Requests
  if (error._tag === "NetworkError") return true;
  if (error._tag === "HttpError" && error.status >= 500 && error.status <= 599) return true;
  if (error._tag === "TooManyRequestsError") return true;
  return false;
};

export const supermemoryClientEffect = Effect.gen(function* () {
  const config = yield* SupermemoryClientConfig;
  const { namespace, baseUrl, apiKey, timeoutMs, retries } = config;
  const httpClient = yield* HttpClientImpl;

  // Create a Schedule if retries are configured
  const retrySchedule: Schedule.Schedule<unknown, HttpClientError> | undefined = retries
    ? Schedule.addDelay(Schedule.recurs(retries.attempts - 1), () => Duration.millis(retries.delayMs))
    : undefined;

  // Helper for common request logic with retry policy
  const makeRequestWithRetries = <T = unknown>(
    path: string,
    options: Omit<HttpRequestOptions, "headers">,
    keyFor404Translation?: string
  ) => {
    const baseRequest = httpClient.request<T>(path, options);

    // Apply retry logic if retrySchedule is defined
    if (retrySchedule) {
      return baseRequest.pipe(
        Effect.retry(retrySchedule), // Apply the schedule
        Effect.catchIf(shouldRetryHttpClientError, (error) => {
          // If retries are exhausted and it's a retryable error, re-fail with translated error
          return Effect.fail(SupermemoryErrors.translateHttpClientError(error, keyFor404Translation));
        }),
        Effect.mapError((error) => {
          // Handle non-retryable errors or final translated errors
          return SupermemoryErrors.translateHttpClientError(error, keyFor404Translation);
        })
      );
    } else {
      // No retries configured, proceed with base request and direct error translation
      return baseRequest.pipe(
        Effect.mapError((error) => {
          return SupermemoryErrors.translateHttpClientError(error, keyFor404Translation);
        })
      );
    }
  };

  return {
    put: (key, value) =>
      makeRequestWithRetries<SupermemoryApiMemory>(
        `/api/v1/memories`,
        {
          method: "POST",
          body: {
            id: key,
            value: Utils.toBase64(value),
            namespace: namespace,
          },
        }
      ).pipe(Effect.asVoid),

    get: (key) =>
      makeRequestWithRetries<SupermemoryApiMemory>(
        `/api/v1/memories/${key}`,
        { method: "GET" },
        key
      ).pipe(
        Effect.map((response) => Utils.fromBase64(response.body.value)),
        Effect.catchIf((error) => error instanceof MemoryNotFoundError, () => Effect.succeed(undefined))
      ),

    delete: (key) =>
      makeRequestWithRetries<void>(
        `/api/v1/memories/${key}`,
        { method: "DELETE" }
      ).pipe(
        Effect.map(() => true),
        Effect.catchIf((error) => error instanceof MemoryNotFoundError, () => Effect.succeed(true))
      ),

    exists: (key) =>
      makeRequestWithRetries<SupermemoryApiMemory>(
        `/api/v1/memories/${key}`,
        { method: "GET" },
        key
      ).pipe(
        Effect.map(() => true),
        Effect.catchIf((error) => error instanceof MemoryNotFoundError, () => Effect.succeed(false))
      ),

    clear: () =>
      makeRequestWithRetries<void>(
        `/api/v1/memories`,
        {
          method: "DELETE",
          queryParams: { namespace: namespace },
        }
      ).pipe(Effect.asVoid),
  } satisfies SupermemoryClient;
});

export class SupermemoryClientImpl extends Effect.Service<SupermemoryClientImpl>()(
  "SupermemoryClient",
  {
    effect: supermemoryClientEffect,
  }
) {}
