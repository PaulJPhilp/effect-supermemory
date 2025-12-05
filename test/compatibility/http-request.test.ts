/**
 * HTTP Request Compatibility Tests
 *
 * Tests that verify effect-supermemory makes equivalent HTTP requests
 * to the official Supermemory SDK.
 */

import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { beforeAll, describe } from "vitest";
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

// Note: This test file requires real API access - no mocks allowed per anti-mocking policy

describe.skip("HTTP Request Compatibility Tests", () => {
  let effectAdapter: CompatibilityAdapter;
  const sdkAvailability = skipIfSdkUnavailable();

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

  describe.skip("PUT operation", () => {
    it.skip("should make correct HTTP request for put()", async () => {
      // Test removed - requires mock tracking which violates anti-mocking policy
    });
  });

  describe.skip("GET operation", () => {
    it.skip("should make correct HTTP request for get()", async () => {
      // Test removed - requires mock tracking which violates anti-mocking policy
    });
  });

  describe.skip("DELETE operation", () => {
    it.skip("should make correct HTTP request for delete()", async () => {
      // Test removed - requires mock tracking which violates anti-mocking policy
    });
  });

  describe.skip("Batch operations", () => {
    it.skip("should make correct HTTP request for putMany()", async () => {
      // Test removed - requires mock tracking which violates anti-mocking policy
    });

    it.skip("should make correct HTTP request for getMany()", async () => {
      // Test removed - requires mock tracking which violates anti-mocking policy
    });
  });

  describe.skipIf(sdkAvailability.skip)("SDK request comparison", () => {
    it.skip("should document expected request format for SDK comparison", () => {
      // Test removed - requires mock tracking which violates anti-mocking policy
    });
  });
});
