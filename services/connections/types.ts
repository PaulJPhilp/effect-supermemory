/**
 * ConnectionsService Types
 *
 * Types for OAuth connection management operations.
 * Based on official Supermemory SDK v3.10.0
 *
 * @since 1.0.0
 * @module Connections
 */

/**
 * Supported OAuth providers.
 */
export type ConnectionProvider =
  | "notion"
  | "google-drive"
  | "onedrive"
  | "web-crawler";

/**
 * Metadata for connections.
 */
export type ConnectionMetadata = Record<string, string | number | boolean>;

/**
 * Parameters for creating a new connection.
 */
export type ConnectionCreateParams = {
  readonly containerTags?: readonly string[];
  readonly documentLimit?: number;
  readonly metadata?: ConnectionMetadata | null;
  readonly redirectUrl?: string;
};

/**
 * Response from creating a connection.
 */
export type ConnectionCreateResponse = {
  readonly id: string;
  readonly authLink: string;
  readonly expiresIn: string;
  readonly redirectsTo?: string;
};

/**
 * Parameters for listing connections.
 */
export type ConnectionListParams = {
  readonly containerTags?: readonly string[];
};

/**
 * A single connection item in list response.
 */
export type Connection = {
  readonly id: string;
  readonly createdAt: string;
  readonly provider: string;
  readonly documentLimit?: number;
  readonly email?: string;
  readonly expiresAt?: string;
  readonly metadata?: Record<string, unknown>;
};

/**
 * Response from listing connections.
 */
export type ConnectionListResponse = readonly Connection[];

/**
 * Response from deleting a connection by ID.
 */
export type ConnectionDeleteByIDResponse = {
  readonly id: string;
  readonly provider: string;
};

/**
 * Parameters for deleting by provider.
 */
export type ConnectionDeleteByProviderParams = {
  readonly containerTags: readonly string[];
};

/**
 * Response from deleting a connection by provider.
 */
export type ConnectionDeleteByProviderResponse = {
  readonly id: string;
  readonly provider: string;
};

/**
 * Response from getting a connection by ID.
 */
export type ConnectionGetByIDResponse = {
  readonly id: string;
  readonly createdAt: string;
  readonly provider: string;
  readonly documentLimit?: number;
  readonly email?: string;
  readonly expiresAt?: string;
  readonly metadata?: Record<string, unknown>;
};

/**
 * Parameters for getting by tags.
 */
export type ConnectionGetByTagsParams = {
  readonly containerTags: readonly string[];
};

/**
 * Response from getting a connection by tags.
 */
export type ConnectionGetByTagsResponse = {
  readonly id: string;
  readonly createdAt: string;
  readonly provider: string;
  readonly documentLimit?: number;
  readonly email?: string;
  readonly expiresAt?: string;
  readonly metadata?: Record<string, unknown>;
};

/**
 * Parameters for manual import/sync.
 */
export type ConnectionImportParams = {
  readonly containerTags?: readonly string[];
};

/**
 * Response from import (just a message string).
 */
export type ConnectionImportResponse = string;

/**
 * Parameters for listing documents.
 */
export type ConnectionListDocumentsParams = {
  readonly containerTags?: readonly string[];
};

/**
 * A document item in list documents response.
 */
export type ConnectionDocument = {
  readonly id: string;
  readonly createdAt: string;
  readonly status: string;
  readonly summary: string | null;
  readonly title: string | null;
  readonly type: string;
  readonly updatedAt: string;
};

/**
 * Response from listing documents.
 */
export type ConnectionListDocumentsResponse = readonly ConnectionDocument[];
