import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { MemoryClient } from "./api.js";
import type { MemoryConfig } from "./types.js";

export const MemoryConfigTag = Context.GenericTag<MemoryConfig>("MemoryConfig");

class MemoryClientLive implements MemoryClient {
  constructor(private config: MemoryConfig, private store = new Map<string, string>()) {}

  put = (key: string, value: string) =>
    Effect.sync(() => {
      const nsKey = `${this.config.namespace}:${key}`;
      this.store.set(nsKey, value);
    });

  get = (key: string) =>
    Effect.sync(() => {
      const nsKey = `${this.config.namespace}:${key}`;
      return this.store.get(nsKey);
    });

  delete = (key: string) =>
    Effect.sync(() => {
      const nsKey = `${this.config.namespace}:${key}`;
      return this.store.delete(nsKey);
    });

  exists = (key: string) =>
    Effect.sync(() => {
      const nsKey = `${this.config.namespace}:${key}`;
      return this.store.has(nsKey);
    });

  clear = () => Effect.sync(() => this.store.clear());
}

export const MemoryClientLiveTag = Context.GenericTag<MemoryClient>("MemoryClient");

export const make = (config: MemoryConfig) => new MemoryClientLive(config);

export const Default = Layer.effect(
  MemoryClientLiveTag,
  Effect.gen(function* () {
    const config = yield* MemoryConfigTag;
    return make(config);
  })
);
