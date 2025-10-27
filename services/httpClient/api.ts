import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream"; // Import Stream for requestStream return type
import { HttpClientError, HttpRequestOptions } from "./errors.js";

// Basic HTTP request options
export interface HttpRequestOptions {
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  readonly headers?: Record<string, string>;
  readonly body?: unknown; // Will be JSON.stringified for most requests
  readonly queryParams?: Record<string, string>;
}

// Basic HTTP response structure
export interface HttpResponse<T = unknown> {
  readonly status: number;
  readonly headers: Headers;
  readonly body: T;
}

export interface HttpClient {
  /**
   * Sends an HTTP request and returns the response body as JSON.
   * Automatically handles error status codes (>= 400) by transforming to HttpClientError.
   * @param path The path relative to the configured baseUrl.
   * @param options Request options (method, headers, body, etc.).
   */
  readonly request: <T = unknown>(
    path: string,
    options: HttpRequestOptions
  ) => Effect.Effect<HttpResponse<T>, HttpClientError>;

  /**
   * Sends an HTTP request and returns the response body as a Stream of Uint8Array chunks.
   * This is suitable for large responses that should be processed incrementally.
   * The stream ensures proper resource acquisition and release of the underlying HTTP connection.
   */
  readonly requestStream: (
    path: string,
    options: HttpRequestOptions
  ) => Effect.Effect<Stream.Stream<Uint8Array, HttpClientError>, HttpClientError>;
}
