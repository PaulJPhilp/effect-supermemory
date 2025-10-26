import { describe, it, expect } from "vitest";
import * as Effect from "effect/Effect";
import { MemoryClientLive, Default } from "../service.js";

describe("MemoryClient", () => {
  it("puts and gets a value", async () => {
    await Effect.runPromise(Default.put("key1", "value1"));
    const result = await Effect.runPromise(Default.get("key1"));
    expect(result).toBe("value1");
  });

  it("returns undefined for missing key", async () => {
    const result = await Effect.runPromise(Default.get("nonexistent"));
    expect(result).toBeUndefined();
  });

  it("deletes a key (idempotent)", async () => {
    await Effect.runPromise(Default.put("key2", "value2"));
    const deleted = await Effect.runPromise(Default.delete("key2"));
    const missing = await Effect.runPromise(Default.get("key2"));
    expect(deleted).toBe(true);
    expect(missing).toBeUndefined();

    // Idempotent delete
    const deletedAgain = await Effect.runPromise(Default.delete("key2"));
    expect(deletedAgain).toBe(false);
  });

  it("checks existence", async () => {
    await Effect.runPromise(Default.put("key3", "value3"));
    const exists1 = await Effect.runPromise(Default.exists("key3"));
    const exists2 = await Effect.runPromise(Default.exists("missing"));
    expect(exists1).toBe(true);
    expect(exists2).toBe(false);
  });

  it("clears all values", async () => {
    await Effect.runPromise(Default.put("key4", "value4"));
    await Effect.runPromise(Default.put("key5", "value5"));
    await Effect.runPromise(Default.clear());
    const result1 = await Effect.runPromise(Default.get("key4"));
    const result2 = await Effect.runPromise(Default.get("key5"));
    expect(result1).toBeUndefined();
    expect(result2).toBeUndefined();
  });

  it("multiple independent stores (separate service instances)", async () => {
    // Create two separate MemoryClientLive instances for namespace isolation
    const store1 = new MemoryClientLive();
    const store2 = new MemoryClientLive();

    await Effect.runPromise(store1.put("shared_key", "store1_value"));
    await Effect.runPromise(store2.put("shared_key", "store2_value"));

    const result1 = await Effect.runPromise(store1.get("shared_key"));
    const result2 = await Effect.runPromise(store2.get("shared_key"));

    expect(result1).toBe("store1_value");
    expect(result2).toBe("store2_value");
  });
});
