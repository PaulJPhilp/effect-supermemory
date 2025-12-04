import type { MemoryError } from "@services/inMemoryClient/errors.js";
import { Data } from "effect";

export class SearchQueryError extends Data.TaggedError("SearchQueryError")<{
  readonly message: string;
  readonly details?: unknown;
}> {}

// Union of all possible errors from SearchClient operations
export type SearchError = SearchQueryError | MemoryError;
