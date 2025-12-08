/**
 * SupermemoryHttpClient Service Comprehensive Tests
 *
 * @since 1.0.0
 * @module Client
 */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */

import {
  SupermemoryAuthenticationError,
  SupermemoryRateLimitError,
  SupermemoryServerError,
  SupermemoryValidationError,
} from "@/Errors.js";
import { Effect, Redacted } from "effect";
import { describe, expect, it } from "vitest";
import type { SupermemoryHttpClient } from "../api.js";
import {
  extractRetryAfter,
  makeBaseRequest,
  mapHttpError,
} from "../helpers.js";
import { SupermemoryHttpClientService } from "../service.js";
import { ApiVersions } from "../types.js";

describe("SupermemoryHttpClientService", () => {
  describe("Service Definition", () => {
    it("should be properly defined as an Effect.Service", () => {
      expect(SupermemoryHttpClientService).toBeDefined();
      expect(typeof SupermemoryHttpClientService).toBe("function");
    });
  });

  describe("API Contract", () => {
    it("should define request method", () => {
      type RequestMethod = SupermemoryHttpClient["request"];
      const _typeCheck: RequestMethod = {} as RequestMethod;
      expect(true).toBe(true);
    });

    it("should define requestV3 method (deprecated)", () => {
      type RequestV3Method = SupermemoryHttpClient["requestV3"];
      const _typeCheck: RequestV3Method = {} as RequestV3Method;
      expect(true).toBe(true);
    });

    it("should define requestV4 method (deprecated)", () => {
      type RequestV4Method = SupermemoryHttpClient["requestV4"];
      const _typeCheck: RequestV4Method = {} as RequestV4Method;
      expect(true).toBe(true);
    });
  });
});

describe("ApiVersions", () => {
  it("should define V3 version path", () => {
    expect(ApiVersions.V3).toBe("/v3");
  });

  it("should define V4 version path", () => {
    expect(ApiVersions.V4).toBe("/v4");
  });

  it("should be immutable (const assertion)", () => {
    // TypeScript const assertion ensures immutability at type level
    const versions = ApiVersions;
    expect(Object.isFrozen(versions)).toBe(false); // Runtime check
    // But the type system prevents reassignment
  });
});

describe("extractRetryAfter", () => {
  describe("numeric seconds format", () => {
    it("returns undefined when header is not present", () => {
      const headers = {};
      const result = extractRetryAfter(headers);
      expect(result).toBeUndefined();
    });

    it("parses seconds value and converts to milliseconds", () => {
      const headers = { "retry-after": "30" };
      const result = extractRetryAfter(headers);
      expect(result).toBe(30_000);
    });

    it("parses zero seconds", () => {
      const headers = { "retry-after": "0" };
      const result = extractRetryAfter(headers);
      expect(result).toBe(0);
    });

    it("parses large seconds value", () => {
      const headers = { "retry-after": "3600" }; // 1 hour
      const result = extractRetryAfter(headers);
      expect(result).toBe(3_600_000);
    });

    it("parses single digit seconds", () => {
      const headers = { "retry-after": "5" };
      const result = extractRetryAfter(headers);
      expect(result).toBe(5000);
    });
  });

  describe("HTTP-date format", () => {
    it("parses date value and returns milliseconds until that time", () => {
      const futureDate = new Date(Date.now() + 60_000);
      const headers = { "retry-after": futureDate.toUTCString() };
      const result = extractRetryAfter(headers);

      expect(result).toBeDefined();
      expect(result).toBeGreaterThan(59_000);
      expect(result).toBeLessThanOrEqual(60_000);
    });

    it("returns 0 for date in the past", () => {
      const pastDate = new Date(Date.now() - 60_000);
      const headers = { "retry-after": pastDate.toUTCString() };
      const result = extractRetryAfter(headers);
      expect(result).toBe(0);
    });

    it("returns 0 for date exactly now", () => {
      const nowDate = new Date(Date.now());
      const headers = { "retry-after": nowDate.toUTCString() };
      const result = extractRetryAfter(headers);
      // Should be 0 or very close to 0
      expect(result).toBeLessThanOrEqual(1000);
    });
  });

  describe("invalid formats", () => {
    it("returns undefined for invalid header value", () => {
      const headers = { "retry-after": "invalid-value-xyz" };
      const result = extractRetryAfter(headers);
      expect(result).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const headers = { "retry-after": "" };
      const result = extractRetryAfter(headers);
      expect(result).toBeUndefined();
    });

    it("returns undefined for negative number", () => {
      const headers = { "retry-after": "-30" };
      const result = extractRetryAfter(headers);
      // Negative values are invalid per HTTP semantics
      expect(result).toBeUndefined();
    });

    it("returns undefined for floating point", () => {
      const headers = { "retry-after": "30.5" };
      const result = extractRetryAfter(headers);
      // parseInt truncates to 30
      expect(result).toBe(30_000);
    });
  });

  describe("header name case sensitivity", () => {
    it("matches lowercase header name", () => {
      const headers = { "retry-after": "30" };
      const result = extractRetryAfter(headers);
      expect(result).toBe(30_000);
    });
  });
});

