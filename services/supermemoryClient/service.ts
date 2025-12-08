/** biome-ignore-all assist/source/organizeImports: < > */
import {
  API_ENDPOINTS,
  API_FIELD_NAMES,
  ERROR_MESSAGES,
  HTTP_HEADERS,
  HTTP_METHODS,
  HTTP_STATUS,
} from "@/Constants.js";
import type { HttpBody } from "@effect/platform/HttpBody";
import type { HttpClientError } from "@services/httpClient/errors.js";
import {
  isNetworkError,
  isRetryableErrorType,
  isTooManyRequestsError,
} from "@services/httpClient/helpers.js";
import { HttpClient } from "@services/httpClient/service.js";
import type {
  HttpPath,
  HttpRequestOptions,
} from "@services/httpClient/types.js";
import {
  MemoryBatchPartialFailure,
  type MemoryError,
  MemoryNotFoundError,
  MemoryValidationError,
} from "@services/inMemoryClient/errors.js";
import type {
  MemoryKey,
  MemoryValueMap,
} from "@services/inMemoryClient/types.js";
import { Effect } from "effect";
import type { SupermemoryClientApi } from "./api.js";
import {
  createRetrySchedule,
  fromBase64,
  isServerError,
  toBase64,
  translateHttpClientError,
} from "./helpers.js";
import type {
  SupermemoryApiMemory,
  SupermemoryBatchResponse,
  SupermemoryBatchResponseItem,
  SupermemoryClientConfigType,
} from "./types.js";

// Helper function to determine if an HttpClientError should trigger a retry
const shouldRetryHttpClientError = (error: HttpClientError): boolean => {
  if (isNetworkError(error)) {
    return true;
  }
  if (isServerError(error)) {
    return true;
  }
  if (isTooManyRequestsError(error)) {
    return true;
  }
  return false;
};

