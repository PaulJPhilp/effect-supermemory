import type { HttpBody } from "@effect/platform/HttpBody";
import { Duration, Effect, Schedule } from "effect";
import type { HttpClientError } from "../httpClient/errors.js";
import { HttpClientImpl } from "../httpClient/service.js";
import type { HttpPath, HttpRequestOptions } from "../httpClient/types.js";
import {
  MemoryBatchPartialFailure,
  type MemoryError,
  MemoryNotFoundError,
  MemoryValidationError,
} from "../memoryClient/errors.js";
import type { SupermemoryClient } from "./api.js";
import { translateHttpClientError } from "./errors.js";
import { fromBase64, toBase64 } from "./helpers.js";
import type {
  SupermemoryApiMemory,
  SupermemoryBatchResponse,
  SupermemoryBatchResponseItem,
  SupermemoryClientConfigType,
} from "./types.js";

// Helper function to determine if an HttpClientError should trigger a retry
const shouldRetryHttpClientError = (error: HttpClientError): boolean => {
  if (error._tag === "NetworkError") {
    return true;
  }
  if (
    error._tag === "HttpError" &&
    error.status >= 500 &&
    error.status <= 599
  ) {
    return true;
  }
  if (error._tag === "TooManyRequestsError") {
    return true;
  }
  return false;
};

