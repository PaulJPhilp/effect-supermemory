import type { MemoryError } from "@services/inMemoryClient/errors.js";
import type { SearchError } from "@services/searchClient/errors.js";
import type {
  SearchOptions,
  SearchResult,
} from "@services/searchClient/types.js";
import type { Effect, Stream } from "effect";
import type { StreamError } from "./errors.js";

export type MemoryStreamClientApi = {
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
};
