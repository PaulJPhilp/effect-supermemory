/** biome-ignore-all assist/source/organizeImports: <> */
import {
  ERROR_MESSAGES,
  ERROR_TAGS,
  HTTP_HEADERS,
  HTTP_VALUES,
} from "@/Constants.js";
import { parseJson } from "@/utils/json.js";
import type { HttpBody } from "@effect/platform/HttpBody";
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
  body?: HttpBody
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
 * Type guard to check if an error is an instance of HttpClientError.
 */
export const isHttpClientError = (error: unknown): error is HttpClientError =>
  error instanceof HttpError ||
  error instanceof NetworkError ||
  error instanceof RequestError ||
  error instanceof AuthorizationError ||
  error instanceof TooManyRequestsError;

/**
 * Type guard to check if an error is a retryable error type.
 * Retryable errors are: NetworkError, HttpError, and TooManyRequestsError.
 * Can be used with HttpClientError or union types that include HttpClientError.
 */
export const isRetryableErrorType = (
  error: HttpClientError | { _tag: string }
): error is HttpError | NetworkError | TooManyRequestsError =>
  error._tag === ERROR_TAGS.NETWORK_ERROR ||
  error._tag === ERROR_TAGS.HTTP_ERROR ||
  error._tag === ERROR_TAGS.TOO_MANY_REQUESTS_ERROR;

/**
 * Type guard to check if an error is a NetworkError.
 */
export const isNetworkError = (error: HttpClientError): error is NetworkError =>
  error._tag === "NetworkError";

/**
 * Type guard to check if an error is an HttpError.
 */
export const isHttpError = (error: HttpClientError): error is HttpError =>
  error._tag === ERROR_TAGS.HTTP_ERROR;

/**
 * Type guard to check if an error is an HttpError with a specific status code.
 */
export const isHttpErrorWithStatus = (
  error: HttpClientError,
  status: number
): error is HttpError =>
  error._tag === ERROR_TAGS.HTTP_ERROR && error.status === status;

/**
 * Type guard to check if an error is an AuthorizationError.
 */
export const isAuthorizationError = (
  error: HttpClientError
): error is AuthorizationError => error._tag === ERROR_TAGS.AUTHORIZATION_ERROR;

/**
 * Type guard to check if an error is a TooManyRequestsError.
 */
export const isTooManyRequestsError = (
  error: HttpClientError
): error is TooManyRequestsError =>
  error._tag === ERROR_TAGS.TOO_MANY_REQUESTS_ERROR;

/**
 * Handles fetch errors and converts them to HttpClientError.
 */
export const handleFetchError = (
  error: unknown,
  url: HttpUrl
): HttpClientError => {
  if (isHttpClientError(error)) {
    return error;
  }
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return new NetworkError({
        cause: new Error(ERROR_MESSAGES.REQUEST_TIMED_OUT_OR_ABORTED),
        url,
      });
    }
    return createNetworkError(error, url);
  }
  return new RequestError({
    cause: new Error(ERROR_MESSAGES.UNKNOWN_REQUEST_ERROR),
    details: error,
  });
};

/**
 * Parses response body based on Content-Type header.
 * Uses effect-json for JSON parsing.
 */
export const parseResponseBody = async <T>(response: Response): Promise<T> => {
  const contentType = response.headers.get(HTTP_HEADERS.CONTENT_TYPE);
  // Handle NDJSON as text (not JSON) since it's newline-delimited
  if (
    contentType?.includes(HTTP_VALUES.APPLICATION_JSON) &&
    !contentType?.includes(HTTP_VALUES.APPLICATION_NDJSON)
  ) {
    const text = await response.text();
    const parsed = await Effect.runPromise(parseJson(text));
    return parsed as T;
  }
  if (
    contentType?.includes("text/") ||
    contentType?.includes(HTTP_VALUES.APPLICATION_NDJSON)
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
): { read: () => Promise<void>; cancel: () => void } => {
  let cancelled = false;

  const handleReadResult = (value: Uint8Array | undefined, done: boolean) => {
    if (done) {
      emit.end();
      return;
    }

    if (value && value.length > 0) {
      emit.single(value);
    }

    if (!cancelled) {
      read();
    }
  };

  const read = async () => {
    if (cancelled) {
      return;
    }

    try {
      const readResult = await Effect.runPromise(
        Effect.tryPromise({
          try: () => reader.read(),
          catch: (e) => createNetworkError(e, url),
        })
      );

      if (cancelled) {
        return;
      }

      handleReadResult(readResult.value, readResult.done);
    } catch (error) {
      if (cancelled) {
        return;
      }
      const networkError =
        error instanceof NetworkError ? error : createNetworkError(error, url);
      emit.fail(networkError);
    }
  };

  const cancel = () => {
    cancelled = true;
  };

  return { read, cancel };
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
    return {
      [HTTP_HEADERS.CONTENT_TYPE]: HTTP_VALUES.APPLICATION_JSON,
      ...headers,
    };
  }
  return headers;
};
