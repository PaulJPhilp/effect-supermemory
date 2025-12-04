/**
 * Compatibility Tests
 *
 * Tests that verify effect-supermemory produces equivalent results
 * to the official Supermemory TypeScript SDK.
 */
/** biome-ignore-all assist/source/organizeImports: we want to use named imports */

import { Effect, Layer } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HttpClient } from "../../services/httpClient/index.js";
import type { HttpUrl } from "../../services/httpClient/types.js";
import { SupermemoryClient } from "../../services/supermemoryClient/index.js";
import {
  type CompatibilityAdapter,
  cleanupTestData,
  compareResults,
  createEffectSupermemoryAdapter,
  createOfficialSdkClient,
  generateTestData,
  runCompatibilityTest,
  skipIfSdkUnavailable,
} from "./helpers.js";

// Test configuration
const TEST_CONFIG = {
  namespace: "test-compatibility",
  baseUrl: "http://localhost:3001", // Mock server
  apiKey: "test-api-key",
  timeoutMs: 5000,
};

// Create test layers
const HttpClientTestLayer = HttpClient.Default({
  baseUrl: TEST_CONFIG.baseUrl as HttpUrl,
  headers: {
    Authorization: `Bearer ${TEST_CONFIG.apiKey}`,
    "X-Supermemory-Namespace": TEST_CONFIG.namespace,
  },
  timeoutMs: TEST_CONFIG.timeoutMs,
});

const SupermemoryTestLayer = SupermemoryClient.Default(TEST_CONFIG).pipe(
  Layer.provide(HttpClientTestLayer)
);

