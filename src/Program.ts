import { SupermemoryConfigFromValues } from "@services/config/service.js";
import { HttpClient } from "@services/httpClient/service.js";
import type { HttpUrl } from "@services/httpClient/types.js";
import {
  ApiKey,
  Namespace,
  PositiveInteger,
  ValidatedHttpUrl,
} from "@services/inMemoryClient/types.js";
import { SupermemoryClient } from "@services/supermemoryClient/service.js";
import { Effect, Layer, Redacted } from "effect";

const supermemoryConfigLayer = SupermemoryConfigFromValues({
  apiKey: Redacted.make("test-api-key"),
});

const httpClientLayer = HttpClient.Default({
  baseUrl: ValidatedHttpUrl("https://api.supermemory.ai") as HttpUrl,
  headers: {},
  timeoutMs: PositiveInteger(5000),
});

const supermemoryClientLayer = Layer.provide(
  SupermemoryClient.Default({
    namespace: Namespace("demo-namespace"),
    baseUrl: ValidatedHttpUrl("https://api.supermemory.ai"),
    apiKey: ApiKey("test-api-key"),
    timeoutMs: PositiveInteger(5000),
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
