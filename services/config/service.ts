/** @effect-diagnostics classSelfMismatch:skip-file */
/**
 * @since 1.0.0
 * @module Config
 */

import { Effect, Layer, Redacted, Schema as S } from "effect";
import { EnvTag, fromProcess, makeEnvSchema } from "effect-env";
import type { SupermemoryConfig } from "./types.js";

/**
 * Schema for Supermemory configuration environment variables.
 * Uses strings for all values and parses numbers in the service layer.
 *
 * @since 1.0.0
 * @category Schema
 */
const SupermemoryConfigEnvSchema = makeEnvSchema(
  S.Struct({
    SUPERMEMORY_API_KEY: S.String,
    SUPERMEMORY_WORKSPACE_ID: S.optional(S.String),
    SUPERMEMORY_BASE_URL: S.optional(S.String),
    SUPERMEMORY_DEFAULT_THRESHOLD: S.optional(S.String),
    SUPERMEMORY_TIMEOUT_MS: S.optional(S.String),
  })
);

type SupermemoryConfigEnv = S.Schema.Type<typeof SupermemoryConfigEnvSchema>;

/**
 * Environment layer for Supermemory configuration.
 *
 * @since 1.0.0
 * @category Layers
 */
const envLayer = fromProcess(SupermemoryConfigEnvSchema);

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
    effect: Effect.gen(function* () {
      const env = yield* EnvTag;

      const apiKey = yield* env.get("SUPERMEMORY_API_KEY");
      const workspaceId = yield* env.get("SUPERMEMORY_WORKSPACE_ID");
      const baseUrlStr = yield* env.get("SUPERMEMORY_BASE_URL");
      const defaultThresholdStr = yield* env.get(
        "SUPERMEMORY_DEFAULT_THRESHOLD"
      );
      const timeoutMsStr = yield* env.get("SUPERMEMORY_TIMEOUT_MS");

      // Parse numbers from strings
      const defaultThreshold = defaultThresholdStr
        ? Number.parseFloat(defaultThresholdStr)
        : 0.7;
      const timeoutMs = timeoutMsStr
        ? Number.parseInt(timeoutMsStr, 10)
        : 30_000;

      return {
        apiKey: Redacted.make(apiKey),
        workspaceId: workspaceId ?? undefined,
        baseUrl: baseUrlStr ?? "https://api.supermemory.ai",
        defaultThreshold: Number.isNaN(defaultThreshold)
          ? 0.7
          : defaultThreshold,
        timeoutMs: Number.isNaN(timeoutMs) ? 30_000 : timeoutMs,
      } satisfies SupermemoryConfig;
    }),
  }
) {}

/**
 * Live layer for SupermemoryConfig.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryConfigLive = Layer.provide(
  SupermemoryConfigService.Default,
  envLayer
);

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
