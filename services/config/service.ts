/** @effect-diagnostics classSelfMismatch:skip-file */
/**
 * @since 1.0.0
 * @module Config
 */
import { Config, Effect, Layer, Option, type Redacted } from "effect";
import type { SupermemoryConfig } from "./types.js";

/**
 * Context tag for SupermemoryConfig.
 *
 * @since 1.0.0
 * @category Context
 */
export class SupermemoryConfigService extends Effect.Service<SupermemoryConfig>()(
  "@effect-supermemory/Config",
  {
    accessors: true,
    effect: Effect.map(
      Config.all({
        apiKey: Config.redacted("SUPERMEMORY_API_KEY"),
        workspaceId: Config.string("SUPERMEMORY_WORKSPACE_ID").pipe(
          Config.option
        ),
        baseUrl: Config.string("SUPERMEMORY_BASE_URL").pipe(
          Config.withDefault("https://api.supermemory.ai")
        ),
        defaultThreshold: Config.number("SUPERMEMORY_DEFAULT_THRESHOLD").pipe(
          Config.withDefault(0.7)
        ),
        timeoutMs: Config.number("SUPERMEMORY_TIMEOUT_MS").pipe(
          Config.withDefault(30_000)
        ),
      }),
      (config) => ({
        ...config,
        workspaceId: Option.getOrUndefined(config.workspaceId),
      })
    ),
  }
) {}

/**
 * Live layer for SupermemoryConfig.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryConfigLive = SupermemoryConfigService.Default;

/**
 * Create a config layer from explicit values.
 * Useful for testing or programmatic configuration.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryConfigFromValues = (
  config: Partial<SupermemoryConfig> & { apiKey: Redacted.Redacted<string> }
): Layer.Layer<SupermemoryConfigService> =>
  Layer.succeed(SupermemoryConfigService, {
    apiKey: config.apiKey,
    workspaceId: config.workspaceId,
    baseUrl: config.baseUrl ?? "https://api.supermemory.ai",
    defaultThreshold: config.defaultThreshold ?? 0.7,
    timeoutMs: config.timeoutMs ?? 30_000,
  });
