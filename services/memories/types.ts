/**
 * Memories Service Types
 *
 * Types derived from the official Supermemory SDK v3.10.0
 *
 * @since 1.0.0
 * @module MemoriesTypes
 */

/**
 * Status of a memory/document in the processing pipeline.
 * @since 1.0.0
 */
export type MemoryStatus =
  | "unknown"
  | "queued"
  | "extracting"
  | "chunking"
  | "embedding"
  | "indexing"
  | "done"
  | "failed";

/**
 * Type of content stored in a memory/document.
 * @since 1.0.0
 */
export type MemoryType =
  | "text"
  | "pdf"
  | "tweet"
  | "google_doc"
  | "google_slide"
  | "google_sheet"
  | "image"
  | "video"
  | "notion_doc"
  | "webpage"
  | "onedrive";

/**
 * Metadata that can be attached to a memory.
 * Keys must be strings. Values can be strings, numbers, booleans, or arrays of strings.
 * @since 1.0.0
 */
export type MemoryMetadata = {
  readonly [key: string]: string | number | boolean | readonly string[];
};

/**
 * Sort order for list operations.
 * @since 1.0.0
 */
export type SortOrder = "asc" | "desc";

/**
 * Fields that can be sorted by.
 * @since 1.0.0
 */
export type SortField = "createdAt" | "updatedAt";

// ============================================================================
// Request Parameters
// ============================================================================

/**
 * Parameters for adding a new memory.
 * @since 1.0.0
 */
export type MemoryAddParams = {
  /**
   * The content to extract and process. Can be plaintext or a URL.
   */
  readonly content: string;

  /**
   * Optional tag for containerizing the document.
   * Max 100 characters, alphanumeric with hyphens and underscores only.
   */
  readonly containerTag?: string;

  /**
   * Optional custom ID from your database.
   * Max 100 characters, alphanumeric with hyphens and underscores only.
   */
  readonly customId?: string;

  /**
   * Optional metadata for the document.
   */
  readonly metadata?: MemoryMetadata;
};

/**
 * Parameters for updating an existing memory.
 * @since 1.0.0
 */
export type MemoryUpdateParams = {
  /**
   * Optional tag for containerizing the document.
   */
  readonly containerTag?: string;

  /**
   * The content to update.
   */
  readonly content?: string;

  /**
   * Optional custom ID.
   */
  readonly customId?: string;

  /**
   * Optional metadata to update.
   */
  readonly metadata?: MemoryMetadata;
};

/**
 * Filter expression for list operations.
 * @since 1.0.0
 */
export type MemoryFilterOr = {
  readonly OR: readonly unknown[];
};

/**
 * Filter expression for list operations.
 * @since 1.0.0
 */
export type MemoryFilterAnd = {
  readonly AND: readonly unknown[];
};

/**
 * Parameters for listing memories.
 * @since 1.0.0
 */
export type MemoryListParams = {
  /**
   * Optional container tags to filter by.
   */
  readonly containerTags?: readonly string[];

  /**
   * Optional filters to apply.
   */
  readonly filters?: MemoryFilterOr | MemoryFilterAnd;

  /**
   * Whether to include content in the response.
   * Warning: Can make responses significantly larger.
   */
  readonly includeContent?: boolean;

  /**
   * Number of items per page.
   */
  readonly limit?: number;

  /**
   * Sort order.
   */
  readonly order?: SortOrder;

  /**
   * Page number to fetch.
   */
  readonly page?: number;

  /**
   * Field to sort by.
   */
  readonly sort?: SortField;
};

/**
 * Parameters for uploading a file.
 * @since 1.0.0
 */
export type MemoryUploadFileParams = {
  /**
   * File to upload (Blob, File, or Buffer).
   */
  readonly file: Blob | File | Buffer;

  /**
   * Optional container tags as JSON string or single string.
   */
  readonly containerTags?: string;

  /**
   * Optional file type override.
   */
  readonly fileType?: string;

  /**
   * Optional metadata as JSON string.
   */
  readonly metadata?: string;

  /**
   * MIME type (required for image/video).
   */
  readonly mimeType?: string;
};

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response from adding a memory.
 * @since 1.0.0
 */
export type MemoryAddResponse = {
  readonly id: string;
  readonly status: string;
};

/**
 * Response from updating a memory.
 * @since 1.0.0
 */
export type MemoryUpdateResponse = {
  readonly id: string;
  readonly status: string;
};

/**
 * Response from uploading a file.
 * @since 1.0.0
 */
export type MemoryUploadFileResponse = {
  readonly id: string;
  readonly status: string;
};

/**
 * Full memory/document object returned from get.
 * @since 1.0.0
 */
export type Memory = {
  readonly id: string;
  readonly connectionId: string | null;
  readonly content: string | null;
  readonly createdAt: string;
  readonly customId: string | null;
  readonly metadata: unknown;
  readonly ogImage: string | null;
  readonly raw: unknown;
  readonly source: string | null;
  readonly status: MemoryStatus;
  readonly summary: string | null;
  readonly summaryEmbeddingModel: string | null;
  readonly summaryEmbeddingModelNew: string | null;
  readonly summaryEmbeddingNew: readonly number[] | null;
  readonly title: string | null;
  readonly type: MemoryType;
  readonly updatedAt: string;
  readonly containerTags?: readonly string[];
  readonly url?: string | null;
};

/**
 * Memory item in list response (subset of full Memory).
 * @since 1.0.0
 */
export type MemoryListItem = {
  readonly id: string;
  readonly connectionId: string | null;
  readonly createdAt: string;
  readonly customId: string | null;
  readonly metadata: unknown;
  readonly status: MemoryStatus;
  readonly summary: string | null;
  readonly title: string | null;
  readonly type: MemoryType;
  readonly updatedAt: string;
  readonly containerTags?: readonly string[];
  readonly content?: string;
};

/**
 * Pagination metadata.
 * @since 1.0.0
 */
export type Pagination = {
  readonly currentPage: number;
  readonly totalItems: number;
  readonly totalPages: number;
  readonly limit?: number;
};

/**
 * Response from listing memories.
 * @since 1.0.0
 */
export type MemoryListResponse = {
  readonly memories: readonly MemoryListItem[];
  readonly pagination: Pagination;
};
