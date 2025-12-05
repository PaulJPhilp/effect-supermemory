/**
 * Supermemory HTTP Client Service API
 *
 * @since 1.0.0
 * @module Client
 */

import type { Effect, Schema } from "effect";
import type { SupermemoryError } from "@/Errors.js";

/**
 * API version paths for different endpoints.
 *
 * @since 1.0.0
 * @category Constants
 */
export const ApiVersions = {
  V3: "/v3",
  V4: "/v4",
} as const;

/**
 * Supermemory HTTP client interface.
 *
 * Provides methods for making HTTP requests to the Supermemory API
 * with proper error handling, telemetry, and schema validation.
 *
 * @since 1.0.0
 * @category Services
 */
export type SupermemoryHttpClient = {
  /**
   * Make a request to a v3 endpoint (documents, RAG search).
   *
   * @param method - HTTP method (GET, POST, PUT, DELETE)
   * @param path - API endpoint path
   * @param options - Request options including body and schema
   * @returns Effect that resolves with the response data
   *
   * @example
   * ```typescript
   * const response = yield* SupermemoryHttpClientService.requestV3(
   *   "POST",
   *   "/documents",
   *   {
   *     body: { content: "Hello world" },
   *     schema: DocumentSchema
   *   }
   * )
   * ```
   *
   * @since 1.0.0
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
   *
   * @param method - HTTP method (GET, POST, PUT, DELETE)
   * @param path - API endpoint path
   * @param options - Request options including body and schema
   * @returns Effect that resolves with the response data
   *
   * @example
   * ```typescript
   * const memories = yield* SupermemoryHttpClientService.requestV4(
   *   "GET",
   *   "/memories/search",
   *   {
   *     body: { query: "test" },
   *     schema: MemorySearchSchema
   *   }
   * )
   * ```
   *
   * @since 1.0.0
   */
  readonly requestV4: <A, I, R>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    options?: {
      readonly body?: unknown;
      readonly schema?: Schema.Schema<A, I, R>;
    }
  ) => Effect.Effect<A, SupermemoryError, R>;
};
