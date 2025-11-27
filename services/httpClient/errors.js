import { Data } from "effect";
// General HTTP error when status is >= 400
export class HttpError extends Data.TaggedError("HttpError") {}
// Network level errors (DNS, connection refused, timeout)
export class NetworkError extends Data.TaggedError("NetworkError") {}
// Request creation or parsing errors
export class RequestError extends Data.TaggedError("RequestError") {}
// Specific errors for Supermemory API responses (e.g., specific 4xx codes)
export class AuthorizationError extends Data.TaggedError(
  "AuthorizationError"
) {}
export class TooManyRequestsError extends Data.TaggedError(
  "TooManyRequestsError"
) {}
