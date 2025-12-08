import type { HttpStatusCode } from "@services/httpClient/types.js";
import type {
  ApiKey,
  Namespace,
  PositiveInteger,
  ValidatedHttpUrl,
} from "@services/inMemoryClient/types.js";
import { Brand } from "effect";

export type SupermemoryId = string & Brand.Brand<"SupermemoryId">;

/**
 * Branded type for Supermemory IDs with validation.
 *
 * A SupermemoryId must be a non-empty string.
 *
 * @example
 * ```typescript
 * const valid: SupermemoryId = SupermemoryId("abc123");
 * const invalid: SupermemoryId = SupermemoryId(""); // Throws error (empty)
 * ```
 */
export const SupermemoryId = Brand.refined<SupermemoryId>(
  (id) => typeof id === "string" && id.length > 0,
  (id) =>
    Brand.error(`SupermemoryId must be a non-empty string, got: ${String(id)}`)
);

export type RetryScheduleConfig = {
  readonly attempts: number; // Total number of attempts (1 means no retries, just initial call)
  readonly delayMs: number; // Fixed delay in milliseconds between attempts
};

/**
 * Configuration for the SupermemoryClient service itself.
 *
 * @since 1.0.0
 */
export type SupermemoryClientConfigType = {
  /** The namespace to isolate memory operations (validated namespace string) */
  readonly namespace: Namespace;
  /** The base URL for the Supermemory API (validated HTTP/HTTPS URL) */
  readonly baseUrl: ValidatedHttpUrl;
  /** The API key for authentication (validated non-empty string) */
  readonly apiKey: ApiKey;
  /** Optional timeout for HTTP requests in milliseconds (must be positive integer) */
  readonly timeoutMs?: PositiveInteger;
  /** Optional retry configuration */
  readonly retries?: RetryScheduleConfig;
};

// Represents a memory as stored/returned by the Supermemory backend
export type SupermemoryApiMemory = {
  readonly id: SupermemoryId;
  readonly value: string; // Base64 encoded content
  readonly namespace: string;
  readonly metadata?: Record<string, unknown>;
  readonly createdAt: string; // ISO date string
  readonly updatedAt: string; // ISO date string
};

// Batch response types
export type SupermemoryBatchResponseItem = {
  readonly id: string;
  readonly status: HttpStatusCode;
  readonly value?: string;
  readonly error?: string;
};

export type SupermemoryBatchResponse = {
  readonly correlationId?: string;
  readonly results: readonly SupermemoryBatchResponseItem[];
};
