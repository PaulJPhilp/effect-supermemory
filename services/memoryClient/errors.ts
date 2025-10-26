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

export type MemoryError =
  | MemoryNotFoundError
  | MemoryValidationError;
