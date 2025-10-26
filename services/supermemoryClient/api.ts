import * as Effect from "effect/Effect";
import { MemoryError } from "./errors.js";

// This interface implements the MemoryClient interface with specific error types.
export interface SupermemoryClient {
  readonly put: (key: string, value: string) => Effect.Effect<void, MemoryError>;
  readonly get: (
    key: string
  ) => Effect.Effect<string | undefined, MemoryError>;
  readonly delete: (key: string) => Effect.Effect<boolean, MemoryError>;
  readonly exists: (key: string) => Effect.Effect<boolean, MemoryError>;
  readonly clear: () => Effect.Effect<void, MemoryError>;
}
