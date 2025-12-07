/**
 * SupermemoryConfig Service Unit Tests
 *
 * @since 1.0.0
 * @module Config
 */

import { Effect, Redacted } from "effect";
import { describe, expect, it } from "vitest";
import type { SupermemoryConfig } from "../api.js";
import {
  SupermemoryConfigFromValues,
  SupermemoryConfigService,
} from "../service.js";

describe("SupermemoryConfigService", () => {
  it("should be properly defined as an Effect.Service", () => {
    expect(SupermemoryConfigService).toBeDefined();
  });

  describe("SupermemoryConfigFromValues", () => {
    it("should create a config layer with all values provided", async () => {
      const testConfig: SupermemoryConfig = {
        apiKey: Redacted.make("test-api-key"),
        workspaceId: "test-workspace",
        baseUrl: "https://test.api.example.com",
        defaultThreshold: 0.85,
        timeoutMs: 60_000,
      };

      const testLayer = SupermemoryConfigFromValues(testConfig);

      const program = Effect.gen(function* () {
        const config = yield* SupermemoryConfigService;
        return config;
      }).pipe(Effect.provide(testLayer)) as Effect.Effect<
        SupermemoryConfig,
        never,
        never
      >;

      const result = await Effect.runPromise(program);

      expect(result.apiKey).toBe(testConfig.apiKey);
      expect(result.workspaceId).toBe("test-workspace");
      expect(result.baseUrl).toBe("https://test.api.example.com");
      expect(result.defaultThreshold).toBe(0.85);
      expect(result.timeoutMs).toBe(60_000);
    });

    it("should use default values for optional fields", async () => {
      const testConfig = {
        apiKey: Redacted.make("test-api-key"),
      };

      const testLayer = SupermemoryConfigFromValues(testConfig);

      const program = Effect.gen(function* () {
        const config = yield* SupermemoryConfigService;
        return config;
      }).pipe(Effect.provide(testLayer)) as Effect.Effect<
        SupermemoryConfig,
        never,
        never
      >;

      const result = await Effect.runPromise(program);

      expect(result.apiKey).toBe(testConfig.apiKey);
      expect(result.workspaceId).toBeUndefined();
      expect(result.baseUrl).toBe("https://api.supermemory.ai");
      expect(result.defaultThreshold).toBe(0.7);
      expect(result.timeoutMs).toBe(30_000);
    });

    it("should allow partial config with some optional values", async () => {
      const testConfig = {
        apiKey: Redacted.make("test-api-key"),
        workspaceId: "custom-workspace",
        baseUrl: "https://custom.api.com",
        // defaultThreshold and timeoutMs should use defaults
      };

      const testLayer = SupermemoryConfigFromValues(testConfig);

      const program = Effect.gen(function* () {
        const config = yield* SupermemoryConfigService;
        return config;
      }).pipe(Effect.provide(testLayer)) as Effect.Effect<
        SupermemoryConfig,
        never,
        never
      >;

      const result = await Effect.runPromise(program);

      expect(result.apiKey).toBe(testConfig.apiKey);
      expect(result.workspaceId).toBe("custom-workspace");
      expect(result.baseUrl).toBe("https://custom.api.com");
      expect(result.defaultThreshold).toBe(0.7);
      expect(result.timeoutMs).toBe(30_000);
    });

    it("should handle undefined workspaceId explicitly", async () => {
      const testConfig = {
        apiKey: Redacted.make("test-api-key"),
        workspaceId: undefined,
      };

      const testLayer = SupermemoryConfigFromValues(testConfig);

      const program = Effect.gen(function* () {
        const config = yield* SupermemoryConfigService;
        return config;
      }).pipe(Effect.provide(testLayer)) as Effect.Effect<
        SupermemoryConfig,
        never,
        never
      >;

      const result = await Effect.runPromise(program);

      expect(result.workspaceId).toBeUndefined();
    });

    it("should preserve redacted API key", async () => {
      const redactedKey = Redacted.make("secret-key-123");
      const testConfig = {
        apiKey: redactedKey,
      };

      const testLayer = SupermemoryConfigFromValues(testConfig);

      const program = Effect.gen(function* () {
        const config = yield* SupermemoryConfigService;
        return config;
      }).pipe(Effect.provide(testLayer)) as Effect.Effect<
        SupermemoryConfig,
        never,
        never
      >;

      const result = await Effect.runPromise(program);

      expect(result.apiKey).toBe(redactedKey);
      expect(Redacted.value(result.apiKey)).toBe("secret-key-123");
    });

    it("should handle edge case values", async () => {
      const testConfig = {
        apiKey: Redacted.make("test-key"),
        defaultThreshold: 0.0,
        timeoutMs: 1,
      };

      const testLayer = SupermemoryConfigFromValues(testConfig);

      const program = Effect.gen(function* () {
        const config = yield* SupermemoryConfigService;
        return config;
      }).pipe(Effect.provide(testLayer)) as Effect.Effect<
        SupermemoryConfig,
        never,
        never
      >;

      const result = await Effect.runPromise(program);

      expect(result.defaultThreshold).toBe(0.0);
      expect(result.timeoutMs).toBe(1);
    });

    it("should handle maximum threshold value", async () => {
      const testConfig = {
        apiKey: Redacted.make("test-key"),
        defaultThreshold: 1.0,
      };

      const testLayer = SupermemoryConfigFromValues(testConfig);

      const program = Effect.gen(function* () {
        const config = yield* SupermemoryConfigService;
        return config;
      }).pipe(Effect.provide(testLayer)) as Effect.Effect<
        SupermemoryConfig,
        never,
        never
      >;

      const result = await Effect.runPromise(program);

      expect(result.defaultThreshold).toBe(1.0);
    });
  });
});
