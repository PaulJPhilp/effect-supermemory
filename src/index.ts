// Re-export configuration and errors
/** biome-ignore-all assist/source/organizeImports: we want to re-export all the things */
/** biome-ignore-all lint/performance/noBarrelFile: we want to re-export all the things */

// HTTP Client exports
export type { HttpClientApi } from "../services/httpClient/api.js";
export {
  AuthorizationError,
  HttpError,
  NetworkError,
  RequestError,
  TooManyRequestsError,
  type HttpClientError,
} from "../services/httpClient/errors.js";
export { HttpClient } from "../services/httpClient/service.js";
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
} from "../services/httpClient/types.js";

// In-Memory Client exports
export type { InMemoryClientApi } from "../services/inMemoryClient/api.js";
export {
  MemoryBatchPartialFailure,
  MemoryNotFoundError,
  MemoryValidationError,
  type MemoryBatchError,
  type MemoryError,
  type MemoryFailureError,
} from "../services/inMemoryClient/errors.js";
export { getOption as inMemoryGetOption } from "../services/inMemoryClient/helpers.js";
export { InMemoryClient } from "../services/inMemoryClient/service.js";

// Memory Stream Client exports
export type { MemoryStreamClientApi } from "../services/memoryStreamClient/api.js";
export {
  StreamReadError,
  type StreamError,
} from "../services/memoryStreamClient/errors.js";
export {
  decodeUint8Array,
  isCompleteJson,
  ndjsonDecoder,
  splitIntoLines,
  validateJson,
  validateUtf8Chunk,
  type ParseError,
  type ValidationError,
} from "../services/memoryStreamClient/helpers.js";
export { MemoryStreamClient } from "../services/memoryStreamClient/service.js";
export type { MemoryStreamClientConfigType } from "../services/memoryStreamClient/types.js";
export type { SupermemoryClientApi } from "../services/supermemoryClient/api.js";
export { getOption as supermemoryGetOption } from "../services/supermemoryClient/helpers.js";
// Supermemory Client exports
export {
  MemoryNotFoundError as SupermemoryMemoryNotFoundError,
  MemoryValidationError as SupermemoryMemoryValidationError,
  translateHttpClientError,
  type MemoryError as SupermemoryMemoryError,
} from "../services/supermemoryClient/errors.js";
export {
  encodeBasicAuth,
  fromBase64,
  isValidBase64,
  safeFromBase64,
  safeToBase64,
  toBase64,
  validateBase64,
} from "../services/supermemoryClient/helpers.js";
export { SupermemoryClient } from "../services/supermemoryClient/service.js";
export {
  SupermemoryId,
  type RetryScheduleConfig,
  type SupermemoryApiMemory,
  type SupermemoryBatchResponse,
  type SupermemoryBatchResponseItem,
  type SupermemoryClientConfigType,
} from "../services/supermemoryClient/types.js";
// Re-export HTTP client
export {
  ApiVersions,
  mapHttpError,
  SupermemoryHttpClientLive,
  SupermemoryHttpClientService,
  type SupermemoryHttpClient,
} from "./Client.js";
export {
  SupermemoryConfigFromValues,
  SupermemoryConfigLive,
  SupermemoryConfigService,
  type SupermemoryConfig,
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
  type SupermemoryError,
} from "./Errors.js";
// Re-export Ingest service
export {
  IngestServiceLive,
  IngestServiceTag,
  type IngestService,
} from "./Ingest.js";
// Re-export Search service and Filter API
export {
  Filter,
  SearchServiceLive,
  SearchServiceTag,
  toJSON,
  type FilterExpression,
  type SearchService,
} from "./Search.js";
