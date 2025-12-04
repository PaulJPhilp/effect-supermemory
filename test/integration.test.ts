import { Chunk, Effect, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import type {
  MemoryKey,
  MemoryValue,
} from "../services/inMemoryClient/types.js";
import {
  HttpClient,
  type HttpUrl,
  MemoryStreamClient,
  SupermemoryClient,
} from "../src/index.js";

// Integration test configuration
const TEST_CONFIG = {
  namespace: "test-integration",
  baseUrl: "http://localhost:3001", // Mock server
  apiKey: "test-api-key",
  timeoutMs: 5000,
};

// Create test layers
const HttpClientTestLayer = HttpClient.Default({
  baseUrl: TEST_CONFIG.baseUrl as HttpUrl,
  // Headers should now be injected by SupermemoryClient
  timeoutMs: TEST_CONFIG.timeoutMs,
});

const SupermemoryTestLayer = SupermemoryClient.Default(TEST_CONFIG).pipe(
  Layer.provide(HttpClientTestLayer)
);

const MemoryStreamTestLayer = Layer.merge(
  MemoryStreamClient.Default(TEST_CONFIG),
  SupermemoryTestLayer
);

describe("Integration Tests", () => {
  describe("SupermemoryClient", () => {
    it("should put and get memories", async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;

        // Put a memory
        yield* client.put("test-key" as MemoryKey, "test-value" as MemoryValue);

        // Get the memory
        const value = yield* client.get("test-key" as MemoryKey);

        expect(value).toBe("test-value");
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });

    it("should return undefined for non-existent keys", async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;

        const value = yield* client.get("non-existent-key" as MemoryKey);

        expect(value).toBeUndefined();
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });

    it("should delete memories", async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;

        // Put a memory first
        yield* client.put(
          "delete-test-key" as MemoryKey,
          "delete-test-value" as MemoryValue
        );

        // Verify it exists
        const beforeDelete = yield* client.get("delete-test-key" as MemoryKey);
        expect(beforeDelete).toBe("delete-test-value");

        // Delete it
        const deleted = yield* client.delete("delete-test-key" as MemoryKey);
        expect(deleted).toBe(true);

        // Verify it's gone
        const afterDelete = yield* client.get("delete-test-key" as MemoryKey);
        expect(afterDelete).toBeUndefined();
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });

    it("should check if memory exists", async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClient;

        // Check non-existent key
        const existsBefore = yield* client.exists(
          "exists-test-key" as MemoryKey
        );
        expect(existsBefore).toBe(false);

        // Put a memory
        yield* client.put(
          "exists-test-key" as MemoryKey,
          "exists-test-value" as MemoryValue
        );

        // Check existing key
        const existsAfter = yield* client.exists(
          "exists-test-key" as MemoryKey
        );
        expect(existsAfter).toBe(true);
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });
  });

  describe("MemoryStreamClient", () => {
    it("should stream all keys", async () => {
      const program = Effect.gen(function* () {
        const client = yield* MemoryStreamClient;

        // Put some test memories
        const memoryClient = yield* SupermemoryClient;
        yield* memoryClient.put(
          "stream-test-1" as MemoryKey,
          "value-1" as MemoryValue
        );
        yield* memoryClient.put(
          "stream-test-2" as MemoryKey,
          "value-2" as MemoryValue
        );
        yield* memoryClient.put(
          "stream-test-3" as MemoryKey,
          "value-3" as MemoryValue
        );

        // Stream all keys
        const stream = yield* client.listAllKeys();
        const keys = yield* Stream.runCollect(stream);

        // Type assertion for Chunk<string>
        const keysChunk = keys as unknown as Chunk.Chunk<string>;
        const keysArray = Chunk.toReadonlyArray(keysChunk);
        expect(keysArray).toContain("stream-test-1");
        expect(keysArray).toContain("stream-test-2");
        expect(keysArray).toContain("stream-test-3");
      }).pipe(Effect.provide(MemoryStreamTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });

    it("should stream search results", async () => {
      const program = Effect.gen(function* () {
        const client = yield* MemoryStreamClient;

        // Put some test memories with searchable content
        const memoryClient = yield* SupermemoryClient;
        yield* memoryClient.put(
          "search-test-1" as MemoryKey,
          "apple banana cherry" as MemoryValue
        );
        yield* memoryClient.put(
          "search-test-2" as MemoryKey,
          "dog cat mouse" as MemoryValue
        );
        yield* memoryClient.put(
          "search-test-3" as MemoryKey,
          "apple orange grape" as MemoryValue
        );

        // Search for "apple"
        const searchStream = yield* client.streamSearch("apple");
        const results = yield* Stream.runCollect(searchStream);

        // Type assertion to help TypeScript understand this is a Chunk
        const resultsChunk = results as unknown as Chunk.Chunk<{
          memory: { key: string };
        }>;
        const resultsArray = Chunk.toReadonlyArray(resultsChunk);
        expect(resultsArray.length).toBe(2);
        const resultKeys = resultsArray.map((r) => r.memory.key);
        expect(resultKeys).toContain("search-test-1");
        expect(resultKeys).toContain("search-test-3");
      }).pipe(Effect.provide(MemoryStreamTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });
  });
});
