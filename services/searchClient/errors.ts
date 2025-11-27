import { Data } from "effect";
import type { MemoryError } from "../memoryClient/errors.js";

export class SearchQueryError extends Data.TaggedError("SearchQueryError")<{
  readonly message: string;
  readonly details?: unknown;
}> {}

// Union of all possible errors from SearchClient operations
export type SearchError = SearchQueryError | MemoryError;
