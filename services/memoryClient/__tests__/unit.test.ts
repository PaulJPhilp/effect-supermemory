import * as Effect from "effect/Effect";
import { describe, expect, it } from "vitest";
import { MemoryClientImpl } from "../service.js"; // Import the service class

describe("MemoryClient (Parameterized Service)", () => {
  // Layer for a specific namespace, used for most tests
  const testNamespaceLayer = MemoryClientImpl.Default("test-ns");

  it("puts and gets a value within its namespace", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientImpl;
      yield* client.put("key1", "value1");
      const result = yield* client.get("key1");
      return result;
    }).pipe(Effect.provide(testNamespaceLayer)); // Provide the namespace-specific layer

    const result = await Effect.runPromise(program);
    expect(result).toBe("value1");
  });

  it("returns undefined for missing key within its namespace", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientImpl;
      const result = yield* client.get("nonexistent");
      return result;
    }).pipe(Effect.provide(testNamespaceLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBeUndefined();
  });

  it("deletes a key (idempotent) within its namespace", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientImpl;
      yield* client.put("key2", "value2");

      const deleted = yield* client.delete("key2");
      expect(deleted).toBe(true);

      const missing = yield* client.get("key2");
      expect(missing).toBeUndefined();

      // Idempotent delete
      const deletedAgain = yield* client.delete("key2");
      expect(deletedAgain).toBe(false);
    }).pipe(Effect.provide(testNamespaceLayer));

    await Effect.runPromise(program);
  });

  it("checks existence within its namespace", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientImpl;
      yield* client.put("key3", "value3");
      const exists1 = yield* client.exists("key3");
      const exists2 = yield* client.exists("missing");
      return { exists1, exists2 };
    }).pipe(Effect.provide(testNamespaceLayer));

    const result = await Effect.runPromise(program);
    expect(result.exists1).toBe(true);
    expect(result.exists2).toBe(false);
  });

  it("clears all values within its namespace", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MemoryClientImpl;
      yield* client.put("key4", "value4");
      yield* client.put("key5", "value5");
      yield* client.clear();
      const result1 = yield* client.get("key4");
      const result2 = yield* client.get("key5");
      return { result1, result2 };
    }).pipe(Effect.provide(testNamespaceLayer));

    const clearResult = await Effect.runPromise(program);
    expect(clearResult.result1).toBeUndefined();
    expect(clearResult.result2).toBeUndefined();
  });

  it("isolates different namespaces correctly", async () => {
    const ns1Layer = MemoryClientImpl.Default("namespace-one");
    const ns2Layer = MemoryClientImpl.Default("namespace-two");

    const programNs1 = Effect.gen(function* () {
      const client = yield* MemoryClientImpl;
      yield* client.put("shared_key", "value_from_ns1");
      return yield* client.get("shared_key");
    }).pipe(Effect.provide(ns1Layer));

    const programNs2 = Effect.gen(function* () {
      const client = yield* MemoryClientImpl;
      const initialGet = yield* client.get("shared_key"); // Should be undefined in ns2
      yield* client.put("shared_key", "value_from_ns2");
      const finalGet = yield* client.get("shared_key");
      return { initialGet, finalGet };
    }).pipe(Effect.provide(ns2Layer));

    const result1 = await Effect.runPromise(programNs1);
    const ns2Result = await Effect.runPromise(programNs2);

    expect(result1).toBe("value_from_ns1");
    expect(ns2Result.initialGet).toBeUndefined(); // Key in ns1 should not be visible in ns2
    expect(ns2Result.finalGet).toBe("value_from_ns2");
  });
});
