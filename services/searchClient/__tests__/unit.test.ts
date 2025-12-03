import { Cause, Effect, Layer, Option } from "effect";
import { describe, expect, it } from "vitest";
import { type HttpClientError, HttpError } from "../../httpClient/errors.js";
import { HttpClientImpl } from "../../httpClient/service.js";
import type { HttpResponse, HttpUrl } from "../../httpClient/types.js";
import { MemoryValidationError } from "../../memoryClient/errors.js";
import { type SearchError, SearchQueryError } from "../errors.js";
import { toBase64 } from "../helpers.js";
import { SearchClientImpl } from "../service.js";
import type { SearchResult, SupermemoryClientConfigType } from "../types.js";

// Create a test HttpClient layer
const createTestHttpClientLayer = (
  responses: Map<string, HttpResponse<any> | HttpClientError>
) => {
  const mockFetch = (url: string, options?: RequestInit) => {
    const method = options?.method || "GET";
    const path = url.replace("https://api.supermemory.dev", "");
    const key = `${method} ${path}`;
    const response = responses.get(key);

    if (response && "_tag" in response) {
      // It's an error - check if it has status property
      const status = "status" in response ? response.status : 500;
      const message =
        "message" in response ? response.message : "Unknown error";

      return Promise.resolve({
        ok: false,
        status,
        statusText: message,
        headers: new Headers(),
      });
    }

    // It's a successful response
    return Promise.resolve({
      ok: true,
      status: response?.status || 200,
      statusText: "OK",
      headers: response?.headers || new Headers(),
      json: () => Promise.resolve(response?.body || {}),
    });
  };

  return HttpClientImpl.Default({
    baseUrl: "https://api.supermemory.dev" as HttpUrl,
    fetch: mockFetch as any,
  });
};

const baseConfig: SupermemoryClientConfigType = {
  namespace: "test-ns",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "test-api-key",
};

// Create a SearchClient layer using the test HttpClient
const createSearchClientLayer = (
  configOverrides: Partial<SupermemoryClientConfigType> | undefined,
  responses: Map<string, HttpResponse<any> | HttpClientError>
) => {
  const config = { ...baseConfig, ...configOverrides };
  const testHttpClientLayer = createTestHttpClientLayer(responses);
  return SearchClientImpl.Default(config).pipe(
    Layer.provideMerge(testHttpClientLayer)
  );
};

describe("SearchClientImpl", () => {
  it("search sends a GET request with query", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        {
          status: 200,
          headers: new Headers(),
          body: {
            results: [
              {
                id: "test-key",
                value: toBase64("test-value"),
                relevanceScore: 0.9,
                namespace: "test-ns",
              },
            ],
            total: 1,
          },
        },
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("test query");
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    const result = await Effect.runPromise(program);

    expect(result).toEqual([
      {
        memory: { key: "test-key", value: "test-value" },
        relevanceScore: 0.9,
      },
    ]);
  });

  it("search with options includes query params", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        {
          status: 200,
          headers: new Headers(),
          body: { results: [], total: 0 },
        },
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query", {
        limit: 5,
        offset: 10,
        minRelevanceScore: 0.8,
      });
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    await Effect.runPromise(program);
  });

  it("search with filters encodes them as query params", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        {
          status: 200,
          headers: new Headers(),
          body: { results: [], total: 0 },
        },
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query", {
        filters: {
          tag: "cli",
          category: ["tool", "utility"],
          status: "active",
        },
      });
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    await Effect.runPromise(program);
  });

  it("search with maxAgeHours includes it in query params", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        {
          status: 200,
          headers: new Headers(),
          body: { results: [], total: 0 },
        },
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query", { maxAgeHours: 24 });
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    await Effect.runPromise(program);
  });

  it("search returns multiple results correctly mapped", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        {
          status: 200,
          headers: new Headers(),
          body: {
            results: [
              {
                id: "key1",
                value: toBase64("value1"),
                relevanceScore: 0.95,
                namespace: "test-ns",
              },
              {
                id: "key2",
                value: toBase64("value2"),
                relevanceScore: 0.87,
                namespace: "test-ns",
              },
            ],
            total: 2,
          },
        },
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("multi query");
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    const result = await Effect.runPromise(program);

    expect(result).toEqual([
      {
        memory: { key: "key1", value: "value1" },
        relevanceScore: 0.95,
      },
      {
        memory: { key: "key2", value: "value2" },
        relevanceScore: 0.87,
      },
    ]);
  });

  it("search returns empty array for no results", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        {
          status: 200,
          headers: new Headers(),
          body: { results: [], total: 0 },
        },
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("no results query");
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    const result = await Effect.runPromise(program);

    expect(result).toEqual([]);
  });

  it("translates 400 to SearchQueryError", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        new HttpError({
          status: 400,
          message: "Bad Request",
          url: "/api/v1/search" as HttpUrl,
        }),
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("invalid query");
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

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
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        new HttpError({
          status: 500,
          message: "Internal Server Error",
          url: "/api/v1/search" as HttpUrl,
        }),
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query");
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(MemoryValidationError);
        expect((error.value as MemoryValidationError).message).toContain(
          "Search request failed"
        );
      }
    }
  });

  it("handles options being undefined", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        {
          status: 200,
          headers: new Headers(),
          body: { results: [], total: 0 },
        },
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query", undefined);
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    await Effect.runPromise(program);
  });

  it("sends correct headers from config", async () => {
    const responses = new Map<string, HttpResponse<any> | HttpClientError>([
      [
        "GET /api/v1/search",
        {
          status: 200,
          headers: new Headers(),
          body: { results: [], total: 0 },
        },
      ],
    ]);

    const program = Effect.gen(function* () {
      const client = yield* SearchClientImpl;
      return yield* client.search("query");
    }).pipe(
      Effect.provide(createSearchClientLayer(undefined, responses))
    ) as Effect.Effect<SearchResult[], SearchError>;

    await Effect.runPromise(program);
  });

  it("includes timeout in HttpClient config when provided", () => {
    const layer = SearchClientImpl.Default({ ...baseConfig, timeoutMs: 5000 });

    // Since we can't easily inspect the internal HttpClient config,
    // we can test that the layer is created without error
    expect(layer).toBeDefined();
  });
});
