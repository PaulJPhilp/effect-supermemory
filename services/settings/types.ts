/**
 * SettingsService Types
 *
 * Types for organization settings management.
 * Based on official Supermemory SDK v3.10.0
 *
 * @since 1.0.0
 * @module Settings
 */

/**
 * Flexible JSON value type for include/exclude items.
 */
export type SettingsJsonValue =
  | string
  | number
  | boolean
  | Record<string, unknown>
  | readonly unknown[]
  | null;

/**
 * Organization settings configuration.
 */
export type OrganizationSettings = {
  /** Chunk size for document processing */
  readonly chunkSize?: number | null;
  /** Items to exclude from processing */
  readonly excludeItems?: SettingsJsonValue;
  /** LLM filter prompt */
  readonly filterPrompt?: string | null;
  /** Google Drive OAuth client ID (custom key) */
  readonly googleDriveClientId?: string | null;
  /** Google Drive OAuth client secret (custom key) */
  readonly googleDriveClientSecret?: string | null;
  /** Whether custom Google Drive key is enabled */
  readonly googleDriveCustomKeyEnabled?: boolean | null;
  /** Items to include in processing */
  readonly includeItems?: SettingsJsonValue;
  /** Notion OAuth client ID (custom key) */
  readonly notionClientId?: string | null;
  /** Notion OAuth client secret (custom key) */
  readonly notionClientSecret?: string | null;
  /** Whether custom Notion key is enabled */
  readonly notionCustomKeyEnabled?: boolean | null;
  /** OneDrive OAuth client ID (custom key) */
  readonly onedriveClientId?: string | null;
  /** OneDrive OAuth client secret (custom key) */
  readonly onedriveClientSecret?: string | null;
  /** Whether custom OneDrive key is enabled */
  readonly onedriveCustomKeyEnabled?: boolean | null;
  /** Whether to use LLM filtering */
  readonly shouldLLMFilter?: boolean | null;
};

/**
 * Parameters for updating settings.
 */
export type SettingsUpdateParams = OrganizationSettings;

/**
 * Response from getting settings.
 */
export type SettingsGetResponse = OrganizationSettings;

/**
 * Response from updating settings.
 */
export type SettingsUpdateResponse = {
  readonly orgId: string;
  readonly orgSlug: string;
  readonly updated: OrganizationSettings;
};
