import * as Effect from "effect/Effect";
import { MemoryClient } from "./api.js";
// No longer importing MemoryConfig type or tag as it's a direct parameter now

export class MemoryClientImpl extends Effect.Service<MemoryClientImpl>()(
  "MemoryClient",
  {
    // Use Effect.fn to accept 'namespace' as a constructor parameter
    effect: Effect.fn(function* (namespace: string) {
      const store = new Map<string, string>(); // This 'store' is now tied to a specific namespace instance

      return {
        put: (key: string, value: string) =>
          Effect.sync(() => {
            const nsKey = `${namespace}:${key}`; // Use the instance's namespace
            store.set(nsKey, value);
          }),

        get: (key: string) =>
          Effect.sync(() => {
            const nsKey = `${namespace}:${key}`;
            return store.get(nsKey);
          }),

        delete: (key: string) =>
          Effect.sync(() => {
            const nsKey = `${namespace}:${key}`;
            return store.delete(nsKey);
          }),

        exists: (key: string) =>
          Effect.sync(() => {
            const nsKey = `${namespace}:${key}`;
            return store.has(nsKey);
          }),

        clear: () =>
          Effect.sync(() => {
            store.clear();
          }),

        putMany: (items) =>
          Effect.sync(() => {
            for (const { key, value } of items) {
              const nsKey = `${namespace}:${key}`;
              store.set(nsKey, value);
            }
          }),

        deleteMany: (keys) =>
          Effect.sync(() => {
            for (const key of keys) {
              const nsKey = `${namespace}:${key}`;
              store.delete(nsKey);
            }
          }),

        getMany: (keys) =>
          Effect.sync(() => {
            const result = new Map<string, string | undefined>();
            for (const key of keys) {
              const nsKey = `${namespace}:${key}`;
              result.set(key, store.get(nsKey));
            }
            return result;
          }),
      } satisfies MemoryClient;
    }),
  }
) {}

// The Default layer now requires the namespace parameter
// We will not export a generic 'Default' layer from here,
// as it requires a parameter. Specific layers will be created by consumers
// or a higher-level factory. For tests, we'll create layers directly.
