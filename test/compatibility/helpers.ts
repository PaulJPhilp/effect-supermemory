/**
 * Compatibility Test Helpers
 *
 * Utilities for testing compatibility between effect-supermemory
 * and the official Supermemory TypeScript SDK.
 */

import * as Effect from "effect/Effect";
import type { SupermemoryClient } from "../../services/supermemoryClient/api.js";

/**
 * Adapter interface to run same operations through both libraries
 */
export interface CompatibilityAdapter {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  putMany(items: Array<{ key: string; value: string }>): Promise<void>;
  getMany(keys: readonly string[]): Promise<Map<string, string | undefined>>;
  deleteMany(keys: readonly string[]): Promise<void>;
}

/**
 * Effect-supermemory adapter implementation
 */
export function createEffectSupermemoryAdapter(
  client: SupermemoryClient
): CompatibilityAdapter {
  return {
    async put(key: string, value: string): Promise<void> {
      await Effect.runPromise(client.put(key, value));
    },

    async get(key: string): Promise<string | undefined> {
      return await Effect.runPromise(client.get(key));
    },

    async delete(key: string): Promise<boolean> {
      return await Effect.runPromise(client.delete(key));
    },

    async exists(key: string): Promise<boolean> {
      return await Effect.runPromise(client.exists(key));
    },

    async clear(): Promise<void> {
      await Effect.runPromise(client.clear());
    },

    async putMany(items: Array<{ key: string; value: string }>): Promise<void> {
      await Effect.runPromise(client.putMany(items));
    },

    async getMany(
      keys: readonly string[]
    ): Promise<Map<string, string | undefined>> {
      const result = await Effect.runPromise(client.getMany(keys));
      // Convert ReadonlyMap to Map
      return new Map(result);
    },

    async deleteMany(keys: readonly string[]): Promise<void> {
      await Effect.runPromise(client.deleteMany(keys));
    },
  };
}

/**
 * Creates a rejecting adapter that returns rejected promises for all operations.
 * Used when SDK client is invalid or missing.
 */
function createRejectingAdapter(error: Error): CompatibilityAdapter {
  const reject = () => Promise.reject(error);
  return {
    put: reject,
    get: reject,
    delete: reject,
    exists: reject,
    clear: reject,
    putMany: reject,
    getMany: reject,
    deleteMany: reject,
  };
}

/**
 * Official SDK adapter implementation
 *
 * The official SDK uses:
 * - `new Supermemory({ apiKey })` to initialize
 * - `client.memories.create({ content, containerTags })` for creating memories
 *
 * This adapter wraps the official SDK to match the CompatibilityAdapter interface.
 *
 * Note: This implementation assumes the official SDK is available. If not installed,
 * the tests will skip official SDK comparisons.
 */
export function createOfficialSdkAdapter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sdkClient: any,
  namespace: string
): CompatibilityAdapter {
  // Check if SDK client has the expected structure
  if (!sdkClient || typeof sdkClient !== "object") {
    return createRejectingAdapter(new Error("Invalid SDK client provided"));
  }

  // Try to detect SDK structure
  const hasMemories =
    sdkClient.memories && typeof sdkClient.memories === "object";

  if (!hasMemories) {
    return createRejectingAdapter(
      new Error(
        "SDK client does not have expected structure. " +
          "Expected client.memories.create() pattern."
      )
    );
  }

  return {
    async put(key: string, value: string): Promise<void> {
      // Map to SDK's create method
      // SDK uses: memories.create({ content, containerTags })
      // We use key as containerTag and value as content
      await sdkClient.memories.create({
        content: value,
        containerTags: [namespace, key],
        customId: key, // Use key as customId for retrieval
      });
    },

    async get(key: string): Promise<string | undefined> {
      // SDK likely uses search or get by customId
      // For now, try search by containerTags
      try {
        const results = await sdkClient.memories.search({
          containerTags: [namespace, key],
          limit: 1,
        });

        if (results && results.length > 0) {
          // Extract content from result
          return results[0]?.content || results[0]?.value || undefined;
        }
        return undefined;
      } catch {
        // Try direct get if available
        if (typeof sdkClient.memories.get === "function") {
          try {
            const result = await sdkClient.memories.get(key);
            return result?.content || result?.value || undefined;
          } catch {
            return undefined;
          }
        }
        return undefined;
      }
    },

    async delete(key: string): Promise<boolean> {
      try {
        // Try to find the memory first
        const memory = await this.get(key);
        if (!memory) {
          return true; // Already deleted (idempotent)
        }

        // Delete by ID or customId
        if (typeof sdkClient.memories.delete === "function") {
          await sdkClient.memories.delete(key);
          return true;
        }

        // Fallback: delete by containerTags
        if (typeof sdkClient.memories.deleteByTags === "function") {
          await sdkClient.memories.deleteByTags({
            containerTags: [namespace, key],
          });
          return true;
        }

        return false;
      } catch {
        // Assume success for idempotent behavior
        return true;
      }
    },

    async exists(key: string): Promise<boolean> {
      const value = await this.get(key);
      return value !== undefined;
    },

    async clear(): Promise<void> {
      // Clear all memories with the namespace tag
      if (typeof sdkClient.memories.deleteByTags === "function") {
        await sdkClient.memories.deleteByTags({
          containerTags: [namespace],
        });
      } else if (typeof sdkClient.memories.clear === "function") {
        await sdkClient.memories.clear({
          containerTags: [namespace],
        });
      } else {
        return Promise.reject(
          new Error("SDK does not support clear operation")
        );
      }
    },

    async putMany(items: Array<{ key: string; value: string }>): Promise<void> {
      // Batch create
      if (typeof sdkClient.memories.createMany === "function") {
        await sdkClient.memories.createMany(
          items.map((item) => ({
            content: item.value,
            containerTags: [namespace, item.key],
            customId: item.key,
          }))
        );
      } else {
        // Fallback to individual creates
        await Promise.all(items.map((item) => this.put(item.key, item.value)));
      }
    },

    async getMany(
      keys: readonly string[]
    ): Promise<Map<string, string | undefined>> {
      const result = new Map<string, string | undefined>();

      // Try batch get if available
      if (typeof sdkClient.memories.getMany === "function") {
        const memories = await sdkClient.memories.getMany(keys);
        for (const key of keys) {
          const memory = memories?.find((m: unknown) => {
            const mem = m as { customId?: string; id?: string };
            return mem.customId === key || mem.id === key;
          });
          result.set(key, memory?.content || memory?.value || undefined);
        }
      } else {
        // Fallback to individual gets
        await Promise.all(
          keys.map(async (key) => {
            const value = await this.get(key);
            result.set(key, value);
          })
        );
      }

      return result;
    },

    async deleteMany(keys: readonly string[]): Promise<void> {
      // Try batch delete if available
      if (typeof sdkClient.memories.deleteMany === "function") {
        await sdkClient.memories.deleteMany(keys);
      } else {
        // Fallback to individual deletes
        await Promise.all(keys.map((key) => this.delete(key)));
      }
    },
  };
}

