/**
 * Client service types
 *
 * @since 1.0.0
 * @module Client
 */

/**
 * API version paths for different endpoints.
 *
 * @since 1.0.0
 * @category Constants
 */
export const ApiVersions = {
  V3: "/v3",
  V4: "/v4",
} as const;

// Re-export API types for backward compatibility
export type { SupermemoryHttpClient } from "./api.js";
