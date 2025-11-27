/**
 * @since 1.0.0
 * @module Config
 *
 * Configuration layer for effect-supermemory.
 * Loads settings from environment variables with sensible defaults.
 */
import { Config, Context, Effect, Layer, Option, Redacted } from "effect";

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

/**
 * Context tag for SupermemoryConfig.
 *
 * @since 1.0.0
 * @category Context
 */
export class SupermemoryConfigService extends Context.Tag(
  "@effect-supermemory/Config",
)<SupermemoryConfigService, SupermemoryConfig>() {}

/**
 * Environment schema for Supermemory configuration.
 */
const supermemoryConfig = Config.all({
  apiKey: Config.redacted("SUPERMEMORY_API_KEY"),
  workspaceId: Config.string("SUPERMEMORY_WORKSPACE_ID").pipe(
    Config.option,
  ),
  baseUrl: Config.string("SUPERMEMORY_BASE_URL").pipe(
    Config.withDefault("https://api.supermemory.ai"),
  ),
  defaultThreshold: Config.number("SUPERMEMORY_DEFAULT_THRESHOLD").pipe(
    Config.withDefault(0.7),
  ),
  timeoutMs: Config.number("SUPERMEMORY_TIMEOUT_MS").pipe(
    Config.withDefault(30_000),
  ),
});

/**
 * Layer that loads SupermemoryConfig from environment variables.
 *
 * Required environment variables:
 * - `SUPERMEMORY_API_KEY` (required)
 *
 * Optional environment variables:
 * - `SUPERMEMORY_WORKSPACE_ID`
 * - `SUPERMEMORY_BASE_URL` (default: "https://api.supermemory.ai")
 * - `SUPERMEMORY_DEFAULT_THRESHOLD` (default: 0.7)
 * - `SUPERMEMORY_TIMEOUT_MS` (default: 30000)
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryConfigLive = Layer.effect(
  SupermemoryConfigService,
  Effect.map(supermemoryConfig, (config) => ({
    ...config,
    workspaceId: Option.getOrUndefined(config.workspaceId),
  })),
);

/**
 * Create a config layer from explicit values.
 * Useful for testing or programmatic configuration.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryConfigFromValues = (
  config: Partial<SupermemoryConfig> & { apiKey: Redacted.Redacted<string> },
): Layer.Layer<SupermemoryConfigService> =>
  Layer.succeed(SupermemoryConfigService, {
    apiKey: config.apiKey,
    workspaceId: config.workspaceId,
    baseUrl: config.baseUrl ?? "https://api.supermemory.ai",
    defaultThreshold: config.defaultThreshold ?? 0.7,
    timeoutMs: config.timeoutMs ?? 30_000,
  });
