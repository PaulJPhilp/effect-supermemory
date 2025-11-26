/**
 * Type definitions for the memory client service.
 * 
 * This module contains all types used throughout the memory client service,
 * including interfaces for memory operations and data structures.
 */

/**
 * Represents a key-value pair for memory storage operations.
 * 
 * @interface MemoryItem
 * @since 1.0.0
 */
export interface MemoryItem {
	/** The unique key for the memory item */
	readonly key: string;
	/** The string value stored in memory */
	readonly value: string;
}

/**
 * Represents a batch operation result for memory operations.
 * 
 * @interface MemoryBatchResult
 * @since 1.0.0
 */
export interface MemoryBatchResult {
	/** The total number of items processed in the batch */
	readonly processed: number;
	/** The number of items that failed to process */
	readonly failed: number;
	/** Array of error messages for failed operations */
	readonly errors: ReadonlyArray<string>;
}

/**
 * Represents the configuration options for memory client operations.
 * 
 * @interface MemoryClientConfig
 * @since 1.0.0
 */
export interface MemoryClientConfig {
	/** The namespace to isolate memory operations */
	readonly namespace: string;
	/** Optional maximum size for the memory store (in items) */
	readonly maxSize?: number;
	/** Optional TTL for memory items (in milliseconds) */
	readonly ttl?: number;
}

/**
 * Type alias for a namespace string used in memory operations.
 * 
 * @type {string}
 * @since 1.0.0
 */
export type Namespace = string;

/**
 * Type alias for a memory key string.
 * 
 * @type {string}
 * @since 1.0.0
 */
export type MemoryKey = string;

/**
 * Type alias for a memory value string.
 * 
 * @type {string}
 * @since 1.0.0
 */
export type MemoryValue = string;
