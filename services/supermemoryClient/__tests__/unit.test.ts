import { describe, it, expect, vi, beforeEach } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { HttpClientImpl } from "../../httpClient/service.js"; // Dependency to mock
import { HttpClientError, HttpError, AuthorizationError as HttpClientAuthorizationError } from "../../httpClient/errors.js";
import { SupermemoryClientImpl, SupermemoryClientConfig, supermemoryClientEffect } from "../service.js";
import { SupermemoryClientConfigType } from "../types.js";
import { MemoryClient } from "../../memoryClient/api.js"; // Import MemoryClient interface for type checking
import { MemoryValidationError, MemoryNotFoundError } from "../../memoryClient/errors.js"; // Expected error types
import { SupermemoryClient } from "../api.js";
import * as Utils from "../utils.js";

// Mock the HttpClientImpl service
const mockHttpClient = {
  request: vi.fn(),
};

// Create a layer that provides the mocked HttpClientImpl
const mockHttpClientLayer = Layer.succeed(HttpClientImpl, mockHttpClient as any);

const baseConfig: SupermemoryClientConfigType = {
  namespace: "test-ns",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "test-api-key",
};

// Create a SupermemoryClient layer using the mock HttpClient
const createSupermemoryClientLayer = (
  configOverrides?: Partial<SupermemoryClientConfigType>
) => {
  const config = { ...baseConfig, ...configOverrides };
  return Layer.merge(
    mockHttpClientLayer,
    Layer.effect(SupermemoryClientImpl, supermemoryClientEffect),
    Layer.succeed(SupermemoryClientConfig, config)
  );
};

describe("SupermemoryClientImpl", () => {
  beforeEach(() => {
    mockHttpClient.request.mockReset();
  });

  it("put sends a POST request with base64 encoded value", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({
        status: 201,
        headers: new Headers(),
        body: { id: "test-key", value: Utils.toBase64("test-value"), namespace: "test-ns" },
      })
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.put("test-key", "test-value");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    await Effect.runPromise(program);

    expect(mockHttpClient.request).toHaveBeenCalledWith(
      "/api/v1/memories",
      expect.objectContaining({
        method: "POST",
        body: {
          id: "test-key",
          value: Utils.toBase64("test-value"),
          namespace: "test-ns",
        },
      })
    );
  });

  it("get sends a GET request and returns decoded value", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({
        status: 200,
        headers: new Headers(),
        body: { id: "test-key", value: Utils.toBase64("decoded-value"), namespace: "test-ns" },
      })
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.get("test-key");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    const result = await Effect.runPromise(program);
    expect(result).toBe("decoded-value");
  });

  it("get returns undefined for 404 Not Found", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.fail(
        new HttpError({ status: 404, message: "Not Found", url: "/api/v1/memories/nonexistent" })
      )
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.get("nonexistent-key");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    const result = await Effect.runPromise(program);
    expect(result).toBeUndefined();
  });

  it("delete sends a DELETE request and returns true for success", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({ status: 204, headers: new Headers(), body: null })
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.delete("test-key");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    const result = await Effect.runPromise(program);
    expect(result).toBe(true);
  });

  it("delete returns true for 404 Not Found (idempotent)", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.fail(
        new HttpError({ status: 404, message: "Not Found", url: "/api/v1/memories/nonexistent" })
      )
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.delete("nonexistent-key");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    const result = await Effect.runPromise(program);
    expect(result).toBe(true);
  });

  it("exists sends a GET request and returns true for 200 OK", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({
        status: 200,
        headers: new Headers(),
        body: { id: "test-key", value: "foo", namespace: "test-ns" },
      })
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.exists("test-key");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    const result = await Effect.runPromise(program);
    expect(result).toBe(true);
  });

  it("exists returns false for 404 Not Found", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.fail(
        new HttpError({ status: 404, message: "Not Found", url: "/api/v1/memories/nonexistent" })
      )
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.exists("nonexistent-key");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    const result = await Effect.runPromise(program);
    expect(result).toBe(false);
  });

  it("clear sends a DELETE request to the bulk endpoint", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.succeed({ status: 204, headers: new Headers(), body: null })
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.clear();
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    await Effect.runPromise(program);

    expect(mockHttpClient.request).toHaveBeenCalledWith(
      "/api/v1/memories",
      expect.objectContaining({
        method: "DELETE",
        queryParams: { namespace: "test-ns" },
      })
    );
  });

  it("translates HttpClient AuthorizationError to MemoryValidationError", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.fail(
        new HttpClientAuthorizationError({ reason: "Invalid API key", url: "/api/v1/memories" })
      )
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.put("key", "value");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(MemoryValidationError);
        expect(error.value.message).toContain("Authorization failed: Invalid API key");
      }
    }
  });

  it("translates generic HttpError to MemoryValidationError", async () => {
    mockHttpClient.request.mockReturnValueOnce(
      Effect.fail(
        new HttpError({ status: 500, message: "Internal Server Error", url: "/api/v1/memories" })
      )
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.put("key", "value");
    }).pipe(Effect.provide(createSupermemoryClientLayer()));

    const result = await Effect.runPromiseExit(program);

    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(MemoryValidationError);
        expect(error.value.message).toContain("API request failed: HttpError - Internal Server Error");
      }
    }
  });
});
