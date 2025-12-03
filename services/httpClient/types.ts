import type { HttpBody } from "@effect/platform/HttpBody";
import type { Brand } from "effect";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

/**
 * HTTP path (relative path starting with `/`).
 * Used for paths relative to the configured baseUrl.
 * Accepts string literals starting with `/` or template literals, or the branded HttpPath type.
 */
export type HttpPath = `/${string}` | (string & Brand.Brand<"HttpPath">);

/**
 * HTTP status code (typically 100-599).
 */
export type HttpStatusCode = number;

/**
 * HTTP headers as a record of string key-value pairs.
 */
export type HttpHeaders = Record<string, string>;

/**
 * HTTP query parameters as a record of string key-value pairs.
 */
export type HttpQueryParams = Record<string, string>;

/**
 * HTTP URL (absolute or relative URL string).
 * Used for base URLs and full URLs in error messages.
 */
export type HttpUrl = string & Brand.Brand<"HttpUrl">;

/**
 * HTTP request options for configuring an HTTP request.
 */
export type HttpRequestOptions = {
  readonly method: HttpMethod;
  readonly headers?: HttpHeaders;
  readonly body?: HttpBody;
  readonly queryParams?: HttpQueryParams;
};

/**
 * HTTP response structure containing status, headers, and body.
 */
export type HttpResponse<T = HttpBody> = {
  readonly status: HttpStatusCode;
  readonly headers: Headers;
  readonly body: T;
};

export type HttpClientConfigType = {
  readonly baseUrl: HttpUrl;
  readonly headers?: HttpHeaders;
  readonly timeoutMs?: number;
  readonly fetch?: typeof globalThis.fetch; // Allows injecting custom fetch for testing
};
