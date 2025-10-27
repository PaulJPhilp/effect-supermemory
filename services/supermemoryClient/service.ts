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

    // Helper to process batch responses and generate MemoryBatchPartialFailure
      const processBatchResponse = (
        response: SupermemoryBatchResponse,
        originalKeys: ReadonlyArray<string>
      ): Effect.Effect<void, MemoryBatchPartialFailure> => {
        const failures: { key: string; error: MemoryError }[] = [];
        let successes = 0;

        const allBackendIds = new Set(response.results.map(item => item.id));
        const backendErrorMap = new Map<string, SupermemoryBatchResponseItem>();
        response.results.forEach(item => {
          if (item.status >= 400 || item.error) { // Item-specific failure
            backendErrorMap.set(item.id, item);
          } else {
            successes++;
          }
        });

        // Check for items that were requested but not in response (e.g., backend dropped them or never processed)
        originalKeys.forEach(key => {
            if (!allBackendIds.has(key)) {
                failures.push({ key, error: new MemoryValidationError({ message: `Item ${key} not processed by backend.`}) });
            }
        });

        // Translate specific backend item errors
        backendErrorMap.forEach((item, id) => {
          let error: MemoryError;
          if (item.status === 404) {
            error = new MemoryError.MemoryNotFoundError({ key: id });
          } else if (item.status === 401 || item.status === 403) {
            error = new MemoryValidationError({ message: `Authorization failed for item ${id}: ${item.error || 'Unknown'}` });
          } else if (item.status === 400) {
            error = new MemoryValidationError({ message: `Bad request for item ${id}: ${item.error || 'Unknown'}` });
          } else {
            error = new MemoryValidationError({ message: `Item ${id} failed with status ${item.status}: ${item.error || 'Unknown'}` });
          }
          failures.push({ key: id, error });
        });

        if (failures.length > 0) {
          return Effect.fail(new MemoryBatchPartialFailure({
            successes,
            correlationId: response.correlationId,
            failures: Chunk.fromIterable(failures),
          }));
        }
        return Effect.void;
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

        // New Batch Operations
        putMany: (items) =>
          makeRequestWithRetries<SupermemoryBatchResponse>(
            `/api/v1/memories/batch`,
            {
              method: "POST",
              body: items.map(item => ({
                id: item.key,
                value: Utils.toBase64(item.value),
                namespace: namespace,
              })),
            }
          ).pipe(
            Effect.flatMap((response) => processBatchResponse(response.body, items.map(i => i.key))),
          ),

        deleteMany: (keys) =>
          makeRequestWithRetries<SupermemoryBatchResponse>(
            `/api/v1/memories/batch`,
            {
              method: "DELETE",
              body: keys.map(key => ({ id: key, namespace: namespace })),
            }
          ).pipe(
            Effect.flatMap((response) => processBatchResponse(response.body, keys)),
          ),

        getMany: (keys) =>
          makeRequestWithRetries<SupermemoryBatchResponse>(
            `/api/v1/memories/batchGet`,
            {
              method: "POST", // Often GET with body isn't well supported, so POST is common for batchGet
              body: keys.map(key => ({ id: key, namespace: namespace })),
            }
          ).pipe(
            Effect.flatMap((response) => {
              const resultMap = new Map<string, string | undefined>();
              const originalKeysSet = new Set(keys); // Track keys we were asked for

              response.body.results.forEach(item => {
                if (item.status === 200 && item.value !== undefined) {
                  resultMap.set(item.id, Utils.fromBase64(item.value));
                  originalKeysSet.delete(item.id); // Mark as processed
                } else if (item.status === 404) {
                  resultMap.set(item.id, undefined); // Explicitly undefined for 404
                  originalKeysSet.delete(item.id); // Mark as processed
                }
              });

              // Process failures (includes items not found that are not 404 explicitly reported by backend)
              return processBatchResponse(response.body, keys).pipe(
                Effect.map(() => {
                  // For any keys asked for but not in response or not handled by explicit 404,
                  // assume they are undefined.
                  originalKeysSet.forEach(key => {
                    if (!resultMap.has(key)) {
                      resultMap.set(key, undefined);
                    }
                  });
                  return resultMap;
                })
              );
            }),
          ),
      } satisfies SupermemoryClient;
});

export class SupermemoryClientImpl extends Effect.Service<SupermemoryClientImpl>()(
  "SupermemoryClient",
  {
    effect: supermemoryClientEffect,
  }
) {}
