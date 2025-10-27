import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Layer from "effect/Layer";
import * as Chunk from "effect/Chunk";
import { HttpClientImpl } from "../../httpClient/service.js";
import { MemoryStreamClientImpl } from "../service.js";
import { MemoryStreamClientConfigType } from "../types.js";
import { HttpError, NetworkError, AuthorizationError as HttpClientAuthorizationError } from "../../httpClient/errors.js";
import { StreamReadError, JsonParsingError } from "../errors.js";
import { SearchOptions, SearchResult } from "../../searchClient/api.js";
import { MemoryValidationError } from "../../memoryClient/errors.js";

// Mock the HttpClientImpl service
const mockHttpClient = {
  request: vi.fn(),
  requestStream: vi.fn(),
};

// Create a layer that provides the mocked HttpClientImpl
const mockHttpClientLayer = Layer.succeed(HttpClientImpl, mockHttpClient as any);

const baseConfig: MemoryStreamClientConfigType = {
  namespace: "stream-test-ns",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "stream-api-key",
};

const createMemoryStreamClientLayer = (
  configOverrides?: Partial<MemoryStreamClientConfigType>
) => {
  return MemoryStreamClientImpl.Default({ ...baseConfig, ...configOverrides }).pipe(
    Layer.provide(mockHttpClientLayer)
  );
};

// Helper for creating a mock ReadableStream source for HttpClient.requestStream
const createMockByteStream = (textChunks: string[]): Stream.Stream<Uint8Array, HttpClientError> => {
  return Stream.fromIterable(textChunks.map(s => new TextEncoder().encode(s))).pipe(
    Stream.mapError((e) => new NetworkError({ cause: new Error(String(e)), url: "mock-url" })) // Ensure error type
  );
};

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
    mockHttpClient.requestStream.mockReturnValueOnce(Effect.succeed(createMockByteStream(ndjsonResponse)));

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      return yield* client.listAllKeys().pipe(Stream.runCollect);
    }).pipe(createMemoryStreamClientLayer());

    const result = await Effect.runPromise(program);
    expect(result.toArray()).toEqual(["key1", "key2", "key3"]);
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
    expect(mockHttpClient.requestStream).toHaveBeenCalledWith(
      "/api/v1/memories/keys/stream",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("streamSearch streams SearchResults correctly from NDJSON", async () => {
    const searchResults: SearchResult[] = [
      { memory: { key: "mem1", value: "foo" } as any, relevanceScore: 0.9 },
      { memory: { key: "mem2", value: "bar" } as any, relevanceScore: 0.8 },
    ];
    const ndjsonResponse = searchResults.map(JSON.stringify).map(s => s + "\n");
    mockHttpClient.requestStream.mockReturnValueOnce(Effect.succeed(createMockByteStream(ndjsonResponse)));

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      return yield* client.streamSearch("test query").pipe(Stream.runCollect);
    }).pipe(createMemoryStreamClientLayer());

    const result = await Effect.runPromise(program);
    expect(result.toArray()).toEqual(searchResults);
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
    expect(mockHttpClient.requestStream).toHaveBeenCalledWith(
      "/api/v1/search/stream",
      expect.objectContaining({
        method: "GET",
        queryParams: { q: "test query", filters: "{}", limit: undefined, offset: undefined, minRelevanceScore: undefined, maxAgeHours: undefined }
      })
    );
  });

  it("listAllKeys fails on initial 401 AuthorizationError", async () => {
    mockHttpClient.requestStream.mockReturnValueOnce(
      Effect.fail(new HttpClientAuthorizationError({ reason: "Bad Auth", url: "/keys/stream" }))
    );

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      return yield* client.listAllKeys().pipe(Stream.runCollect);
    }).pipe(createMemoryStreamClientLayer());

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Effect.Cause.failureOption(result.cause);
      expect(error.pipe(Effect.Option.isSome)).toBe(true);
      if (error.pipe(Effect.Option.isSome)) {
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
    mockHttpClient.requestStream.mockReturnValueOnce(Effect.succeed(createMockByteStream(malformedNdjsonResponse)));

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      return yield* client.listAllKeys().pipe(Stream.runCollect);
    }).pipe(createMemoryStreamClientLayer());

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Effect.Cause.failureOption(result.cause);
      expect(error.pipe(Effect.Option.isSome)).toBe(true);
      if (error.pipe(Effect.Option.isSome)) {
        expect(error.value).toBeInstanceOf(StreamReadError);
        expect(error.value.message).toContain("Failed to parse stream item as key");
      }
    }
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
  });

  it("listAllKeys handles stream interruption gracefully (cancellation propagation)", async () => {
    // This test ensures `reader.cancel()` is called. The mock setup for `createMockReadableStream`
    // includes a `cancel` spy on its reader.
    const mockCancelFn = vi.fn(() => Promise.resolve());
    const mockBody = {
      getReader: () => ({
        read: vi.fn(() => Promise.resolve({ value: new TextEncoder().encode('{"key":"data"}\n'), done: false })),
        releaseLock: vi.fn(),
        cancel: mockCancelFn,
      }),
    };
    mockHttpClient.requestStream.mockReturnValueOnce(
      Effect.succeed(
        Stream.fromReadableStream(() => mockBody as any, new NetworkError({ cause: new Error("mock"), url: "mock" }))
      )
    );

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.listAllKeys();
      return yield* stream.pipe(Stream.take(1), Stream.runCollect); // Take only one, then interrupt
    }).pipe(createMemoryStreamClientLayer());

    await Effect.runPromise(program);

    expect(mockCancelFn).toHaveBeenCalledTimes(1); // Underlying stream reader's cancel should be called
    expect(mockHttpClient.requestStream).toHaveBeenCalledTimes(1);
  });

  it("streamSearch handles empty results stream", async () => {
    mockHttpClient.requestStream.mockReturnValueOnce(Effect.succeed(createMockByteStream([]))); // Empty stream

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      return yield* client.streamSearch("no results query").pipe(Stream.runCollect);
    }).pipe(createMemoryStreamClientLayer());

    const result = await Effect.runPromise(program);
    expect(result.toArray()).toEqual([]);
  });
});
