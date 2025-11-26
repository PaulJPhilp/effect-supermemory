/**
 * @since 1.0.0
 * @module Client
 *
 * HTTP client for Supermemory API with authentication,
 * error mapping, and telemetry middleware.
 */
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientError from "@effect/platform/HttpClientError";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import { Schema } from "effect";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { SupermemoryConfigService } from "./Config.js";
import {
  SupermemoryAuthenticationError,
  SupermemoryRateLimitError,
  SupermemoryServerError,
  SupermemoryValidationError,
  type SupermemoryError,
} from "./Errors.js";

// =============================================================================
// API Version Constants
// =============================================================================

/**
 * API version paths for different endpoints.
 */
export const ApiVersions = {
  V3: "/v3",
  V4: "/v4",
} as const;

// =============================================================================
// Error Mapping
// =============================================================================

/**
 * Extract retry-after value from response headers.
 */
const extractRetryAfter = (
  headers: HttpClientResponse.HttpClientResponse["headers"]
): number | undefined => {
  const retryAfter = headers["retry-after"];
  if (!retryAfter) return undefined;

  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) return seconds * 1000;

  const date = Date.parse(retryAfter);
  if (!isNaN(date)) return Math.max(0, date - Date.now());

  return undefined;
};

/**
 * Map HTTP status codes to typed Supermemory errors.
 *
 * @since 1.0.0
 * @category Error Handling
 */
export const mapHttpError = (
  status: number,
  body: unknown,
  headers: HttpClientResponse.HttpClientResponse["headers"]
): SupermemoryError => {
  const message =
    typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
      ? (body as { message: string }).message
      : `HTTP ${status}`;

  switch (status) {
    case 401:
    case 403:
      return new SupermemoryAuthenticationError({
        message,
        status: status as 401 | 403,
      });

    case 429:
      return new SupermemoryRateLimitError({
        message,
        retryAfterMs: extractRetryAfter(headers),
      });

    default:
      if (status >= 500) {
        return new SupermemoryServerError({ message, status });
      }
      return new SupermemoryValidationError({ message, details: body });
  }
};

// =============================================================================
// Client Service Definition
// =============================================================================

/**
 * Supermemory HTTP client interface.
 *
 * @since 1.0.0
 * @category Services
 */
export interface SupermemoryHttpClient {
  /**
   * Make a request to a v3 endpoint (documents, RAG search).
   */
  readonly requestV3: <A, I, R>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: {
      readonly body?: unknown;
      readonly schema?: Schema.Schema<A, I, R>;
    }
  ) => Effect.Effect<A, SupermemoryError, R>;

  /**
   * Make a request to a v4 endpoint (memory search).
   */
  readonly requestV4: <A, I, R>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: {
      readonly body?: unknown;
      readonly schema?: Schema.Schema<A, I, R>;
    }
  ) => Effect.Effect<A, SupermemoryError, R>;
}

/**
 * Context tag for SupermemoryHttpClient.
 *
 * @since 1.0.0
 * @category Context
 */
export class SupermemoryHttpClientService extends Context.Tag(
  "@effect-supermemory/HttpClient"
)<SupermemoryHttpClientService, SupermemoryHttpClient>() { }

// =============================================================================
// Client Implementation
// =============================================================================

/**
 * Create the base request with authentication and common headers.
 */
const makeBaseRequest = (
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  apiKey: Redacted.Redacted<string>,
  body?: unknown
): Effect.Effect<
  HttpClientRequest.HttpClientRequest,
  HttpClientError.HttpClientError
> => {
  return Effect.gen(function* () {
    let request = HttpClientRequest.make(method)(url).pipe(
      HttpClientRequest.setHeader(
        "Authorization",
        `Bearer ${Redacted.value(apiKey)}`
      ),
      HttpClientRequest.setHeader("Content-Type", "application/json"),
      HttpClientRequest.setHeader("Accept", "application/json")
    );

    if (body !== undefined) {
      request = yield* HttpClientRequest.bodyJson(request, body).pipe(
        Effect.mapError(
          (error) => error as unknown as HttpClientError.HttpClientError
        )
      );
    }

    return request;
  });
};

/**
 * Process response with error mapping and schema validation.
 */
const processResponse = <A, I, R>(
  response: HttpClientResponse.HttpClientResponse,
  schema?: Schema.Schema<A, I, R>
): Effect.Effect<A, SupermemoryError, R> =>
  Effect.gen(function* () {
    const status = response.status;

    // Handle error responses
    if (status >= 400) {
      const body = yield* Effect.tryPromise({
        try: () => response.json.pipe(Effect.runPromise),
        catch: () => ({}),
      }).pipe(Effect.orElseSucceed(() => ({})));

      yield* Effect.fail<SupermemoryError>(
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

/**
 * Create the client implementation effect.
 */
const makeSupermemoryHttpClient = Effect.gen(function* () {
  const config = yield* SupermemoryConfigService;
  const httpClient = yield* HttpClient.HttpClient;

  const makeRequest = <A, I, R>(
    version: string,
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: {
      readonly body?: unknown;
      readonly schema?: Schema.Schema<A, I, R>;
    }
  ): Effect.Effect<A, SupermemoryError, R> =>
    Effect.gen(function* () {
      const url = `${config.baseUrl}${version}${path}`;
      const request = yield* makeBaseRequest(
        method,
        url,
        config.apiKey,
        options?.body
      ).pipe(
        Effect.mapError(
          (error: HttpClientError.HttpClientError) =>
            new SupermemoryValidationError({
              message: `Request creation failed: ${error._tag}`,
              details: error,
            })
        )
      );

      const response = yield* httpClient.execute(request).pipe(
        Effect.mapError(
          (error: HttpClientError.HttpClientError) =>
            new SupermemoryValidationError({
              message: `HTTP request failed: ${error._tag}`,
              details: error,
            })
        ),
        Effect.scoped
      );

      return yield* processResponse(response, options?.schema);
    }).pipe(
      Effect.withSpan(`supermemory.${method.toLowerCase()}`, {
        attributes: {
          "supermemory.version": version,
          "supermemory.path": path,
          "supermemory.method": method,
        },
      })
    );

  return {
    requestV3: (method, path, options) =>
      makeRequest(ApiVersions.V3, method, path, options),
    requestV4: (method, path, options) =>
      makeRequest(ApiVersions.V4, method, path, options),
  } satisfies SupermemoryHttpClient;
});

/**
 * Live layer for SupermemoryHttpClient.
 * Requires SupermemoryConfigService and HttpClient.HttpClient.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryHttpClientLive: Layer.Layer<
  SupermemoryHttpClientService,
  never,
  SupermemoryConfigService | HttpClient.HttpClient
> = Layer.effect(SupermemoryHttpClientService, makeSupermemoryHttpClient);
