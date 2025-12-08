/** @effect-diagnostics classSelfMismatch:skip-file */
/**
 * @since 1.0.0
 * @module Config
 */

import { Effect, Layer, Redacted, type Redacted as RedactedType } from "effect";
import type { SupermemoryConfig } from "./api.js";

/**
 * Default configuration values.
 */
const DEFAULTS = {
  BASE_URL: "https://api.supermemory.ai",
  DEFAULT_THRESHOLD: 0.7,
  TIMEOUT_MS: 30_000,
} as const;

/**
 * Build SupermemoryConfig from process.env directly.
 * Avoids effect-env to prevent Effect version conflicts.
 */
function buildConfigFromProcessEnv(): SupermemoryConfig {
  const apiKey = process.env.SUPERMEMORY_API_KEY ?? "";
  const workspaceId = process.env.SUPERMEMORY_WORKSPACE_ID;
  const baseUrl = process.env.SUPERMEMORY_BASE_URL ?? DEFAULTS.BASE_URL;

  const thresholdStr = process.env.SUPERMEMORY_DEFAULT_THRESHOLD;
  const timeoutStr = process.env.SUPERMEMORY_TIMEOUT_MS;

  const defaultThreshold = thresholdStr
    ? Number.parseFloat(thresholdStr)
    : DEFAULTS.DEFAULT_THRESHOLD;
  const timeoutMs = timeoutStr
    ? Number.parseInt(timeoutStr, 10)
    : DEFAULTS.TIMEOUT_MS;

  return {
    apiKey: Redacted.make(apiKey),
    workspaceId,
    baseUrl,
    defaultThreshold: Number.isNaN(defaultThreshold)
      ? DEFAULTS.DEFAULT_THRESHOLD
      : defaultThreshold,
    timeoutMs: Number.isNaN(timeoutMs) ? DEFAULTS.TIMEOUT_MS : timeoutMs,
  };
}

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
    sync: buildConfigFromProcessEnv,
  }
) {}

/**
 * Layer for SupermemoryConfig that reads from process environment.
 *
 * Usage: Effect.provide(myProgram, SupermemoryConfigFromEnv)
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryConfigFromEnv = SupermemoryConfigService.Default;

/**
 * Create a config layer from explicit values.
 * Useful for testing or programmatic configuration.
 *
 * @since 1.0.0
 * @category Layers
 */
export const SupermemoryConfigFromValues = (
  config: Partial<SupermemoryConfig> & { apiKey: RedactedType.Redacted<string> }
): Layer.Layer<SupermemoryConfigService> =>
  Layer.succeed(SupermemoryConfigService, {
    apiKey: config.apiKey,
    workspaceId: config.workspaceId,
    baseUrl: config.baseUrl ?? DEFAULTS.BASE_URL,
    defaultThreshold: config.defaultThreshold ?? DEFAULTS.DEFAULT_THRESHOLD,
    timeoutMs: config.timeoutMs ?? DEFAULTS.TIMEOUT_MS,
  });
