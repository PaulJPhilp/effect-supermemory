import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { HttpClientImpl } from "../service.js";
import { HttpError, NetworkError, AuthorizationError, TooManyRequestsError } from "../errors.js";
import { HttpClientConfigType } from "../types.js";

// Mock the global fetch
const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockClear();
});

const createTestHttpClientLayer = (configOverrides?: Partial<HttpClientConfigType>) => {
  const defaultConfig: HttpClientConfigType = {
    baseUrl: "https://api.supermemory.dev",
    fetch: mockFetch as typeof globalThis.fetch, // Inject mock fetch
  };
  return HttpClientImpl.Default({ ...defaultConfig, ...configOverrides });
};

describe("HttpClientImpl", () => {
  it("sends a GET request and returns data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () => Promise.resolve({ id: "mem1", content: "test" }),
      text: () => Promise.resolve(''),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClientImpl;
      return yield* client.request("/memories/mem1", { method: "GET" });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const response = await Effect.runPromise(program);

    expect(mockFetch).toHaveBeenCalledWith("https://api.supermemory.dev/memories/mem1", expect.any(Object));
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "mem1", content: "test" });
  });

  it("sends a POST request with JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(''),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClientImpl;
      return yield* client.request("/memories", {
        method: "POST",
        body: { content: "new memory" },
      });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const response = await Effect.runPromise(program);

    expect(mockFetch).toHaveBeenCalledWith("https://api.supermemory.dev/memories", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "Content-Type": "application/json" }),
      body: JSON.stringify({ content: "new memory" }),
    }));
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ success: true });
  });

  it("handles 404 HttpError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers(),
      json: () => Promise.resolve({ message: "Item not found" }),
      text: () => Promise.resolve('Item not found'),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClientImpl;
      return yield* client.request("/memories/missing", { method: "GET" });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      expect(Cause.isFailure(result.cause)).toBe(true);
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(HttpError);
        expect(error.value).toMatchObject({
          status: 404,
          message: "Not Found",
          url: "https://api.supermemory.dev/memories/missing",
        });
      }
    }
  });

  it("handles 401 AuthorizationError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClientImpl;
      return yield* client.request("/protected", { method: "GET" });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(AuthorizationError);
        expect(error.value).toMatchObject({
          reason: "Unauthorized: Unauthorized",
          url: "https://api.supermemory.dev/protected",
        });
      }
    }
  });

  it("handles network error", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const program = Effect.gen(function* () {
      const client = yield* HttpClientImpl;
      return yield* client.request("/broken", { method: "GET" });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(NetworkError);
        expect(error.value).toMatchObject({
          url: "https://api.supermemory.dev/broken",
        });
        expect((error.value as NetworkError).cause).toBeInstanceOf(TypeError);
      }
    }
  });

  it("applies default headers from config", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClientImpl;
      return yield* client.request("/status", { method: "GET" });
    }).pipe(Effect.provide(createTestHttpClientLayer({ headers: { "X-Custom-Header": "Test" } })));

    await Effect.runPromise(program);

    expect(mockFetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      headers: expect.objectContaining({ "X-Custom-Header": "Test" }),
    }));
  });

  it("applies query parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClientImpl;
      return yield* client.request("/search", { method: "GET", queryParams: { q: "test", limit: "10" } });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    await Effect.runPromise(program);

    expect(mockFetch).toHaveBeenCalledWith("https://api.supermemory.dev/search?q=test&limit=10", expect.any(Object));
  });
});
