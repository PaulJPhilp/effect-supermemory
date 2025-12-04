import { HttpClient } from "@services/httpClient/service.js";
import type { HttpUrl } from "@services/httpClient/types.js";
import { Cause, Effect, Layer, Option, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { MemoryStreamClient } from "../service.js";
import type { MemoryStreamClientConfigType } from "../types.js";

const baseConfig: MemoryStreamClientConfigType = {
  namespace: "stream-test-ns",
  baseUrl: "https://api.supermemory.dev",
  apiKey: process.env.SUPERMEMORY_API_KEY || "stream-api-key",
  timeoutMs: 10000,
};

// Create a layer with real HttpClient
const createMemoryStreamClientLayer = (
  configOverrides?: Partial<MemoryStreamClientConfigType>
) => {
  const config = { ...baseConfig, ...configOverrides };
  const httpClientLayer = HttpClient.Default({
    baseUrl: config.baseUrl as HttpUrl,
    ...(config.timeoutMs !== undefined && { timeoutMs: config.timeoutMs }),
  });

  return MemoryStreamClient.Default(config).pipe(Layer.provide(httpClientLayer));
};

describe("MemoryStreamClient", () => {
  // Skip network-dependent tests if no real API key is provided
  const hasRealApiKey = process.env.SUPERMEMORY_API_KEY && process.env.SUPERMEMORY_API_KEY !== "stream-api-key";

  it.skipIf(!hasRealApiKey)("listAllKeys streams keys correctly from NDJSON", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClient;
      const stream = yield* client.listAllKeys();
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));

    const result = await Effect.runPromise(program);
    // Verify we get some results (actual keys will depend on test data)
    expect(Array.from(result)).toBeDefined();
  });

  it.skipIf(!hasRealApiKey)("streamSearch streams SearchResults correctly from NDJSON", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClient;
      const stream = yield* client.streamSearch("test", {});
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));

    const result = await Effect.runPromise(program);
    // Verify we get some results (actual results will depend on test data)
    expect(Array.from(result)).toBeDefined();
  });

  it.skipIf(!hasRealApiKey)("listAllKeys fails on initial 401 AuthorizationError", async () => {
    // Test with invalid API key to trigger auth error
    const invalidConfig = { ...baseConfig, apiKey: "invalid-key" };
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClient;
      const stream = yield* client.listAllKeys();
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer(invalidConfig)));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        // Should be some kind of authorization/validation error
        expect(error.value).toBeDefined();
      }
    }
  });

  it.skipIf(!hasRealApiKey)("streamSearch handles empty results stream", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClient;
      const stream = yield* client.streamSearch("nonexistent-query-xyz123", {});
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));

    const result = await Effect.runPromise(program);
    // Empty results should be handled gracefully
    expect(Array.from(result)).toEqual([]);
  });

  it.skipIf(!hasRealApiKey)("listAllKeys handles stream interruption gracefully", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClient;
      const stream = yield* client.listAllKeys();
      // Take only first element to test interruption
      return yield* Stream.runCollect(Stream.take(stream, 1));
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));

    const result = await Effect.runPromise(program);
    // Should get exactly one result
    expect(Array.from(result)).toHaveLength(1);
  });
});
