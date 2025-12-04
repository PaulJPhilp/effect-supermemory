import type { Effect } from "effect";
import type { HttpClient } from "../httpClient/service.js"; // For R type
import type { MemoryBatchError, MemoryError } from "./errors.js"; // Import batch error
import type { MemoryValueMap } from "./types.js";

/**
 * Core interface for in-memory operations in a namespace-isolated key-value store.
 *
 * All operations are Effect-native and return discriminated errors on failure.
 * The client is parameterized by namespace, ensuring complete isolation between
 * different namespaces within the same service instance.
 *
 * This is an in-memory implementation that stores data in a local Map.
 * For persistent storage, use SupermemoryClient instead.
 *
 * @example
 * ```typescript
 * const program = Effect.gen(function* () {
 *   const client = yield* InMemoryClient;
 *   yield* client.put("key", "value");
 *   const result = yield* client.get("key");
 *   return result; // "value"
 * }).pipe(Effect.provide(InMemoryClient.Default("my-namespace")));
 * ```
 */
// biome-ignore lint: Interface preferred for object contracts
export interface InMemoryClientApi {
  /**
   * Stores a key-value pair in memory.
   *
   * @param key - The memory key (must be a non-empty string, max 255 characters)
   * @param value - The memory value (must be a string, max 1MB)
   * @returns Effect that succeeds with void or fails with MemoryError
   *
   * @example
   * ```typescript
   * yield* client.put("user:123", "John Doe");
   * ```
   */
  readonly put: (
    key: string,
    value: string
  ) => Effect.Effect<void, MemoryError>;

  /**
   * Retrieves a value by key.
   *
   * Returns `undefined` if the key does not exist (semantic 404 handling).
   * This is not an error condition - use `exists()` to check for key presence.
   *
   * @param key - The memory key to retrieve
   * @returns Effect that produces the value or undefined if not found, or fails with MemoryError
   *
   * @example
   * ```typescript
   * const value = yield* client.get("user:123");
   * if (value === undefined) {
   *   // Key doesn't exist
   * }
   * ```
   */
  readonly get: (key: string) => Effect.Effect<string | undefined, MemoryError>;

  /**
   * Deletes a key-value pair from memory.
   *
   * This operation is idempotent - deleting a non-existent key returns `false`
   * without error. Returns `true` if the key was deleted, `false` if it didn't exist.
   *
   * @param key - The memory key to delete
   * @returns Effect that produces true if deleted, false if not found, or fails with MemoryError
   *
   * @example
   * ```typescript
   * const deleted = yield* client.delete("user:123");
   * // deleted === true if key existed, false otherwise
   * ```
   */
  readonly delete: (key: string) => Effect.Effect<boolean, MemoryError>;

  /**
   * Checks if a key exists in memory.
   *
   * @param key - The memory key to check
   * @returns Effect that produces true if key exists, false otherwise, or fails with MemoryError
   *
   * @example
   * ```typescript
   * const exists = yield* client.exists("user:123");
   * if (exists) {
   *   // Key exists
   * }
   * ```
   */
  readonly exists: (key: string) => Effect.Effect<boolean, MemoryError>;

  /**
   * Clears all key-value pairs in the current namespace.
   *
   * This operation affects only the namespace associated with this client instance.
   * Other namespaces remain unaffected.
   *
   * @returns Effect that succeeds with void or fails with MemoryError
   *
   * @example
   * ```typescript
   * yield* client.clear();
   * // All keys in this namespace are now deleted
   * ```
   */
  readonly clear: () => Effect.Effect<void, MemoryError>;

  /**
   * Stores multiple key-value pairs in a single operation.
   *
   * Batch operations are more efficient than individual `put()` calls.
   * If any items fail, returns `MemoryBatchPartialFailure` with details about
   * which items succeeded and which failed.
   *
   * @param items - Array of key-value pairs to store
   * @returns Effect that succeeds with void, or fails with MemoryError or MemoryBatchPartialFailure
   * @requires HttpClient - Requires HttpClient service in the Effect context
   *
   * @example
   * ```typescript
   * yield* client.putMany([
   *   { key: "user:1", value: "Alice" },
   *   { key: "user:2", value: "Bob" },
   * ]);
   * ```
   */
  readonly putMany: (
    items: ReadonlyArray<{ key: string; value: string }>
  ) => Effect.Effect<void, MemoryError | MemoryBatchError, HttpClient>;

  /**
   * Deletes multiple keys in a single operation.
   *
   * Batch operations are more efficient than individual `delete()` calls.
   * This operation is idempotent - non-existent keys are ignored.
   * If any deletions fail, returns `MemoryBatchPartialFailure` with details.
   *
   * @param keys - Array of keys to delete
   * @returns Effect that succeeds with void, or fails with MemoryError or MemoryBatchPartialFailure
   * @requires HttpClient - Requires HttpClient service in the Effect context
   *
   * @example
   * ```typescript
   * yield* client.deleteMany(["user:1", "user:2", "user:3"]);
   * ```
   */
  readonly deleteMany: (
    keys: readonly string[]
  ) => Effect.Effect<void, MemoryError | MemoryBatchError, HttpClient>;

  /**
   * Retrieves multiple values by their keys in a single operation.
   *
   * Batch operations are more efficient than individual `get()` calls.
   * Returns a Map where keys that don't exist have `undefined` as their value.
   * If any retrievals fail, returns `MemoryBatchPartialFailure` with details.
   *
   * @param keys - Array of keys to retrieve
   * @returns Effect that produces a Map of key-value pairs (undefined for missing keys),
   *          or fails with MemoryError or MemoryBatchPartialFailure
   * @requires HttpClient - Requires HttpClient service in the Effect context
   *
   * @example
   * ```typescript
   * const results = yield* client.getMany(["user:1", "user:2", "user:3"]);
   * const user1 = results.get("user:1"); // string | undefined
   * ```
   */
  readonly getMany: (
    keys: readonly string[]
  ) => Effect.Effect<
    MemoryValueMap,
    MemoryError | MemoryBatchError,
    HttpClient
  >;
}
