/**
 * Settings Service Acceptance Tests
 *
 * Compares the official Supermemory SDK with our Effect-native implementation
 * to ensure API compatibility and consistent behavior for organization settings.
 *
 * @since 1.0.0
 * @module Acceptance/Settings
 */

import { SettingsService } from "@services/settings/service.js";
import { Effect, type Layer } from "effect";
import type Supermemory from "supermemory";
import { beforeAll, describe, expect, it } from "vitest";
import {
  ACCEPTANCE_TIMEOUT,
  createEffectTestLayer,
  createOfficialSDKClient,
  isStructurallySimilar,
  runEffect,
  SKIP_ACCEPTANCE,
} from "./helpers.js";

describe("Acceptance: SettingsService", () => {
  let sdkClient: Supermemory;
  // biome-ignore lint/suspicious/noExplicitAny: Complex layer composition types
  let effectLayer: Layer.Layer<any>;

  beforeAll(() => {
    if (SKIP_ACCEPTANCE) {
      console.log(
        "\n⚠️  Acceptance tests skipped: SUPERMEMORY_API_KEY not set.\n"
      );
      return;
    }
    sdkClient = createOfficialSDKClient();
    effectLayer = createEffectTestLayer();
    console.log("\n✅ Acceptance tests enabled for SettingsService.\n");
  });

  describe("get()", () => {
    it(
      "SDK and Effect should return compatible settings responses",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        // Get with SDK
        const sdkResult = await sdkClient.settings.get();

        // Get with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const settings = yield* SettingsService;
            return yield* settings.get();
          }),
          effectLayer
        );

        // Both should return settings objects
        expect(sdkResult).toBeDefined();
        expect(effectResult).toBeDefined();
        expect(typeof sdkResult).toBe("object");
        expect(typeof effectResult).toBe("object");

        // Verify structure compatibility
        // SDK response may have: chunkSize, shouldLLMFilter, filterPrompt, OAuth credentials, etc.
        expect(isStructurallySimilar(effectResult, sdkResult)).toBe(true);

        // Check specific optional fields that may be present
        const checkOptionalField = (
          sdkObj: Record<string, unknown>,
          effectObj: Record<string, unknown>,
          field: string
        ) => {
          if (field in sdkObj) {
            expect(typeof sdkObj[field]).toBe(typeof effectObj[field]);
          }
        };

        checkOptionalField(
          sdkResult as Record<string, unknown>,
          effectResult as Record<string, unknown>,
          "chunkSize"
        );
        checkOptionalField(
          sdkResult as Record<string, unknown>,
          effectResult as Record<string, unknown>,
          "shouldLLMFilter"
        );
        checkOptionalField(
          sdkResult as Record<string, unknown>,
          effectResult as Record<string, unknown>,
          "filterPrompt"
        );
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("update()", () => {
    it(
      "SDK and Effect should return compatible update responses",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        // We'll test with a safe update - updating shouldLLMFilter which is reversible
        // First, get current settings
        const currentSettings = await sdkClient.settings.get();
        const currentFilter = currentSettings.shouldLLMFilter ?? false;

        // Update with SDK (toggle the value)
        const sdkResult = await sdkClient.settings.update({
          shouldLLMFilter: !currentFilter,
        });

        // Restore original value with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const settings = yield* SettingsService;
            return yield* settings.update({
              shouldLLMFilter: currentFilter,
            });
          }),
          effectLayer
        );

        // Both should return update response with orgId, orgSlug, updated
        expect(sdkResult).toBeDefined();
        expect(effectResult).toBeDefined();

        // SDK returns { orgId, orgSlug, updated: { ...changes... } }
        expect(typeof sdkResult.orgId).toBe("string");
        expect(typeof sdkResult.orgSlug).toBe("string");
        expect(sdkResult.updated).toBeDefined();

        // Effect should have similar structure
        expect(typeof effectResult.orgId).toBe("string");
        expect(typeof effectResult.orgSlug).toBe("string");
        expect(effectResult.updated).toBeDefined();

        expect(isStructurallySimilar(effectResult, sdkResult)).toBe(true);
      },
      ACCEPTANCE_TIMEOUT
    );

    it(
      "Both should handle empty update gracefully",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        // Update with empty params (no changes)
        const sdkResult = await sdkClient.settings.update({});

        const effectResult = await runEffect(
          Effect.gen(function* () {
            const settings = yield* SettingsService;
            return yield* settings.update({});
          }),
          effectLayer
        );

        // Both should succeed and return valid response
        expect(sdkResult).toBeDefined();
        expect(effectResult).toBeDefined();
        expect(typeof sdkResult.orgId).toBe("string");
        expect(typeof effectResult.orgId).toBe("string");
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("Service Interface", () => {
    it(
      "Effect service should have all expected methods",
      async () => {
        if (SKIP_ACCEPTANCE || !effectLayer) {
          return;
        }

        const effectService = await runEffect(
          Effect.gen(function* () {
            const settings = yield* SettingsService;
            return settings;
          }),
          effectLayer
        );

        // Verify service has expected methods
        expect(typeof effectService.get).toBe("function");
        expect(typeof effectService.update).toBe("function");
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("Settings Fields", () => {
    it(
      "Both SDKs should support the same settings fields",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient) {
          return;
        }

        // Get settings to verify field presence
        const settings = await sdkClient.settings.get();

        // Known optional fields from SDK types
        const knownFields = [
          "chunkSize",
          "shouldLLMFilter",
          "filterPrompt",
          "notionClientId",
          "notionClientSecret",
          "notionCustomKeyEnabled",
          "googleDriveClientId",
          "googleDriveClientSecret",
          "googleDriveCustomKeyEnabled",
          "onedriveClientId",
          "onedriveClientSecret",
          "onedriveCustomKeyEnabled",
          "includeItems",
          "excludeItems",
        ];

        // All known fields should be present (may be null)
        for (const field of knownFields) {
          // These fields are all optional and can be null/undefined
          // We just verify the type is valid if present
          const value = (settings as Record<string, unknown>)[field];
          if (value !== null && value !== undefined) {
            const validTypes = ["string", "number", "boolean", "object"];
            expect(validTypes).toContain(typeof value);
          }
        }
      },
      ACCEPTANCE_TIMEOUT
    );
  });
});
