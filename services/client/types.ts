/**
 * @since 1.0.0
 * @module Client
 */
import type { Effect, Schema } from "effect";
import type { SupermemoryError } from "@/Errors.js";

/**
 * API version paths for different endpoints.
 */
export const ApiVersions = {
  V3: "/v3",
  V4: "/v4",
} as const;

/**
 * Supermemory HTTP client interface.
 *
 * @since 1.0.0
 * @category Services
 */
export type SupermemoryHttpClient = {
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
};
