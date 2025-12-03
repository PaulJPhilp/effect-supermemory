import { Chunk, Effect, Layer, Stream } from "effect";
import { describe, expect, it } from "vitest";
import {
  HttpClientImpl,
  MemoryStreamClientImpl,
  SupermemoryClientImpl,
  type HttpUrl,
} from "../src/index.js";

// Integration test configuration
const TEST_CONFIG = {
  namespace: "test-integration",
  baseUrl: "http://localhost:3001", // Mock server
  apiKey: "test-api-key",
  timeoutMs: 5000,
};

// Create test layers
const HttpClientTestLayer = HttpClientImpl.Default({
  baseUrl: TEST_CONFIG.baseUrl as HttpUrl,
  // Headers should now be injected by SupermemoryClient
  timeoutMs: TEST_CONFIG.timeoutMs,
});

const SupermemoryTestLayer = SupermemoryClientImpl.Default(TEST_CONFIG).pipe(
  Layer.provide(HttpClientTestLayer)
);

const MemoryStreamTestLayer = Layer.merge(
  MemoryStreamClientImpl.Default(TEST_CONFIG),
  SupermemoryTestLayer
);

describe("Integration Tests", () => {
  describe("SupermemoryClient", () => {
    it("should put and get memories", async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClientImpl;

        // Put a memory
        yield* client.put("test-key", "test-value");

        // Get the memory
        const value = yield* client.get("test-key");

        expect(value).toBe("test-value");
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });

    it("should return undefined for non-existent keys", async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClientImpl;

        const value = yield* client.get("non-existent-key");

        expect(value).toBeUndefined();
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });

    it("should delete memories", async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClientImpl;

        // Put a memory first
        yield* client.put("delete-test-key", "delete-test-value");

        // Verify it exists
        const beforeDelete = yield* client.get("delete-test-key");
        expect(beforeDelete).toBe("delete-test-value");

        // Delete it
        const deleted = yield* client.delete("delete-test-key");
        expect(deleted).toBe(true);

        // Verify it's gone
        const afterDelete = yield* client.get("delete-test-key");
        expect(afterDelete).toBeUndefined();
      }).pipe(Effect.provide(SupermemoryTestLayer));

      const result = await Effect.runPromiseExit(program);
      if (result._tag === "Failure") {
        expect.fail(`Test failed: ${result.cause}`);
      }
    });

    it("should check if memory exists", async () => {
      const program = Effect.gen(function* () {
        const client = yield* SupermemoryClientImpl;

        // Check non-existent key
        const existsBefore = yield* client.exists("exists-test-key");
        expect(existsBefore).toBe(false);

        // Put a memory
        yield* client.put("exists-test-key", "exists-test-value");

        // Check existing key
        const existsAfter = yield* client.exists("exists-test-key");
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
        const client = yield* MemoryStreamClientImpl;

        // Put some test memories
        const memoryClient = yield* SupermemoryClientImpl;
        yield* memoryClient.put("stream-test-1", "value-1");
        yield* memoryClient.put("stream-test-2", "value-2");
        yield* memoryClient.put("stream-test-3", "value-3");

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
        const client = yield* MemoryStreamClientImpl;

        // Put some test memories with searchable content
        const memoryClient = yield* SupermemoryClientImpl;
        yield* memoryClient.put("search-test-1", "apple banana cherry");
        yield* memoryClient.put("search-test-2", "dog cat mouse");
        yield* memoryClient.put("search-test-3", "apple orange grape");

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
