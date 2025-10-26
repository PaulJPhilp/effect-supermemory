import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";
import { HttpClientImpl } from "../../httpClient/service.js"; // Import HttpClient service
import { SupermemoryClient } from "./api.js";
import { SupermemoryClientConfigType, SupermemoryApiMemory, SupermemoryId } from "./types.js";
import * as Utils from "./utils.js";
import * as SupermemoryErrors from "./errors.js";
import { HttpClientError, HttpError, HttpRequestOptions } from "../../httpClient/api.js"; // Import specific HttpClientErrors

export class SupermemoryClientConfig extends Context.Tag("SupermemoryClientConfig")<SupermemoryClientConfigType>() {}

export const supermemoryClientEffect = Effect.gen(function* () {
  const config = yield* SupermemoryClientConfig;
  const httpClient = yield* HttpClientImpl;

  // Helper for common request logic and error translation
  const makeRequest = <T = unknown>(
    path: string,
    options: HttpRequestOptions,
    keyFor404Translation?: string // Optional key for potential error translation
  ) =>
    httpClient
      .request<T>(path, options)
      .pipe(
        Effect.mapError((error) => {
          // Specific 404 handling that returns 'undefined' for GET/EXISTS
          // or 'true' for DELETE are handled *outside* this generic error translation
          return SupermemoryErrors.translateHttpClientError(error, keyFor404Translation);
        })
      );

  return {
    put: (key, value) =>
      makeRequest<SupermemoryApiMemory>(
        `/api/v1/memories`, // POST for creating a new memory
        {
          method: "POST",
          body: {
            id: key, // Assuming key is used as ID on backend
            value: Utils.toBase64(value),
            namespace: config.namespace,
            // metadata could be passed if MemoryClient interface supported it
          },
        }
      ).pipe(Effect.asVoid), // `put` returns void

    get: (key) =>
      makeRequest<SupermemoryApiMemory>(
        `/api/v1/memories/${key}`,
        { method: "GET" },
        key // Pass key for potential error translation
      ).pipe(
        Effect.map((response) => Utils.fromBase64(response.body.value)),
        Effect.catchIf((error) => error instanceof HttpError && error.status === 404, () => Effect.succeed(undefined))
      ),

    delete: (key) =>
      makeRequest<void>(
        `/api/v1/memories/${key}`,
        { method: "DELETE" }
      ).pipe(
        Effect.map(() => true), // Successful delete returns true
        Effect.catchIf((error) => error instanceof HttpError && error.status === 404, () => Effect.succeed(true)) // 404 on delete is also success (idempotent)
      ),

    exists: (key) =>
      makeRequest<SupermemoryApiMemory>(
        `/api/v1/memories/${key}`,
        { method: "GET" },
        key
      ).pipe(
        Effect.map(() => true), // If request succeeds, memory exists
        Effect.catchIf((error) => error instanceof HttpError && error.status === 404, () => Effect.succeed(false)) // 404 means it doesn't exist
      ),

    clear: () =>
      makeRequest<void>(
        `/api/v1/memories`, // Assumed bulk delete endpoint
        {
          method: "DELETE",
          queryParams: { namespace: config.namespace }, // Pass namespace as query param
        }
      ).pipe(Effect.asVoid),
  } satisfies SupermemoryClient;
});

export class SupermemoryClientImpl extends Effect.Service<SupermemoryClientImpl>()(
  "SupermemoryClient",
  {
    effect: supermemoryClientEffect,
  }
) {}

// Layer for SupermemoryClient, parameterized by config
// Consumers will call SupermemoryClientImpl.Default({ namespace: "...", baseUrl: "...", ... })
export const createSupermemoryClientLayer = (config: SupermemoryClientConfigType) => {
  const httpConfig: any = { baseUrl: config.baseUrl, headers: { "Authorization": `Bearer ${config.apiKey}`, "X-Supermemory-Namespace": config.namespace, "Content-Type": "application/json" } };
  if (config.timeoutMs !== undefined) httpConfig.timeoutMs = config.timeoutMs;
  return Layer.merge(
    HttpClientImpl.Default(httpConfig),
    Layer.effect(SupermemoryClientImpl, supermemoryClientEffect),
    Layer.succeed(SupermemoryClientConfig, config)
  );
};

// For compatibility with the prompt
SupermemoryClientImpl.Default = createSupermemoryClientLayer;
