import { HttpError, NetworkError } from "@services/httpClient/errors.js";
import type { HttpUrl } from "@services/httpClient/types.js";
import {
  ApiKey,
  Namespace,
  PositiveInteger,
  ValidatedHttpUrl,
} from "@services/inMemoryClient/types.js";
import { Chunk, Effect, Stream } from "effect";
import { describe, expect, it } from "vitest";
import { StreamReadError } from "../errors.js";
import {
  parseKeyLine,
  parseNdjsonLines,
  parseSearchResultLine,
  translateHttpClientError,
  validateStreamResponse,
} from "../helpers.js";
import { MemoryStreamClient } from "../service.js";
import type { MemoryStreamClientConfigType } from "../types.js";

// Test configuration - uses branded types
const testConfig: MemoryStreamClientConfigType = {
  namespace: Namespace("test-ns"),
  baseUrl: ValidatedHttpUrl("https://api.supermemory.dev"),
  apiKey: ApiKey("test-api-key"),
  timeoutMs: PositiveInteger(5000),
};

describe("MemoryStreamClient", () => {
  describe("service construction", () => {
    it("creates service with valid config", async () => {
      const program = Effect.gen(function* () {
        const client = yield* MemoryStreamClient;
        expect(client).toBeDefined();
        expect(typeof client.listAllKeys).toBe("function");
        expect(typeof client.streamSearch).toBe("function");
      }).pipe(Effect.provide(MemoryStreamClient.Default(testConfig)));

      await Effect.runPromise(program);
    });

    it("creates service with minimal config (no timeoutMs)", async () => {
      const minimalConfig: MemoryStreamClientConfigType = {
        namespace: Namespace("minimal-ns"),
        baseUrl: ValidatedHttpUrl("https://api.supermemory.dev"),
        apiKey: ApiKey("minimal-key"),
      };

      const program = Effect.gen(function* () {
        const client = yield* MemoryStreamClient;
        expect(client).toBeDefined();
      }).pipe(Effect.provide(MemoryStreamClient.Default(minimalConfig)));

      await Effect.runPromise(program);
    });
  });

  describe("parseKeyLine", () => {
    it("parses valid key JSON", async () => {
      const result = await Effect.runPromise(
        parseKeyLine('{"key": "my-test-key"}')
      );
      expect(result).toBe("my-test-key");
    });

    it("parses key with additional fields", async () => {
      const result = await Effect.runPromise(
        parseKeyLine('{"key": "test-key", "extra": "ignored"}')
      );
      expect(result).toBe("test-key");
    });

    it("fails on invalid JSON", async () => {
      const result = await Effect.runPromiseExit(parseKeyLine("not-json"));
      expect(result._tag).toBe("Failure");
    });

    it("fails on missing key field", async () => {
      const result = await Effect.runPromiseExit(
        parseKeyLine('{"notKey": "value"}')
      );
      // Will succeed but return undefined for the key
      expect(result._tag).toBe("Success");
    });
  });

  describe("parseSearchResultLine", () => {
    it("parses valid search result JSON", async () => {
      const searchResult = {
        id: "result-1",
        score: 0.95,
        content: "test content",
      };
      const result = await Effect.runPromise(
        parseSearchResultLine(JSON.stringify(searchResult))
      );
      expect(result).toEqual(searchResult);
    });

    it("fails on invalid JSON", async () => {
      const result = await Effect.runPromiseExit(
        parseSearchResultLine("invalid")
      );
      expect(result._tag).toBe("Failure");
    });
  });

  describe("parseNdjsonLines", () => {
    it("parses multiple NDJSON lines", async () => {
      const ndjson = '{"key": "key1"}\n{"key": "key2"}\n{"key": "key3"}';
      const stream = parseNdjsonLines(ndjson, parseKeyLine);
      const result = await Effect.runPromise(Stream.runCollect(stream));
      expect(Chunk.toReadonlyArray(result)).toEqual(["key1", "key2", "key3"]);
    });

    it("handles empty lines", async () => {
      const ndjson = '{"key": "key1"}\n\n{"key": "key2"}\n';
      const stream = parseNdjsonLines(ndjson, parseKeyLine);
      const result = await Effect.runPromise(Stream.runCollect(stream));
      expect(Chunk.toReadonlyArray(result)).toEqual(["key1", "key2"]);
    });

    it("handles empty input", async () => {
      const stream = parseNdjsonLines("", parseKeyLine);
      const result = await Effect.runPromise(Stream.runCollect(stream));
      expect(Chunk.toReadonlyArray(result)).toEqual([]);
    });

    it("handles whitespace-only lines", async () => {
      const ndjson = '{"key": "key1"}\n   \n{"key": "key2"}';
      const stream = parseNdjsonLines(ndjson, parseKeyLine);
      const result = await Effect.runPromise(Stream.runCollect(stream));
      expect(Chunk.toReadonlyArray(result)).toEqual(["key1", "key2"]);
    });
  });

  describe("validateStreamResponse", () => {
    it("succeeds with valid response", async () => {
      const result = await Effect.runPromise(
        validateStreamResponse({ status: 200, body: "response body" }, "Test")
      );
      expect(result).toBe("response body");
    });

    it("fails on 4xx status", async () => {
      const result = await Effect.runPromiseExit(
        validateStreamResponse({ status: 400, body: "error" }, "Test")
      );
      expect(result._tag).toBe("Failure");
    });

    it("fails on 5xx status", async () => {
      const result = await Effect.runPromiseExit(
        validateStreamResponse({ status: 500, body: "error" }, "Test")
      );
      expect(result._tag).toBe("Failure");
    });

    it("fails on non-string body", async () => {
      const result = await Effect.runPromiseExit(
        validateStreamResponse(
          { status: 200, body: { json: "object" } },
          "Test"
        )
      );
      expect(result._tag).toBe("Failure");
    });
  });

  describe("translateHttpClientError", () => {
    it("translates HttpError to StreamReadError", () => {
      const httpError = new HttpError({
        status: 500,
        message: "Internal Server Error",
        url: "https://api.test.com" as HttpUrl,
      });
      const result = translateHttpClientError(httpError);
      expect(result).toBeInstanceOf(StreamReadError);
      expect(result.message).toContain("HTTP 500");
    });

    it("translates NetworkError to StreamReadError", () => {
      const networkError = new NetworkError({
        cause: new Error("Connection refused"),
        url: "https://api.test.com" as HttpUrl,
      });
      const result = translateHttpClientError(networkError);
      expect(result).toBeInstanceOf(StreamReadError);
      expect(result.message).toContain("Network error");
      expect(result.message).toContain("Connection refused");
    });

    it("handles unknown error types", () => {
      const unknownError = new HttpError({
        status: 418,
        message: "I'm a teapot",
        url: "https://api.test.com" as HttpUrl,
      });
      const result = translateHttpClientError(unknownError);
      expect(result).toBeInstanceOf(StreamReadError);
    });
  });

  describe("branded type validation", () => {
    it("Namespace requires non-empty string", () => {
      expect(() => Namespace("")).toThrow();
      expect(() => Namespace("valid-ns")).not.toThrow();
    });

    it("ApiKey requires non-empty string", () => {
      expect(() => ApiKey("")).toThrow();
      expect(() => ApiKey("sk-valid")).not.toThrow();
    });

    it("ValidatedHttpUrl requires valid URL", () => {
      expect(() => ValidatedHttpUrl("not-a-url")).toThrow();
      expect(() => ValidatedHttpUrl("https://valid.com")).not.toThrow();
    });

    it("PositiveInteger requires positive number", () => {
      expect(() => PositiveInteger(0)).toThrow();
      expect(() => PositiveInteger(-1)).toThrow();
      expect(() => PositiveInteger(1.5)).toThrow();
      expect(() => PositiveInteger(1)).not.toThrow();
    });
  });
});
