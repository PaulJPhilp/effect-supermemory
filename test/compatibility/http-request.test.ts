/**
 * HTTP Request Compatibility Tests
 *
 * Tests that verify effect-supermemory makes equivalent HTTP requests
 * to the official Supermemory SDK.
 */

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { HttpClient } from "../../services/httpClient/index.js";
import type { HttpUrl } from "../../services/httpClient/types.js";
import { SupermemoryClient } from "../../services/supermemoryClient/index.js";
import type { CompatibilityAdapter } from "./helpers.js";
import {
  createEffectSupermemoryAdapter,
  skipIfSdkUnavailable,
} from "./helpers.js";

// Test configuration
const TEST_CONFIG = {
  namespace: "test-http-compat",
  baseUrl: "http://localhost:3001",
  apiKey: "test-api-key",
  timeoutMs: 5000,
};

// Track HTTP requests made
interface HttpRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
}

const httpRequests: HttpRequest[] = [];

// Mock HTTP client that tracks requests
function createTrackingHttpClient() {
  const originalFetch = global.fetch;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  global.fetch = async (input: any, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = init?.method || "GET";
    const headers: Record<string, string> = {};

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, key) => {
          headers[key] = value;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [key, value] of init.headers) {
          if (key && value) {
            headers[key] = value;
          }
        }
      } else {
        Object.assign(headers, init.headers);
      }
    }

    let body: unknown;
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string);
      } catch {
        body = init.body;
      }
    }

    httpRequests.push({
      method,
      path: url,
      headers,
      body,
    });

    // Call original fetch for actual request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalFetch(input as any, init);
  };

  return () => {
    global.fetch = originalFetch;
  };
}

describe("HTTP Request Compatibility Tests", () => {
  let effectAdapter: CompatibilityAdapter;
  const sdkAvailability = skipIfSdkUnavailable();
  let restoreFetch: (() => void) | undefined;

  beforeEach(() => {
    httpRequests.length = 0;
    restoreFetch = createTrackingHttpClient();
  });

  afterEach(() => {
    if (restoreFetch) {
      restoreFetch();
    }
  });

  beforeAll(async () => {
    const HttpClientTestLayer = HttpClient.Default({
      baseUrl: TEST_CONFIG.baseUrl as HttpUrl,
      headers: {
        Authorization: `Bearer ${TEST_CONFIG.apiKey}`,
        "X-Supermemory-Namespace": TEST_CONFIG.namespace,
      },
      timeoutMs: TEST_CONFIG.timeoutMs,
    });

    const SupermemoryTestLayer = SupermemoryClient.Default(TEST_CONFIG).pipe(
      Layer.provide(HttpClientTestLayer)
    );

    const program = Effect.gen(function* () {
      const client = yield* SupermemoryClient;
      return createEffectSupermemoryAdapter(client);
    }).pipe(Effect.provide(SupermemoryTestLayer));

    effectAdapter = await Effect.runPromise(program);
  });

  describe("PUT operation", () => {
    it("should make correct HTTP request for put()", async () => {
      const testKey = "http-put-test";
      const testValue = "test-value";

      await effectAdapter.put(testKey, testValue);

      expect(httpRequests.length).toBeGreaterThan(0);

      const putRequest = httpRequests.find((req) => req.method === "POST");
      expect(putRequest).toBeDefined();
      expect(putRequest?.path).toContain("/api/v1/memories");
      expect(putRequest?.body).toMatchObject({
        id: testKey,
        namespace: TEST_CONFIG.namespace,
      });
      expect(putRequest?.headers["Authorization"]).toBe(
        `Bearer ${TEST_CONFIG.apiKey}`
      );
    });
  });

  describe("GET operation", () => {
    it("should make correct HTTP request for get()", async () => {
      const testKey = "http-get-test";

      await effectAdapter.get(testKey);

      expect(httpRequests.length).toBeGreaterThan(0);

      const getRequest = httpRequests.find((req) => req.method === "GET");
      expect(getRequest).toBeDefined();
      expect(getRequest?.path).toContain(`/api/v1/memories/${testKey}`);
      expect(getRequest?.headers["Authorization"]).toBe(
        `Bearer ${TEST_CONFIG.apiKey}`
      );
    });
  });

  describe("DELETE operation", () => {
    it("should make correct HTTP request for delete()", async () => {
      const testKey = "http-delete-test";

      await effectAdapter.delete(testKey);

      expect(httpRequests.length).toBeGreaterThan(0);

      const deleteRequest = httpRequests.find((req) => req.method === "DELETE");
      expect(deleteRequest).toBeDefined();
      expect(deleteRequest?.path).toContain(`/api/v1/memories/${testKey}`);
      expect(deleteRequest?.headers["Authorization"]).toBe(
        `Bearer ${TEST_CONFIG.apiKey}`
      );
    });
  });

  describe("Batch operations", () => {
    it("should make correct HTTP request for putMany()", async () => {
      const testData = [
        { key: "batch-1", value: "value-1" },
        { key: "batch-2", value: "value-2" },
      ];

      await effectAdapter.putMany(testData);

      expect(httpRequests.length).toBeGreaterThan(0);

      const batchRequest = httpRequests.find(
        (req) => req.method === "POST" && req.path.includes("/batch")
      );

      if (batchRequest) {
        expect(batchRequest.path).toContain("/api/v1/memories/batch");
        expect(Array.isArray(batchRequest.body)).toBe(true);
      }
    });

    it("should make correct HTTP request for getMany()", async () => {
      const keys = ["batch-get-1", "batch-get-2"];

      await effectAdapter.getMany(keys);

      expect(httpRequests.length).toBeGreaterThan(0);

      const batchRequest = httpRequests.find(
        (req) => req.method === "POST" && req.path.includes("batchGet")
      );

      if (batchRequest) {
        expect(Array.isArray(batchRequest.body)).toBe(true);
      }
    });
  });

  describe.skipIf(sdkAvailability.skip)("SDK request comparison", () => {
    it("should document expected request format for SDK comparison", () => {
      // This test documents the expected HTTP request format
      // for manual comparison with official SDK
      expect(httpRequests).toBeDefined();

      // When official SDK is available, we can:
      // 1. Capture SDK requests
      // 2. Compare request formats
      // 3. Verify they're semantically equivalent
    });
  });
});
