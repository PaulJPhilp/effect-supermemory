// Re-export configuration and errors

export * from "../services/httpClient/index.js";
export {
  getOption as memoryGetOption,
  type MemoryBatchError,
  MemoryBatchPartialFailure,
  MemoryClient,
  MemoryClientImpl,
  MemoryError,
  type MemoryFailureError,
  MemoryNotFoundError,
  MemoryValidationError,
} from "../services/memoryClient/index.js";
export * from "../services/memoryStreamClient/index.js";
export * from "../services/supermemoryClient/errors.js";
export * from "../services/supermemoryClient/helpers.js";
export {
  getOption as supermemoryGetOption,
  SupermemoryClient,
  SupermemoryClientConfigType,
  SupermemoryClientImpl,
} from "../services/supermemoryClient/index.js";
export * from "../services/supermemoryClient/types.js";
// Re-export HTTP client
export {
  ApiVersions,
  mapHttpError,
  type SupermemoryHttpClient,
  SupermemoryHttpClientLive,
  SupermemoryHttpClientService,
} from "./Client.js";
export {
  type SupermemoryConfig,
  SupermemoryConfigFromValues,
  SupermemoryConfigLive,
  SupermemoryConfigService,
} from "./Config.js";
// Re-export domain models
export {
  DeleteResponse,
  DocumentChunk,
  DocumentStatus,
  IngestOptions,
  IngestResponse,
  Metadata,
  SearchDocumentsResponse,
  SearchMemoriesResponse,
  SearchOptions,
  SupermemoryDocument,
  SupermemoryMemory,
  Threshold,
} from "./Domain.js";
export {
  SupermemoryAuthenticationError,
  type SupermemoryError,
  SupermemoryRateLimitError,
  SupermemoryServerError,
  SupermemoryValidationError,
} from "./Errors.js";
// Re-export Ingest service
export {
  type IngestService,
  IngestServiceLive,
  IngestServiceTag,
} from "./Ingest.js";
// Re-export Search service and Filter API
export {
  Filter,
  type FilterExpression,
  type SearchService,
  SearchServiceLive,
  SearchServiceTag,
  toJSON,
} from "./Search.js";
