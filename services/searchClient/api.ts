import * as Effect from "effect/Effect";
import { SearchOptions, SearchResult } from "./types.js";
import { SearchError } from "./errors.js";

export interface SearchClient {
  readonly search: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<SearchResult[], SearchError>;
}
