/**
 * SupermemoryHttpClient Service Tests
 *
 * @since 1.0.0
 * @module Client
 */

import {
  SupermemoryAuthenticationError,
  SupermemoryRateLimitError,
  SupermemoryServerError,
  SupermemoryValidationError,
} from "@/Errors.js";
import { Effect, Redacted } from "effect";
import { describe, expect, it } from "vitest";
import {
  extractRetryAfter,
  makeBaseRequest,
  mapHttpError,
} from "../helpers.js";
import { SupermemoryHttpClientService } from "../service.js";

describe("SupermemoryHttpClientService", () => {
  it("should be properly defined as an Effect.Service", () => {
    expect(SupermemoryHttpClientService).toBeDefined();
  });
});

describe("extractRetryAfter", () => {
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

  it("parses date value and returns milliseconds until that time", () => {
    // Set a date 60 seconds in the future
    const futureDate = new Date(Date.now() + 60_000);
    const headers = { "retry-after": futureDate.toUTCString() };
    const result = extractRetryAfter(headers);

    // Should be approximately 60000ms, allow some variance for test execution time
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

  it("returns undefined for invalid header value", () => {
    const headers = { "retry-after": "invalid-value-xyz" };
    const result = extractRetryAfter(headers);
    expect(result).toBeUndefined();
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
  });

  describe("rate limit errors (429)", () => {
    it("maps 429 to SupermemoryRateLimitError", () => {
      const result = mapHttpError(429, { message: "Too many requests" }, {});

      expect(result).toBeInstanceOf(SupermemoryRateLimitError);
      expect(result._tag).toBe("SupermemoryRateLimitError");
      expect(result.message).toBe("Too many requests");
    });

    it("extracts retry-after header when present", () => {
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

    it("maps 422 to SupermemoryValidationError", () => {
      const body = {
        message: "Validation failed",
        errors: ["field1 required"],
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
  });
});

describe("makeBaseRequest", () => {
  const testApiKey = Redacted.make("test-api-key-12345");

  it("creates a request with correct method", async () => {
    const result = await Effect.runPromise(
      makeBaseRequest("GET", "https://api.example.com/test", testApiKey)
    );

    expect(result.method).toBe("GET");
  });

  it("creates a request with correct URL", async () => {
    const result = await Effect.runPromise(
      makeBaseRequest("POST", "https://api.example.com/documents", testApiKey)
    );

    expect(result.url).toBe("https://api.example.com/documents");
  });

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

  it("creates request without body when body is undefined", async () => {
    const result = await Effect.runPromise(
      makeBaseRequest("GET", "https://api.example.com/test", testApiKey)
    );

    expect(result.body._tag).toBe("Empty");
  });

  it("serializes body as JSON when provided", async () => {
    const body = { content: "test content", tags: ["tag1", "tag2"] };
    const result = await Effect.runPromise(
      makeBaseRequest("POST", "https://api.example.com/test", testApiKey, body)
    );

    expect(result.body._tag).toBe("Uint8Array");
  });

  it("supports all HTTP methods", async () => {
    const methods = ["GET", "POST", "DELETE"] as const;

    for (const method of methods) {
      const result = await Effect.runPromise(
        makeBaseRequest(method, "https://api.example.com/test", testApiKey)
      );
      expect(result.method).toBe(method);
    }
  });
});
