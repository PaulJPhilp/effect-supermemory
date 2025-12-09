/**
 * Search Service Acceptance Tests
 *
 * Compares the official Supermemory SDK with our Effect-native implementation
 * to ensure API compatibility and consistent behavior for search operations.
 *
 * @since 1.0.0
 * @module Acceptance/Search
 */

import { SearchService } from "@services/search/service.js";
import { Effect, type Layer } from "effect";
import type Supermemory from "supermemory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ACCEPTANCE_TIMEOUT,
  createEffectTestLayer,
  createOfficialSDKClient,
  runEffect,
  SKIP_ACCEPTANCE,
  sleep,
  TestCleanup,
  uniqueTestTag,
} from "./helpers.js";

describe("Acceptance: SearchService", () => {
  let sdkClient: Supermemory;
  // biome-ignore lint/suspicious/noExplicitAny: Complex layer composition types
  let effectLayer: Layer.Layer<any>;
  const cleanup = new TestCleanup();
  const testTag = uniqueTestTag("acceptance-search");

  beforeAll(async () => {
    if (SKIP_ACCEPTANCE) {
      console.log(
        "\n⚠️  Acceptance tests skipped: SUPERMEMORY_API_KEY not set.\n"
      );
      return;
    }
    sdkClient = createOfficialSDKClient();
    effectLayer = createEffectTestLayer();
    console.log("\n✅ Acceptance tests enabled for SearchService.\n");

    // Seed some data for search tests
    try {
      const seeds = [
        "Supermemory provides long-term memory for AI applications with semantic search.",
        "Effect-TS is a powerful TypeScript library for building type-safe applications.",
        "TypeScript enables static typing for JavaScript with excellent developer experience.",
        "AI applications benefit from context retention and memory management.",
        "Semantic search enables finding relevant content based on meaning, not just keywords.",
      ];

      for (const content of seeds) {
        const result = await sdkClient.memories.add({
          content,
          containerTag: testTag,
          metadata: { type: "seed", test: "search-acceptance" },
        });
        cleanup.track(result.id);
      }

      // Wait for indexing
      await sleep(3000);
    } catch (e) {
      console.warn("Failed to seed test data:", e);
    }
  }, ACCEPTANCE_TIMEOUT * 2);

  afterAll(async () => {
    if (!SKIP_ACCEPTANCE && sdkClient) {
      await cleanup.cleanupWithSDK(sdkClient);
    }
  });

  describe("searchDocuments() / documents()", () => {
    it(
      "SDK and Effect should return compatible document search results",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        const query = "Supermemory AI memory";

        // Search with SDK
        const sdkResult = await sdkClient.search.documents({
          q: query,
          containerTags: [testTag],
          limit: 5,
        });

        // Search with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments(query, {
              topK: 5,
              containerTags: [testTag],
            });
          }),
          effectLayer
        );

        // SDK returns { results, timing, total }
        expect(sdkResult).toBeDefined();
        expect(sdkResult.results).toBeDefined();
        expect(Array.isArray(sdkResult.results)).toBe(true);

        // Effect returns array of DocumentChunks
        expect(effectResult).toBeDefined();
        expect(Array.isArray(effectResult)).toBe(true);

        // Results should have similar structure when we have results
        if (sdkResult.results.length > 0 && effectResult.length > 0) {
          // SDK results have: documentId, score, chunks, metadata, title, type
          // Our results should have similar fields
          const sdkItem = sdkResult.results[0]!;
          const effectItem = effectResult[0]!;

          // Both should have score
          expect(typeof sdkItem.score).toBe("number");
          expect(
            typeof effectItem.score === "number" ||
              effectItem.score === undefined
          ).toBe(true);
        }
      },
      ACCEPTANCE_TIMEOUT
    );

    it(
      "Both should handle search with threshold parameter",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        const query = "TypeScript static typing";

        // Search with SDK (uses chunkThreshold)
        const sdkResult = await sdkClient.search.documents({
          q: query,
          containerTags: [testTag],
          chunkThreshold: 0.5,
          limit: 5,
        });

        // Search with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments(query, {
              topK: 5,
              threshold: 0.5,
              containerTags: [testTag],
            });
          }),
          effectLayer
        );

        expect(sdkResult).toBeDefined();
        expect(effectResult).toBeDefined();
        expect(Array.isArray(sdkResult.results)).toBe(true);
        expect(Array.isArray(effectResult)).toBe(true);
      },
      ACCEPTANCE_TIMEOUT
    );

    it(
      "Both should handle search with rerank enabled",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        const query = "semantic search";

        // Search with SDK
        const sdkResult = await sdkClient.search.documents({
          q: query,
          containerTags: [testTag],
          rerank: true,
          limit: 5,
        });

        // Search with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments(query, {
              topK: 5,
              rerank: true,
              containerTags: [testTag],
            });
          }),
          effectLayer
        );

        expect(sdkResult).toBeDefined();
        expect(effectResult).toBeDefined();
        expect(Array.isArray(sdkResult.results)).toBe(true);
        expect(Array.isArray(effectResult)).toBe(true);
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("execute()", () => {
    it(
      "SDK execute and Effect execute should return compatible results",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        const query = "AI applications context";

        // Execute with SDK
        const sdkResult = await sdkClient.search.execute({
          q: query,
          containerTags: [testTag],
          limit: 5,
        });

        // Execute with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.execute(query, {
              topK: 5,
              containerTags: [testTag],
            });
          }),
          effectLayer
        );

        expect(sdkResult).toBeDefined();
        expect(effectResult).toBeDefined();
        expect(Array.isArray(sdkResult.results)).toBe(true);
        expect(Array.isArray(effectResult)).toBe(true);
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("searchMemories() / memories()", () => {
    it(
      "SDK and Effect should return compatible memory search results",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        const query = "memory management";

        // Search with SDK (v4 endpoint)
        const sdkResult = await sdkClient.search.memories({
          q: query,
          containerTag: testTag,
          limit: 5,
        });

        // Search with Effect
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchMemories(query, {
              topK: 5,
              containerTag: testTag,
            });
          }),
          effectLayer
        );

        // SDK returns { results, timing, total }
        expect(sdkResult).toBeDefined();
        expect(sdkResult.results).toBeDefined();
        expect(Array.isArray(sdkResult.results)).toBe(true);

        // Effect returns array
        expect(effectResult).toBeDefined();
        expect(Array.isArray(effectResult)).toBe(true);

        // Compare structure if both have results
        if (sdkResult.results.length > 0 && effectResult.length > 0) {
          // SDK results have: id, memory, similarity, metadata, updatedAt
          const sdkItem = sdkResult.results[0]!;
          expect(typeof sdkItem.id).toBe("string");
          expect(typeof sdkItem.memory).toBe("string");
          expect(typeof sdkItem.similarity).toBe("number");
        }
      },
      ACCEPTANCE_TIMEOUT
    );
  });

  describe("Error Handling", () => {
    it(
      "Both should handle empty query errors",
      async () => {
        if (SKIP_ACCEPTANCE || !sdkClient || !effectLayer) {
          return;
        }

        let sdkError: Error | null = null;
        let effectError: unknown = null;

        // SDK with empty query
        try {
          await sdkClient.search.documents({ q: "" });
        } catch (e) {
          sdkError = e as Error;
        }

        // Effect with empty query
        const effectResult = await runEffect(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments("").pipe(
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

        // Both should fail with empty query
        expect(sdkError).not.toBeNull();
        expect(effectError).not.toBeNull();
      },
      ACCEPTANCE_TIMEOUT
    );
  });
});
