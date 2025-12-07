/**
 * Supermemory HTTP Client Service Implementation
 *
 * Provides a configurable HTTP client for making requests to the Supermemory API
 * with proper error handling, telemetry, and schema validation.
 *
 * @since 1.0.0
 * @module Client
 */
/** biome-ignore-all assist/source/organizeImports: <> */

import { SPANS, TELEMETRY_ATTRIBUTES } from "@/Constants.js";
import { type SupermemoryError, SupermemoryValidationError } from "@/Errors.js";
import type { HttpBody } from "@effect/platform/HttpBody";
import { HttpClient } from "@effect/platform/HttpClient";
import type * as HttpClientError from "@effect/platform/HttpClientError";
import { SupermemoryConfigService } from "@services/config/service.js";
import type { HttpMethod } from "@services/httpClient/types.js";
import { Effect, type Schema } from "effect";
import type { SupermemoryHttpClient } from "./api.js";
import { makeBaseRequest, processResponse } from "./helpers.js";
import { ApiVersions } from "./types.js";

/**
 * Creates the Supermemory HTTP client implementation.
 *
 * This function builds a client that can make HTTP requests to both v3 and v4
 * API endpoints with proper error handling, telemetry, and schema validation.
 *
 * @returns Effect that resolves with a configured SupermemoryHttpClient
 *
 * @example
 * ```typescript
 * const client = yield* makeSupermemoryHttpClient
 * const result = yield* client.requestV3("GET", "/documents", {
 *   schema: DocumentSchema
 * })
 * ```
 *
 * @since 1.0.0
 * @category Factory
 */
export const makeSupermemoryHttpClient = Effect.gen(function* () {
  const config = yield* SupermemoryConfigService;
  const httpClient = yield* HttpClient;

  const makeRequest = <A, I, R>(
    version: string,
    method: HttpMethod,
    path: string,
    options?: {
      readonly body?: HttpBody | unknown;
      readonly schema?: Schema.Schema<A, I, R>;
    }
  ) =>
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
      Effect.withSpan(SPANS.HTTP_METHOD(method), {
        attributes: {
          [TELEMETRY_ATTRIBUTES.VERSION]: version,
          [TELEMETRY_ATTRIBUTES.PATH]: path,
          [TELEMETRY_ATTRIBUTES.METHOD]: method,
        },
      })
    ) as Effect.Effect<A, SupermemoryError, R>;

  return {
    requestV3: <A, I, R>(
      method: HttpMethod,
      path: string,
      options?: {
        readonly body?: unknown;
        readonly schema?: Schema.Schema<A, I, R>;
      }
    ) => makeRequest<A, I, R>(ApiVersions.V3, method, path, options),
    requestV4: <A, I, R>(
      method: HttpMethod,
      path: string,
      options?: {
        readonly body?: unknown;
        readonly schema?: Schema.Schema<A, I, R>;
      }
    ) => makeRequest<A, I, R>(ApiVersions.V4, method, path, options),
  } satisfies SupermemoryHttpClient;
});

/**
 * Context tag and Service for SupermemoryHttpClient.
 *
 * Provides the Effect.Service implementation for dependency injection
 * and composition with other Effect services.
 *
 * @since 1.0.0
 * @category Services
 */
export class SupermemoryHttpClientService extends Effect.Service<SupermemoryHttpClientService>()(
  "@effect-supermemory/HttpClient",
  {
    accessors: false,
    effect: makeSupermemoryHttpClient,
  }
) {}
