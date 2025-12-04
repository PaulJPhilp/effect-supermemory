/**
 * @since 1.0.0
 * @module Constants
 */

/**
 * API Endpoints used across services.
 * @since 1.0.0
 */
export const API_ENDPOINTS = {
  V1: {
    MEMORIES: "/api/v1/memories",
    MEMORIES_BATCH: "/api/v1/memories/batch",
    MEMORIES_BATCH_GET: "/api/v1/memories/batchGet",
    SEARCH: "/api/v1/search",
  },
  V3: {
    SEARCH: "/search",
    DOCUMENTS: "/documents",
  },
  V4: {
    SEARCH: "/search",
  },
  STREAM: {
    KEYS: (namespace: string) => `/v1/keys/${encodeURIComponent(namespace)}`,
    SEARCH: (namespace: string) =>
      `/v1/search/${encodeURIComponent(namespace)}/stream`,
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
