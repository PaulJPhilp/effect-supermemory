import type {
  ApiKey,
  Namespace,
  PositiveInteger,
  ValidatedHttpUrl,
} from "@services/inMemoryClient/types.js";

/**
 * Configuration type for the MemoryStreamClient service.
 *
 * @since 1.0.0
 */
export type MemoryStreamClientConfigType = {
  /** The namespace to isolate memory operations (validated namespace string) */
  readonly namespace: Namespace;
  /** The base URL for the Supermemory API (validated HTTP/HTTPS URL) */
  readonly baseUrl: ValidatedHttpUrl;
  /** The API key for authentication (validated non-empty string) */
  readonly apiKey: ApiKey;
  /** Optional timeout for HTTP requests in milliseconds (must be positive integer) */
  readonly timeoutMs?: PositiveInteger;
};