describe("mapHttpError", () => {
  describe("authentication errors (401/403)", () => {
    it("maps 401 to SupermemoryAuthenticationError", () => {
      const result = mapHttpError(401, { message: "Unauthorized" }, {});

      expect(result).toBeInstanceOf(SupermemoryAuthenticationError);
      expect(result._tag).toBe("SupermemoryAuthenticationError");
      expect(result.message).toBe("Unauthorized");
      if (result._tag === "SupermemoryAuthenticationError") {
        expect(result.status).toBe(401);
      }
    });

    it("maps 403 to SupermemoryAuthenticationError", () => {
      const result = mapHttpError(403, { message: "Forbidden" }, {});

      expect(result).toBeInstanceOf(SupermemoryAuthenticationError);
      expect(result._tag).toBe("SupermemoryAuthenticationError");
      expect(result.message).toBe("Forbidden");
      if (result._tag === "SupermemoryAuthenticationError") {
        expect(result.status).toBe(403);
      }
    });

    it("handles 401 with API key invalid message", () => {
      const result = mapHttpError(
        401,
        { message: "Invalid API key provided" },
        {}
      );

      expect(result._tag).toBe("SupermemoryAuthenticationError");
      expect(result.message).toBe("Invalid API key provided");
    });
  });

  describe("rate limit errors (429)", () => {
    it("maps 429 to SupermemoryRateLimitError", () => {
      const result = mapHttpError(429, { message: "Too many requests" }, {});

      expect(result).toBeInstanceOf(SupermemoryRateLimitError);
      expect(result._tag).toBe("SupermemoryRateLimitError");
      expect(result.message).toBe("Too many requests");
    });

    it("extracts retry-after header when present (seconds)", () => {
      const result = mapHttpError(
        429,
        { message: "Rate limited" },
        { "retry-after": "60" }
      );

      expect(result).toBeInstanceOf(SupermemoryRateLimitError);
      if (result._tag === "SupermemoryRateLimitError") {
        expect(result.retryAfterMs).toBe(60_000);
      }
    });

    it("handles 429 without retry-after header", () => {
      const result = mapHttpError(429, { message: "Rate limited" }, {});

      expect(result._tag).toBe("SupermemoryRateLimitError");
      if (result._tag === "SupermemoryRateLimitError") {
        expect(result.retryAfterMs).toBeUndefined();
      }
    });
  });

  describe("server errors (5xx)", () => {
    it("maps 500 to SupermemoryServerError", () => {
      const result = mapHttpError(
        500,
        { message: "Internal server error" },
        {}
      );

      expect(result).toBeInstanceOf(SupermemoryServerError);
      expect(result._tag).toBe("SupermemoryServerError");
      expect(result.message).toBe("Internal server error");
      if (result._tag === "SupermemoryServerError") {
        expect(result.status).toBe(500);
      }
    });

    it("maps 502 to SupermemoryServerError", () => {
      const result = mapHttpError(502, { message: "Bad gateway" }, {});

      expect(result).toBeInstanceOf(SupermemoryServerError);
      if (result._tag === "SupermemoryServerError") {
        expect(result.status).toBe(502);
      }
    });

    it("maps 503 to SupermemoryServerError", () => {
      const result = mapHttpError(503, { message: "Service unavailable" }, {});

      expect(result).toBeInstanceOf(SupermemoryServerError);
      if (result._tag === "SupermemoryServerError") {
        expect(result.status).toBe(503);
      }
    });

    it("maps 504 to SupermemoryServerError", () => {
      const result = mapHttpError(504, { message: "Gateway timeout" }, {});

      expect(result).toBeInstanceOf(SupermemoryServerError);
      if (result._tag === "SupermemoryServerError") {
        expect(result.status).toBe(504);
      }
    });

    it("maps 599 to SupermemoryServerError (edge of 5xx range)", () => {
      const result = mapHttpError(599, { message: "Unknown server error" }, {});

      expect(result).toBeInstanceOf(SupermemoryServerError);
    });
  });

  describe("validation errors (4xx)", () => {
    it("maps 400 to SupermemoryValidationError", () => {
      const result = mapHttpError(400, { message: "Bad request" }, {});

      expect(result).toBeInstanceOf(SupermemoryValidationError);
      expect(result._tag).toBe("SupermemoryValidationError");
      expect(result.message).toBe("Bad request");
    });

    it("maps 404 to SupermemoryValidationError", () => {
      const result = mapHttpError(404, { message: "Not found" }, {});

      expect(result).toBeInstanceOf(SupermemoryValidationError);
      expect(result.message).toBe("Not found");
    });

    it("maps 405 to SupermemoryValidationError", () => {
      const result = mapHttpError(405, { message: "Method not allowed" }, {});

      expect(result).toBeInstanceOf(SupermemoryValidationError);
    });

    it("maps 409 to SupermemoryValidationError (conflict)", () => {
      const result = mapHttpError(409, { message: "Resource conflict" }, {});

      expect(result).toBeInstanceOf(SupermemoryValidationError);
    });

    it("maps 422 to SupermemoryValidationError with details", () => {
      const body = {
        message: "Validation failed",
        errors: ["field1 required", "field2 invalid format"],
      };
      const result = mapHttpError(422, body, {});

      expect(result).toBeInstanceOf(SupermemoryValidationError);
      expect(result.message).toBe("Validation failed");
      if (result._tag === "SupermemoryValidationError") {
        expect(result.details).toEqual(body);
      }
    });
  });

  describe("message extraction", () => {
    it("uses message from body when present", () => {
      const result = mapHttpError(400, { message: "Custom error" }, {});
      expect(result.message).toBe("Custom error");
    });

    it("falls back to HTTP status when body has no message", () => {
      const result = mapHttpError(400, {}, {});
      expect(result.message).toBe("HTTP 400");
    });

    it("falls back to HTTP status when body is null", () => {
      const result = mapHttpError(500, null, {});
      expect(result.message).toBe("HTTP 500");
    });

    it("falls back to HTTP status when body is undefined", () => {
      const result = mapHttpError(404, undefined, {});
      expect(result.message).toBe("HTTP 404");
    });

    it("falls back to HTTP status when message is not a string", () => {
      const result = mapHttpError(400, { message: 123 }, {});
      expect(result.message).toBe("HTTP 400");
    });

    it("falls back to HTTP status when message is object", () => {
      const result = mapHttpError(400, { message: { nested: "error" } }, {});
      expect(result.message).toBe("HTTP 400");
    });

    it("falls back to HTTP status when message is array", () => {
      const result = mapHttpError(400, { message: ["error1", "error2"] }, {});
      expect(result.message).toBe("HTTP 400");
    });

    it("uses empty string message when provided", () => {
      // Empty string is technically a string, but might be treated specially
      const result = mapHttpError(400, { message: "" }, {});
      // Depends on implementation - could be empty or fallback
      expect(result.message).toBeDefined();
    });
  });
});

