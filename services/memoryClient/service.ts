import * as Effect from "effect/Effect";
import { MemoryClient } from "./api.js";

export class MemoryClientLive implements MemoryClient {
  constructor(private store = new Map<string, string>()) {}

  put = (key: string, value: string) =>
    Effect.sync(() => {
      this.store.set(key, value);
    });

  get = (key: string) =>
    Effect.sync(() => this.store.get(key));

  delete = (key: string) =>
    Effect.sync(() => this.store.delete(key));

  exists = (key: string) =>
    Effect.sync(() => this.store.has(key));

  clear = () =>
    Effect.sync(() => this.store.clear());
}

export const Default = new MemoryClientLive();
