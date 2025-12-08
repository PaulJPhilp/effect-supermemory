/**
 * Type definitions for the memory client service.
 *
 * This module contains all types used throughout the memory client service,
 * including interfaces for memory operations and data structures.
 */

import { Brand } from "effect";
import { MAX_NAMESPACE_LENGTH } from "./constants.js";

// Top-level regex for namespace validation (performance optimization)
const NAMESPACE_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Represents a map of memory keys to their values, where values may be undefined
 * if the key does not exist. Used for batch retrieval operations like `getMany`.
 *
 * @type MemoryValueMap
 * @since 1.0.0
 */
export type MemoryValueMap = ReadonlyMap<string, string | undefined>;

/**
 * Represents a key-value pair for memory storage operations.
 *
 * @interface MemoryItem
 * @since 1.0.0
 */
export type MemoryItem = {
  /** The unique key for the memory item (max 255 characters) */
  readonly key: MemoryKey;
  /** The string value stored in memory (max 1MB) */
  readonly value: MemoryValue;
};

/**
 * Represents a batch operation result for memory operations.
 *
 * @interface MemoryBatchResult
 * @since 1.0.0
 */
export type MemoryBatchResult = {
  /** The total number of items processed in the batch (non-negative integer) */
  readonly processed: NonNegativeInteger;
  /** The number of items that failed to process (non-negative integer) */
  readonly failed: NonNegativeInteger;
  /** Array of error messages for failed operations */
  readonly errors: readonly string[];
};

/**
 * Represents the configuration options for memory client operations.
 *
 * @interface MemoryClientConfig
 * @since 1.0.0
 */
export type MemoryClientConfig = {
  /** The namespace to isolate memory operations (validated namespace string) */
  readonly namespace: Namespace;
  /** Optional maximum size for the memory store (in items, must be positive integer) */
  readonly maxSize?: PositiveInteger;
  /** Optional TTL for memory items (in milliseconds, must be positive integer) */
  readonly ttl?: PositiveInteger;
};

/**
 * Branded type for a namespace string used in memory operations.
 * Represents a validated namespace (non-empty, alphanumeric with underscores/hyphens, max 64 characters).
 *
 * @since 1.0.0
 */
export type Namespace = string & Brand.Brand<"Namespace">;

/**
 * Constructor for Namespace that validates the value meets namespace requirements.
 *
 * @param namespace - The string to validate and brand as a namespace
 * @returns A branded Namespace value
 * @throws BrandErrors if the value is not a valid namespace
 *
 * @example
 * ```typescript
 * const ns: Namespace = Namespace("my-namespace"); // Valid
 * const ns2: Namespace = Namespace("user_123"); // Valid
 * const invalid: Namespace = Namespace("invalid namespace"); // Throws error (contains space)
 * const invalid2: Namespace = Namespace(""); // Throws error (empty)
 * ```
 */
export const Namespace = Brand.refined<Namespace>(
  (ns) => {
    if (!ns || typeof ns !== "string" || ns.length === 0) {
      return false;
    }
    if (!NAMESPACE_PATTERN.test(ns)) {
      return false;
    }
    if (ns.length > MAX_NAMESPACE_LENGTH) {
      return false;
    }
    return true;
  },
  (ns) => {
    if (!ns || typeof ns !== "string" || ns.length === 0) {
      return Brand.error("Namespace must be a non-empty string");
    }
    if (!NAMESPACE_PATTERN.test(ns)) {
      return Brand.error(
        "Namespace can only contain letters, numbers, underscores, and hyphens"
      );
    }
    if (ns.length > MAX_NAMESPACE_LENGTH) {
      return Brand.error(
        `Namespace must be ${MAX_NAMESPACE_LENGTH} characters or less`
      );
    }
    return Brand.error(`Invalid namespace: ${ns}`);
  }
);

/**
 * Branded type for a memory key string.
 * Represents a validated memory key (max 255 characters, non-empty).
 *
 * @type {string & Brand.Brand<"MemoryKey">}
 * @since 1.0.0
 */
export type MemoryKey = string & Brand.Brand<"MemoryKey">;

/**
 * Branded type for a memory value string.
 * Represents a validated memory value (max 1MB, must be a string).
 *
 * @type {string & Brand.Brand<"MemoryValue">}
 * @since 1.0.0
 */
export type MemoryValue = string & Brand.Brand<"MemoryValue">;

/**
 * Branded type for a non-negative integer (0 or positive).
 * Used for counts, indices, and quantities that cannot be negative.
 *
 * @since 1.0.0
 */
