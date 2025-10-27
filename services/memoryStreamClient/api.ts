import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { SearchOptions, SearchResult } from "../searchClient/api.js";
import { MemoryError, SearchError } from "../memoryClient/errors.js";
import { StreamError } from "./errors.js";

export interface MemoryStreamClient {
  readonly listAllKeys: () => Effect.Effect<Stream.Stream<string, MemoryError | StreamError>, MemoryError | StreamError>;

  readonly streamSearch: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<Stream.Stream<SearchResult, SearchError | StreamError>, SearchError | StreamError>;
}
