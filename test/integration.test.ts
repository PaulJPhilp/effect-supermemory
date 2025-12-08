/**
 * Integration Tests for effect-supermemory
 *
 * Tests all services against the real Supermemory API.
 * Requires SUPERMEMORY_API_KEY environment variable to be set.
 *
 * Environment variables are managed via effect-env:
 * - SUPERMEMORY_API_KEY (required)
 * - SUPERMEMORY_BASE_URL (optional, defaults to https://api.supermemory.ai)
 * - SUPERMEMORY_TIMEOUT_MS (optional, defaults to 30000)
 *
 * @since 1.0.0
 * @module Integration
 */

import { NodeHttpClient } from "@effect/platform-node";
// Services
import { SupermemoryHttpClientService } from "@services/client/service.js";
import { SupermemoryConfigFromEnv } from "@services/config/service.js";
import { ConnectionsService } from "@services/connections/service.js";
import { MemoriesService } from "@services/memories/service.js";
import { SearchService } from "@services/search/service.js";
import { SettingsService } from "@services/settings/service.js";
import { Effect, Layer } from "effect";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Test timeout (integration tests may be slow)
const TEST_TIMEOUT = 30_000;

/**
 * Check if the environment has a valid API key configured.
 * Simple direct check - doesn't rely on effect-env parsing.
 * Rejects placeholder values like "sk-your-api-key-here".
 */
function isEnvironmentConfigured(): boolean {
  const apiKey = process.env.SUPERMEMORY_API_KEY;
  if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
    return false;
  }
  // Reject common placeholder values
  const placeholders = [
    "sk-your-api-key-here",
    "your-api-key-here",
    "your_api_key",
    "your-api-key",
    "placeholder",
    "xxx",
  ];
  const lowerKey = apiKey.toLowerCase().trim();
  return !placeholders.some((p) => lowerKey.includes(p));
}

// Create test layer that provides all dependencies using effect-env

function createTestLayer(): Layer.Layer<any> {
  // Platform HTTP client layer (required by SupermemoryHttpClientService)
  const platformHttpLayer = NodeHttpClient.layer;

  // Combine config (from effect-env) and platform HTTP client as base
  const baseLayer = Layer.merge(SupermemoryConfigFromEnv, platformHttpLayer);

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

  // Merge all service layers
  return Layer.mergeAll(
    memoriesLayer,
    searchLayer,
    connectionsLayer,
    settingsLayer
  );
}

// Helper to run effects with test layer
function runTest<A>(
  effect: Effect.Effect<A, unknown, unknown>,
  testLayer: Layer.Layer<unknown>
): Promise<A> {
  return Effect.runPromise(effect.pipe(Effect.provide(testLayer)));
}

// Check environment at module load time (synchronous - no effect parsing needed)
const SKIP_INTEGRATION = !isEnvironmentConfigured();
const BASE_URL =
  process.env.SUPERMEMORY_BASE_URL || "https://api.supermemory.ai";

// Conditional describe based on environment configuration
// Note: We use a function to check SKIP_INTEGRATION dynamically
const _describeIntegration = (
  name: string,
  fn: () => void,
  _skip?: unknown
) => {
  describe(name, () => {
    let testLayer: Layer.Layer<unknown> | null = null;
    const createdMemoryIds: string[] = [];

    beforeAll(() => {
      if (SKIP_INTEGRATION) {
        console.log(
          "\n⚠️  Integration tests skipped: Environment not configured.\n" +
            "   Required environment variables (managed via effect-env):\n" +
            "   - SUPERMEMORY_API_KEY (required)\n" +
            "   - SUPERMEMORY_BASE_URL (optional)\n" +
            "   - SUPERMEMORY_TIMEOUT_MS (optional)\n" +
            "\n" +
            "   Set these in your .env file or shell environment.\n"
        );
        return;
      }

      testLayer = createTestLayer();
      console.log(
        "\n✅ Integration tests enabled via effect-env configuration.\n" +
          `   API Base URL: ${BASE_URL}\n`
      );
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

    // Run the test definitions
    fn();

    // Helper to conditionally run tests
    const _conditionalIt = (
      testName: string,
      testFn: () => Promise<void>,
      timeout?: number
    ) => {
      it(
        testName,
        async () => {
          if (SKIP_INTEGRATION || !testLayer) {
            return; // Skip silently - beforeAll already logged the message
          }
          await testFn();
        },
        timeout ?? TEST_TIMEOUT
      );
    };

    // Expose helpers via describe context (we'll define tests inline)
    // The actual tests are defined below
  });
};

describe("Integration Tests", () => {
  let testLayer: Layer.Layer<unknown> | null = null;
  const createdMemoryIds: string[] = [];

  beforeAll(() => {
    if (SKIP_INTEGRATION) {
      console.log(
        "\n⚠️  Integration tests skipped: SUPERMEMORY_API_KEY not set.\n" +
          "   Set SUPERMEMORY_API_KEY in your .env file to run integration tests.\n"
      );
      return;
    }

    testLayer = createTestLayer();
    console.log(
      `\n✅ Integration tests enabled.\n   API Base URL: ${BASE_URL}\n`
    );
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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

        const result = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            const r = yield* memories.add({
              content:
                "Integration test memory: Effect-TS is a powerful TypeScript library for building type-safe applications.",
              metadata: { source: "integration-test", timestamp: Date.now() },
              containerTag: "integration-test",
            });
            if (r.id) {
              createdMemoryIds.push(r.id);
            }
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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

        // First, create a memory
        const created = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            const r = yield* memories.add({
              content: "Test memory for get operation",
              containerTag: "integration-test",
            });
            if (r.id) {
              createdMemoryIds.push(r.id);
            }
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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

        // First, create a memory
        const created = await runTest(
          Effect.gen(function* () {
            const memories = yield* MemoriesService;
            const r = yield* memories.add({
              content: "Original content for update test",
              containerTag: "integration-test",
            });
            if (r.id) {
              createdMemoryIds.push(r.id);
            }
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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
      if (SKIP_INTEGRATION || !testLayer) {
        return;
      }

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
            if (r.id) {
              createdMemoryIds.push(r.id);
            }
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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

        const result = await runTest(
          Effect.gen(function* () {
            const connections = yield* ConnectionsService;
            return yield* connections.getByID("non-existent-id").pipe(
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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
        if (SKIP_INTEGRATION || !testLayer) {
          return;
        }

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
