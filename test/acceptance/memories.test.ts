/**
 * Memories Service Acceptance Tests
 *
 * Compares the official Supermemory SDK with our Effect-native implementation
 * to ensure API compatibility and consistent behavior.
 *
 * @since 1.0.0
 * @module Acceptance/Memories
 */

import { MemoriesService } from "@services/memories/service.js";
import { Effect, type Layer } from "effect";
import type Supermemory from "supermemory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ACCEPTANCE_TIMEOUT,
  createEffectTestLayer,
  createOfficialSDKClient,
  isStructurallySimilar,
  runEffect,
  SKIP_ACCEPTANCE,
  sleep,
  TestCleanup,
  uniqueTestTag,
} from "./helpers.js";

describe("Acceptance: MemoriesService", () => {
  let sdkClient: Supermemory;
  // biome-ignore lint/suspicious/noExplicitAny: Complex layer composition types
  let effectLayer: Layer.Layer<any>;
  const cleanup = new TestCleanup();
  const testTag = uniqueTestTag("acceptance-memories");

  beforeAll(() => {
    if (SKIP_ACCEPTANCE) {
      console.log(
        "\n⚠️  Acceptance tests skipped: SUPERMEMORY_API_KEY not set.\n"
      );
      return;
    }
    sdkClient = createOfficialSDKClient();
    effectLayer = createEffectTestLayer();
    console.log("\n✅ Acceptance tests enabled for MemoriesService.\n");
  });

  afterAll(async () => {
    if (!SKIP_ACCEPTANCE && sdkClient) {
      await cleanup.cleanupWithSDK(sdkClient);
    }
  });

  describe("add()", () => {
    it(
      "SDK and Effect should produce compatible add responses",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        const content = "Acceptance test content for add comparison.";
        const testMetadata = {
          source: "acceptance-test",
          timestamp: Date.now(),
        };

        // Call official SDK
        const sdkResult = await sdkClient.memories.add({
          content,
          metadata: testMetadata,
          containerTag: testTag,
        });
        if (sdkResult.id) {
          cleanup.track(sdkResult.id);
        }

        // Call Effect implementation
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.add({
              content,
              metadata: testMetadata,
              containerTag: testTag,
            });
          }),
          effectLayer
        );
        if (effectResult.id) {
          cleanup.track(effectResult.id);
        }

        // Compare results
        expect(sdkResult).toBeDefined();
        expect(effectResult).toBeDefined();

        // Both should have id and status
        expect(typeof sdkResult.id).toBe("string");
        expect(typeof effectResult.id).toBe("string");
        expect(sdkResult.id.length).toBeGreaterThan(0);
        expect(effectResult.id.length).toBeGreaterThan(0);

        // Structure should be similar
        expect(isStructurallySimilar(effectResult, sdkResult)).toBe(true);
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("get()", () => {
    it(
      "SDK and Effect should retrieve the same memory",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        // First, create a memory with SDK
        const createResult = await sdkClient.memories.add({
          content: "Memory content for get() acceptance test",
          containerTag: testTag,
        });
        expect(createResult.id).toBeDefined();
        cleanup.track(createResult.id);

        // Wait for indexing
        await sleep(1000);

        // Get with SDK
        const sdkResult = await sdkClient.memories.get(createResult.id);

        // Get with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.get(createResult.id);
          }),
          effectLayer
        );

        // Compare key fields
        expect(sdkResult.id).toBe(effectResult.id);
        expect(isStructurallySimilar(effectResult, sdkResult)).toBe(true);

        // Both should have required fields
        expect(typeof sdkResult.id).toBe("string");
        expect(typeof effectResult.id).toBe("string");
        expect(typeof sdkResult.createdAt).toBe("string");
        expect(typeof effectResult.createdAt).toBe("string");
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("list()", () => {
    it(
      "SDK and Effect should return compatible list responses",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        // Create a few memories first
        for (let i = 0; i < 3; i++) {
          const result = await sdkClient.memories.add({
            content: `List test memory ${i}`,
            containerTag: testTag,
          });
          cleanup.track(result.id);
        }

        // Wait for indexing
        await sleep(2000);

        // List with SDK
        const sdkResult = await sdkClient.memories.list({
          containerTags: [testTag],
          limit: 10,
        });

        // List with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.list({
              containerTags: [testTag],
              limit: 10,
            });
          }),
          effectLayer
        );

        // Compare structure
        expect(sdkResult.memories).toBeDefined();
        expect(effectResult.memories).toBeDefined();
        expect(Array.isArray(sdkResult.memories)).toBe(true);
        expect(Array.isArray(effectResult.memories)).toBe(true);

        // Both should have pagination
        expect(sdkResult.pagination).toBeDefined();
        expect(effectResult.pagination).toBeDefined();

        // Structure should be compatible
        expect(isStructurallySimilar(effectResult, sdkResult)).toBe(true);
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("update()", () => {
    it(
      "SDK and Effect should produce compatible update responses",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        // Create a memory with SDK
        const created = await sdkClient.memories.add({
          content: "Original content for update test",
          containerTag: testTag,
        });
        cleanup.track(created.id);

        // Wait for processing
        await sleep(1000);

        const updateMetadata = { updated: true, timestamp: Date.now() };

        // Update with SDK
        const sdkResult = await sdkClient.memories.update(created.id, {
          metadata: updateMetadata,
        });

        // Create another memory to update with Effect
        const created2 = await sdkClient.memories.add({
          content: "Original content for update test 2",
          containerTag: testTag,
        });
        cleanup.track(created2.id);

        // Wait for processing
        await sleep(1000);

        // Update with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.update(created2.id, {
              metadata: updateMetadata,
            });
          }),
          effectLayer
        );

        // Both should return update response with id
        expect(sdkResult.id).toBe(created.id);
        expect(effectResult.id).toBe(created2.id);

        // Structure should be similar
        expect(isStructurallySimilar(effectResult, sdkResult)).toBe(true);
      },
      ACCEPTANCE_TIMEOUT * 2
    );
  });

  describe("delete()", () => {
    it(
      "Both SDK and Effect should successfully delete memories",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        // Create two memories
        const sdkMemory = await sdkClient.memories.add({
          content: "Memory for SDK delete test",
          containerTag: testTag,
        });

        const effectMemory = await sdkClient.memories.add({
          content: "Memory for Effect delete test",
          containerTag: testTag,
        });

        // Wait for indexing
        await sleep(1000);

        // Delete with SDK (returns void)
        await sdkClient.memories.delete(sdkMemory.id);

        // Delete with Effect
        await runEffect(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            yield* memories.delete(effectMemory.id);
          }),
          effectLayer
        );

        // Verify both are deleted by trying to get them
        try {
          await sdkClient.memories.get(sdkMemory.id);
          expect.fail("SDK memory should have been deleted");
        } catch {
          // Expected - memory was deleted
        }

        const effectGetResult = await runEffect(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.get(effectMemory.id).pipe(
              Effect.map(() => "found"),
              Effect.catchAll(() => Effect.succeed("not-found"))
            );
          }),
          effectLayer
        );
        expect(effectGetResult).toBe("not-found");
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("Error Handling", () => {
    it(
      "Both should handle non-existent memory errors similarly",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        const fakeId = "non-existent-memory-id-12345";
        let sdkError: Error | null = null;
        let effectError: unknown = null;

        // SDK error
        try {
          await sdkClient.memories.get(fakeId);
        } catch (e) {
          sdkError = e as Error;
        }

        // Effect error
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.get(fakeId).pipe(
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

        // Both should have failed
        expect(sdkError).not.toBeNull();
        expect(effectError).not.toBeNull();
      },
      ACCEPTANCE_TIMEOUT
    );
  });
});
