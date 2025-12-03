import { Cause, Effect, Layer, Option, Stream } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthorizationError as HttpClientAuthorizationError } from "../../httpClient/errors.js";
import { HttpClientImpl } from "../../httpClient/service.js";
import type { HttpUrl } from "../../httpClient/types.js";
import { MemoryValidationError } from "../../memoryClient/errors.js";
import type { SearchResult } from "../../searchClient/types.js";
import { StreamReadError } from "../errors.js";
import { MemoryStreamClientImpl } from "../service.js";
import type { MemoryStreamClientConfigType } from "../types.js";

// Mock the HttpClientImpl service
const mockHttpClient = {
  request: vi.fn(),
  requestStream: vi.fn(),
};

// Create a layer that provides the mocked HttpClientImpl
const mockHttpClientLayer = Layer.succeed(
  HttpClientImpl,
  mockHttpClient as any
);

const baseConfig: MemoryStreamClientConfigType = {
  namespace: "stream-test-ns",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "stream-api-key",
};

const createMemoryStreamClientLayer = (
  configOverrides?: Partial<MemoryStreamClientConfigType>
) =>
  MemoryStreamClientImpl.Default({
    ...baseConfig,
    ...configOverrides,
  }).pipe(Layer.provide(mockHttpClientLayer));

describe("MemoryStreamClientImpl", () => {
  beforeEach(() => {
    mockHttpClient.request.mockReset();
    mockHttpClient.requestStream.mockReset();
  });

  it("listAllKeys streams keys correctly from NDJSON", async () => {
    const ndjsonResponse =
      '{"key": "key1"}\n{"key": "key2"}\n{"key": "key3"}\n';
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({
        status: 200,
        headers: new Headers(),
        body: ndjsonResponse,
      })
    );

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.listAllKeys();
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));

    const result = await Effect.runPromise(program);
    expect(Array.from(result)).toEqual(["key1", "key2", "key3"]);
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    expect(mockHttpClient.request).toHaveBeenCalledWith(
      "/v1/keys/stream-test-ns",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("streamSearch streams SearchResults correctly from NDJSON", async () => {
    const searchResults: SearchResult[] = [
      { memory: { key: "mem1", value: "foo" }, relevanceScore: 0.9 },
      { memory: { key: "mem2", value: "bar" }, relevanceScore: 0.8 },
    ];
    const ndjsonResponse = `${searchResults
      .map((r) => JSON.stringify(r))
      .join("\n")}\n`;
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({
        status: 200,
        headers: new Headers(),
        body: ndjsonResponse,
      })
    );

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.streamSearch("test query", {});
      return yield* Stream.runCollect(stream);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));

    const result = await Effect.runPromise(program);
    expect(Array.from(result)).toEqual(searchResults);
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    expect(mockHttpClient.request).toHaveBeenCalledWith(
      "/v1/search/stream-test-ns/stream",
      expect.objectContaining({
        method: "GET",
        queryParams: expect.objectContaining({ q: "test query" }),
      })
    );
  });

  it("listAllKeys fails on initial 401 AuthorizationError", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.fail(
        new HttpClientAuthorizationError({
          reason: "Bad Auth",
          url: "/keys/stream" as HttpUrl,
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
      }
    }
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
  });

  it("listAllKeys fails on mid-stream JSON parsing error", async () => {
    const malformedNdjsonResponse =
      '{"key": "key1"}\n{"key": "key2", "malformed"\n{"key": "key3"}\n';
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({
        status: 200,
        headers: new Headers(),
        body: malformedNdjsonResponse,
      })
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
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
  });

  it("listAllKeys handles stream interruption gracefully", async () => {
    const ndjsonResponse =
      '{"key": "key1"}\n{"key": "key2"}\n{"key": "key3"}\n';
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({
        status: 200,
        headers: new Headers(),
        body: ndjsonResponse,
      })
    );

    const program = Effect.gen(function* () {
      const client = yield* MemoryStreamClientImpl;
      const stream = yield* client.listAllKeys();
      return yield* stream.pipe(Stream.take(1), Stream.runCollect);
    }).pipe(Effect.provide(createMemoryStreamClientLayer()));

    const result = await Effect.runPromise(program);
    expect(Array.from(result)).toEqual(["key1"]);
    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
  });

  it("streamSearch handles empty results stream", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({
        status: 200,
        headers: new Headers(),
        body: "",
      })
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
