/** @effect-diagnostics classSelfMismatch:skip-file */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */
/**
 * @since 1.0.0
 * @module Connections
 */

import { API_ENDPOINTS, HTTP_METHODS, SERVICE_TAGS } from "@/Constants.js";
import type { SupermemoryError } from "@/Errors.js";
import { SupermemoryHttpClientService } from "@services/client/service.js";
import { Effect } from "effect";
import type { ConnectionsServiceOps } from "./api.js";
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
 * Create the connections service implementation.
 *
 * @since 1.0.0
 * @category Constructors
 */
const makeConnectionsService = Effect.gen(function* () {
  const httpClient = yield* SupermemoryHttpClientService;

  const create = (
    provider: ConnectionProvider,
    params?: ConnectionCreateParams
  ): Effect.Effect<ConnectionCreateResponse, SupermemoryError> =>
    Effect.gen(function* () {
      const body = params ?? {};
      return yield* httpClient.request<
        ConnectionCreateResponse,
        unknown,
        never
      >(HTTP_METHODS.POST, API_ENDPOINTS.CONNECTIONS.BY_PROVIDER(provider), {
        body,
      });
    }).pipe(Effect.withSpan("supermemory.connections.create"));

  const list = (
    params?: ConnectionListParams
  ): Effect.Effect<ConnectionListResponse, SupermemoryError> =>
    Effect.gen(function* () {
      const body = params ?? {};
      return yield* httpClient.request<ConnectionListResponse, unknown, never>(
        HTTP_METHODS.POST,
        API_ENDPOINTS.CONNECTIONS.BASE,
        { body }
      );
    }).pipe(Effect.withSpan("supermemory.connections.list"));

  const getByID = (
    id: string
  ): Effect.Effect<ConnectionGetByIDResponse, SupermemoryError> =>
    Effect.gen(function* () {
      return yield* httpClient.request<
        ConnectionGetByIDResponse,
        unknown,
        never
      >(HTTP_METHODS.GET, API_ENDPOINTS.CONNECTIONS.BY_ID(id), {});
    }).pipe(Effect.withSpan("supermemory.connections.getByID"));

  const getByTags = (
    provider: ConnectionProvider,
    params: ConnectionGetByTagsParams
  ): Effect.Effect<ConnectionGetByTagsResponse, SupermemoryError> =>
    Effect.gen(function* () {
      return yield* httpClient.request<
        ConnectionGetByTagsResponse,
        unknown,
        never
      >(
        HTTP_METHODS.POST,
        `${API_ENDPOINTS.CONNECTIONS.BY_PROVIDER(provider)}/tags`,
        { body: params }
      );
    }).pipe(Effect.withSpan("supermemory.connections.getByTags"));

  const deleteByID = (
    id: string
  ): Effect.Effect<ConnectionDeleteByIDResponse, SupermemoryError> =>
    Effect.gen(function* () {
      return yield* httpClient.request<
        ConnectionDeleteByIDResponse,
        unknown,
        never
      >(HTTP_METHODS.DELETE, API_ENDPOINTS.CONNECTIONS.BY_ID(id), {});
    }).pipe(Effect.withSpan("supermemory.connections.deleteByID"));

  const deleteByProvider = (
    provider: ConnectionProvider,
    params: ConnectionDeleteByProviderParams
  ): Effect.Effect<ConnectionDeleteByProviderResponse, SupermemoryError> =>
    Effect.gen(function* () {
      return yield* httpClient.request<
        ConnectionDeleteByProviderResponse,
        unknown,
        never
      >(HTTP_METHODS.DELETE, API_ENDPOINTS.CONNECTIONS.BY_PROVIDER(provider), {
        body: params,
      });
    }).pipe(Effect.withSpan("supermemory.connections.deleteByProvider"));

  const importData = (
    provider: ConnectionProvider,
    params?: ConnectionImportParams
  ): Effect.Effect<ConnectionImportResponse, SupermemoryError> =>
    Effect.gen(function* () {
      const body = params ?? {};
      return yield* httpClient.request<
        ConnectionImportResponse,
        unknown,
        never
      >(
        HTTP_METHODS.POST,
        `${API_ENDPOINTS.CONNECTIONS.BY_PROVIDER(provider)}/import`,
        { body }
      );
    }).pipe(Effect.withSpan("supermemory.connections.import"));

  const listDocuments = (
    provider: ConnectionProvider,
    params?: ConnectionListDocumentsParams
  ): Effect.Effect<ConnectionListDocumentsResponse, SupermemoryError> =>
    Effect.gen(function* () {
      const body = params ?? {};
      return yield* httpClient.request<
        ConnectionListDocumentsResponse,
        unknown,
        never
      >(
        HTTP_METHODS.POST,
        `${API_ENDPOINTS.CONNECTIONS.BY_PROVIDER(provider)}/documents`,
        { body }
      );
    }).pipe(Effect.withSpan("supermemory.connections.listDocuments"));

  return {
    create,
    list,
    getByID,
    getByTags,
    deleteByID,
    deleteByProvider,
    importData,
    listDocuments,
  } satisfies ConnectionsServiceOps;
});

/**
 * Context tag and Service for ConnectionsService.
 *
 * @since 1.0.0
 * @category Services
 */
export class ConnectionsService extends Effect.Service<ConnectionsServiceOps>()(
  SERVICE_TAGS.CONNECTIONS,
  {
    accessors: true,
    effect: makeConnectionsService,
  }
) {}

/**
 * Live layer for ConnectionsService.
 *
 * @since 1.0.0
 * @category Layers
 */
export const ConnectionsServiceLive = ConnectionsService.Default;
