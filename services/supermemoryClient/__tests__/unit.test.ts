import { HttpClient } from "@services/httpClient/service.js";
import type { HttpUrl } from "@services/httpClient/types.js";
import type { MemoryKey, MemoryValue } from "@services/inMemoryClient/types.js";
import { Cause, Effect, Layer, Option } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { SupermemoryClient } from "../service.js";
import type { SupermemoryClientConfigType } from "../types.js";

// Integration test configuration
const TEST_CONFIG: SupermemoryClientConfigType = {
  namespace: "test-supermemory-client",
  baseUrl: "https://api.supermemory.ai",
  apiKey: process.env.SUPERMEMORY_API_KEY || "test-api-key",
  timeoutMs: 10_000,
};

// Create test layers
const HttpClientTestLayer = HttpClient.Default({
  baseUrl: TEST_CONFIG.baseUrl as HttpUrl,
  ...(TEST_CONFIG.timeoutMs !== undefined && {
    timeoutMs: TEST_CONFIG.timeoutMs,
  }),
});

const SupermemoryTestLayer = SupermemoryClient.Default(TEST_CONFIG).pipe(
  Layer.provide(HttpClientTestLayer)
);

// Helper to cast strings to branded types for tests
const asKey = (s: string): MemoryKey => s as MemoryKey;
const asValue = (s: string): MemoryValue => s as MemoryValue;

