/**
 * SettingsService API
 *
 * @since 1.0.0
 * @module Settings
 */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */

import type { SupermemoryError } from "@/Errors.js";
import type { Effect } from "effect";
import type {
  SettingsGetResponse,
  SettingsUpdateParams,
  SettingsUpdateResponse,
} from "./types.js";

/**
 * Settings service interface.
 *
 * Provides methods for managing organization-level settings
 * including chunking configuration, OAuth credentials, and LLM filtering.
 *
 * @since 1.0.0
 * @category Services
 */
export type SettingsServiceOps = {
  /**
   * Get current organization settings.
   *
   * @returns Effect that resolves to current settings.
   */
  readonly get: () => Effect.Effect<SettingsGetResponse, SupermemoryError>;

  /**
   * Update organization settings.
   *
   * @param params - Settings to update (partial update supported).
   * @returns Effect that resolves to update response with new settings.
   */
  readonly update: (
    params?: SettingsUpdateParams
  ) => Effect.Effect<SettingsUpdateResponse, SupermemoryError>;
};
