/**
 * Supermemory HTTP Client Service API
 *
 * @since 1.0.0
 * @module Client
 */
/** biome-ignore-all assist/source/organizeImports: <> */

import type { SupermemoryError } from "@/Errors.js";
import type { HttpBody } from "@effect/platform/HttpBody";
import type { HttpMethod } from "@services/httpClient/types.js";
import type { Effect, Schema } from "effect";

/**
 * Supermemory HTTP client interface.
 *
 * Provides methods for making HTTP requests to the Supermemory API
 * with proper error handling, telemetry, and schema validation.
 *
 * @since 1.0.0
 * @category Services
 */
// biome-ignore lint/style/useShorthandFunctionType: Interface preferred for object contracts per TS_RULES.md
export type SupermemoryHttpClient = {
  /**
   * Make a request to an API endpoint (no version prefix added).
   * Use this for V1 endpoints where the path already includes the version.
   *
   * @param method - HTTP method (GET, POST, PATCH, PUT, DELETE)
   * @param path - Full API endpoint path (e.g., "/v1/memories")
   * @param options - Request options including body and schema
   * @returns Effect that resolves with the response data
   *
   * @example
   * ```typescript
   * const response = yield* SupermemoryHttpClientService.request(
   *   "POST",
   *   "/v1/memories",
   *   {
   *     body: { content: "Hello world" },
   *     schema: MemorySchema
   *   }
   * )
   * ```
   *
   * @since 1.0.0
   */
  readonly request: <A, I, R>(
    method: HttpMethod,
    path: string,
    options?: {
      readonly body?: HttpBody | unknown;
      readonly schema?: Schema.Schema<A, I, R>;
    }
  ) => Effect.Effect<A, SupermemoryError, R>;

  /**
   * Make a request to a v3 endpoint (documents, RAG search).
   *
   * @deprecated Use `request` with full path instead
   * @param method - HTTP method (GET, POST, PUT, DELETE)
   * @param path - API endpoint path
   * @param options - Request options including body and schema
   * @returns Effect that resolves with the response data
   *
   * @since 1.0.0
   */
  readonly requestV3: <A, I, R>(
    method: HttpMethod,
    path: string,
    options?: {
      readonly body?: HttpBody | unknown;
      readonly schema?: Schema.Schema<A, I, R>;
    }
  ) => Effect.Effect<A, SupermemoryError, R>;

  /**
   * Make a request to a v4 endpoint (memory search).
   *
   * @deprecated Use `request` with full path instead
   * @param method - HTTP method (GET, POST, PUT, DELETE)
   * @param path - API endpoint path
   * @param options - Request options including body and schema
   * @returns Effect that resolves with the response data
   *
   * @since 1.0.0
   */
  readonly requestV4: <A, I, R>(
    method: HttpMethod,
    path: string,
    options?: {
      readonly body?: HttpBody | unknown;
      readonly schema?: Schema.Schema<A, I, R>;
    }
  ) => Effect.Effect<A, SupermemoryError, R>;
};
