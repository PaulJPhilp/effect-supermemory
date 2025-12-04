import { Effect, Layer, Redacted } from "effect";
import { HttpClient } from "../services/httpClient/service.js";
import type { HttpUrl } from "../services/httpClient/types.js";
import { SupermemoryClient } from "../services/supermemoryClient/service.js";
import { SupermemoryConfigFromValues } from "./Config.js";

const supermemoryConfigLayer = SupermemoryConfigFromValues({
  apiKey: Redacted.make("test-api-key"),
});

const httpClientLayer = HttpClient.Default({
  baseUrl: "https://api.supermemory.ai" as HttpUrl,
  headers: {},
  timeoutMs: 5000,
});

const supermemoryClientLayer = Layer.provide(
  SupermemoryClient.Default({
    namespace: "demo-namespace",
    baseUrl: "https://api.supermemory.ai",
    apiKey: "test-api-key",
    timeoutMs: 5000,
  }),
  httpClientLayer
);

const AppLayer = Layer.mergeAll(
  supermemoryConfigLayer,
  httpClientLayer,
  supermemoryClientLayer
);

const program = Effect.log("effect-supermemory demo runtime initialized");

Effect.runPromise(Effect.provide(program, AppLayer));
