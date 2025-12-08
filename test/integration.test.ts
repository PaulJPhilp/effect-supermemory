/**
 * Integration Tests for effect-supermemory
 *
 * Tests all services against the real Supermemory API.
 * Requires SUPERMEMORY_API_KEY environment variable to be set.
 *
 * @since 1.0.0
 * @module Integration
 */

import { NodeHttpClient } from "@effect/platform-node";
import { Effect, Layer, Redacted } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Services
import { SupermemoryHttpClientService } from "@services/client/service.js";
import { SupermemoryConfigFromValues } from "@services/config/service.js";
import { ConnectionsService } from "@services/connections/service.js";
import { MemoriesService } from "@services/memories/service.js";
import { SearchService } from "@services/search/service.js";
import { SettingsService } from "@services/settings/service.js";

// Check if API key is available (must be non-empty string)
const API_KEY = process.env.SUPERMEMORY_API_KEY?.trim();
const BASE_URL =
  process.env.SUPERMEMORY_BASE_URL ?? "https://api.supermemory.ai";
const SKIP_INTEGRATION = !API_KEY || API_KEY.length === 0;

// Test timeout (integration tests may be slow)
const TEST_TIMEOUT = 30_000;

// Create test layer that provides all dependencies
// biome-ignore lint/suspicious/noExplicitAny: Complex layer types require any for test composition
function createTestLayer(): Layer.Layer<any> {
  if (!API_KEY) {
    throw new Error("SUPERMEMORY_API_KEY is required for integration tests");
  }

  // Configuration layer
  const configLayer = SupermemoryConfigFromValues({
    apiKey: Redacted.make(API_KEY),
    baseUrl: BASE_URL,
    timeoutMs: TEST_TIMEOUT,
  });

  // Platform HTTP client layer (required by SupermemoryHttpClientService)
  const platformHttpLayer = NodeHttpClient.layer;

  // Combine config and platform HTTP client as base
  const baseLayer = Layer.merge(configLayer, platformHttpLayer);

  // Supermemory HTTP client layer
  const supermemoryHttpClientLayer = Layer.provide(
    SupermemoryHttpClientService.Default,
    baseLayer
  );

  // Create layers for each service
  const memoriesLayer = Layer.provide(
    MemoriesService.Default,
    supermemoryHttpClientLayer
  );
  const searchLayer = Layer.provide(
    SearchService.Default,
    supermemoryHttpClientLayer
  );
  const connectionsLayer = Layer.provide(
    ConnectionsService.Default,
    supermemoryHttpClientLayer
  );
  const settingsLayer = Layer.provide(
    SettingsService.Default,
    supermemoryHttpClientLayer
  );

  // Merge all service layers and cast to any to bypass complex type inference
  return Layer.mergeAll(
    memoriesLayer,
    searchLayer,
    connectionsLayer,
    settingsLayer
    // biome-ignore lint/suspicious/noExplicitAny: Complex layer composition requires any cast
  ) as unknown as Layer.Layer<any>;
}

// Helper to run effects with test layer
// biome-ignore lint/suspicious/noExplicitAny: Complex effect types require any for test composition
async function runTest<A>(
  // biome-ignore lint/suspicious/noExplicitAny: Complex effect types require any for test composition
  effect: Effect.Effect<A, any, any>,
  // biome-ignore lint/suspicious/noExplicitAny: Complex layer types require any for test composition
  testLayer: Layer.Layer<any>
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(testLayer)));
}

// Conditional describe based on API key availability
const describeIf = SKIP_INTEGRATION ? describe.skip : describe;

