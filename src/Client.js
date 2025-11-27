/**
 * @since 1.0.0
 * @module Client
 *
 * HTTP client for Supermemory API with authentication,
 * error mapping, and telemetry middleware.
 */
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import { Context, Effect, Layer, Redacted, Schema } from "effect";
import { SupermemoryConfigService } from "./Config.js";
import {
  SupermemoryAuthenticationError,
  SupermemoryRateLimitError,
  SupermemoryServerError,
  SupermemoryValidationError,
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
};
// =============================================================================
// Error Mapping
// =============================================================================
/**
 * Extract retry-after value from response headers.
 */
const extractRetryAfter = (headers) => {
  const retryAfter = headers["retry-after"];
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
 * Map HTTP status codes to typed Supermemory errors.
 *
 * @since 1.0.0
 * @category Error Handling
 */
export const mapHttpError = (status, body, headers) => {
  const message =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof body.message === "string"
      ? body.message
      : `HTTP ${status}`;
  switch (status) {
    case 401:
    case 403:
      return new SupermemoryAuthenticationError({
        message,
        status: status,
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
/**
 * Context tag for SupermemoryHttpClient.
 *
 * @since 1.0.0
 * @category Context
 */
export class SupermemoryHttpClientService extends Context.Tag(
  "@effect-supermemory/HttpClient"
)() {}
// =============================================================================
// Client Implementation
// =============================================================================
/**
 * Create the base request with authentication and common headers.
 */
const makeBaseRequest = (method, url, apiKey, body) =>
  Effect.gen(function* () {
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
        Effect.mapError((error) => error)
      );
    }
    return request;
  });
/**
 * Process response with error mapping and schema validation.
 */
const processResponse = (response, schema) =>
  Effect.gen(function* () {
    const status = response.status;
    // Handle error responses
    if (status >= 400) {
      const body = yield* Effect.tryPromise({
        try: () => response.json.pipe(Effect.runPromise),
        catch: () => ({}),
      }).pipe(Effect.orElseSucceed(() => ({})));
      yield* Effect.fail(mapHttpError(status, body, response.headers));
    }
    // Parse successful response
    const json = yield* Effect.tryPromise({
      try: () => response.json.pipe(Effect.runPromise),
      catch: (error) =>
        new SupermemoryValidationError({
          message: "Failed to parse response JSON",
          details: error,
        }),
    });
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
      );
      return decoded;
    }
    return json;
  });
/**
 * Create the client implementation effect.
 */
const makeSupermemoryHttpClient = Effect.gen(function* () {
  const config = yield* SupermemoryConfigService;
  const httpClient = yield* HttpClient.HttpClient;
  const makeRequest = (version, method, path, options) =>
    Effect.gen(function* () {
      const url = `${config.baseUrl}${version}${path}`;
      const request = yield* makeBaseRequest(
        method,
        url,
        config.apiKey,
        options?.body
      ).pipe(
        Effect.mapError(
          (error) =>
            new SupermemoryValidationError({
              message: `Request creation failed: ${error._tag}`,
              details: error,
            })
        )
      );
      const response = yield* httpClient.execute(request).pipe(
        Effect.mapError(
          (error) =>
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
  };
});
/**
 * Live layer for SupermemoryHttpClient.
 * Requires SupermemoryConfigService and HttpClient.HttpClient.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryHttpClientLive = Layer.effect(
  SupermemoryHttpClientService,
  makeSupermemoryHttpClient
);
