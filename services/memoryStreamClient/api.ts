import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { type MemoryError } from "../memoryClient/errors.js";
import { type SearchError } from "../searchClient/errors.js";
import { SearchOptions, SearchResult } from "../searchClient/types.js";
import { type StreamError } from "./errors.js";

export interface MemoryStreamClient {
  readonly listAllKeys: () => Effect.Effect<
    Stream.Stream<string, MemoryError | StreamError>,
    MemoryError | StreamError
  >;

  readonly streamSearch: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<
    Stream.Stream<SearchResult, SearchError | StreamError>,
    SearchError | StreamError
  >;
}
