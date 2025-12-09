/**
 * Acceptance Test Helpers
 *
 * Shared utilities for acceptance tests that compare the official Supermemory SDK
 * with our Effect-native implementation.
 *
 * @since 1.0.0
 * @module Acceptance/Helpers
 */

import { NodeHttpClient } from "@effect/platform-node";
import { SupermemoryHttpClientService } from "@services/client/service.js";
import { SupermemoryConfigFromEnv } from "@services/config/service.js";
import { ConnectionsService } from "@services/connections/service.js";
import { MemoriesService } from "@services/memories/service.js";
import { SearchService } from "@services/search/service.js";
import { SettingsService } from "@services/settings/service.js";
import { Effect, Layer } from "effect";
import Supermemory from "supermemory";

/**
 * Test timeout for acceptance tests (may be slow due to API calls).
 */
export const ACCEPTANCE_TIMEOUT = 30_000;

/**
 * Check if the environment is properly configured for acceptance tests.
 * Rejects placeholder values and requires a real API key.
 */
export function isEnvironmentConfigured(): boolean {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return false;
  }
  // Reject common placeholder values
  const placeholders = [
    "sk-your-api-key-here",
    "your-api-key-here",
    "your_api_key",
    "your-api-key",
    "placeholder",
    "xxx",
  ];
  const lowerKey = apiKey.toLowerCase().trim();
  return !placeholders.some((p) => lowerKey.includes(p));
}

/**
 * Skip flag for acceptance tests based on environment configuration.
 */
export const SKIP_ACCEPTANCE = !isEnvironmentConfigured();

/**
 * Create an instance of the official Supermemory SDK client.
 * Uses environment variables for configuration.
 */
export function createOfficialSDKClient(): Supermemory {
  const apiKey = process.env.SUPERMEMORY_API_KEY ?? "";
  const baseURL = process.env.SUPERMEMORY_BASE_URL;

  return new Supermemory({
    apiKey,
    baseURL,
  });
}

/**
 * Create the Effect layer that provides all effect-supermemory services.
 */
export function createEffectTestLayer(): Layer.Layer<
  MemoriesService | SearchService | ConnectionsService | SettingsService
> {
  // Platform HTTP client layer
  const platformHttpLayer = NodeHttpClient.layer;

  // Combine config and platform HTTP client as base
  const baseLayer = Layer.merge(SupermemoryConfigFromEnv, platformHttpLayer);

  // Supermemory HTTP client layer
  const supermemoryHttpClientLayer = Layer.provide(
    SupermemoryHttpClientService.Default,
    baseLayer
  );

  // Create layers for each service
  const memoriesLayer = Layer.provide(
    MemoriesService.Default,
    supermemoryHttpClientLayer
  );
  const searchLayer = Layer.provide(
    SearchService.Default,
    supermemoryHttpClientLayer
  );
  const connectionsLayer = Layer.provide(
    ConnectionsService.Default,
    supermemoryHttpClientLayer
  );
  const settingsLayer = Layer.provide(
    SettingsService.Default,
    supermemoryHttpClientLayer
  );

  // Merge all service layers - use type assertion to simplify layer composition
  return Layer.mergeAll(
    memoriesLayer,
    searchLayer,
    connectionsLayer,
    settingsLayer
  ) as Layer.Layer<
    MemoriesService | SearchService | ConnectionsService | SettingsService
  >;
}

/**
 * Helper to run an Effect with the test layer.
 */
export function runEffect<A>(
  effect: Effect.Effect<A, unknown, unknown>,
  testLayer: Layer.Layer<unknown>
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(testLayer)));
}

/**
 * Unique tag generator for test isolation.
 * Creates unique container tags to avoid test interference.
 */
export function uniqueTestTag(prefix: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Cleanup helper - tracks created memory IDs for cleanup.
 */
export class TestCleanup {
  private memoryIds: string[] = [];

  /**
   * Track a memory ID for cleanup.
   */
  track(id: string): void {
    this.memoryIds.push(id);
  }

  /**
   * Get all tracked memory IDs.
   */
  getIds(): readonly string[] {
    return this.memoryIds;
  }

  /**
   * Clean up all tracked memories using the official SDK.
   */
  async cleanupWithSDK(client: Supermemory): Promise<void> {
    for (const id of this.memoryIds) {
      try {
        await client.memories.delete(id);
      } catch {
        // Ignore cleanup errors
      }
    }
    this.memoryIds = [];
  }

  /**
   * Clean up all tracked memories using Effect services.
   */
  async cleanupWithEffect(testLayer: Layer.Layer<unknown>): Promise<void> {
    for (const id of this.memoryIds) {
      try {
        await runEffect(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            yield* memories
              .delete(id)
              .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
          }),
          testLayer
        );
      } catch {
        // Ignore cleanup errors
      }
    }
    this.memoryIds = [];
  }
}

/**
 * Compare two values for structural similarity.
 * Returns true if they have the same shape and compatible types.
 */
export function isStructurallySimilar(
  actual: unknown,
  expected: unknown
): boolean {
  if (typeof actual !== typeof expected) {
    return false;
  }

  if (actual === null || expected === null) {
    return actual === expected;
  }

  if (typeof actual !== "object" || typeof expected !== "object") {
    return typeof actual === typeof expected;
  }

  // Arrays - check if both are arrays with similar element types
  if (Array.isArray(actual) && Array.isArray(expected)) {
    // Empty arrays are structurally similar
    if (actual.length === 0 || expected.length === 0) {
      return true;
    }
    // Compare first elements
    return isStructurallySimilar(actual[0], expected[0]);
  }

  // Objects - check if they have the same keys
  const actualKeys = Object.keys(actual as Record<string, unknown>).sort();
  const expectedKeys = Object.keys(expected as Record<string, unknown>).sort();

  // Check for overlapping keys (allow extra keys)
  const commonKeys = actualKeys.filter((k) => expectedKeys.includes(k));
  if (
    commonKeys.length === 0 &&
    actualKeys.length > 0 &&
    expectedKeys.length > 0
  ) {
    return false;
  }

  // Check types of common keys
  for (const key of commonKeys) {
    const actualVal = (actual as Record<string, unknown>)[key];
    const expectedVal = (expected as Record<string, unknown>)[key];
    if (!isStructurallySimilar(actualVal, expectedVal)) {
      return false;
    }
  }

  return true;
}

/**
 * Wait for a specified duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
