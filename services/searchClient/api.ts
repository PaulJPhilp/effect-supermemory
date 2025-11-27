import type * as Effect from "effect/Effect";
import type { SearchError } from "./errors.js";
import type { SearchOptions, SearchResult } from "./types.js";

export type SearchClient = {
  readonly search: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<SearchResult[], SearchError>;
};
