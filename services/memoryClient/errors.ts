import { Data } from "effect";

export class MemoryNotFoundError extends Data.TaggedError(
  "MemoryNotFoundError"
)<{
  readonly key: string;
}> {}

export class MemoryValidationError extends Data.TaggedError(
  "MemoryValidationError"
)<{
  readonly message: string;
}> {}

export class MemoryBatchPartialFailure extends Data.TaggedError("MemoryBatchPartialFailure")<{
  readonly successes: number;
  readonly correlationId?: string; // Optional correlation ID for tracing
  readonly failures: ReadonlyArray<{ key: string; error: MemoryError }>; // Detailed error per failed key
}> {}

export type MemoryError =
  | MemoryNotFoundError
  | MemoryValidationError;

export type MemoryBatchError = MemoryBatchPartialFailure;
