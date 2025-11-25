import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpClientImpl } from "../httpClient/service.js"; // For R type
import { MemoryBatchError, MemoryError } from "./errors.js"; // Import batch error

export interface MemoryClient {
  readonly put: (
    key: string,
    value: string
  ) => Effect.Effect<void, MemoryError>;
  readonly get: (key: string) => Effect.Effect<string | undefined, MemoryError>;
  readonly delete: (key: string) => Effect.Effect<boolean, MemoryError>;
  readonly exists: (key: string) => Effect.Effect<boolean, MemoryError>;
  readonly clear: () => Effect.Effect<void, MemoryError>;

  // New Batch Operations
  readonly putMany: (
    items: ReadonlyArray<{ key: string; value: string }>
  ) => Effect.Effect<void, MemoryError | MemoryBatchError, HttpClientImpl>;

  readonly deleteMany: (
    keys: ReadonlyArray<string>
  ) => Effect.Effect<void, MemoryError | MemoryBatchError, HttpClientImpl>;

  readonly getMany: (
    keys: ReadonlyArray<string>
  ) => Effect.Effect<
    ReadonlyMap<string, string | undefined>,
    MemoryError | MemoryBatchError,
    HttpClientImpl
  >;
}

export const getOption =
  (client: MemoryClient) =>
  (key: string): Effect.Effect<Option.Option<string>, MemoryError> =>
    client.get(key).pipe(Effect.map(Option.fromNullable));
