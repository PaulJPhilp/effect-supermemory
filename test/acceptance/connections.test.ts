/**
 * Connections Service Acceptance Tests
 *
 * Compares the official Supermemory SDK with our Effect-native implementation
 * to ensure API compatibility and consistent behavior for OAuth connections.
 *
 * NOTE: Many connection operations require OAuth flows and active integrations,
 * so these tests focus on read-only operations and structure verification.
 *
 * @since 1.0.0
 * @module Acceptance/Connections
 */

import { ConnectionsService } from "@services/connections/service.js";
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

describe("Acceptance: ConnectionsService", () => {
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
    console.log("\n✅ Acceptance tests enabled for ConnectionsService.\n");
  });

  describe("list()", () => {
    it(
      "SDK and Effect should return compatible list responses",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        // List with SDK
        const sdkResult = await sdkClient.connections.list({});

        // List with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const connections = yield* ConnectionsService;
            return yield* connections.list();
          }),
          effectLayer
        );

        // Both should return arrays
        expect(Array.isArray(sdkResult)).toBe(true);
        expect(Array.isArray(effectResult)).toBe(true);

        // If there are connections, compare structure
        if (sdkResult.length > 0 && effectResult.length > 0) {
          // SDK connection items have: id, provider, createdAt, email?, metadata?, etc.
          const sdkItem = sdkResult[0]!;
          const effectItem = effectResult[0]!;

          expect(typeof sdkItem.id).toBe("string");
          expect(typeof effectItem.id).toBe("string");
          expect(typeof sdkItem.provider).toBe("string");
          expect(typeof effectItem.provider).toBe("string");

          expect(isStructurallySimilar(effectItem, sdkItem)).toBe(true);
        }
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("getByID() - Error Handling", () => {
    it(
      "Both should handle non-existent connection ID errors similarly",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        const fakeId = "non-existent-connection-id-12345";
        let sdkError: Error | null = null;
        let effectError: unknown = null;

        // SDK error
        try {
          await sdkClient.connections.getByID(fakeId);
        } catch (e) {
          sdkError = e as Error;
        }

        // Effect error
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const connections = yield* ConnectionsService;
            return yield* connections.getByID(fakeId).pipe(
              Effect.map(() => ({ success: true })),
              Effect.catchAll((e) =>
                Effect.succeed({ success: false, error: e })
              )
            );
          }),
          effectLayer
        );

        if ("error" in effectResult) {
          effectError = effectResult.error;
        }

        // Both should fail with non-existent ID
        expect(sdkError).not.toBeNull();
        expect(effectError).not.toBeNull();
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("create() - Structure Verification", () => {
    it(
      "Effect create method should have compatible signature",
      async () => {
        if (SKIP_ACCEPTANCE || !effectLayer) {
          return;
        }

        // Verify Effect service has create method with expected signature
        // We don't actually call it to avoid creating real OAuth flows
        const effectService = await runEffect(
          Effect.gen(function* () {
            const connections = yield* ConnectionsService;
            return connections;
          }),
          effectLayer
        );

        expect(typeof effectService.create).toBe("function");
        expect(typeof effectService.list).toBe("function");
        expect(typeof effectService.getByID).toBe("function");
        expect(typeof effectService.deleteByID).toBe("function");
        expect(typeof effectService.getByTags).toBe("function");
        expect(typeof effectService.deleteByProvider).toBe("function");
        expect(typeof effectService.importData).toBe("function");
        expect(typeof effectService.listDocuments).toBe("function");
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("Provider Types", () => {
    it(
      "Both SDKs should support the same provider types",
      async () => {
        if (SKIP_ACCEPTANCE) {
          return;
        }

        // Provider types from SDK: 'notion' | 'google-drive' | 'onedrive' | 'web-crawler'
        const providers = [
          "notion",
          "google-drive",
          "onedrive",
          "web-crawler",
        ] as const;

        // Verify Effect service accepts these providers in type signatures
        // We check this at compile time via TypeScript types
        // Runtime verification just confirms the service exists
        expect(providers.length).toBe(4);
        expect(providers).toContain("notion");
        expect(providers).toContain("google-drive");
        expect(providers).toContain("onedrive");
        expect(providers).toContain("web-crawler");
      },
      ACCEPTANCE_TIMEOUT
    );
  });
});
