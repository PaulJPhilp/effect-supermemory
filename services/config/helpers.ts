/**
 * Helper functions for the config service.
 *
 * @since 1.0.0
 * @module Config
 */

import { Effect, Redacted, type Schema } from "effect";
import { EnvTag } from "effect-env";
import type { SupermemoryConfig } from "./api.js";
import type { SupermemoryConfigEnv } from "./schema.js";

/**
 * Environment variable names for Supermemory configuration.
 */
const ENV_VARS: Record<
  keyof Schema.Schema.Type<typeof SupermemoryConfigEnv>,
  string
> = {
  SUPERMEMORY_API_KEY: "SUPERMEMORY_API_KEY",
  SUPERMEMORY_WORKSPACE_ID: "SUPERMEMORY_WORKSPACE_ID",
  SUPERMEMORY_BASE_URL: "SUPERMEMORY_BASE_URL",
  SUPERMEMORY_DEFAULT_THRESHOLD: "SUPERMEMORY_DEFAULT_THRESHOLD",
  SUPERMEMORY_TIMEOUT_MS: "SUPERMEMORY_TIMEOUT_MS",
} as const;

/**
 * Default configuration values.
 */
const DEFAULTS = {
  BASE_URL: "https://api.supermemory.ai",
  DEFAULT_THRESHOLD: 0.7,
  TIMEOUT_MS: 30_000,
} as const;

/**
 * Reads all environment variables needed for Supermemory configuration.
 *
 * @returns Effect that resolves to an object containing all environment variable values
 * @since 1.0.0
 * @category Helpers
 */
export const readEnvVars = () =>
  Effect.gen(function* () {
    const env = yield* EnvTag;

    const apiKey = yield* env.get(ENV_VARS.SUPERMEMORY_API_KEY);
    const workspaceId = yield* env.get(ENV_VARS.SUPERMEMORY_WORKSPACE_ID);
    const baseUrlStr = yield* env.get(ENV_VARS.SUPERMEMORY_BASE_URL);
    const defaultThresholdStr = yield* env.get(
      ENV_VARS.SUPERMEMORY_DEFAULT_THRESHOLD
    );
    const timeoutMsStr = yield* env.get(ENV_VARS.SUPERMEMORY_TIMEOUT_MS);

    return {
      apiKey: apiKey as string,
      workspaceId: workspaceId as string | undefined,
      baseUrlStr: baseUrlStr as string | undefined,
      defaultThresholdStr: defaultThresholdStr as string | undefined,
      timeoutMsStr: timeoutMsStr as string | undefined,
    };
  });

/**
 * Parses numeric strings with fallback to defaults.
 *
 * @param thresholdStr - String representation of threshold (0.0-1.0)
 * @param timeoutStr - String representation of timeout in milliseconds
 * @returns Object with parsed numeric values or defaults
 * @since 1.0.0
 * @category Helpers
 */
export const parseNumericConfig = (
  thresholdStr: string | undefined,
  timeoutStr: string | undefined
): {
  readonly defaultThreshold: number;
  readonly timeoutMs: number;
} => {
  const defaultThreshold = thresholdStr
    ? Number.parseFloat(thresholdStr)
    : DEFAULTS.DEFAULT_THRESHOLD;
  const timeoutMs = timeoutStr
    ? Number.parseInt(timeoutStr, 10)
    : DEFAULTS.TIMEOUT_MS;

  return {
    defaultThreshold: Number.isNaN(defaultThreshold)
      ? DEFAULTS.DEFAULT_THRESHOLD
      : defaultThreshold,
    timeoutMs: Number.isNaN(timeoutMs) ? DEFAULTS.TIMEOUT_MS : timeoutMs,
  };
};

/**
 * Builds SupermemoryConfig from environment variables.
 *
 * @returns Effect that resolves to SupermemoryConfig
 * @since 1.0.0
 * @category Helpers
 */
export const buildConfigFromEnv = () =>
  Effect.gen(function* () {
    const envVars = yield* readEnvVars();
    const { defaultThreshold, timeoutMs } = parseNumericConfig(
      envVars.defaultThresholdStr,
      envVars.timeoutMsStr
    );

    return {
      apiKey: Redacted.make(envVars.apiKey),
      workspaceId: envVars.workspaceId ?? undefined,
      baseUrl: envVars.baseUrlStr ?? DEFAULTS.BASE_URL,
      defaultThreshold,
      timeoutMs,
    } satisfies SupermemoryConfig;
  });
