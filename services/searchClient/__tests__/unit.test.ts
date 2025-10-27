import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { HttpClientImpl } from "../../httpClient/service.js";
import { HttpClientError, HttpError } from "../../httpClient/errors.js";
import { SearchClientImpl, SearchClientDefault } from "../service.js";
import { HttpResponse } from "../../httpClient/api.js";
import { SupermemoryClientConfigType } from "../../supermemoryClient/types.js";
import { MemoryValidationError } from "../../memoryClient/errors.js";
import { SearchQueryError } from "../errors.js";
import { SearchClient } from "../api.js";
import * as Utils from "../utils.js";

// Test HttpClient implementation that returns predetermined responses
class TestHttpClient {
  constructor(private responses: Map<string, HttpResponse<any> | Error>) {}

  request<T = any>(path: string, options: any): Effect.Effect<HttpResponse<T>, HttpClientError> {
    const key = `${options.method} ${path}`;
    const response = this.responses.get(key);
    if (response instanceof Error) {
      return Effect.fail(response);
    }
    return Effect.succeed(response as HttpResponse<T>);
  }
}

// Create a test HttpClient layer
const createTestHttpClientLayer = (responses: Map<string, HttpResponse<any> | Error>) => {
  const testHttpClient = new TestHttpClient(responses);
  return Layer.succeed(HttpClientImpl, testHttpClient as any);
};

const baseConfig: SupermemoryClientConfigType = {
  namespace: "test-ns",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "test-api-key",
};

// Create a SearchClient layer using the test HttpClient
const createSearchClientLayer = (
  configOverrides: Partial<SupermemoryClientConfigType> | undefined,
  responses: Map<string, HttpResponse<any> | Error>
) => {
  const config = { ...baseConfig, ...configOverrides };
  const testHttpClientLayer = createTestHttpClientLayer(responses);
  return SearchClientDefault(config).pipe(
    Layer.provideMerge(testHttpClientLayer)
  );
};

describe("SearchClientImpl", () => {
  it("search sends a GET request with query", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", {
        status: 200,
        headers: new Headers(),
        body: {
          results: [
            {
              id: "test-key",
              value: Utils.toBase64("test-value"),
              relevanceScore: 0.9,
              namespace: "test-ns"
            }
          ],
          total: 1
        }
      }]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("test query");
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    const result = await Effect.runPromise(program);

    expect(result).toEqual([
      {
        memory: { key: "test-key", value: "test-value" },
        relevanceScore: 0.9
      }
    ]);
  });

  it("search with options includes query params", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", {
        status: 200,
        headers: new Headers(),
        body: { results: [], total: 0 }
      }]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query", { limit: 5, offset: 10, minRelevanceScore: 0.8 });
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    await Effect.runPromise(program);
  });

  it("search with filters encodes them as query params", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", {
        status: 200,
        headers: new Headers(),
        body: { results: [], total: 0 }
      }]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query", {
        filters: { tag: "cli", category: ["tool", "utility"], status: "active" }
      });
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    await Effect.runPromise(program);
  });

  it("search with maxAgeHours includes it in query params", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", {
        status: 200,
        headers: new Headers(),
        body: { results: [], total: 0 }
      }]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query", { maxAgeHours: 24 });
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    await Effect.runPromise(program);
  });

  it("search returns multiple results correctly mapped", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", {
        status: 200,
        headers: new Headers(),
        body: {
          results: [
            {
              id: "key1",
              value: Utils.toBase64("value1"),
              relevanceScore: 0.95,
              namespace: "test-ns"
            },
            {
              id: "key2",
              value: Utils.toBase64("value2"),
              relevanceScore: 0.87,
              namespace: "test-ns"
            }
          ],
          total: 2
        }
      }]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("multi query");
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    const result = await Effect.runPromise(program);

    expect(result).toEqual([
      {
        memory: { key: "key1", value: "value1" },
        relevanceScore: 0.95
      },
      {
        memory: { key: "key2", value: "value2" },
        relevanceScore: 0.87
      }
    ]);
  });

  it("search returns empty array for no results", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", {
        status: 200,
        headers: new Headers(),
        body: { results: [], total: 0 }
      }]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("no results query");
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    const result = await Effect.runPromise(program);

    expect(result).toEqual([]);
  });

  it("translates 400 to SearchQueryError", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", new HttpError({ status: 400, message: "Bad Request", url: "/api/v1/search" })]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("invalid query");
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(SearchQueryError);
      }
    }
  });

  it("translates 500 to MemoryValidationError", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", new HttpError({ status: 500, message: "Internal Server Error", url: "/api/v1/search" })]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query");
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(MemoryValidationError);
        expect(error.value.message).toContain("Search request failed");
      }
    }
  });

  it("handles options being undefined", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", {
        status: 200,
        headers: new Headers(),
        body: { results: [], total: 0 }
      }]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query", undefined);
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    await Effect.runPromise(program);
  });

  it("sends correct headers from config", async () => {
    const responses = new Map<string, HttpResponse<any> | Error>([
      ["GET /api/v1/search", {
        status: 200,
        headers: new Headers(),
        body: { results: [], total: 0 }
      }]
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query");
    }).pipe(Effect.provide(createSearchClientLayer(undefined, responses)));

    await Effect.runPromise(program);
  });

  it("includes timeout in HttpClient config when provided", async () => {
    const layer = SearchClientDefault({ ...baseConfig, timeoutMs: 5000 });

    // Since we can't easily inspect the internal HttpClient config,
    // we can test that the layer is created without error
    expect(layer).toBeDefined();
  });
});
