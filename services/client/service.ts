/** @effect-diagnostics classSelfMismatch:skip-file */
import * as HttpClient from "@effect/platform/HttpClient";
import type * as HttpClientError from "@effect/platform/HttpClientError";
import { SupermemoryConfigService } from "@services/config/service.js";
import { Effect, type Schema } from "effect";
import { SPANS, TELEMETRY_ATTRIBUTES } from "@/Constants.js";
import { type SupermemoryError, SupermemoryValidationError } from "@/Errors.js";
import { makeBaseRequest, processResponse } from "./helpers.js";
import { ApiVersions, type SupermemoryHttpClient } from "./types.js";

/**
 * Create the client implementation effect.
 */
export const makeSupermemoryHttpClient = Effect.gen(function* () {
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
      method: "GET" | "POST" | "PUT" | "DELETE",
      path: string,
      options?: {
        readonly body?: unknown;
        readonly schema?: Schema.Schema<A, I, R>;
      }
    ) => makeRequest<A, I, R>(ApiVersions.V3, method, path, options),
    requestV4: <A, I, R>(
      method: "GET" | "POST" | "PUT" | "DELETE",
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
 * @since 1.0.0
 * @category Services
 */
export class SupermemoryHttpClientService extends Effect.Service<SupermemoryHttpClient>()(
  "@effect-supermemory/HttpClient",
  {
    accessors: false,
    effect: makeSupermemoryHttpClient,
  }
) {}

/**
 * Live layer for SupermemoryHttpClient.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryHttpClientLive = SupermemoryHttpClientService.Default;
