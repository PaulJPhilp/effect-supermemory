/**
 * Error exports for the supermemory client service.
 *
 * This module re-exports memory error types from the inMemoryClient service.
 * SupermemoryClient-specific error translation logic is in helpers.ts.
 */

export type { MemoryError } from "@services/inMemoryClient/errors.js";
// Re-export MemoryError types for convenience
/** biome-ignore lint/performance/noBarrelFile: convenience re-export for service-specific error namespace */
export {
  MemoryNotFoundError,
  MemoryValidationError,
} from "@services/inMemoryClient/errors.js";
