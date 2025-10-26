import { describe, it, expect } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { MemoryClientLiveTag, MemoryConfigTag, Default } from "../service.js";
import type { MemoryConfig as MemoryConfigType } from "../types.js";

describe("MemoryClient", () => {
  const testLayer = Default.pipe(
    Layer.provide(Layer.succeed(MemoryConfigTag, { namespace: "test" } as MemoryConfigType))
  );

  it("puts and gets a value", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientLiveTag;
      yield* client.put("key1", "value1");
      const result = yield* client.get("key1");
      expect(result).toBe("value1");
    });

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  });

  it("returns undefined for missing key", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientLiveTag;
      const result = yield* client.get("missing");
      expect(result).toBeUndefined();
    });

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  });

  it("deletes a value (idempotent)", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientLiveTag;
      yield* client.put("key2", "value2");

      const deleted = yield* client.delete("key2");
      expect(deleted).toBe(true);

      const missing = yield* client.get("key2");
      expect(missing).toBeUndefined();

      const deletedAgain = yield* client.delete("key2");
      expect(deletedAgain).toBe(false);
    });

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  });

  it("checks existence", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientLiveTag;
      yield* client.put("key3", "value3");

      const exists1 = yield* client.exists("key3");
      expect(exists1).toBe(true);

      const exists2 = yield* client.exists("missing");
      expect(exists2).toBe(false);
    });

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  });

  it("clears all values in namespace", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientLiveTag;
      yield* client.put("key4", "value4");
      yield* client.put("key5", "value5");

      yield* client.clear();

      const result1 = yield* client.get("key4");
      const result2 = yield* client.get("key5");

      expect(result1).toBeUndefined();
      expect(result2).toBeUndefined();
    });

    await Effect.runPromise(program.pipe(Effect.provide(testLayer)));
  });

  it("isolates namespaces", async () => {
    // Test namespace 1
    const program1 = Effect.gen(function* () {
      const client = yield* MemoryClientLiveTag;
      yield* client.put("shared_key", "namespace1_value");
      const result = yield* client.get("shared_key");
      expect(result).toBe("namespace1_value");
    });

    await Effect.runPromise(program1.pipe(Effect.provide(testLayer)));

    // Test namespace 2 (different layer)
    const ns2Layer = Default.pipe(
      Layer.provide(Layer.succeed(MemoryConfigTag, {
        namespace: "namespace2",
      } as MemoryConfigType))
    );

    const program2 = Effect.gen(function* () {
      const client2 = yield* MemoryClientLiveTag;
      const result = yield* client2.get("shared_key");
      expect(result).toBeUndefined();

      yield* client2.put("shared_key", "namespace2_value");
      const result2 = yield* client2.get("shared_key");
      expect(result2).toBe("namespace2_value");
    });

    await Effect.runPromise(program2.pipe(Effect.provide(ns2Layer)));
  });
});
