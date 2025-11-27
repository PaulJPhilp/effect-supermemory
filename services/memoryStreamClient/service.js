import { Effect, Stream } from "effect";
import { HttpClientImpl } from "../httpClient/service.js";
import { MemoryValidationError } from "../memoryClient/errors.js";
import { StreamReadError } from "./errors.js";
export class MemoryStreamClientImpl extends Effect.Service()(
  "MemoryStreamClient",
  {
    effect: Effect.fn(function* (config) {
      const { namespace, baseUrl, apiKey, timeoutMs } = config;
      const httpClientLayer = HttpClientImpl.Default({
        baseUrl,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Supermemory-Namespace": namespace,
          "Content-Type": "application/json",
        },
        ...(timeoutMs !== undefined ? { timeoutMs } : {}),
      });
      return {
        listAllKeys: () => {
          return Effect.gen(function* () {
            const httpClient = yield* HttpClientImpl.pipe(
              Effect.provide(httpClientLayer)
            );
            const keysPath = `/v1/keys/${encodeURIComponent(namespace)}`;
            const options = {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/x-ndjson",
              },
            };
            const response = yield* httpClient.request(keysPath, options).pipe(
              Effect.mapError((error) => {
                if (error._tag === "HttpError") {
                  return new MemoryValidationError({
                    message: `HTTP ${error.status}: ${error.message}`,
                  });
                }
                if (error._tag === "NetworkError") {
                  return new StreamReadError({
                    message: `Network error: ${error.message}`,
                    cause: error,
                  });
                }
                return new StreamReadError({
                  message: `HTTP client error: ${error._tag}`,
                  cause: error,
                });
              })
            );
            if (response.status >= 400) {
              return yield* new StreamReadError({
                message: `HTTP ${response.status}: Failed to fetch keys`,
              });
            }
            // Handle response body as string that needs to be parsed as NDJSON
            const responseBody =
              typeof response.body === "string"
                ? response.body
                : JSON.stringify(response.body);
            return Stream.fromIterable(responseBody.split("\n")).pipe(
              Stream.filter((line) => line.trim().length > 0),
              Stream.mapEffect((line) =>
                Effect.try({
                  try: () => {
                    const parsed = JSON.parse(line);
                    return parsed.key;
                  },
                  catch: (error) =>
                    new StreamReadError({
                      message: `Failed to parse key: ${error instanceof Error ? error.message : String(error)}`,
                      cause:
                        error instanceof Error
                          ? error
                          : new Error(String(error)),
                    }),
                })
              )
            );
          });
        },
        streamSearch: (query, options) => {
          return Effect.gen(function* () {
            const httpClient = yield* HttpClientImpl.pipe(
              Effect.provide(httpClientLayer)
            );
            const searchPath = `/v1/search/${encodeURIComponent(namespace)}/stream`;
            // Build query parameters
            const params = new URLSearchParams();
            params.set("q", query);
            if (options?.limit) {
              params.set("limit", options.limit.toString());
            }
            if (options?.filters) {
              Object.entries(options.filters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                  value.forEach((v) => params.append(key, v.toString()));
                } else {
                  params.set(key, value.toString());
                }
              });
            }
            const fullPath = `${searchPath}?${params.toString()}`;
            const requestOptions = {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Accept: "application/x-ndjson",
              },
            };
            const response = yield* httpClient
              .request(fullPath, requestOptions)
              .pipe(
                Effect.mapError((error) => {
                  if (error._tag === "HttpError") {
                    return new StreamReadError({
                      message: `HTTP ${error.status}: ${error.message}`,
                      cause: error,
                    });
                  }
                  if (error._tag === "NetworkError") {
                    return new StreamReadError({
                      message: `Network error: ${error.message}`,
                      cause: error,
                    });
                  }
                  return new StreamReadError({
                    message: `HTTP client error: ${error._tag}`,
                    cause: error,
                  });
                })
              );
            if (response.status >= 400) {
              return yield* new StreamReadError({
                message: `HTTP ${response.status}: Search request failed`,
              });
            }
            // Handle response body as string that needs to be parsed as NDJSON
            const responseBody =
              typeof response.body === "string"
                ? response.body
                : JSON.stringify(response.body);
            return Stream.fromIterable(responseBody.split("\n")).pipe(
              Stream.filter((line) => line.trim().length > 0),
              Stream.mapEffect((line) =>
                Effect.try({
                  try: () => {
                    return JSON.parse(line);
                  },
                  catch: (error) =>
                    new StreamReadError({
                      message: `Failed to parse search result: ${error instanceof Error ? error.message : String(error)}`,
                      cause:
                        error instanceof Error
                          ? error
                          : new Error(String(error)),
                    }),
                })
              )
            );
          });
        },
      };
    }),
  }
) {}