export class SupermemoryClient extends Effect.Service<SupermemoryClient>()(
  "SupermemoryClient",
  {
    effect: Effect.fn(function* (config: SupermemoryClientConfigType) {
      const { namespace, apiKey, retries } = config;
      const httpClient = yield* HttpClient;

      // Create a Schedule if retries are configured
      const retrySchedule = createRetrySchedule(retries);

      // Helper for common request logic with retry policy
      const makeRequestWithRetries = <T = unknown>(
        path: HttpPath,
        options: Omit<HttpRequestOptions, "headers">,
        keyFor404Translation?: string
      ): Effect.Effect<{ body: T }, MemoryError> => {
        const requestOptions: HttpRequestOptions = {
          ...options,
          headers: {
            [HTTP_HEADERS.AUTHORIZATION]: `Bearer ${apiKey}`,
            [HTTP_HEADERS.SUPERMEMORY_NAMESPACE]: namespace,
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
                if (isRetryableErrorType(error)) {
                  return Effect.fail(
                    translateHttpClientError(error, keyFor404Translation)
                  );
                }
                return Effect.fail(error as unknown as MemoryError);
              }
            ),
            Effect.mapError((error: HttpClientError | MemoryError) => {
              // Handle non-retryable errors or final translated errors
              // Check if it's an HttpClientError and retryable
              if (isRetryableErrorType(error)) {
                // TypeScript knows error is HttpError | NetworkError | TooManyRequestsError
                // All of these are HttpClientError, so safe to cast
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
        response: SupermemoryBatchResponse | null,
        originalKeys: readonly string[]
      ): Effect.Effect<void, MemoryBatchPartialFailure> => {
        // Handle null response (e.g., from empty arrays or parsing failures)
        if (!response?.results) {
          // If no keys were requested, this is a success
          if (originalKeys.length === 0) {
            return Effect.void;
          }
          // Otherwise, treat as failure
          return Effect.fail(
            new MemoryBatchPartialFailure({
              successes: 0,
              failures: originalKeys.map((key) => ({
                key,
                error: new MemoryValidationError({
                  message:
                    ERROR_MESSAGES.BATCH_OPERATION_FAILED_INVALID_RESPONSE,
                }),
              })),
            })
          );
        }
        const buildBackendErrorMap = (
          items: readonly SupermemoryBatchResponseItem[]
        ): {
          errorMap: Map<string, SupermemoryBatchResponseItem>;
          successes: number;
        } => {
          const errorMap = new Map<string, SupermemoryBatchResponseItem>();
          let successes = 0;

          for (const item of items) {
            if (
              item[API_FIELD_NAMES.STATUS] >= HTTP_STATUS.BAD_REQUEST ||
              item[API_FIELD_NAMES.ERROR]
            ) {
              errorMap.set(item[API_FIELD_NAMES.ID], item);
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
                  message: `${ERROR_MESSAGES.ITEM_NOT_PROCESSED_BY_BACKEND} ${key}`,
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
          const allBackendIds = new Set(
            items.map((item) => item[API_FIELD_NAMES.ID])
          );
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
          if (item[API_FIELD_NAMES.STATUS] === HTTP_STATUS.NOT_FOUND) {
            return new MemoryNotFoundError({ key: id });
          }
          if (
            item[API_FIELD_NAMES.STATUS] === HTTP_STATUS.UNAUTHORIZED ||
            item[API_FIELD_NAMES.STATUS] === HTTP_STATUS.FORBIDDEN
          ) {
            return new MemoryValidationError({
              message: `${
                ERROR_MESSAGES.AUTHORIZATION_FAILED
              } for item ${id}: ${
                item[API_FIELD_NAMES.ERROR] || ERROR_MESSAGES.UNKNOWN
              }`,
            });
          }
          if (item[API_FIELD_NAMES.STATUS] === HTTP_STATUS.BAD_REQUEST) {
            return new MemoryValidationError({
              message: `${ERROR_MESSAGES.BAD_REQUEST_FOR_ITEM} ${id}: ${
                item[API_FIELD_NAMES.ERROR] || ERROR_MESSAGES.UNKNOWN
              }`,
            });
          }
          return new MemoryValidationError({
            message: `${ERROR_MESSAGES.ITEM_FAILED_WITH_STATUS} ${id}: ${
              item[API_FIELD_NAMES.STATUS]
            }: ${item[API_FIELD_NAMES.ERROR] || ERROR_MESSAGES.UNKNOWN}`,
          });
        };

        const { failures, successes: successCount } = validateBatchResponse(
          response[API_FIELD_NAMES.RESULTS],
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

          const correlationId = response[API_FIELD_NAMES.CORRELATION_ID];
          if (correlationId !== undefined) {
            batchFailureData.correlationId = correlationId;
          }

          return Effect.fail(new MemoryBatchPartialFailure(batchFailureData));
        }
        return Effect.void;
      };

      return {
        put: (key, value) =>
          makeRequestWithRetries<SupermemoryApiMemory>(
            API_ENDPOINTS.V1.MEMORIES,
            {
              method: HTTP_METHODS.POST,
              body: {
                [API_FIELD_NAMES.ID]: key,
                [API_FIELD_NAMES.VALUE]: toBase64(value),
                [API_FIELD_NAMES.NAMESPACE]: namespace,
              } as unknown as HttpBody,
            }
          ).pipe(Effect.asVoid) as Effect.Effect<void, MemoryError>,

        get: (key) =>
          makeRequestWithRetries<SupermemoryApiMemory>(
            `${API_ENDPOINTS.V1.MEMORIES}/${key}`,
            { method: HTTP_METHODS.GET },
            key
          ).pipe(
            Effect.map((response) =>
              fromBase64(response.body[API_FIELD_NAMES.VALUE])
            ),
            Effect.catchIf(
              (error) => error instanceof MemoryNotFoundError,
              () => Effect.succeed(undefined)
            )
          ) as Effect.Effect<string | undefined, MemoryError>,

        delete: (key) =>
          makeRequestWithRetries<void>(`${API_ENDPOINTS.V1.MEMORIES}/${key}`, {
            method: HTTP_METHODS.DELETE,
          }).pipe(
            Effect.map(() => true),
            Effect.catchIf(
              (error) => error instanceof MemoryNotFoundError,
              () => Effect.succeed(true)
            )
          ) as Effect.Effect<boolean, MemoryError>,

        exists: (key) =>
          makeRequestWithRetries<SupermemoryApiMemory>(
            `${API_ENDPOINTS.V1.MEMORIES}/${key}`,
            { method: HTTP_METHODS.GET },
            key
          ).pipe(
            Effect.map(() => true),
            Effect.catchIf(
              (error) => error instanceof MemoryNotFoundError,
              () => Effect.succeed(false)
            )
          ) as Effect.Effect<boolean, MemoryError>,

        clear: () =>
          makeRequestWithRetries<void>(API_ENDPOINTS.V1.MEMORIES, {
            method: "DELETE",
            queryParams: { namespace },
          }).pipe(Effect.asVoid) as Effect.Effect<void, MemoryError>,

        // New Batch Operations
        putMany: (items) =>
          makeRequestWithRetries<SupermemoryBatchResponse>(
            API_ENDPOINTS.V1.MEMORIES_BATCH,
            {
              method: HTTP_METHODS.POST,
              body: {
                [API_FIELD_NAMES.ITEMS]: items.map((item) => ({
                  [API_FIELD_NAMES.ID]: item.key,
                  [API_FIELD_NAMES.VALUE]: toBase64(item.value),
                  [API_FIELD_NAMES.NAMESPACE]: namespace,
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
            API_ENDPOINTS.V1.MEMORIES_BATCH,
            {
              method: HTTP_METHODS.DELETE,
              body: {
                [API_FIELD_NAMES.KEYS]: keys,
                [API_FIELD_NAMES.NAMESPACE]: namespace,
              } as unknown as HttpBody,
            }
          ).pipe(
            Effect.flatMap((response) =>
              processBatchResponse(response.body, keys)
            )
          ) as Effect.Effect<void, MemoryError | MemoryBatchPartialFailure>,

        getMany: (keys) =>
          makeRequestWithRetries<SupermemoryBatchResponse>(
            API_ENDPOINTS.V1.MEMORIES_BATCH_GET,
            {
              method: HTTP_METHODS.POST, // Often GET with body isn't well supported, so POST is common for batchGet
              body: {
                [API_FIELD_NAMES.KEYS]: keys,
                [API_FIELD_NAMES.NAMESPACE]: namespace,
              } as unknown as HttpBody,
            }
          ).pipe(
            Effect.flatMap((response) => {
              const resultMap = new Map<string, string | undefined>();
              const originalKeysSet = new Set(keys); // Track keys we were asked for

              for (const item of response.body[API_FIELD_NAMES.RESULTS]) {
                const itemKey = item[API_FIELD_NAMES.ID] as MemoryKey;
                switch (item[API_FIELD_NAMES.STATUS]) {
                  case HTTP_STATUS.OK: {
                    const value = item[API_FIELD_NAMES.VALUE];
                    if (value !== undefined) {
                      resultMap.set(
                        item[API_FIELD_NAMES.ID],
                        fromBase64(value)
                      );
                      originalKeysSet.delete(itemKey); // Mark as processed
                    }
                    break;
                  }
                  case HTTP_STATUS.NOT_FOUND:
                    resultMap.set(item[API_FIELD_NAMES.ID], undefined); // Explicitly undefined for 404
                    originalKeysSet.delete(itemKey); // Mark as processed
                    break;
                  default:
                    // Other status codes will be handled by processBatchResponse
                    break;
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
                  return resultMap as MemoryValueMap;
                })
              );
            })
          ) as Effect.Effect<
            MemoryValueMap,
            MemoryError | MemoryBatchPartialFailure
          >,
      } satisfies SupermemoryClientApi;
    }),
  }
) {}
