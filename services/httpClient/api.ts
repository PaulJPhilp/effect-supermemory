import type { HttpBody } from "@effect/platform/HttpBody";
import type { Effect, Stream } from "effect";
import type { HttpClientError } from "./errors.js";
import type { HttpPath, HttpRequestOptions, HttpResponse } from "./types.js";

export type HttpClient = {
  /**
   * Sends an HTTP request and returns the response body as JSON.
   * Automatically handles error status codes (>= 400) by transforming to HttpClientError.
   * @param path The path relative to the configured baseUrl (must start with `/`).
   * @param options Request options (method, headers, body, etc.).
   */
  readonly request: <T = HttpBody>(
    path: HttpPath,
    options: HttpRequestOptions
  ) => Effect.Effect<HttpResponse<T>, HttpClientError>;

  /**
   * Sends an HTTP request and returns the response body as a Stream of Uint8Array chunks.
   * This is suitable for large responses that should be processed incrementally.
   * The stream ensures proper resource acquisition and release of the underlying HTTP connection.
   * @param path The path relative to the configured baseUrl (must start with `/`).
   * @param options Request options (method, headers, body, etc.).
   */
  readonly requestStream: (
    path: HttpPath,
    options: HttpRequestOptions
  ) => Effect.Effect<
    Stream.Stream<Uint8Array, HttpClientError>,
    HttpClientError
  >;
};