describeIf("Integration Tests", () => {
  // biome-ignore lint/suspicious/noExplicitAny: Complex layer types require any for test composition
  let testLayer: Layer.Layer<any>;
  const createdMemoryIds: string[] = [];

  beforeAll(() => {
    testLayer = createTestLayer();
  });

  afterAll(async () => {
    // Cleanup: Delete any memories created during tests
    if (createdMemoryIds.length > 0 && testLayer) {
      for (const id of createdMemoryIds) {
        try {
          const cleanup = Effect.gen(function* () {
            const memories = yield* MemoriesService;
            yield* memories
              .delete(id)
              .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
          });
          await runTest(cleanup, testLayer);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  });

  describe("MemoriesService", () => {
    it(
      "should add a text memory",
      async () => {
        const result = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            const r = yield* memories.add({
              content:
                "Integration test memory: Effect-TS is a powerful TypeScript library for building type-safe applications.",
              metadata: { source: "integration-test", timestamp: Date.now() },
              containerTag: "integration-test",
            });
            if (r.id) createdMemoryIds.push(r.id);
            return r;
          }),
          testLayer
        );
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(typeof result.id).toBe("string");
      },
      TEST_TIMEOUT
    );

    it(
      "should list memories",
      async () => {
        const result = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.list({ limit: 10 });
          }),
          testLayer
        );
        expect(result).toBeDefined();
        expect(result.memories).toBeDefined();
        expect(Array.isArray(result.memories)).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "should get a specific memory by ID",
      async () => {
        // First, create a memory
        const created = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            const r = yield* memories.add({
              content: "Test memory for get operation",
              containerTag: "integration-test",
            });
            if (r.id) createdMemoryIds.push(r.id);
            return r;
          }),
          testLayer
        );

        // Then get it by ID
        const result = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.get(created.id);
          }),
          testLayer
        );
        expect(result).toBeDefined();
        expect(result.id).toBe(created.id);
      },
      TEST_TIMEOUT
    );

    it(
      "should update a memory",
      async () => {
        // First, create a memory
        const created = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            const r = yield* memories.add({
              content: "Original content for update test",
              containerTag: "integration-test",
            });
            if (r.id) createdMemoryIds.push(r.id);
            return r;
          }),
          testLayer
        );

        // Then update it
        const result = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.update(created.id, {
              metadata: { updated: true, timestamp: Date.now() },
            });
          }),
          testLayer
        );
        expect(result).toBeDefined();
        expect(result.id).toBe(created.id);
      },
      TEST_TIMEOUT
    );

    it(
      "should delete a memory",
      async () => {
        // First, create a memory
        const created = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.add({
              content: "Memory to be deleted",
              containerTag: "integration-test",
            });
          }),
          testLayer
        );

        // Then delete it
        const deleted = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            yield* memories.delete(created.id);
            return true;
          }),
          testLayer
        );
        expect(deleted).toBe(true);
      },
      TEST_TIMEOUT
    );
  });

  describe("SearchService", () => {
    // First, ensure there's some content to search
    beforeAll(async () => {
      try {
        await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            const r = yield* memories.add({
              content:
                "Supermemory is a long-term memory layer for AI applications. It helps with context retention and semantic search.",
              metadata: { type: "documentation", topic: "supermemory" },
              containerTag: "search-test",
            });
            if (r.id) createdMemoryIds.push(r.id);
            return r;
          }),
          testLayer
        );
        // Wait a bit for indexing
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch {
        // Ignore if seeding fails
      }
    }, TEST_TIMEOUT);

    it(
      "should search documents",
      async () => {
        const results = await runTest(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments("supermemory AI memory", {
              topK: 5,
            });
          }),
          testLayer
        );
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "should execute general search",
      async () => {
        const results = await runTest(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.execute("AI applications", { topK: 5 });
          }),
          testLayer
        );
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "should search memories",
      async () => {
        const results = await runTest(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchMemories("context retention", {
              topK: 5,
            });
          }),
          testLayer
        );
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "should search with threshold filter",
      async () => {
        const results = await runTest(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments("semantic search", {
              topK: 10,
              threshold: 0.5,
            });
          }),
          testLayer
        );
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "should search with rerank enabled",
      async () => {
        const results = await runTest(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments("AI memory layer", {
              topK: 5,
              rerank: true,
            });
          }),
          testLayer
        );
        expect(results).toBeDefined();
        expect(Array.isArray(results)).toBe(true);
      },
      TEST_TIMEOUT
    );
  });

  describe("ConnectionsService", () => {
    it(
      "should list connections",
      async () => {
        const result = await runTest(
          Effect.gen(function* () {
            const connections = yield* ConnectionsService;
            return yield* connections.list();
          }),
          testLayer
        );
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      "should handle non-existent connection gracefully",
      async () => {
        const result = await runTest(
          Effect.gen(function* () {
            const connections = yield* ConnectionsService;
            return yield* connections
              .getByID("non-existent-id")
              .pipe(
                Effect.map((r) => ({ success: true, data: r })),
                Effect.catchAll((error) =>
                  Effect.succeed({ success: false, error })
                )
              );
          }),
          testLayer
        );
        expect(result).toBeDefined();
        expect(typeof result.success).toBe("boolean");
      },
      TEST_TIMEOUT
    );
  });

  describe("SettingsService", () => {
    it(
      "should get organization settings",
      async () => {
        const result = await runTest(
          Effect.gen(function* () {
            const settings = yield* SettingsService;
            return yield* settings.get();
          }),
          testLayer
        );
        expect(result).toBeDefined();
        expect(typeof result).toBe("object");
      },
      TEST_TIMEOUT
    );
  });

  describe("Error Handling", () => {
    it(
      "should handle invalid memory ID",
      async () => {
        const result = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories
              .get("invalid-memory-id-12345")
              .pipe(Effect.either);
          }),
          testLayer
        );
        expect(result._tag).toBe("Left");
      },
      TEST_TIMEOUT
    );

    it(
      "should handle empty search query",
      async () => {
        const result = await runTest(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments("").pipe(Effect.either);
          }),
          testLayer
        );
        expect(result._tag).toBe("Left");
      },
      TEST_TIMEOUT
    );
  });

  describe("End-to-End Workflow", () => {
    it(
      "should complete full memory lifecycle",
      async () => {
        // 1. Create memory
        const created = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.add({
              content:
                "E2E test: This memory will be created, updated, searched, and deleted.",
              metadata: { test: "e2e", phase: "create" },
              containerTag: "e2e-test",
            });
          }),
          testLayer
        );
        expect(created.id).toBeDefined();
        const memoryId = created.id;

        // 2. Get memory
        const fetched = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.get(memoryId);
          }),
          testLayer
        );
        expect(fetched.id).toBe(memoryId);

        // 3. Update memory
        const updated = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.update(memoryId, {
              metadata: { test: "e2e", phase: "updated" },
            });
          }),
          testLayer
        );
        expect(updated.id).toBe(memoryId);

        // 4. Wait for indexing then search
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const searchResults = await runTest(
          Effect.gen(function* () {
            const search = yield* SearchService;
            return yield* search.searchDocuments("E2E test memory lifecycle", {
              topK: 10,
            });
          }),
          testLayer
        );
        expect(Array.isArray(searchResults)).toBe(true);

        // 5. Delete memory
        const deleted = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            yield* memories.delete(memoryId);
            return true;
          }),
          testLayer
        );
        expect(deleted).toBe(true);

        // 6. Verify deletion
        const verification = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            return yield* memories.get(memoryId).pipe(Effect.either);
          }),
          testLayer
        );
        expect(verification._tag).toBe("Left");
      },
      TEST_TIMEOUT * 3
    );
  });
});

// Print skip message if tests are skipped
if (SKIP_INTEGRATION) {
  console.log(
    "\n⚠️  Integration tests skipped: SUPERMEMORY_API_KEY environment variable not set or empty.\n" +
      "   To run integration tests:\n" +
      "   1. Set the API key in your environment: export SUPERMEMORY_API_KEY=your-api-key\n" +
      "   2. Or create a .env file with: SUPERMEMORY_API_KEY=your-api-key\n" +
      "\n" +
      "   Note: The API key must have access to the Supermemory API endpoints.\n"
  );
} else {
  console.log(
    "\n✅ Integration tests enabled with SUPERMEMORY_API_KEY.\n" +
      "   API Base URL: " + BASE_URL + "\n"
  );
}