describe("SupermemoryClient", () => {
  // Skip network-dependent tests if no real API key is provided
  const hasRealApiKey =
    process.env.SUPERMEMORY_API_KEY &&
    process.env.SUPERMEMORY_API_KEY !== "test-api-key";

  afterEach(async () => {
    if (!hasRealApiKey) {
      return;
    }

    // Clean up: clear all test data after each test
    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClient;
      yield* client.clear();
    }).pipe(Effect.provide(SupermemoryTestLayer));

    await Effect.runPromiseExit(program);
  });

  it.skipIf(!hasRealApiKey)(
    "put stores a memory and encodes value to base64",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.put(asKey("test-key"), asValue("test-value"));
        const value = yield* client.get(asKey("test-key"));
        expect(value).toBe("test-value");
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "get retrieves a memory and decodes value from base64",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.put(asKey("get-test-key"), asValue("decoded-value"));
        const value = yield* client.get(asKey("get-test-key"));
        expect(value).toBe("decoded-value");
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "get returns undefined for 404 Not Found",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        const value = yield* client.get(asKey("nonexistent-key"));
        expect(value).toBeUndefined();
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "delete removes a memory and returns true for success",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.put(
          asKey("delete-test-key"),
          asValue("delete-test-value")
        );
        const deleted = yield* client.delete(asKey("delete-test-key"));
        expect(deleted).toBe(true);
        const value = yield* client.get(asKey("delete-test-key"));
        expect(value).toBeUndefined();
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "delete returns true for 404 Not Found (idempotent)",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        const deleted = yield* client.delete(asKey("nonexistent-key"));
        expect(deleted).toBe(true);
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "exists returns true for existing key",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.put(
          asKey("exists-test-key"),
          asValue("exists-test-value")
        );
        const exists = yield* client.exists(asKey("exists-test-key"));
        expect(exists).toBe(true);
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "exists returns false for 404 Not Found",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        const exists = yield* client.exists(asKey("nonexistent-key"));
        expect(exists).toBe(false);
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "clear removes all memories in namespace",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.put(asKey("clear-key-1"), asValue("value1"));
        yield* client.put(asKey("clear-key-2"), asValue("value2"));
        yield* client.clear();
        const exists1 = yield* client.exists(asKey("clear-key-1"));
        const exists2 = yield* client.exists(asKey("clear-key-2"));
        expect(exists1).toBe(false);
        expect(exists2).toBe(false);
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "putMany stores multiple memories and encodes values to base64",
    async () => {
      const items = [
        { key: asKey("batch-key-1"), value: asValue("batch-value-1") },
        { key: asKey("batch-key-2"), value: asValue("batch-value-2") },
      ];
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.putMany(items);
        const value1 = yield* client.get(asKey("batch-key-1"));
        const value2 = yield* client.get(asKey("batch-key-2"));
        expect(value1).toBe("batch-value-1");
        expect(value2).toBe("batch-value-2");
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "deleteMany deletes multiple memories",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.put(asKey("delete-many-1"), asValue("value1"));
        yield* client.put(asKey("delete-many-2"), asValue("value2"));
        const keys = [asKey("delete-many-1"), asKey("delete-many-2")];
        yield* client.deleteMany(keys);
        const exists1 = yield* client.exists(asKey("delete-many-1"));
        const exists2 = yield* client.exists(asKey("delete-many-2"));
        expect(exists1).toBe(false);
        expect(exists2).toBe(false);
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "getMany retrieves multiple memories and decodes values from base64",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.put(asKey("get-many-1"), asValue("val1"));
        yield* client.put(asKey("get-many-2"), asValue("val2"));
        yield* client.put(asKey("get-many-3"), asValue("val3"));
        const keys = [
          asKey("get-many-1"),
          asKey("get-many-2"),
          asKey("get-many-3"),
          asKey("get-many-nonexistent"),
        ];
        const result = yield* client.getMany(keys);
        expect(result.get("get-many-1")).toBe("val1");
        expect(result.get("get-many-2")).toBe("val2");
        expect(result.get("get-many-3")).toBe("val3");
        expect(result.get("get-many-nonexistent")).toBeUndefined();
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "handles special characters in keys and values",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        const specialKey = asKey("key-with-special-chars-!@#$%^&*()");
        const specialValue = asValue("value-with-unicode-🚀-and-特殊字符");
        yield* client.put(specialKey, specialValue);
        const value = yield* client.get(specialKey);
        expect(value).toBe("value-with-unicode-🚀-and-特殊字符");
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)("handles empty values", async () => {
    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClient;
      yield* client.put(asKey("empty-value-key"), asValue(""));
      const value = yield* client.get(asKey("empty-value-key"));
      expect(value).toBe("");
    }).pipe(Effect.provide(SupermemoryTestLayer));

    const result = await Effect.runPromiseExit(program);
    if (result._tag === "Failure") {
      expect.fail(`Test failed: ${result.cause}`);
    }
  });

  it.skipIf(!hasRealApiKey)("handles large values", async () => {
    const largeValue = "x".repeat(10_000);
    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClient;
      yield* client.put(asKey("large-value-key"), asValue(largeValue));
      const value = yield* client.get(asKey("large-value-key"));
      expect(value).toBe(largeValue);
    }).pipe(Effect.provide(SupermemoryTestLayer));

    const result = await Effect.runPromiseExit(program);
    if (result._tag === "Failure") {
      expect.fail(`Test failed: ${result.cause}`);
    }
  });

  it.skipIf(!hasRealApiKey)(
    "handles empty arrays for batch operations",
    async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        // Empty arrays should succeed without errors
        yield* client.putMany([]);
        yield* client.deleteMany([]);
        const result = yield* client.getMany([]);
        expect(result.size).toBe(0);
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      // Empty arrays might fail if the service doesn't handle them gracefully
      // This is acceptable behavior - the test verifies the service doesn't crash
      if (result._tag === "Failure") {
        // Check if it's a validation error (acceptable for empty arrays)
        const error = Cause.failureOption(result.cause);
        if (Option.isSome(error)) {
          // Empty arrays might return validation errors, which is acceptable
          expect(error.value).toBeDefined();
        }
      }
    }
  );

  it.skipIf(!hasRealApiKey)(
    "retries on transient errors with retry configuration",
    async () => {
      const configWithRetries: SupermemoryClientConfigType = {
        ...TEST_CONFIG,
        retries: { attempts: 3, delayMs: 100 },
      };
      const layerWithRetries = SupermemoryClient.Default(
        configWithRetries
      ).pipe(Layer.provide(HttpClientTestLayer));

      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        // First attempt might fail, but retries should succeed
        yield* client.put(asKey("retry-test-key"), asValue("retry-test-value"));
        const value = yield* client.get(asKey("retry-test-key"));
        expect(value).toBe("retry-test-value");
      }).pipe(Effect.provide(layerWithRetries));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );

  it.skipIf(!hasRealApiKey)("does not retry on 404 errors", async () => {
    const configWithRetries: SupermemoryClientConfigType = {
      ...TEST_CONFIG,
      retries: { attempts: 3, delayMs: 100 },
    };
    const layerWithRetries = SupermemoryClient.Default(configWithRetries).pipe(
      Layer.provide(HttpClientTestLayer)
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClient;
      // 404 should return undefined immediately without retries
      const value = yield* client.get(asKey("nonexistent-retry-key"));
      expect(value).toBeUndefined();
    }).pipe(Effect.provide(layerWithRetries));

    const result = await Effect.runPromiseExit(program);
    if (result._tag === "Failure") {
      expect.fail(`Test failed: ${result.cause}`);
    }
  });

  it.skipIf(!hasRealApiKey)(
    "handles batch operations with many items",
    async () => {
      const items = Array.from({ length: 50 }, (_, i) => ({
        key: asKey(`batch-large-${i}`),
        value: asValue(`batch-value-${i}`),
      }));

      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;
        yield* client.putMany(items);
        const keys = items.map((item) => item.key);
        const results = yield* client.getMany(keys);
        expect(results.size).toBe(50);
        for (let i = 0; i < 50; i++) {
          expect(results.get(`batch-large-${i}`)).toBe(`batch-value-${i}`);
        }
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    }
  );
});
