// Re-export configuration and errors
export {
	SupermemoryConfigFromValues, SupermemoryConfigLive, SupermemoryConfigService, type SupermemoryConfig
} from "./Config.js";

export {
	SupermemoryAuthenticationError,
	SupermemoryRateLimitError, SupermemoryServerError, SupermemoryValidationError, type SupermemoryError
} from "./Errors.js";

// Re-export domain models
export {
	DeleteResponse, DocumentChunk, DocumentStatus, IngestOptions, IngestResponse, Metadata, SearchDocumentsResponse,
	SearchMemoriesResponse, SearchOptions, SupermemoryDocument,
	SupermemoryMemory, Threshold
} from "./Domain.js";

// Re-export HTTP client
export {
	ApiVersions, SupermemoryHttpClientLive, SupermemoryHttpClientService, mapHttpError, type SupermemoryHttpClient
} from "./Client.js";

// Re-export Ingest service
export {
	IngestServiceLive, IngestServiceTag, type IngestService
} from "./Ingest.js";

// Re-export Search service and Filter API
export {
	Filter, SearchServiceLive, SearchServiceTag, toJSON, type FilterExpression, type SearchService
} from "./Search.js";

export {
	MemoryBatchPartialFailure,
	MemoryClient,
	MemoryClientImpl,
	MemoryError, MemoryNotFoundError,
	MemoryValidationError, getOption as memoryGetOption, type MemoryBatchError,
	type MemoryFailureError
} from "../services/memoryClient/index.js";

export * from "../services/httpClient/index.js";

export * from "../services/supermemoryClient/errors.js";
export * from "../services/supermemoryClient/helpers.js";
export {
	SupermemoryClient,
	SupermemoryClientConfigType,
	SupermemoryClientImpl,
	getOption as supermemoryGetOption
} from "../services/supermemoryClient/index.js";
export * from "../services/supermemoryClient/types.js";

export * from "../services/memoryStreamClient/index.js";
