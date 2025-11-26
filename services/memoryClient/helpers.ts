/**
 * Helper functions for the memory client service.
 * 
 * This module provides utility functions for memory operations,
 * validation, and data transformation.
 */

import * as Effect from "effect/Effect";
import { MemoryValidationError } from "./errors.js";
import { MemoryItem, MemoryKey, MemoryValue, Namespace } from "./types.js";

/**
 * Validates a memory key to ensure it meets requirements.
 * 
 * @param key - The memory key to validate
 * @returns Effect that fails with MemoryError if key is invalid
 * 
 * @example
 * ```typescript
 * const result = await validateKey("valid-key").pipe(
 *   Effect.runPromise
 * );
 * ```
 */
export const validateKey = (key: MemoryKey): Effect.Effect<MemoryKey, MemoryValidationError> =>
	Effect.sync(() => {
		if (!key || typeof key !== "string") {
			throw new MemoryValidationError({ message: "Key must be a non-empty string" });
		}
		if (key.length > 255) {
			throw new MemoryValidationError({ message: "Key must be 255 characters or less" });
		}
		return key;
	});

/**
 * Validates a memory value to ensure it meets requirements.
 * 
 * @param value - The memory value to validate
 * @returns Effect that fails with MemoryValidationError if value is invalid
 * 
 * @example
 * ```typescript
 * const result = await validateValue("valid value").pipe(
 *   Effect.runPromise
 * );
 * ```
 */
export const validateValue = (value: MemoryValue): Effect.Effect<MemoryValue, MemoryValidationError> =>
	Effect.sync(() => {
		if (typeof value !== "string") {
			throw new MemoryValidationError({ message: "Value must be a string" });
		}
		if (value.length > 1024 * 1024) { // 1MB limit
			throw new MemoryValidationError({ message: "Value must be 1MB or less" });
		}
		return value;
	});

/**
 * Validates a namespace to ensure it meets requirements.
 * 
 * @param namespace - The namespace to validate
 * @returns Effect that fails with MemoryValidationError if namespace is invalid
 * 
 * @example
 * ```typescript
 * const result = await validateNamespace("valid-namespace").pipe(
 *   Effect.runPromise
 * );
 * ```
 */
export const validateNamespace = (namespace: Namespace): Effect.Effect<Namespace, MemoryValidationError> =>
	Effect.sync(() => {
		if (!namespace || typeof namespace !== "string") {
			throw new MemoryValidationError({ message: "Namespace must be a non-empty string" });
		}
		if (!/^[a-zA-Z0-9_-]+$/.test(namespace)) {
			throw new MemoryValidationError({
				message: "Namespace can only contain letters, numbers, underscores, and hyphens"
			});
		}
		if (namespace.length > 64) {
			throw new MemoryValidationError({ message: "Namespace must be 64 characters or less" });
		}
		return namespace;
	});

/**
 * Creates a namespaced key by combining namespace and key.
 * 
 * @param namespace - The namespace to use
 * @param key - The key to namespace
 * @returns The namespaced key in format "namespace:key"
 * 
 * @example
 * ```typescript
 * const namespacedKey = createNamespacedKey("user", "123");
 * console.log(namespacedKey); // "user:123"
 * ```
 */
export const createNamespacedKey = (namespace: Namespace, key: MemoryKey): string =>
	`${namespace}:${key}`;

/**
 * Validates and creates a memory item with proper validation.
 * 
 * @param key - The memory key
 * @param value - The memory value
 * @returns Effect that produces a validated MemoryItem
 * 
 * @example
 * ```typescript
 * const item = await createMemoryItem("key", "value").pipe(
 *   Effect.runPromise
 * );
 * ```
 */
export const createMemoryItem = (
	key: MemoryKey,
	value: MemoryValue
): Effect.Effect<MemoryItem, MemoryValidationError> =>
	Effect.all([validateKey(key), validateValue(value)]).pipe(
		Effect.map(([validKey, validValue]) => ({
			key: validKey,
			value: validValue,
		}))
	);

/**
 * Extracts the original key from a namespaced key.
 * 
 * @param namespacedKey - The namespaced key in format "namespace:key"
 * @returns The original key without namespace, or undefined if format is invalid
 * 
 * @example
 * ```typescript
 * const key = extractKeyFromNamespaced("user:123");
 * console.log(key); // "123"
 * ```
 */
export const extractKeyFromNamespaced = (namespacedKey: string): string | undefined => {
	const colonIndex = namespacedKey.indexOf(":");
	return colonIndex !== -1 ? namespacedKey.substring(colonIndex + 1) : undefined;
};

/**
 * Checks if a string is a valid namespaced key format.
 * 
 * @param key - The key to check
 * @returns True if the key is in valid "namespace:key" format
 * 
 * @example
 * ```typescript
 * console.log(isNamespacedKey("user:123")); // true
 * console.log(isNamespacedKey("invalid")); // false
 * ```
 */
export const isNamespacedKey = (key: string): boolean =>
	key.includes(":") && key.split(":").length === 2;
