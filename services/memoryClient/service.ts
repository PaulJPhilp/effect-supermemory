import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { MemoryClient } from "./api.js";
import type { MemoryConfig } from "./types.js";

export const MemoryConfig = Context.Tag<MemoryConfig>("MemoryConfig");

export class MemoryClientImpl extends Effect.Service<MemoryClientImpl>()(
  "MemoryClient",
  {
    sync: () => {
      const store = new Map<string, string>();

      return {
        put: (key: string, value: string) =>
          Effect.gen(function* () {
            const config = yield* MemoryConfig;
            const nsKey = `${config.namespace}:${key}`;
            store.set(nsKey, value);
          }),

        get: (key: string) =>
          Effect.gen(function* () {
            const config = yield* MemoryConfig;
            const nsKey = `${config.namespace}:${key}`;
            return store.get(nsKey);
          }),

        delete: (key: string) =>
          Effect.gen(function* () {
            const config = yield* MemoryConfig;
            const nsKey = `${config.namespace}:${key}`;
            return store.delete(nsKey);
          }),

        exists: (key: string) =>
          Effect.gen(function* () {
            const config = yield* MemoryConfig;
            const nsKey = `${config.namespace}:${key}`;
            return store.has(nsKey);
          }),

        clear: () => Effect.sync(() => store.clear()),
      } satisfies MemoryClient;
    },
  }
) {}

export const Default = Layer.succeed(
  MemoryClientImpl,
  new MemoryClientImpl()
);
