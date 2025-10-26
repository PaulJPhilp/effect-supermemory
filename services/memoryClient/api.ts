import * as Effect from "effect/Effect";

export interface MemoryClient {
  readonly put: (key: string, value: string) => Effect.Effect<void>;
  readonly get: (
    key: string
  ) => Effect.Effect<string | undefined, never>;
  readonly delete: (key: string) => Effect.Effect<boolean>;
  readonly exists: (key: string) => Effect.Effect<boolean>;
  readonly clear: () => Effect.Effect<void>;
}
