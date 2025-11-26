/**
 * Helper functions for the search client service.
 * 
 * This module provides utility functions for encoding and decoding base64 strings
 * used in search operations and API communications.
 */

/**
 * Converts a string to base64 encoding.
 * 
 * @param str - The string to encode
 * @returns The base64-encoded string
 * 
 * @example
 * ```typescript
 * const encoded = toBase64("hello world");
 * console.log(encoded); // "aGVsbG8gd29ybGQ="
 * ```
 */
export const toBase64 = (str: string): string =>
	Buffer.from(str).toString("base64");

/**
 * Decodes a base64-encoded string back to its original form.
 * 
 * @param b64 - The base64-encoded string to decode
 * @returns The decoded UTF-8 string
 * 
 * @example
 * ```typescript
 * const decoded = fromBase64("aGVsbG8gd29ybGQ=");
 * console.log(decoded); // "hello world"
 * ```
 */
export const fromBase64 = (b64: string): string =>
	Buffer.from(b64, "base64").toString("utf8");