/**
 * Check if official SDK is available
 */
export function isOfficialSdkAvailable(): boolean {
  try {
    // Try to require/import the official SDK
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("supermemory");
    return true;
  } catch {
    return false;
  }
}

/**
 * Create official SDK client (if available)
 */
export async function createOfficialSdkClient(config: {
  apiKey: string;
  baseUrl?: string;
  namespace: string;
}): Promise<CompatibilityAdapter | null> {
  if (!isOfficialSdkAvailable()) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Supermemory } = require("supermemory");

    const client = new Supermemory({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });

    return createOfficialSdkAdapter(client, config.namespace);
  } catch (error) {
    console.warn("Failed to create official SDK client:", error);
    return null;
  }
}

/**
 * Compare results from two adapters
 */
export interface ComparisonResult {
  operation: string;
  parameters: unknown[];
  match: boolean;
  effectResult: unknown;
  sdkResult: unknown;
  difference?: string;
}

/**
 * Compare operation results
 */
export function compareResults(
  operation: string,
  parameters: unknown[],
  effectResult: unknown,
  sdkResult: unknown
): ComparisonResult {
  // Deep equality check
  const match = deepEqual(effectResult, sdkResult);

  if (!match) {
    return {
      operation,
      parameters,
      match,
      effectResult,
      sdkResult,
      difference: `Results differ: ${JSON.stringify(effectResult)} vs ${JSON.stringify(sdkResult)}`,
    };
  }

  return {
    operation,
    parameters,
    match,
    effectResult,
    sdkResult,
  };
}

/**
 * Deep equality check
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  if (a instanceof Map && b instanceof Map) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a.entries()) {
      if (!b.has(key) || !deepEqual(value, b.get(key))) {
        return false;
      }
    }
    return true;
  }

  if (
    typeof a === "object" &&
    typeof b === "object" &&
    !Array.isArray(a) &&
    !Array.isArray(b)
  ) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) => {
      return (
        keysB.includes(key) &&
        deepEqual(
          (a as Record<string, unknown>)[key],
          (b as Record<string, unknown>)[key]
        )
      );
    });
  }

  return false;
}

/**
 * Generate test data
 */
export function generateTestData(
  prefix = "test",
  count = 3
): Array<{ key: string; value: string }> {
  return Array.from({ length: count }, (_, i) => ({
    key: `${prefix}-${i + 1}`,
    value: `value-${i + 1}`,
  }));
}

/**
 * Clean up test data
 */
export async function cleanupTestData(
  adapter: CompatibilityAdapter,
  keys: string[]
): Promise<void> {
  try {
    await adapter.deleteMany(keys);
  } catch (error) {
    // Ignore cleanup errors
    console.warn("Cleanup failed:", error);
  }
}

/**
 * Run operation through both adapters and compare results
 */
export async function runCompatibilityTest<T>(
  operation: string,
  effectAdapter: CompatibilityAdapter,
  sdkAdapter: CompatibilityAdapter | null,
  effectOp: (adapter: CompatibilityAdapter) => Promise<T>,
  sdkOp?: (adapter: CompatibilityAdapter) => Promise<T>
): Promise<{
  effectResult: T;
  sdkResult?: T;
  comparison?: ComparisonResult;
  skipped: boolean;
}> {
  const effectResult = await effectOp(effectAdapter);

  if (!sdkAdapter) {
    return {
      effectResult,
      skipped: true,
    };
  }

  const sdkOpFunc = sdkOp || effectOp;
  let sdkResult: T;
  let comparison: ComparisonResult | undefined;

  try {
    sdkResult = await sdkOpFunc(sdkAdapter);
    comparison = compareResults(operation, [], effectResult, sdkResult);
  } catch (error) {
    // SDK operation failed - this is a compatibility issue
    return {
      effectResult,
      skipped: false,
      comparison: {
        operation,
        parameters: [],
        match: false,
        effectResult,
        sdkResult: undefined,
        difference: `SDK operation failed: ${error}`,
      },
    };
  }

  return {
    effectResult,
    sdkResult,
    comparison,
    skipped: false,
  };
}

/**
 * Skip test if official SDK is not available
 */
export function skipIfSdkUnavailable(): { skip: boolean; reason?: string } {
  if (!isOfficialSdkAvailable()) {
    return {
      skip: true,
      reason:
        "Official SDK not installed. Install with: bun add -d supermemory",
    };
  }
  return { skip: false };
}
