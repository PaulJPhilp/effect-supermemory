/** biome-ignore-all assist/source/organizeImports: <> */
import { HTTP_HEADERS, HTTP_STATUS, HTTP_VALUES } from "@/Constants.js";
import {
  SupermemoryAuthenticationError,
  SupermemoryRateLimitError,
  SupermemoryServerError,
  SupermemoryValidationError,
  type SupermemoryError,
} from "@/Errors.js";
import type { HttpClientError } from "@effect/platform/HttpClientError";
import {
  bodyJson,
  make,
  setHeader,
  type HttpClientRequest,
} from "@effect/platform/HttpClientRequest";
import type { HttpClientResponse } from "@effect/platform/HttpClientResponse";
import type { HttpMethod } from "@services/httpClient/types.js";
import { Effect, Redacted, Schema } from "effect";

/**
 * Extract retry-after value from response headers.
 */
export const extractRetryAfter = (
  headers: HttpClientResponse["headers"]
): number | undefined => {
  const retryAfter = headers[HTTP_HEADERS.RETRY_AFTER];
  if (!retryAfter) {
    return;
  }

  const seconds = Number.parseInt(retryAfter, 10);
  if (!Number.isNaN(seconds)) {
    return seconds * 1000;
  }

  const date = Date.parse(retryAfter);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return;
};

/**
 * Type guard to check if an unknown value is an object with a string message property.
 *
 * @param value - The value to check
 * @returns True if value is an object with a string message property
 * @since 1.0.0
 * @category Type Guards
 */
function hasMessage(value: unknown): value is { message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    "message" in value &&
    typeof (value as { message: unknown }).message === "string"
  );
}

/**
 * Map HTTP status codes to typed Supermemory errors.
 *
 * @since 1.0.0
 * @category Error Handling
 */
export const mapHttpError = (
  status: number,
  body: unknown,
  headers: HttpClientResponse["headers"]
): SupermemoryError => {
  const message = hasMessage(body) ? body.message : `HTTP ${status}`;

  switch (status) {
    case HTTP_STATUS.UNAUTHORIZED:
    case HTTP_STATUS.FORBIDDEN:
      return new SupermemoryAuthenticationError({
        message,
        status: status as 401 | 403,
      });

    case HTTP_STATUS.TOO_MANY_REQUESTS:
      return new SupermemoryRateLimitError({
        message,
        retryAfterMs: extractRetryAfter(headers),
      });

    default:
      if (status >= HTTP_STATUS.SERVER_ERROR_MIN) {
        return new SupermemoryServerError({ message, status });
      }
      return new SupermemoryValidationError({ message, details: body });
  }
};

/**
 * Create the base request with authentication and common headers.
 */
export const makeBaseRequest = (
  method: HttpMethod,
  url: string,
  apiKey: Redacted.Redacted<string>,
  body?: unknown
): Effect.Effect<HttpClientRequest, HttpClientError> =>
  Effect.gen(function* () {
    let request = make(method)(url).pipe(
      setHeader(
        HTTP_HEADERS.AUTHORIZATION,
        `${HTTP_VALUES.BEARER_PREFIX}${Redacted.value(apiKey)}`
      ),
      setHeader(HTTP_HEADERS.CONTENT_TYPE, HTTP_VALUES.APPLICATION_JSON),
      setHeader(HTTP_HEADERS.ACCEPT, HTTP_VALUES.APPLICATION_JSON)
    );

    if (body !== undefined) {
      request = yield* bodyJson(request, body).pipe(
        Effect.mapError((error) => error as unknown as HttpClientError)
      );
    }

    return request;
  });

/**
 * Process response with error mapping and schema validation.
 */
export const processResponse = <A, I, R>(
  response: HttpClientResponse,
  schema?: Schema.Schema<A, I, R>
): Effect.Effect<A, SupermemoryError, R> =>
  Effect.gen(function* () {
    const status = response.status;

    // Handle error responses
    if (status >= HTTP_STATUS.BAD_REQUEST) {
      const body = yield* Effect.tryPromise({
        try: () => response.json.pipe(Effect.runPromise),
        catch: () => ({}),
      }).pipe(Effect.orElseSucceed(() => ({})));

      return yield* Effect.fail<SupermemoryError>(
        mapHttpError(status, body, response.headers) as SupermemoryError
      );
    }

    // Parse successful response
    const json = yield* Effect.tryPromise({
      try: () => response.json.pipe(Effect.runPromise),
      catch: (error) =>
        new SupermemoryValidationError({
          message: "Failed to parse response JSON",
          details: error,
        }),
    }) as Effect.Effect<unknown, SupermemoryError, never>;

    // Validate against schema if provided
    if (schema) {
      const decoded = yield* Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError(
          (error) =>
            new SupermemoryValidationError({
              message: "Response validation failed",
              details: error,
            })
        )
      ) as Effect.Effect<A, SupermemoryError, R>;
      return decoded;
    }

    return json as A;
  });