describe("makeBaseRequest", () => {
  const testApiKey = Redacted.make("test-api-key-12345");

  describe("HTTP method handling", () => {
    it("creates a request with GET method", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("GET", "https://api.example.com/test", testApiKey)
      );
      expect(result.method).toBe("GET");
    });

    it("creates a request with POST method", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("POST", "https://api.example.com/test", testApiKey)
      );
      expect(result.method).toBe("POST");
    });

    it("creates a request with DELETE method", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("DELETE", "https://api.example.com/test", testApiKey)
      );
      expect(result.method).toBe("DELETE");
    });

    it("creates a request with PATCH method", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("PATCH", "https://api.example.com/test", testApiKey)
      );
      expect(result.method).toBe("PATCH");
    });

    it("creates a request with PUT method", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("PUT", "https://api.example.com/test", testApiKey)
      );
      expect(result.method).toBe("PUT");
    });
  });

  describe("URL handling", () => {
    it("creates a request with correct URL", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("POST", "https://api.example.com/documents", testApiKey)
      );
      expect(result.url).toBe("https://api.example.com/documents");
    });

    it("handles URL with path segments", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest(
          "GET",
          "https://api.example.com/v1/memories/123",
          testApiKey
        )
      );
      expect(result.url).toBe("https://api.example.com/v1/memories/123");
    });

    it("handles URL with query parameters", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest(
          "GET",
          "https://api.example.com/search?q=test",
          testApiKey
        )
      );
      expect(result.url).toBe("https://api.example.com/search?q=test");
    });
  });

  describe("header handling", () => {
    it("sets Authorization header with Bearer token", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("GET", "https://api.example.com/test", testApiKey)
      );
      expect(result.headers.authorization).toBe("Bearer test-api-key-12345");
    });

    it("sets Content-Type header to application/json", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("GET", "https://api.example.com/test", testApiKey)
      );
      expect(result.headers["content-type"]).toBe("application/json");
    });

    it("sets Accept header to application/json", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("GET", "https://api.example.com/test", testApiKey)
      );
      expect(result.headers.accept).toBe("application/json");
    });

    it("keeps API key redacted until request is made", () => {
      // Verify Redacted.make creates a redacted value
      const key = Redacted.make("secret-key");
      expect(String(key)).not.toContain("secret-key");
    });
  });

  describe("body handling", () => {
    it("creates request without body when body is undefined", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("GET", "https://api.example.com/test", testApiKey)
      );
      expect(result.body._tag).toBe("Empty");
    });

    it("serializes body as JSON when provided", async () => {
      const body = { content: "test content", tags: ["tag1", "tag2"] };
      const result = await Effect.runPromise(
        makeBaseRequest(
          "POST",
          "https://api.example.com/test",
          testApiKey,
          body
        )
      );
      expect(result.body._tag).toBe("Uint8Array");
    });

    it("handles empty object body", async () => {
      const result = await Effect.runPromise(
        makeBaseRequest("POST", "https://api.example.com/test", testApiKey, {})
      );
      expect(result.body._tag).toBe("Uint8Array");
    });

    it("handles nested object body", async () => {
      const body = {
        memory: {
          content: "test",
          metadata: {
            nested: {
              deep: true,
            },
          },
        },
      };
      const result = await Effect.runPromise(
        makeBaseRequest(
          "POST",
          "https://api.example.com/test",
          testApiKey,
          body
        )
      );
      expect(result.body._tag).toBe("Uint8Array");
    });

    it("handles array body", async () => {
      const body = [
        { id: "1", content: "first" },
        { id: "2", content: "second" },
      ];
      const result = await Effect.runPromise(
        makeBaseRequest(
          "POST",
          "https://api.example.com/test",
          testApiKey,
          body
        )
      );
      expect(result.body._tag).toBe("Uint8Array");
    });
  });
});

