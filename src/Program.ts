import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { HttpClientImpl } from "../services/httpClient/service.js";
import { SupermemoryClientConfig } from "../services/supermemoryClient/service.js";
import { SupermemoryConfigFromValues } from "./Config.js";

const supermemoryConfigLayer = SupermemoryConfigFromValues({
  apiKey: Redacted.make("test-api-key"),
});

const httpClientLayer = HttpClientImpl.Default({
  baseUrl: "https://api.supermemory.ai",
  headers: {},
  timeoutMs: 5_000,
});

const supermemoryClientLayer = Layer.mergeAll(
  httpClientLayer,
  Layer.succeed(SupermemoryClientConfig, {
    namespace: "demo-namespace",
    baseUrl: "https://api.supermemory.ai",
    apiKey: "test-api-key",
    timeoutMs: 5_000,
  })
);

const AppLayer = Layer.mergeAll(supermemoryConfigLayer, supermemoryClientLayer);

const program = Effect.log("effect-supermemory demo runtime initialized");

Effect.runPromise(Effect.provide(program, AppLayer));
