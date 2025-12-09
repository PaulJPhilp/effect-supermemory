/**
 * @since 1.0.0
 * @module Constants
 */

/**
 * API Endpoints used across services.
 * Based on official Supermemory SDK v3.10.0
 * @since 1.0.0
 */
export const API_ENDPOINTS = {
  /**
   * Memories (documents) endpoints
   */
  MEMORIES: {
    BASE: "/v1/memories",
    BY_ID: (id: string) => `/v1/memories/${encodeURIComponent(id)}`,
    UPLOAD: "/v1/memories/upload",
  },
  /**
   * Search endpoints
   */
  SEARCH: {
    DOCUMENTS: "/v1/search/documents",
    EXECUTE: "/v1/search",
    MEMORIES: "/v1/search/memories",
  },
  /**
   * Connections endpoints
   */
  CONNECTIONS: {
    BASE: "/v1/connections",
    BY_ID: (id: string) => `/v1/connections/${encodeURIComponent(id)}`,
    BY_PROVIDER: (provider: string) =>
      `/v1/connections/${encodeURIComponent(provider)}`,
  },
  /**
   * Settings endpoints
   */
  SETTINGS: {
    BASE: "/v1/settings",
  },
} as const;

/**
 * HTTP Headers and standard values.
 * @since 1.0.0
 */
export const HTTP_HEADERS = {
  AUTHORIZATION: "Authorization",
  CONTENT_TYPE: "Content-Type",
  ACCEPT: "Accept",
  RETRY_AFTER: "retry-after",
  SUPERMEMORY_NAMESPACE: "X-Supermemory-Namespace",
} as const;

export const HTTP_VALUES = {
  APPLICATION_JSON: "application/json",
  APPLICATION_NDJSON: "application/x-ndjson",
  BEARER_PREFIX: "Bearer ",
} as const;

/**
 * HTTP Status Codes.
 * @since 1.0.0
 */
export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR_MIN: 500,
  SERVER_ERROR_MAX: 599,
} as const;

/**
 * Telemetry Span Names.
 * @since 1.0.0
 */
export const SPANS = {
  SEARCH_DOCUMENTS: "supermemory.search.documents",
  SEARCH_EXECUTE: "supermemory.search.execute",
  SEARCH_MEMORIES: "supermemory.search.memories",
  INGEST_ADD_TEXT: "supermemory.ingest.addText",
  INGEST_ADD_URL: "supermemory.ingest.addUrl",
  HTTP_METHOD: (method: string) => `supermemory.${method.toLowerCase()}`,
} as const;

/**
 * Telemetry Attribute Keys.
 * @since 1.0.0
 */
export const TELEMETRY_ATTRIBUTES = {
  QUERY_LENGTH: "supermemory.query_length",
  TOP_K: "supermemory.top_k",
  THRESHOLD: "supermemory.threshold",
  HAS_FILTERS: "supermemory.has_filters",
  CONTENT_LENGTH: "supermemory.content_length",
  HAS_TAGS: "supermemory.has_tags",
  HAS_CUSTOM_ID: "supermemory.has_custom_id",
  URL: "supermemory.url",
  VERSION: "supermemory.version",
  PATH: "supermemory.path",
  METHOD: "supermemory.method",
} as const;

/**
 * Domain Constraints and Limits.
 * @since 1.0.0
 */
export const LIMITS = {
  SCORE_MIN: 0,
  SCORE_MAX: 1,
  TOP_K_MIN: 1,
  TOP_K_MAX: 100,
} as const;

/**
 * Filter type tags for discriminated union types.
 * @since 1.0.0
 */
export const FILTER_TAGS = {
  TAG_FILTER: "TagFilter",
  METADATA_FILTER: "MetadataFilter",
  SCORE_FILTER: "ScoreFilter",
  AND_FILTER: "AndFilter",
  OR_FILTER: "OrFilter",
  NOT_FILTER: "NotFilter",
} as const;

/**
 * Filter operator strings for metadata field comparisons.
 * @since 1.0.0
 */
export const FILTER_OPERATORS = {
  EQUAL: "eq",
  NOT_EQUAL: "ne",
  LESS_THAN: "lt",
  LESS_THAN_OR_EQUAL: "lte",
  GREATER_THAN: "gt",
  GREATER_THAN_OR_EQUAL: "gte",
  IN: "in",
} as const;

/**
 * JSON query operators used in API filter expressions.
 * @since 1.0.0
 */
export const FILTER_JSON_OPERATORS = {
  NOT_EQUAL: "$ne",
  LESS_THAN: "$lt",
  LESS_THAN_OR_EQUAL: "$lte",
  GREATER_THAN: "$gt",
  GREATER_THAN_OR_EQUAL: "$gte",
  IN: "$in",
  AND: "$and",
  OR: "$or",
  NOT: "$not",
} as const;

/**
 * API field names used in request/response JSON.
 * @since 1.0.0
 */