export class SupermemoryClientImpl extends Effect.Service<SupermemoryClientImpl>()(
  "SupermemoryClient",
  {
    effect: Effect.fn(function* (config: SupermemoryClientConfigType) {
      const { namespace, apiKey, retries } = config;
      const httpClient = yield* HttpClientImpl;

      // Create a Schedule if retries are configured
      const retrySchedule:
        | Schedule.Schedule<unknown, HttpClientError>
        | undefined = retries
        ? Schedule.addDelay(Schedule.recurs(retries.attempts - 1), () =>
            Duration.millis(retries.delayMs)
          )
        : undefined;

      // Helper for common request logic with retry policy
      const makeRequestWithRetries = <T = unknown>(
        path: HttpPath,
        options: Omit<HttpRequestOptions, "headers">,
        keyFor404Translation?: string
      ): Effect.Effect<{ body: T }, MemoryError> => {
        const requestOptions: HttpRequestOptions = {
          ...options,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "X-Supermemory-Namespace": namespace,
          },
        };

        const baseRequest = httpClient.request<T>(path, requestOptions);

        // Apply retry logic if retrySchedule is defined
        if (retrySchedule) {
          return baseRequest.pipe(
            Effect.retry(retrySchedule), // Apply the schedule
            Effect.catchIf(
              shouldRetryHttpClientError,
              (error: HttpClientError) => {
                // If retries are exhausted and it's a retryable error, re-fail with translated error
                if (
                  error._tag === "NetworkError" ||
                  error._tag === "HttpError" ||
                  error._tag === "TooManyRequestsError"
                ) {
                  return Effect.fail(
                    translateHttpClientError(error, keyFor404Translation)
                  );
                }
                return Effect.fail(error as unknown as MemoryError);
              }
            ),
            Effect.mapError((error: HttpClientError | MemoryError) => {
              // Handle non-retryable errors or final translated errors
              if (
                error._tag === "NetworkError" ||
                error._tag === "HttpError" ||
                error._tag === "TooManyRequestsError"
              ) {
                return translateHttpClientError(
                  error as HttpClientError,
                  keyFor404Translation
                );
              }
              return error as MemoryError;
            })
          );
        }
        // No retries configured, proceed with base request and direct error translation
        return baseRequest.pipe(
          Effect.mapError((error: HttpClientError) =>
            translateHttpClientError(error, keyFor404Translation)
          )
        );
      };

      // Helper to process batch responses and generate MemoryBatchPartialFailure
      const processBatchResponse = (
        response: SupermemoryBatchResponse,
        originalKeys: readonly string[]
      ): Effect.Effect<void, MemoryBatchPartialFailure> => {
        const buildBackendErrorMap = (
          items: readonly SupermemoryBatchResponseItem[]
        ): {
          errorMap: Map<string, SupermemoryBatchResponseItem>;
          successes: number;
        } => {
          const errorMap = new Map<string, SupermemoryBatchResponseItem>();
          let successes = 0;

          for (const item of items) {
            if (item.status >= 400 || item.error) {
              errorMap.set(item.id, item);
            } else {
              successes += 1;
            }
          }

          return { errorMap, successes };
        };

        const findMissingKeys = (
          allBackendIds: Set<string>,
          keys: readonly string[]
        ): Array<{ key: string; error: MemoryError }> => {
          const missing: Array<{ key: string; error: MemoryError }> = [];

          for (const key of keys) {
            if (!allBackendIds.has(key)) {
              missing.push({
                key,
                error: new MemoryValidationError({
                  message: `Item ${key} not processed by backend.`,
                }),
              });
            }
          }

          return missing;
        };

        const processErrorItems = (
          errorMap: Map<string, SupermemoryBatchResponseItem>
        ): Array<{ key: string; error: MemoryError }> => {
          const errors: Array<{ key: string; error: MemoryError }> = [];

          for (const [id, item] of errorMap) {
            const error = translateBatchItemError(id, item);
            errors.push({ key: id, error });
          }

          return errors;
        };

        const validateBatchResponse = (
          items: readonly SupermemoryBatchResponseItem[],
          keys: readonly string[]
        ): {
          failures: Array<{ key: string; error: MemoryError }>;
          successes: number;
        } => {
          const allBackendIds = new Set(items.map((item) => item.id));
          const backendData = buildBackendErrorMap(items);
          const missingKeys = findMissingKeys(allBackendIds, keys);
          const errorItems = processErrorItems(backendData.errorMap);

          return {
            failures: [...missingKeys, ...errorItems],
            successes: backendData.successes,
          };
        };

        const translateBatchItemError = (
          id: string,
          item: SupermemoryBatchResponseItem
        ): MemoryError => {
          if (item.status === 404) {
            return new MemoryNotFoundError({ key: id });
          }
          if (item.status === 401 || item.status === 403) {
            return new MemoryValidationError({
              message: `Authorization failed for item ${id}: ${
                item.error || "Unknown"
              }`,
            });
          }
          if (item.status === 400) {
            return new MemoryValidationError({
              message: `Bad request for item ${id}: ${item.error || "Unknown"}`,
            });
          }
          return new MemoryValidationError({
            message: `Item ${id} failed with status ${item.status}: ${
              item.error || "Unknown"
            }`,
          });
        };

        const { failures, successes: successCount } = validateBatchResponse(
          response.results,
          originalKeys
        );

        if (failures.length > 0) {
          const batchFailureData: {
            successes: number;
            correlationId?: string;
            failures: { key: string; error: MemoryError }[];
          } = {
            successes: successCount,
            failures,
          };

          if (response.correlationId) {
            batchFailureData.correlationId = response.correlationId;
          }

          return Effect.fail(new MemoryBatchPartialFailure(batchFailureData));
        }
        return Effect.void;
      };

      return {
        put: (key, value) =>
          makeRequestWithRetries<SupermemoryApiMemory>("/api/v1/memories", {
            method: "POST",
            body: {
              id: key,
              value: toBase64(value),
              namespace,
            } as unknown as HttpBody,
          }).pipe(Effect.asVoid) as Effect.Effect<void, MemoryError>,

        get: (key) =>
          makeRequestWithRetries<SupermemoryApiMemory>(
            `/api/v1/memories/${key}`,
            { method: "GET" },
            key
          ).pipe(
            Effect.map((response) => fromBase64(response.body.value)),
            Effect.catchIf(
              (error) => error instanceof MemoryNotFoundError,
              () => Effect.succeed(undefined)
            )
          ) as Effect.Effect<string | undefined, MemoryError>,

        delete: (key) =>
          makeRequestWithRetries<void>(`/api/v1/memories/${key}`, {
            method: "DELETE",
          }).pipe(
            Effect.map(() => true),
            Effect.catchIf(
              (error) => error instanceof MemoryNotFoundError,
              () => Effect.succeed(true)
            )
          ) as Effect.Effect<boolean, MemoryError>,

        exists: (key) =>
          makeRequestWithRetries<SupermemoryApiMemory>(
            `/api/v1/memories/${key}`,
            { method: "GET" },
            key
          ).pipe(
            Effect.map(() => true),
            Effect.catchIf(
              (error) => error instanceof MemoryNotFoundError,
              () => Effect.succeed(false)
            )
          ) as Effect.Effect<boolean, MemoryError>,

        clear: () =>
          makeRequestWithRetries<void>("/api/v1/memories", {
            method: "DELETE",
            queryParams: { namespace },
          }).pipe(Effect.asVoid) as Effect.Effect<void, MemoryError>,

        // New Batch Operations
        putMany: (items) =>
          makeRequestWithRetries<SupermemoryBatchResponse>(
            "/api/v1/memories/batch",
            {
              method: "POST",
              body: {
                items: items.map((item) => ({
                  id: item.key,
                  value: toBase64(item.value),
                  namespace,
                })),
              } as unknown as HttpBody,
            }
          ).pipe(
            Effect.flatMap((response) =>
              processBatchResponse(
                response.body,
                items.map((i) => i.key)
              )
            )
          ) as Effect.Effect<void, MemoryError | MemoryBatchPartialFailure>,

        deleteMany: (keys) =>
          makeRequestWithRetries<SupermemoryBatchResponse>(
            "/api/v1/memories/batch",
            {
              method: "DELETE",
              body: {
                keys,
                namespace,
              } as unknown as HttpBody,
            }
          ).pipe(
            Effect.flatMap((response) =>
              processBatchResponse(response.body, keys)
            )
          ) as Effect.Effect<void, MemoryError | MemoryBatchPartialFailure>,

        getMany: (keys) =>
          makeRequestWithRetries<SupermemoryBatchResponse>(
            "/api/v1/memories/batchGet",
            {
              method: "POST", // Often GET with body isn't well supported, so POST is common for batchGet
              body: {
                keys,
                namespace,
              } as unknown as HttpBody,
            }
          ).pipe(
            Effect.flatMap((response) => {
              const resultMap = new Map<string, string | undefined>();
              const originalKeysSet = new Set(keys); // Track keys we were asked for

              for (const item of response.body.results) {
                if (item.status === 200 && item.value !== undefined) {
                  resultMap.set(item.id, fromBase64(item.value));
                  originalKeysSet.delete(item.id); // Mark as processed
                } else if (item.status === 404) {
                  resultMap.set(item.id, undefined); // Explicitly undefined for 404
                  originalKeysSet.delete(item.id); // Mark as processed
                }
              }

              // Process failures (includes items not found that are not 404 explicitly reported by backend)
              return processBatchResponse(response.body, keys).pipe(
                Effect.map(() => {
                  // For any keys asked for but not in response or not handled by explicit 404,
                  // assume they are undefined.
                  for (const key of originalKeysSet) {
                    if (!resultMap.has(key)) {
                      resultMap.set(key, undefined);
                    }
                  }
                  return resultMap;
                })
              );
            })
          ) as Effect.Effect<
            ReadonlyMap<string, string | undefined>,
            MemoryError | MemoryBatchPartialFailure
          >,
      } satisfies SupermemoryClient;
    }),
  }
) {}