export type NonNegativeInteger = number & Brand.Brand<"NonNegativeInteger">;

/**
 * Constructor for NonNegativeInteger that validates the value is a non-negative integer.
 *
 * @param n - The number to validate and brand
 * @returns A branded NonNegativeInteger value
 * @throws BrandErrors if the value is not a non-negative integer
 *
 * @example
 * ```typescript
 * const count: NonNegativeInteger = NonNegativeInteger(5); // Valid
 * const zero: NonNegativeInteger = NonNegativeInteger(0); // Valid
 * const invalid: NonNegativeInteger = NonNegativeInteger(-1); // Throws error
 * const invalid2: NonNegativeInteger = NonNegativeInteger(3.14); // Throws error
 * ```
 */
export const NonNegativeInteger = Brand.refined<NonNegativeInteger>(
  (n) => Number.isInteger(n) && n >= 0,
  (n) => Brand.error(`Expected ${n} to be a non-negative integer`)
);

/**
 * Branded type for a positive integer (greater than 0).
 * Used for sizes, limits, and quantities that must be positive.
 *
 * @since 1.0.0
 */
export type PositiveInteger = number & Brand.Brand<"PositiveInteger">;

/**
 * Constructor for PositiveInteger that validates the value is a positive integer.
 *
 * @param n - The number to validate and brand
 * @returns A branded PositiveInteger value
 * @throws BrandErrors if the value is not a positive integer
 *
 * @example
 * ```typescript
 * const size: PositiveInteger = PositiveInteger(100); // Valid
 * const invalid: PositiveInteger = PositiveInteger(0); // Throws error
 * const invalid2: PositiveInteger = PositiveInteger(-1); // Throws error
 * const invalid3: PositiveInteger = PositiveInteger(3.14); // Throws error
 * ```
 */
export const PositiveInteger = Brand.refined<PositiveInteger>(
  (n) => Number.isInteger(n) && n > 0,
  (n) => Brand.error(`Expected ${n} to be a positive integer`)
);

/**
 * Branded type for API keys with validation.
 * Represents a validated API key (non-empty string).
 *
 * @since 1.0.0
 */
export type ApiKey = string & Brand.Brand<"ApiKey">;

/**
 * Constructor for ApiKey that validates the value is a non-empty string.
 *
 * @param key - The string to validate and brand as an API key
 * @returns A branded ApiKey value
 * @throws BrandErrors if the value is not a valid API key
 *
 * @example
 * ```typescript
 * const key: ApiKey = ApiKey("sk-abc123"); // Valid
 * const invalid: ApiKey = ApiKey(""); // Throws error (empty)
 * ```
 */
export const ApiKey = Brand.refined<ApiKey>(
  (key) => typeof key === "string" && key.length > 0,
  (key) => Brand.error(`ApiKey must be a non-empty string, got: ${String(key)}`)
);

import type { HttpUrl } from "@services/httpClient/types.js";

/**
 * Branded type for HTTP URLs with validation.
 * Represents a validated HTTP/HTTPS URL string.
 * Extends HttpUrl to ensure compatibility with HttpClient.
 *
 * @since 1.0.0
 */
export type ValidatedHttpUrl = HttpUrl & Brand.Brand<"ValidatedHttpUrl">;

/**
 * Constructor for ValidatedHttpUrl that validates the value is a valid HTTP/HTTPS URL.
 *
 * @param url - The string to validate and brand as an HTTP URL
 * @returns A branded ValidatedHttpUrl value
 * @throws BrandErrors if the value is not a valid HTTP URL
 *
 * @example
 * ```typescript
 * const url: ValidatedHttpUrl = ValidatedHttpUrl("https://api.example.com"); // Valid
 * const invalid: ValidatedHttpUrl = ValidatedHttpUrl("not-a-url"); // Throws error
 * ```
 */
export const ValidatedHttpUrl = Brand.refined<ValidatedHttpUrl>(
  (url) => {
    if (!url || typeof url !== "string" || url.length === 0) {
      return false;
    }
    try {
      const parsed = new URL(url);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  },
  (url) => {
    if (!url || typeof url !== "string" || url.length === 0) {
      return Brand.error("ValidatedHttpUrl must be a non-empty string");
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return Brand.error(
          `ValidatedHttpUrl must use http:// or https:// protocol, got: ${parsed.protocol}`
        );
      }
    } catch {
      return Brand.error(
        `ValidatedHttpUrl must be a valid URL, got: ${String(url)}`
      );
    }
    return Brand.error(`Invalid HTTP URL: ${String(url)}`);
  }
);
