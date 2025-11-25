import { Data } from "effect";

// General HTTP error when status is >= 400
export class HttpError extends Data.TaggedError("HttpError")<{
  readonly status: number;
  readonly message: string;
  readonly url: string;
  readonly body?: unknown;
}> {}

// Network level errors (DNS, connection refused, timeout)
export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly cause: Error;
  readonly url: string;
}> {}

// Request creation or parsing errors
export class RequestError extends Data.TaggedError("RequestError")<{
  readonly cause: Error;
  readonly details?: unknown;
}> {}

// Specific errors for Supermemory API responses (e.g., specific 4xx codes)
export class AuthorizationError extends Data.TaggedError("AuthorizationError")<{
  readonly reason: string;
  readonly url: string;
}> {}

export class TooManyRequestsError extends Data.TaggedError(
  "TooManyRequestsError"
)<{
  readonly retryAfterSeconds?: number;
  readonly url: string;
}> {}

// Union type for all possible HTTP client errors
export type HttpClientError =
  | HttpError
  | NetworkError
  | RequestError
  | AuthorizationError
  | TooManyRequestsError;
