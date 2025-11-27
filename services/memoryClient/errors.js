import { Data } from "effect";
export class MemoryNotFoundError extends Data.TaggedError(
  "MemoryNotFoundError"
) {}
export class MemoryValidationError extends Data.TaggedError(
  "MemoryValidationError"
) {}
export class MemoryBatchPartialFailure extends Data.TaggedError(
  "MemoryBatchPartialFailure"
) {}