export const API_FIELD_NAMES = {
  TAG: "tag",
  METADATA_PREFIX: "metadata.",
  SCORE: "score",
  KEY: "key",
  ID: "id",
  VALUE: "value",
  NAMESPACE: "namespace",
  ITEMS: "items",
  KEYS: "keys",
  CONTENT: "content",
  TAGS: "tags",
  CUSTOM_ID: "customId",
  METADATA: "metadata",
  URL: "url",
  RESULTS: "results",
  STATUS: "status",
  ERROR: "error",
  CORRELATION_ID: "correlationId",
  QUERY: "query",
  TOP_K: "topK",
  THRESHOLD: "threshold",
  RERANK: "rerank",
  FILTERS: "filters",
  CONTAINER_TAG: "containerTag",
  CONTAINER_TAGS: "containerTags",
} as const;

/**
 * Error tag strings for discriminated error types.
 * @since 1.0.0
 */
export const ERROR_TAGS = {
  SUPERMEMORY_VALIDATION_ERROR: "SupermemoryValidationError",
  SUPERMEMORY_AUTHENTICATION_ERROR: "SupermemoryAuthenticationError",
  SUPERMEMORY_RATE_LIMIT_ERROR: "SupermemoryRateLimitError",
  SUPERMEMORY_SERVER_ERROR: "SupermemoryServerError",
  MEMORY_NOT_FOUND_ERROR: "MemoryNotFoundError",
  MEMORY_VALIDATION_ERROR: "MemoryValidationError",
  MEMORY_BATCH_PARTIAL_FAILURE: "MemoryBatchPartialFailure",
  HTTP_ERROR: "HttpError",
  NETWORK_ERROR: "NetworkError",
  REQUEST_ERROR: "RequestError",
  AUTHORIZATION_ERROR: "AuthorizationError",
  TOO_MANY_REQUESTS_ERROR: "TooManyRequestsError",
  SEARCH_QUERY_ERROR: "SearchQueryError",
  STREAM_READ_ERROR: "StreamReadError",
} as const;

/**
 * Error messages used throughout the codebase.
 * @since 1.0.0
 */
export const ERROR_MESSAGES = {
  QUERY_MUST_BE_NON_EMPTY_STRING: "Query must be a non-empty string",
  CONTENT_MUST_BE_NON_EMPTY_STRING: "Content must be a non-empty string",
  URL_MUST_BE_VALID_STRING: "URL must be a valid string",
  INVALID_URL_FORMAT: "Invalid URL format",
  BATCH_OPERATION_FAILED_INVALID_RESPONSE:
    "Batch operation failed: invalid response",
  AUTHORIZATION_FAILED: "Authorization failed",
  ITEM_NOT_PROCESSED_BY_BACKEND: "Item not processed by backend.",
  BAD_REQUEST_FOR_ITEM: "Bad request for item",
  ITEM_FAILED_WITH_STATUS: "Item failed with status",
  FAILED_TO_PARSE_JSON: "Failed to parse JSON",
  INVALID_UTF8_ENCODING: "Invalid UTF-8 encoding",
  INVALID_JSON: "Invalid JSON",
  HTTP_REQUEST_FAILED: "HTTP request failed",
  API_REQUEST_FAILED: "API request failed",
  NETWORK_ERROR: "Network error",
  HTTP_CLIENT_ERROR: "HTTP client error",
  FAILED_TO_PARSE_KEY_FROM_LINE: "Failed to parse key from line",
  FAILED_TO_PARSE_SEARCH_RESULT_FROM_LINE:
    "Failed to parse search result from line",
  EXPECTED_STRING_RESPONSE_BODY: "Expected string response body",
  INVALID_BASE64_STRING: "Invalid base64 string",
  FAILED_TO_ENCODE_TO_BASE64: "Failed to encode to base64",
  FAILED_TO_DECODE_FROM_BASE64: "Failed to decode from base64",
  UNKNOWN: "Unknown",
  UNKNOWN_REQUEST_ERROR: "Unknown request error",
  REQUEST_TIMED_OUT_OR_ABORTED: "Request timed out or aborted",
  UNAUTHORIZED: "Unauthorized",
  FAILED_TO_PARSE_RESPONSE_JSON: "Failed to parse response JSON",
  RESPONSE_VALIDATION_FAILED: "Response validation failed",
  REQUEST_CREATION_FAILED: "Request creation failed",
  SEARCH_REQUEST_FAILED: "Search request failed",
} as const;

/**
 * HTTP method strings.
 * @since 1.0.0
 */
export const HTTP_METHODS = {
  GET: "GET",
  POST: "POST",
  PATCH: "PATCH",
  PUT: "PUT",
  DELETE: "DELETE",
} as const;

/**
 * Encoding values used for text and binary data.
 * @since 1.0.0
 */
export const ENCODING = {
  UTF8: "utf-8",
  UTF8_ALT: "utf8",
  BASE64: "base64",
} as const;

/**
 * Query parameter names used in API requests.
 * @since 1.0.0
 */
export const QUERY_PARAMS = {
  QUERY: "q",
  LIMIT: "limit",
} as const;

/**
 * Service context tag names for Effect.Service.
 * @since 1.0.0
 */
export const SERVICE_TAGS = {
  MEMORIES: "@effect-supermemory/Memories",
  SEARCH: "@effect-supermemory/Search",
  CONNECTIONS: "@effect-supermemory/Connections",
  SETTINGS: "@effect-supermemory/Settings",
  /** @deprecated Use MEMORIES instead */
  INGEST: "@effect-supermemory/Ingest",
} as const;
