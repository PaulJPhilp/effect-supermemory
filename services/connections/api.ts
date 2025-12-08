/**
 * ConnectionsService API
 *
 * @since 1.0.0
 * @module Connections
 */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */

import type { SupermemoryError } from "@/Errors.js";
import type { Effect } from "effect";
import type {
  ConnectionCreateParams,
  ConnectionCreateResponse,
  ConnectionDeleteByIDResponse,
  ConnectionDeleteByProviderParams,
  ConnectionDeleteByProviderResponse,
  ConnectionGetByIDResponse,
  ConnectionGetByTagsParams,
  ConnectionGetByTagsResponse,
  ConnectionImportParams,
  ConnectionImportResponse,
  ConnectionListDocumentsParams,
  ConnectionListDocumentsResponse,
  ConnectionListParams,
  ConnectionListResponse,
  ConnectionProvider,
} from "./types.js";

/**
 * Connections service interface.
 *
 * Provides methods for managing OAuth connections to external services
 * like Notion, Google Drive, OneDrive, and web crawlers.
 *
 * @since 1.0.0
 * @category Services
 */
export type ConnectionsServiceOps = {
  /**
   * Initialize a new OAuth connection and get authorization URL.
   *
   * @param provider - The OAuth provider to connect.
   * @param params - Optional connection parameters.
   * @returns Effect that resolves to connection creation response with auth link.
   */
  readonly create: (
    provider: ConnectionProvider,
    params?: ConnectionCreateParams
  ) => Effect.Effect<ConnectionCreateResponse, SupermemoryError>;

  /**
   * List all connections.
   *
   * @param params - Optional filter parameters.
   * @returns Effect that resolves to array of connections.
   */
  readonly list: (
    params?: ConnectionListParams
  ) => Effect.Effect<ConnectionListResponse, SupermemoryError>;

  /**
   * Get connection details by ID.
   *
   * @param id - The connection ID.
   * @returns Effect that resolves to connection details.
   */
  readonly getByID: (
    id: string
  ) => Effect.Effect<ConnectionGetByIDResponse, SupermemoryError>;

  /**
   * Get connection details by provider and container tags.
   *
   * @param provider - The OAuth provider.
   * @param params - Parameters including container tags.
   * @returns Effect that resolves to connection details.
   */
  readonly getByTags: (
    provider: ConnectionProvider,
    params: ConnectionGetByTagsParams
  ) => Effect.Effect<ConnectionGetByTagsResponse, SupermemoryError>;

  /**
   * Delete a connection by ID.
   *
   * @param id - The connection ID to delete.
   * @returns Effect that resolves to deletion response.
   */
  readonly deleteByID: (
    id: string
  ) => Effect.Effect<ConnectionDeleteByIDResponse, SupermemoryError>;

  /**
   * Delete connection by provider and container tags.
   *
   * @param provider - The OAuth provider.
   * @param params - Parameters including container tags.
   * @returns Effect that resolves to deletion response.
   */
  readonly deleteByProvider: (
    provider: ConnectionProvider,
    params: ConnectionDeleteByProviderParams
  ) => Effect.Effect<ConnectionDeleteByProviderResponse, SupermemoryError>;

  /**
   * Initiate a manual sync/import of connection data.
   *
   * @param provider - The OAuth provider to sync.
   * @param params - Optional parameters including container tags.
   * @returns Effect that resolves to import status message.
   */
  readonly importData: (
    provider: ConnectionProvider,
    params?: ConnectionImportParams
  ) => Effect.Effect<ConnectionImportResponse, SupermemoryError>;

  /**
   * List documents indexed for a provider.
   *
   * @param provider - The OAuth provider.
   * @param params - Optional parameters including container tags.
   * @returns Effect that resolves to array of documents.
   */
  readonly listDocuments: (
    provider: ConnectionProvider,
    params?: ConnectionListDocumentsParams
  ) => Effect.Effect<ConnectionListDocumentsResponse, SupermemoryError>;
};
