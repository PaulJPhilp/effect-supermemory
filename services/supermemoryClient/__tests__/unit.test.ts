import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { HttpClientImpl } from "../../httpClient/service.js"; // Dependency to mock
import { HttpClientError, HttpError, NetworkError, AuthorizationError as HttpClientAuthorizationError, TooManyRequestsError } from "../../httpClient/errors.js";
import { SupermemoryClientImpl } from "../service.js";
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
  const httpConfig: any = { baseUrl: config.baseUrl, headers: { "Authorization": `Bearer ${config.apiKey}`, "X-Supermemory-Namespace": config.namespace, "Content-Type": "application/json" } };
  if (config.timeoutMs !== undefined) httpConfig.timeoutMs = config.timeoutMs;
  return Layer.merge(
    mockHttpClientLayer,
    Layer.effect(SupermemoryClientImpl, supermemoryClientEffect),
    Layer.succeed(SupermemoryClientConfig, config),
    HttpClientImpl.Default(httpConfig)
  );
};

describe("SupermemoryClientImpl", () => {
  beforeEach(() => {
    mockHttpClient.request.mockReset();
    vi.useFakeTimers(); // Enable fake timers for Schedule testing
  });

  afterEach(() => {
    vi.runOnlyPendingTimers(); // Ensure any pending timers are run
    vi.useRealTimers(); // Restore real timers
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

    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
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

  // --- New Retry Tests ---

  it("retries on NetworkError and succeeds", async () => {
    mockHttpClient.request
      .mockReturnValueOnce(Effect.fail(new NetworkError({ cause: new Error("Connection failed"), url: "/memories" })))
      .mockReturnValueOnce(Effect.succeed({ status: 200, headers: new Headers(), body: { id: "foo", value: Utils.toBase64("bar"), namespace: "test-ns" } }));

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.get("foo");
    }).pipe(createSupermemoryClientLayer({ retries: { attempts: 2, delayMs: 100 } }));

    const promise = Effect.runPromise(program);
    await vi.advanceTimersByTimeAsync(100); // Advance for the delay

    const result = await promise;

    expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    expect(result).toBe("bar");
  });

  it("fails after exhausting retries for persistent 5xx error", async () => {
    mockHttpClient.request
      .mockReturnValue(Effect.fail(new HttpError({ status: 500, message: "Server Error", url: "/memories" })));

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.get("foo");
    }).pipe(createSupermemoryClientLayer({ retries: { attempts: 3, delayMs: 50 } }));

    const promise = Effect.runPromiseExit(program);
    await vi.advanceTimersByTimeAsync(50 * 2); // Advance for 2 delays (3 attempts = 2 delays)

    const result = await promise;

    expect(mockHttpClient.request).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(MemoryValidationError);
        expect(error.value.message).toContain("API request failed: HttpError - Server Error");
      }
    }
  });

  it("does not retry on 404 (get), returns undefined immediately", async () => {
    mockHttpClient.request
      .mockReturnValueOnce(Effect.fail(new HttpError({ status: 404, message: "Not Found", url: "/memories" })));

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.get("nonexistent");
    }).pipe(createSupermemoryClientLayer({ retries: { attempts: 5, delayMs: 100 } }));

    const result = await Effect.runPromise(program);

    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    expect(result).toBeUndefined();
  });

  it("does not retry on 401 (put), fails immediately", async () => {
    mockHttpClient.request
      .mockReturnValueOnce(Effect.fail(new HttpClientAuthorizationError({ reason: "Unauthorized", url: "/memories" })));

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.put("bad-auth", "value");
    }).pipe(createSupermemoryClientLayer({ retries: { attempts: 5, delayMs: 100 } }));

    const result = await Effect.runPromiseExit(program);

    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    expect(result._tag).toBe("Failure");
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(MemoryValidationError);
        expect(error.value.message).toContain("Authorization failed");
      }
    }
  });

  it("retries on 429 TooManyRequestsError and succeeds", async () => {
    mockHttpClient.request
      .mockReturnValueOnce(Effect.fail(new TooManyRequestsError({ retryAfterSeconds: 1, url: "/memories" })))
      .mockReturnValueOnce(Effect.succeed({ status: 200, headers: new Headers(), body: { id: "foo", value: Utils.toBase64("bar"), namespace: "test-ns" } }));

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.get("foo");
    }).pipe(createSupermemoryClientLayer({ retries: { attempts: 2, delayMs: 200 } }));

    const promise = Effect.runPromise(program);
    await vi.advanceTimersByTimeAsync(200); // Advance for the delay

    const result = await promise;

    expect(mockHttpClient.request).toHaveBeenCalledTimes(2);
    expect(result).toBe("bar");
  });

  it("no retries configured means no retries happen", async () => {
    mockHttpClient.request
      .mockReturnValueOnce(Effect.fail(new NetworkError({ cause: new Error("Connection failed"), url: "/memories" })));

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClientImpl;
      return yield* client.get("foo");
    }).pipe(createSupermemoryClientLayer({})); // Explicitly no retries

    const result = await Effect.runPromiseExit(program);

    expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    expect(result._tag).toBe("Failure");
    // Should contain the translated NetworkError
    if (result._tag === "Failure") {
      const error = Cause.failureOption(result.cause);
      expect(Option.isSome(error)).toBe(true);
      if (Option.isSome(error)) {
        expect(error.value).toBeInstanceOf(MemoryValidationError);
        expect(error.value.message).toContain("API request failed: NetworkError");
      }
    }
  });
});
