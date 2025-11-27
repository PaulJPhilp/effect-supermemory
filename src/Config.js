/**
 * @since 1.0.0
 * @module Config
 *
 * Configuration layer for effect-supermemory.
 * Loads settings from environment variables with sensible defaults.
 */
import { Context, Effect, Layer, Redacted, Schema as S } from "effect";
import { createSimpleEnv, EnvService } from "effect-env";
/**
 * Context tag for SupermemoryConfig.
 *
 * @since 1.0.0
 * @category Context
 */
export class SupermemoryConfigService extends Context.Tag(
  "@effect-supermemory/Config"
)() {}
/**
 * Environment schema for Supermemory configuration.
 */
const envSchema = S.Struct({
  SUPERMEMORY_API_KEY: S.String,
  SUPERMEMORY_WORKSPACE_ID: S.optional(S.String),
  SUPERMEMORY_BASE_URL: S.optional(S.String),
  SUPERMEMORY_DEFAULT_THRESHOLD: S.optional(S.String),
  SUPERMEMORY_TIMEOUT_MS: S.optional(S.String),
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
  Effect.gen(function* () {
    const env = yield* EnvService;
    const apiKey = yield* env.get("SUPERMEMORY_API_KEY");
    const workspaceId = yield* env.get("SUPERMEMORY_WORKSPACE_ID");
    const baseUrl = yield* env.get("SUPERMEMORY_BASE_URL");
    const defaultThresholdStr = yield* env.get("SUPERMEMORY_DEFAULT_THRESHOLD");
    const timeoutMsStr = yield* env.get("SUPERMEMORY_TIMEOUT_MS");
    return {
      apiKey: Redacted.make(apiKey),
      workspaceId,
      baseUrl: baseUrl ?? "https://api.supermemory.ai",
      defaultThreshold: defaultThresholdStr ? Number(defaultThresholdStr) : 0.7,
      timeoutMs: timeoutMsStr ? Number(timeoutMsStr) : 30_000,
    };
  })
).pipe(Layer.provide(createSimpleEnv(envSchema)));
/**
 * Create a config layer from explicit values.
 * Useful for testing or programmatic configuration.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryConfigFromValues = (config) =>
  Layer.succeed(SupermemoryConfigService, {
    apiKey: config.apiKey,
    workspaceId: config.workspaceId,
    baseUrl: config.baseUrl ?? "https://api.supermemory.ai",
    defaultThreshold: config.defaultThreshold ?? 0.7,
    timeoutMs: config.timeoutMs ?? 30_000,
  });
