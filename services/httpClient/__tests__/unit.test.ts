import { Cause, Chunk, Effect, Option, Stream } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthorizationError, HttpError, NetworkError } from "../errors.js";
import { HttpClient } from "../service.js";
import type { HttpClientConfigType, HttpUrl } from "../types.js";

// Mock the global fetch
const mockFetch = vi.fn();
beforeEach(() => {
  mockFetch.mockClear();
});

const createTestHttpClientLayer = (
  configOverrides?: Partial<HttpClientConfigType>
) => {
  const defaultConfig: HttpClientConfigType = {
    baseUrl: "https://api.supermemory.dev" as HttpUrl,
    fetch: mockFetch as typeof globalThis.fetch, // Inject mock fetch
  };
  return HttpClient.Default({ ...defaultConfig, ...configOverrides });
};

// Helper function to create a mock ReadableStream
const createMockReadableStream = (chunks: string[]): ReadableStream => {
  const encoder = new TextEncoder();
  let index = 0;

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      } else {
        controller.close();
      }
    },
  });
};

describe("HttpClient", () => {
  it("sends a GET request and returns data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () => Promise.resolve({ id: "mem1", content: "test" }),
      text: () => Promise.resolve(""),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
      return yield* client.request("/memories/mem1", { method: "GET" });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const response = await Effect.runPromise(program);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.supermemory.dev/memories/mem1",
      expect.any(Object)
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: "mem1", content: "test" });
  });

  it("sends a POST request with JSON body", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      headers: new Headers({ "Content-Type": "application/json" }),
      json: () => Promise.resolve({ success: true }),
      text: () => Promise.resolve(""),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
      return yield* client.request("/memories", {
        method: "POST",
        body: { content: "new memory" },
      });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const response = await Effect.runPromise(program);

    const expectedBody = JSON.stringify({ content: "new memory" });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.supermemory.dev/memories",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: expectedBody,
      })
    );
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
      text: () => Promise.resolve("Item not found"),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
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
      text: () => Promise.resolve(""),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
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
      const client = yield* HttpClient;
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
      text: () => Promise.resolve(""),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
      return yield* client.request("/status", { method: "GET" });
    }).pipe(
      Effect.provide(
        createTestHttpClientLayer({ headers: { "X-Custom-Header": "Test" } })
      )
    );

    await Effect.runPromise(program);

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({ "X-Custom-Header": "Test" }),
      })
    );
  });

  it("applies query parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(""),
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
      return yield* client.request("/search", {
        method: "GET",
        queryParams: { q: "test", limit: "10" },
      });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    await Effect.runPromise(program);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.supermemory.dev/search?q=test&limit=10",
      expect.any(Object)
    );
  });
});

describe("HttpClient Streaming", () => {
  it("requestStream successfully streams text chunks", async () => {
    const mockBody = createMockReadableStream(["hello", "world"]);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/plain" }),
      body: mockBody,
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
      const stream = yield* client.requestStream("/stream", { method: "GET" });
      const chunks = yield* Stream.runCollect(stream);
      // Decode Uint8Array chunks to text
      return Chunk.map(chunks, (chunk) => new TextDecoder().decode(chunk));
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const result = await Effect.runPromise(program);
    expect(result).toEqual(Chunk.fromIterable(["hello", "world"]));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("requestStream handles initial 404 HttpError", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      headers: new Headers(),
      body: createMockReadableStream([]), // Empty body for error
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
      return yield* client.requestStream("/stream-404", { method: "GET" });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(HttpError);
        expect(error.value).toMatchObject({ status: 404 });
      }
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("requestStream propagates NetworkError from underlying fetch", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to connect"));

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
      return yield* client.requestStream("/stream-network-fail", {
        method: "GET",
      });
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(NetworkError);
        expect((error.value as NetworkError).cause).toBeInstanceOf(TypeError);
      }
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("requestStream cancels underlying reader on stream interruption", async () => {
    const mockReader = {
      read: vi.fn(() =>
        Promise.resolve({
          value: new TextEncoder().encode("data"),
          done: false,
        })
      ),
      releaseLock: vi.fn(),
      cancel: vi.fn(() => Promise.resolve()), // Mock the cancel method
    };
    const mockBody = { getReader: () => mockReader };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "Content-Type": "text/plain" }),
      body: mockBody,
    });

    const program = Effect.gen(function* () {
      const client = yield* HttpClient;
      const stream = yield* client.requestStream("/interrupt", {
        method: "GET",
      });
      // Take only one element, then the stream should be interrupted
      return yield* stream.pipe(Stream.take(1), Stream.runCollect);
    }).pipe(Effect.provide(createTestHttpClientLayer()));

    await Effect.runPromise(program);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    // Stream.take(1) may trigger a second read before cancellation takes effect
    // The important thing is that cancel() is called
    expect(mockReader.read).toHaveBeenCalled();
    expect(mockReader.cancel).toHaveBeenCalledTimes(1); // Underlying reader should be cancelled
  });
});
