import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { MemoryError } from "./errors.js";

// This interface implements the MemoryClient interface with specific error types.
export interface SupermemoryClient {
  readonly put: (
    key: string,
    value: string
  ) => Effect.Effect<void, MemoryError>;
  readonly get: (key: string) => Effect.Effect<string | undefined, MemoryError>;
  readonly delete: (key: string) => Effect.Effect<boolean, MemoryError>;
  readonly exists: (key: string) => Effect.Effect<boolean, MemoryError>;
  readonly clear: () => Effect.Effect<void, MemoryError>;
  readonly putMany: (
    items: ReadonlyArray<{ key: string; value: string }>
  ) => Effect.Effect<void, MemoryError>;
  readonly deleteMany: (
    keys: ReadonlyArray<string>
  ) => Effect.Effect<void, MemoryError>;
  readonly getMany: (
    keys: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyMap<string, string | undefined>, MemoryError>;
}

export const getOption =
  (client: SupermemoryClient) =>
  (key: string): Effect.Effect<Option.Option<string>, MemoryError> =>
    client.get(key).pipe(Effect.map(Option.fromNullable));
