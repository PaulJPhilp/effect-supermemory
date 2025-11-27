import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthorizationError as HttpClientAuthorizationError,
  NetworkError,
} from "../../httpClient/errors.js";
import { HttpClientImpl } from "../../httpClient/service.js";
import { MemoryValidationError } from "../../memoryClient/errors.js";
import { StreamReadError } from "../errors.js";
import { MemoryStreamClientImpl } from "../service.js";
// Mock the HttpClientImpl service
const mockHttpClient = {
  request: vi.fn(),
  requestStream: vi.fn(),
};
// Create a layer that provides the mocked HttpClientImpl
const mockHttpClientLayer = Layer.succeed(HttpClientImpl, mockHttpClient);
const baseConfig = {
  namespace: "stream-test-ns",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "stream-api-key",
};
const createMemoryStreamClientLayer = (configOverrides) =>
  MemoryStreamClientImpl.Default({
    ...baseConfig,
    ...configOverrides,
  }).pipe(Layer.provide(mockHttpClientLayer));
// Helper for creating a mock ReadableStream source for HttpClient.requestStream
const createMockByteStream = (textChunks) =>
  Stream.fromIterable(textChunks.map((s) => new TextEncoder().encode(s))).pipe(
    Stream.mapError(
      (e) => new NetworkError({ cause: new Error(String(e)), url: "mock-url" })
    )
  );
describe("MemoryStreamClientImpl", () => {
  beforeEach(() => {
    mockHttpClient.request.mockReset();
    mockHttpClient.requestStream.mockReset();
  });
  it("listAllKeys streams keys correctly from NDJSON", async () => {
    const ndjsonResponse = [
      '{"key": "key1"}\n',
      '{"key": "key2"}\n',
      '{"key": "key3"}\n',
    ];
    mockHttpClient.requestStream.mockReturnValueOnce(
      Effect.succeed(createMockByteStream(ndjsonResponse))
    );
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.listAllKeys();
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));
    const result = await Effect.runPromise(program);
    expect(Array.from(result)).toEqual(["key1", "key2", "key3"]);
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
    expect(mockHttpClient.requestStream).toHaveBeenCalledWith(
      "/api/v1/memories/keys/stream",
      expect.objectContaining({ method: "GET" })
    );
  });
  it("streamSearch streams SearchResults correctly from NDJSON", async () => {
    const searchResults = [
      { memory: { key: "mem1", value: "foo" }, relevanceScore: 0.9 },
      { memory: { key: "mem2", value: "bar" }, relevanceScore: 0.8 },
    ];
    const ndjsonResponse = searchResults.map((r) => `${JSON.stringify(r)}\n`);
    mockHttpClient.requestStream.mockReturnValueOnce(
      Effect.succeed(createMockByteStream(ndjsonResponse))
    );
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.streamSearch("test query", {});
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));
    const result = await Effect.runPromise(program);
    expect(Array.from(result)).toEqual(searchResults);
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
    expect(mockHttpClient.requestStream).toHaveBeenCalledWith(
      "/api/v1/search/stream",
      expect.objectContaining({
        method: "GET",
        queryParams: expect.objectContaining({ q: "test query" }),
      })
    );
  });
  it("listAllKeys fails on initial 401 AuthorizationError", async () => {
    mockHttpClient.requestStream.mockReturnValueOnce(
      Effect.fail(
        new HttpClientAuthorizationError({
          reason: "Bad Auth",
          url: "/keys/stream",
        })
      )
    );
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.listAllKeys();
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));
    const result = await Effect.runPromiseExit(program);
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(MemoryValidationError);
        expect(error.value.message).toContain("Authorization failed");
      }
    }
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
  });
  it("listAllKeys fails on mid-stream JSON parsing error", async () => {
    const malformedNdjsonResponse = [
      '{"key": "key1"}\n',
      '{"key": "key2", "malformed"\n', // Malformed line
      '{"key": "key3"}\n',
    ];
    mockHttpClient.requestStream.mockReturnValueOnce(
      Effect.succeed(createMockByteStream(malformedNdjsonResponse))
    );
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.listAllKeys();
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));
    const result = await Effect.runPromiseExit(program);
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(StreamReadError);
      }
    }
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
  });
  it("listAllKeys handles stream interruption gracefully", async () => {
    const ndjsonResponse = [
      '{"key": "key1"}\n',
      '{"key": "key2"}\n',
      '{"key": "key3"}\n',
    ];
    mockHttpClient.requestStream.mockReturnValueOnce(
      Effect.succeed(createMockByteStream(ndjsonResponse))
    );
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.listAllKeys();
      return yield* stream.pipe(Stream.take(1), Stream.runCollect);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));
    const result = await Effect.runPromise(program);
    expect(Array.from(result)).toEqual(["key1"]);
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
  });
  it("streamSearch handles empty results stream", async () => {
    mockHttpClient.requestStream.mockReturnValueOnce(
      Effect.succeed(createMockByteStream([]))
    );
    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.streamSearch("no results query", {});
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));
    const result = await Effect.runPromise(program);
    expect(Array.from(result)).toEqual([]);
  });
});
