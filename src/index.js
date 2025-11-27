// Re-export configuration and errors
export * from "../services/httpClient/index.js";
export {
  getOption as memoryGetOption,
  MemoryBatchPartialFailure,
  MemoryClientImpl,
  MemoryNotFoundError,
  MemoryValidationError,
} from "../services/memoryClient/index.js";
export * from "../services/memoryStreamClient/index.js";
export * from "../services/supermemoryClient/errors.js";
export * from "../services/supermemoryClient/helpers.js";
export {
  getOption as supermemoryGetOption,
  SupermemoryClientImpl,
} from "../services/supermemoryClient/index.js";
export * from "../services/supermemoryClient/types.js";
// Re-export HTTP client
export {
  ApiVersions,
  mapHttpError,
  SupermemoryHttpClientLive,
  SupermemoryHttpClientService,
} from "./Client.js";
export {
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
  SupermemoryRateLimitError,
  SupermemoryServerError,
  SupermemoryValidationError,
} from "./Errors.js";
// Re-export Ingest service
export { IngestServiceLive, IngestServiceTag } from "./Ingest.js";
// Re-export Search service and Filter API
export {
  Filter,
  SearchServiceLive,
  SearchServiceTag,
  toJSON,
} from "./Search.js";