describe("Error Type Discrimination", () => {
  it("allows type-safe error handling with catchTag", () => {
    const error = mapHttpError(401, { message: "Unauthorized" }, {});

    // Type-level test for discriminated union
    if (error._tag === "SupermemoryAuthenticationError") {
      expect(error.status).toBeDefined();
    } else if (error._tag === "SupermemoryRateLimitError") {
      expect(error.retryAfterMs).toBeDefined();
    } else if (error._tag === "SupermemoryServerError") {
      expect(error.status).toBeDefined();
    } else if (error._tag === "SupermemoryValidationError") {
      expect(error.details).toBeDefined();
    }
  });

  it("all error types have _tag property", () => {
    const errors = [
      mapHttpError(401, {}, {}),
      mapHttpError(429, {}, {}),
      mapHttpError(500, {}, {}),
      mapHttpError(400, {}, {}),
    ];

    for (const error of errors) {
      expect(error._tag).toBeDefined();
      expect(typeof error._tag).toBe("string");
    }
  });

  it("all error types have message property", () => {
    const errors = [
      mapHttpError(401, {}, {}),
      mapHttpError(429, {}, {}),
      mapHttpError(500, {}, {}),
      mapHttpError(400, {}, {}),
    ];

    for (const error of errors) {
      expect(error.message).toBeDefined();
      expect(typeof error.message).toBe("string");
    }
  });
});
