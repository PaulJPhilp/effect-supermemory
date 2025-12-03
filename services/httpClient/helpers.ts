import { Effect } from "effect";
import {
  AuthorizationError,
  type HttpClientError,
  HttpError,
  NetworkError,
  RequestError,
  TooManyRequestsError,
} from "./errors.js";
import type { HttpUrl } from "./types.js";

/**
 * Creates a NetworkError from an unknown error.
 */
export const createNetworkError = (
  error: unknown,
  url: HttpUrl
): NetworkError =>
  new NetworkError({
    cause: error instanceof Error ? error : new Error(String(error)),
    url,
  });

/**
 * Handles non-OK HTTP responses and converts them to appropriate HttpClientError.
 */
export const handleErrorResponse = (
  response: Response,
  url: HttpUrl,
  body?: unknown
): Effect.Effect<never, HttpClientError> => {
  if (response.status === 401 || response.status === 403) {
    return Effect.fail(
      new AuthorizationError({
        reason: `Unauthorized: ${response.statusText}`,
        url,
      })
    );
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    const retryAfterSeconds = retryAfter
      ? Number.parseInt(retryAfter, 10)
      : undefined;
    return Effect.fail(
      new TooManyRequestsError({
        ...(retryAfterSeconds !== undefined ? { retryAfterSeconds } : {}),
        url,
      })
    );
  }
  return Effect.fail(
    new HttpError({
      status: response.status,
      message: response.statusText,
      url,
      body,
    })
  );
};

/**
 * Handles fetch errors and converts them to HttpClientError.
 */
export const handleFetchError = (
  error: unknown,
  url: HttpUrl
): HttpClientError => {
  if (
    error instanceof HttpError ||
    error instanceof NetworkError ||
    error instanceof RequestError ||
    error instanceof AuthorizationError ||
    error instanceof TooManyRequestsError
  ) {
    return error;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new NetworkError({
        cause: new Error("Request timed out or aborted"),
        url,
      });
    }
    return createNetworkError(error, url);
  }
  return new RequestError({
    cause: new Error("Unknown request error"),
    details: error,
  });
};

/**
 * Parses response body based on Content-Type header.
 */
export const parseResponseBody = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get("Content-Type");
  // Handle NDJSON as text (not JSON) since it's newline-delimited
  if (
    contentType?.includes("application/json") &&
    !contentType?.includes("application/x-ndjson")
  ) {
    return (await response.json()) as T;
  }
  if (
    contentType?.includes("text/") ||
    contentType?.includes("application/x-ndjson")
  ) {
    return (await response.text()) as T;
  }
  return null as T;
};

/**
 * Creates a stream reader function for ReadableStream.
 */
export const createStreamReader = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  url: HttpUrl,
  emit: {
    single: (chunk: Uint8Array) => void;
    end: () => void;
    fail: (error: HttpClientError) => void;
  }
): (() => Promise<void>) => {
  const read = async () => {
    try {
      const readResult = await Effect.runPromise(
        Effect.tryPromise({
          try: () => reader.read(),
          catch: (e) => createNetworkError(e, url),
        })
      );

      const { value, done } = readResult;
      if (done) {
        emit.end();
      } else if (value && value.length > 0) {
        emit.single(value);
        read();
      } else {
        read();
      }
    } catch (error) {
      const networkError =
        error instanceof NetworkError ? error : createNetworkError(error, url);
      emit.fail(networkError);
    }
  };
  return read;
};

/**
 * Builds a URL with query parameters.
 */
export const buildUrlWithQuery = (
  baseUrl: string,
  path: string,
  queryParams?: Record<string, string>
): URL => {
  const url = new URL(path, baseUrl);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      url.searchParams.append(key, value);
    }
  }
  return url;
};

/**
 * Creates request headers with optional content type.
 */
export const createRequestHeaders = (
  defaultHeaders: Record<string, string> | undefined,
  optionsHeaders?: Record<string, string> | undefined,
  hasBody?: boolean
): Record<string, string> => {
  const headers = { ...(defaultHeaders || {}), ...(optionsHeaders || {}) };
  if (hasBody) {
    return { "Content-Type": "application/json", ...headers };
  }
  return headers;
};
