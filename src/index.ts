/**
 * effect-supermemory - Effect-native SDK for Supermemory.ai
 *
 * @since 1.0.0
 * @module index
 */
/** biome-ignore-all assist/source/organizeImports: barrel file */
/** biome-ignore-all lint/performance/noBarrelFile: barrel file */

// HTTP Client exports
export type { HttpClientApi } from "@services/httpClient/api.js";
export {
  AuthorizationError,
  HttpError,
  NetworkError,
  RequestError,
  TooManyRequestsError,
  type HttpClientError,
} from "@services/httpClient/errors.js";
export { HttpClient } from "@services/httpClient/service.js";
export type {
  HttpClientConfigType,
  HttpHeaders,
  HttpMethod,
  HttpPath,
  HttpQueryParams,
  HttpRequestOptions,
  HttpResponse,
  HttpStatusCode,
  HttpUrl,
} from "@services/httpClient/types.js";

// Supermemory HTTP Client exports
export type { SupermemoryHttpClient } from "@services/client/api.js";
export { mapHttpError } from "@services/client/helpers.js";
export { SupermemoryHttpClientService } from "@services/client/service.js";
export { ApiVersions } from "@services/client/types.js";

// Configuration exports
export type { SupermemoryConfig } from "@services/config/api.js";
export {
  SupermemoryConfigFromValues,
  SupermemoryConfigLive,
  SupermemoryConfigService,
} from "@services/config/service.js";

// Domain models
export {
  DeleteResponse,
  DocumentChunk,
  DocumentStatus,
  IngestOptions,
  IngestResponse,
  Metadata,
  SearchDocumentsResponse,
  SearchExecuteResponse,
  SearchMemoriesResponse,
  SearchOptions,
  SupermemoryDocument,
  SupermemoryMemory,
  Threshold,
} from "./Domain.js";

// Error types
export {
  SupermemoryAuthenticationError,
  SupermemoryRateLimitError,
  SupermemoryServerError,
  SupermemoryValidationError,
  type SupermemoryError,
} from "./Errors.js";

// Memories service (V1.0)
export type { MemoriesServiceApi } from "@services/memories/api.js";
export {
  MemoriesService,
  MemoriesServiceLive,
} from "@services/memories/service.js";
export type {
  Memory,
  MemoryAddParams,
  MemoryAddResponse,
  MemoryFilterAnd,
  MemoryFilterOr,
  MemoryListItem,
  MemoryListParams,
  MemoryListResponse,
  MemoryMetadata,
  MemoryStatus,
  MemoryType,
  MemoryUpdateParams,
  MemoryUpdateResponse,
  MemoryUploadFileParams,
  MemoryUploadFileResponse,
  Pagination,
  SortField,
  SortOrder,
} from "@services/memories/types.js";

// Ingest service (deprecated - use MemoriesService)
/** @deprecated Use MemoriesService instead */
export type { IngestServiceOps } from "@services/ingest/api.js";
/** @deprecated Use MemoriesService instead */
export { IngestService, IngestServiceLive } from "@services/ingest/service.js";

// Search service and Filter API
export type { SearchServiceOps } from "@services/search/api.js";
export {
  Filter,
  toJSON,
  type FilterExpression,
} from "@services/search/filterBuilder.js";
export { SearchService, SearchServiceLive } from "@services/search/service.js";

// Connections service (OAuth integrations)
export type { ConnectionsServiceOps } from "@services/connections/api.js";
export {
  ConnectionsService,
  ConnectionsServiceLive,
} from "@services/connections/service.js";
export type {
  Connection,
  ConnectionCreateParams,
  ConnectionCreateResponse,
  ConnectionDeleteByIDResponse,
  ConnectionDeleteByProviderParams,
  ConnectionDeleteByProviderResponse,
  ConnectionDocument,
  ConnectionGetByIDResponse,
  ConnectionGetByTagsParams,
  ConnectionGetByTagsResponse,
  ConnectionImportParams,
  ConnectionImportResponse,
  ConnectionListDocumentsParams,
  ConnectionListDocumentsResponse,
  ConnectionListParams,
  ConnectionListResponse,
  ConnectionMetadata,
  ConnectionProvider,
} from "@services/connections/types.js";

// Settings service (Organization configuration)
export type { SettingsServiceOps } from "@services/settings/api.js";
export {
  SettingsService,
  SettingsServiceLive,
} from "@services/settings/service.js";
export type {
  OrganizationSettings,
  SettingsGetResponse,
  SettingsJsonValue,
  SettingsUpdateParams,
  SettingsUpdateResponse,
} from "@services/settings/types.js";