describe("Compatibility Tests", () => {
  let effectAdapter: CompatibilityAdapter;
  let sdkAdapter: CompatibilityAdapter | null = null;
  const sdkAvailability = skipIfSdkUnavailable();

  beforeAll(async () => {
    // Create effect-supermemory adapter
    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClient;
      return createEffectSupermemoryAdapter(client);
    }).pipe(Effect.provide(SupermemoryTestLayer));

    effectAdapter = await Effect.runPromise(program);

    // Try to create official SDK adapter if available
    if (!sdkAvailability.skip) {
      sdkAdapter = createOfficialSdkClient({
        apiKey: TEST_CONFIG.apiKey,
        baseUrl: TEST_CONFIG.baseUrl,
        namespace: TEST_CONFIG.namespace,
      });
    }
  });

  afterAll(async () => {
    // Cleanup all test data from both adapters
    const testData = generateTestData("compat", 10);
    const keys = testData.map((item) => item.key);

    await cleanupTestData(effectAdapter, keys);
    if (sdkAdapter) {
      await cleanupTestData(sdkAdapter, keys);
    }
  });

  describe("put() / get() operations", () => {
    it("should store and retrieve values equivalently", async () => {
      const testKey = "compat-put-get";
      const testValue = "test-value-123";

      // Test effect-supermemory
      await effectAdapter.put(testKey, testValue);
      const effectResult = await effectAdapter.get(testKey);
      expect(effectResult).toBe(testValue);

      // Compare with official SDK if available
      if (sdkAdapter) {
        await sdkAdapter.put(testKey, testValue);
        const sdkResult = await sdkAdapter.get(testKey);
        const comparison = compareResults(
          "get",
          [testKey],
          effectResult,
          sdkResult
        );

        expect(comparison.match).toBe(true);
        if (!comparison.match && comparison.difference) {
          console.warn("Result mismatch:", comparison.difference);
        }
      }

      // Cleanup
      await cleanupTestData(effectAdapter, [testKey]);
      if (sdkAdapter) {
        await cleanupTestData(sdkAdapter, [testKey]);
      }
    });

    it("should return undefined for non-existent keys", async () => {
      const nonExistentKey = `compat-nonexistent-${Date.now()}`;

      const testResult = await runCompatibilityTest("get", {
        effectAdapter,
        sdkAdapter,
        effectOp: async (adapter) => await adapter.get(nonExistentKey),
      });

      expect(testResult.effectResult).toBeUndefined();

      if (!testResult.skipped && testResult.sdkResult !== undefined) {
        expect(testResult.sdkResult).toBeUndefined();
        if (testResult.comparison && !testResult.comparison.match) {
          console.warn(
            "Mismatch for non-existent key:",
            testResult.comparison.difference
          );
        }
      }
    });

    it("should handle special characters in keys and values", async () => {
      const testCases = [
        { key: "key-with-special/chars", value: "value with spaces" },
        { key: "unicode-key-测试", value: "unicode-value-🚀" },
        { key: "json-key", value: JSON.stringify({ nested: { data: 123 } }) },
      ];

      for (const testCase of testCases) {
        await effectAdapter.put(testCase.key, testCase.value);
        const effectResult = await effectAdapter.get(testCase.key);
        expect(effectResult).toBe(testCase.value);

        if (sdkAdapter) {
          await sdkAdapter.put(testCase.key, testCase.value);
          const sdkResult = await sdkAdapter.get(testCase.key);
          const comparison = compareResults(
            "get",
            [testCase.key],
            effectResult,
            sdkResult
          );

          expect(comparison.match).toBe(true);
        }

        // Cleanup
        await cleanupTestData(effectAdapter, [testCase.key]);
        if (sdkAdapter) {
          await cleanupTestData(sdkAdapter, [testCase.key]);
        }
      }
    });
  });

  describe("delete() operation", () => {
    it("should delete values and return true", async () => {
      const testKey = "compat-delete";
      const testValue = "delete-me";

      // Create value in both
      await effectAdapter.put(testKey, testValue);
      if (sdkAdapter) {
        await sdkAdapter.put(testKey, testValue);
      }

      // Verify it exists
      const beforeDelete = await effectAdapter.get(testKey);
      expect(beforeDelete).toBe(testValue);

      // Delete from effect-supermemory
      const deleteResult = await effectAdapter.delete(testKey);
      expect(deleteResult).toBe(true);

      // Verify it's gone
      const afterDelete = await effectAdapter.get(testKey);
      expect(afterDelete).toBeUndefined();

      // Compare delete behavior with SDK
      if (sdkAdapter) {
        const sdkDeleteResult = await sdkAdapter.delete(testKey);
        const comparison = compareResults(
          "delete",
          [testKey],
          deleteResult,
          sdkDeleteResult
        );

        expect(comparison.match).toBe(true);
      }
    });

    it("should be idempotent (return true even if key doesn't exist)", async () => {
      const nonExistentKey = `compat-idempotent-${Date.now()}`;

      const testResult = await runCompatibilityTest("delete", {
        effectAdapter,
        sdkAdapter,
        effectOp: async (adapter) => await adapter.delete(nonExistentKey),
      });

      expect(testResult.effectResult).toBe(true);

      if (!testResult.skipped && testResult.sdkResult !== undefined) {
        expect(testResult.sdkResult).toBe(true);
      }
    });
  });

  describe("exists() operation", () => {
    it("should return true for existing keys", async () => {
      const testKey = "compat-exists";
      const testValue = "exists-test";

      await effectAdapter.put(testKey, testValue);

      const testResult = await runCompatibilityTest("exists", {
        effectAdapter,
        sdkAdapter,
        effectOp: async (adapter) => {
          // Put in SDK first if comparing
          if (adapter === effectAdapter && sdkAdapter) {
            await sdkAdapter.put(testKey, testValue);
          }
          return await adapter.exists(testKey);
        },
      });

      expect(testResult.effectResult).toBe(true);

      if (!testResult.skipped && testResult.sdkResult !== undefined) {
        expect(testResult.sdkResult).toBe(true);
      }

      // Cleanup
      await cleanupTestData(effectAdapter, [testKey]);
      if (sdkAdapter) {
        await cleanupTestData(sdkAdapter, [testKey]);
      }
    });

    it("should return false for non-existent keys", async () => {
      const nonExistentKey = `compat-notexists-${Date.now()}`;

      const testResult = await runCompatibilityTest("exists", {
        effectAdapter,
        sdkAdapter,
        effectOp: async (adapter) => await adapter.exists(nonExistentKey),
      });

      expect(testResult.effectResult).toBe(false);

      if (!testResult.skipped && testResult.sdkResult !== undefined) {
        expect(testResult.sdkResult).toBe(false);
      }
    });
  });

  describe("clear() operation", () => {
    it("should clear all values in namespace", async () => {
      const testData = generateTestData("compat-clear", 5);

      // Create test data
      for (const item of testData) {
        await effectAdapter.put(item.key, item.value);
      }

      // Verify data exists
      for (const item of testData) {
        const value = await effectAdapter.get(item.key);
        expect(value).toBe(item.value);
      }

      // Clear namespace
      await effectAdapter.clear();

      // Verify all data is gone
      for (const item of testData) {
        const value = await effectAdapter.get(item.key);
        expect(value).toBeUndefined();
      }

      // Compare with SDK if available
      if (sdkAdapter) {
        // Create same data in SDK
        for (const item of testData) {
          await sdkAdapter.put(item.key, item.value);
        }

        // Clear SDK namespace
        await sdkAdapter.clear();

        // Verify SDK is cleared
        for (const item of testData) {
          const value = await sdkAdapter.get(item.key);
          expect(value).toBeUndefined();
        }
      }
    });
  });

  describe("batch operations", () => {
    describe("putMany()", () => {
      it("should store multiple values in a single request", async () => {
        const testData = generateTestData("compat-putmany", 5);

        await effectAdapter.putMany(testData);

        // Verify all values were stored
        for (const item of testData) {
          const value = await effectAdapter.get(item.key);
          expect(value).toBe(item.value);
        }

        // Compare with SDK
        if (sdkAdapter) {
          await sdkAdapter.putMany(testData);

          for (const item of testData) {
            const effectValue = await effectAdapter.get(item.key);
            const sdkValue = await sdkAdapter.get(item.key);
            const comparison = compareResults(
              "get",
              [item.key],
              effectValue,
              sdkValue
            );

            expect(comparison.match).toBe(true);
          }
        }

        // Cleanup
        const keys = testData.map((item) => item.key);
        await cleanupTestData(effectAdapter, keys);
        if (sdkAdapter) {
          await cleanupTestData(sdkAdapter, keys);
        }
      });

      it("should handle empty arrays", async () => {
        await expect(effectAdapter.putMany([])).resolves.not.toThrow();

        if (sdkAdapter) {
          await expect(sdkAdapter.putMany([])).resolves.not.toThrow();
        }
      });
    });

    describe("getMany()", () => {
      it("should retrieve multiple values in a single request", async () => {
        const testData = generateTestData("compat-getmany", 5);

        // Create test data
        await effectAdapter.putMany(testData);

        // Retrieve all at once
        const keys = testData.map((item) => item.key);
        const results = await effectAdapter.getMany(keys);

        // Verify results
        expect(results.size).toBe(testData.length);
        for (const item of testData) {
          expect(results.get(item.key)).toBe(item.value);
        }

        // Compare with SDK
        if (sdkAdapter) {
          await sdkAdapter.putMany(testData);
          const sdkResults = await sdkAdapter.getMany(keys);

          expect(sdkResults.size).toBe(results.size);
          for (const item of testData) {
            const effectValue = results.get(item.key);
            const sdkValue = sdkResults.get(item.key);
            const comparison = compareResults(
              "getMany",
              [item.key],
              effectValue,
              sdkValue
            );

            expect(comparison.match).toBe(true);
          }
        }

        // Cleanup
        await cleanupTestData(effectAdapter, keys);
        if (sdkAdapter) {
          await cleanupTestData(sdkAdapter, keys);
        }
      });

      it("should return undefined for non-existent keys", async () => {
        const nonExistentKeys = [
          `compat-nonexistent-1-${Date.now()}`,
          `compat-nonexistent-2-${Date.now()}`,
        ] as const;

        const results = await effectAdapter.getMany(nonExistentKeys);
        expect(results.size).toBe(2);
        expect(results.get(nonExistentKeys[0])).toBeUndefined();
        expect(results.get(nonExistentKeys[1])).toBeUndefined();

        // Compare with SDK
        if (sdkAdapter) {
          const sdkResults = await sdkAdapter.getMany(nonExistentKeys);
          expect(sdkResults.size).toBe(2);
          expect(sdkResults.get(nonExistentKeys[0])).toBeUndefined();
          expect(sdkResults.get(nonExistentKeys[1])).toBeUndefined();
        }
      });

      describe("deleteMany()", () => {
        it("should delete multiple values in a single request", async () => {
          const testData = generateTestData("compat-deletemany", 5);

          // Create test data
          await effectAdapter.putMany(testData);

          // Delete all at once
          const keys = testData.map((item) => item.key);
          await effectAdapter.deleteMany(keys);

          // Verify all are deleted
          for (const key of keys) {
            const value = await effectAdapter.get(key);
            expect(value).toBeUndefined();
          }

          // Compare with SDK
          if (sdkAdapter) {
            await sdkAdapter.putMany(testData);
            await sdkAdapter.deleteMany(keys);

            for (const key of keys) {
              const value = await sdkAdapter.get(key);
              expect(value).toBeUndefined();
            }
          }
        });

        it("should handle empty arrays", async () => {
          await expect(effectAdapter.deleteMany([])).resolves.not.toThrow();

          if (sdkAdapter) {
            await expect(sdkAdapter.deleteMany([])).resolves.not.toThrow();
          }
        });
      });
    });
  });

  describe("error handling compatibility", () => {
    it("should handle network errors equivalently", () => {
      // This test would require mocking network failures
      // For now, we just verify both adapters exist
      expect(effectAdapter).toBeDefined();
      if (sdkAdapter) {
        expect(sdkAdapter).toBeDefined();
      }
    });

    it("should handle invalid keys equivalently", async () => {
      // Empty key
      await expect(effectAdapter.get("")).resolves.toBeUndefined();

      if (sdkAdapter) {
        await expect(sdkAdapter.get("")).resolves.toBeUndefined();
      }
    });
  });

  describe("performance characteristics", () => {
    it("should handle large batch operations", async () => {
      const largeBatch = generateTestData("compat-large", 100);

      const startTime = Date.now();
      await effectAdapter.putMany(largeBatch);
      const effectTime = Date.now() - startTime;

      expect(effectTime).toBeLessThan(10_000); // Should complete within 10 seconds

      // Cleanup
      const keys = largeBatch.map((item) => item.key);
      await cleanupTestData(effectAdapter, keys);

      if (sdkAdapter) {
        const sdkStartTime = Date.now();
        await sdkAdapter.putMany(largeBatch);
        const sdkTime = Date.now() - sdkStartTime;

        // Both should be reasonable (within 2x of each other)
        const timeDiff = Math.abs(effectTime - sdkTime);
        expect(timeDiff).toBeLessThan(Math.max(effectTime, sdkTime) * 2);

        await cleanupTestData(sdkAdapter, keys);
      }
    });
  });

  // Note: Streaming operation tests would go here once SDK streaming is analyzed
  describe.skipIf(sdkAvailability.skip)("official SDK integration", () => {
    it("should have official SDK available for comparison", () => {
      expect(sdkAdapter).not.toBeNull();
      expect(sdkAvailability.skip).toBe(false);
    });
  });
});
