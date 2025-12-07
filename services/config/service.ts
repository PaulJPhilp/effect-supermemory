/** @effect-diagnostics classSelfMismatch:skip-file */
/**
 * @since 1.0.0
 * @module Config
 */

import { Effect, Layer, type Redacted } from "effect";
import { fromProcess, makeEnvSchema } from "effect-env";
import type { SupermemoryConfig } from "./api.js";
import { buildConfigFromEnv } from "./helpers.js";
import { SupermemoryConfigEnv } from "./schema.js";

const SupermemoryConfigEnvSchema = makeEnvSchema(
  SupermemoryConfigEnv as unknown as Parameters<typeof makeEnvSchema>[0]
);

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
    effect: buildConfigFromEnv(),
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
  envLayer as unknown as Layer.Layer<unknown, unknown, unknown>
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
