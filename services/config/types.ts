/**
 * @since 1.0.0
 * @module Config
 */
import type { Redacted } from "effect";

/**
 * Configuration for the Supermemory client.
 *
 * @since 1.0.0
 * @category Config
 */
export type SupermemoryConfig = {
  /**
   * API key for authentication (redacted in logs).
   */
  readonly apiKey: Redacted.Redacted<string>;

  /**
   * Optional workspace ID for multi-tenant setups.
   */
  readonly workspaceId: string | undefined;

  /**
   * Base URL for the Supermemory API.
   * @default "https://api.supermemory.ai"
   */
  readonly baseUrl: string;

  /**
   * Default similarity threshold for search operations.
   * @default 0.7
   */
  readonly defaultThreshold: number;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  readonly timeoutMs: number;
};
