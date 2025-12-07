/**
 * Supermemory Client Service API
 *
 * @since 1.0.0
 * @module SupermemoryClient
 */

import type {
  MemoryKey,
  MemoryValue,
  MemoryValueMap,
} from "@services/inMemoryClient/types.js";
import type { Effect } from "effect";
import type { MemoryError } from "./errors.js";

/**
 * API interface for the Supermemory HTTP-backed memory client.
 *
 * This interface provides methods for interacting with the Supermemory API,
 * including storing, retrieving, and managing key-value pairs in a remote
 * memory store. All values are automatically Base64 encoded/decoded for
 * transmission over HTTP.
 *
 * @since 1.0.0
 */
// biome-ignore lint: Interface preferred for object contracts
export interface SupermemoryClientApi {
  /**
   * Stores a key-value pair in Supermemory.
   * The value is automatically Base64 encoded before transmission.
   * If the key already exists, its value is updated.
   *
   * @param key - The memory key (must be a non-empty string)
   * @param value - The memory value (must be a string)
   * @returns Effect that succeeds with void on successful storage, or fails with MemoryError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* SupermemoryClient;
   *   yield* client.put("my-key", "my-value");
   *   const result = yield* client.get("my-key");
   *   return result; // "my-value"
   * }).pipe(Effect.provide(SupermemoryClient.Default({
   *   namespace: "my-namespace",
   *   baseUrl: "https://api.supermemory.dev",
   *   apiKey: "sk-...",
   * })));
   * ```
   */
  readonly put: (
    key: MemoryKey,
    value: MemoryValue
  ) => Effect.Effect<void, MemoryError>;

  /**
   * Retrieves a value from Supermemory by its key.
   * The value is automatically Base64 decoded upon retrieval.
   *
   * @param key - The memory key to retrieve
   * @returns Effect that succeeds with the string value if found, undefined if not found, or fails with MemoryError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* SupermemoryClient;
   *   const value = yield* client.get("existing-key"); // "some-value"
   *   const missing = yield* client.get("non-existent-key"); // undefined
   *   return { value, missing };
   * }).pipe(Effect.provide(SupermemoryClient.Default({ ... })));
   * ```
   */
  readonly get: (
    key: MemoryKey
  ) => Effect.Effect<string | undefined, MemoryError>;

  /**
   * Deletes a key-value pair from Supermemory.
   * This operation is idempotent; attempting to delete a non-existent key will not result in an error.
   *
   * @param key - The memory key to delete
   * @returns Effect that succeeds with `true` if the key was found and deleted, `false` if the key did not exist, or fails with MemoryError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* SupermemoryClient;
   *   yield* client.put("to-delete", "value");
   *   const deleted = yield* client.delete("to-delete"); // true
   *   const notFound = yield* client.delete("non-existent"); // false
   *   return { deleted, notFound };
   * }).pipe(Effect.provide(SupermemoryClient.Default({ ... })));
   * ```
   */
  readonly delete: (key: MemoryKey) => Effect.Effect<boolean, MemoryError>;

  /**
   * Checks if a key exists in Supermemory.
   *
   * @param key - The memory key to check
   * @returns Effect that succeeds with `true` if the key exists, `false` otherwise, or fails with MemoryError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* SupermemoryClient;
   *   yield* client.put("existing-key", "value");
   *   const exists = yield* client.exists("existing-key"); // true
   *   const notExists = yield* client.exists("non-existent-key"); // false
   *   return { exists, notExists };
   * }).pipe(Effect.provide(SupermemoryClient.Default({ ... })));
   * ```
   */
  readonly exists: (key: MemoryKey) => Effect.Effect<boolean, MemoryError>;

  /**
   * Clears all key-value pairs from the current namespace in Supermemory.
   *
   * @returns Effect that succeeds with void on successful clearing, or fails with MemoryError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* SupermemoryClient;
   *   yield* client.put("key1", "value1");
   *   yield* client.clear();
   *   const count = yield* client.exists("key1"); // false
   *   return count;
   * }).pipe(Effect.provide(SupermemoryClient.Default({ ... })));
   * ```
   */
  readonly clear: () => Effect.Effect<void, MemoryError>;

  /**
   * Stores multiple key-value pairs in Supermemory as a batch operation.
   * All values are automatically Base64 encoded before transmission.
   * If a key already exists, its value is updated.
   *
   * @param items - An array of objects, each with a `key` and `value`.
   * @returns Effect that succeeds with void on successful batch storage, or fails with MemoryError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* SupermemoryClient;
   *   yield* client.putMany([
   *     { key: "batch-key1", value: "batch-value1" },
   *     { key: "batch-key2", value: "batch-value2" },
   *   ]);
   * }).pipe(Effect.provide(SupermemoryClient.Default({ ... })));
   * ```
   */
  readonly putMany: (
    items: ReadonlyArray<{ key: MemoryKey; value: MemoryValue }>
  ) => Effect.Effect<void, MemoryError>;

  /**
   * Deletes multiple keys from Supermemory as a batch operation.
   * This operation is idempotent; attempting to delete non-existent keys will not result in an error.
   *
   * @param keys - An array of keys to delete.
   * @returns Effect that succeeds with void on successful batch deletion, or fails with MemoryError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* SupermemoryClient;
   *   yield* client.deleteMany(["batch-key1", "batch-key2"]);
   * }).pipe(Effect.provide(SupermemoryClient.Default({ ... })));
   * ```
   */
  readonly deleteMany: (
    keys: readonly MemoryKey[]
  ) => Effect.Effect<void, MemoryError>;

  /**
   * Retrieves multiple values from Supermemory by their keys as a batch operation.
   * All values are automatically Base64 decoded upon retrieval.
   * The returned map will contain `undefined` for keys that were not found.
   *
   * @param keys - An array of keys to retrieve.
   * @returns Effect that succeeds with a ReadonlyMap where keys map to their string values or `undefined`, or fails with MemoryError.
   *
   * @example
   * ```typescript
   * const program = Effect.gen(function* () {
   *   const client = yield* SupermemoryClient;
   *   const results = yield* client.getMany(["key1", "non-existent-key"]);
   *   return results; // Map { "key1" => "value1", "non-existent-key" => undefined }
   * }).pipe(Effect.provide(SupermemoryClient.Default({ ... })));
   * ```
   */
  readonly getMany: (
    keys: readonly MemoryKey[]
  ) => Effect.Effect<MemoryValueMap, MemoryError>;
}
