# Migrating from Supermemory SDK to effect-supermemory

**Why Effect-native matters for production AI applications**

---

## Introduction

If you're building AI applications with long-term memory using Supermemory, you've likely started with the official TypeScript SDK. It works well for simple use cases—but as your application grows, you'll encounter familiar challenges: error handling becomes a maze of try/catch blocks, testing requires extensive mocking, and composing async operations leads to callback hell or deeply nested promises.

`effect-supermemory` is an Effect-native client library that addresses these challenges while maintaining full API compatibility with Supermemory's official SDK. This article walks through migrating your existing code.

## Why Migrate?

### 1. Type-Safe Error Handling

The official SDK throws errors that you catch with try/catch:

```typescript
try {
  const memory = await client.memories.get("some-id");
} catch (error) {
  // error is `unknown` - what type is it? 
  // Is it a 404? A network error? Auth failure?
  if (error.status === 404) { /* maybe? */ }
}
```

With effect-supermemory, errors are part of the type signature:

```typescript
const result = yield* MemoriesService.get("some-id").pipe(
  Effect.catchTag("SupermemoryNotFoundError", () => 
    Effect.succeed(null)
  ),
  Effect.catchTag("SupermemoryAuthenticationError", (error) =>
    Effect.die(new Error(`Auth failed: ${error.message}`))
  )
);
// TypeScript knows exactly what errors can occur
```

### 2. Composable Operations

Effect operations compose naturally without callback nesting:

```typescript
const enrichedSearch = Effect.gen(function* () {
  // These run sequentially, but read like synchronous code
  const results = yield* SearchService.searchDocuments("AI memory");
  const enriched = yield* Effect.forEach(results, (doc) =>
    MemoriesService.get(doc.documentId)
  );
  return enriched;
});
```

### 3. Built-in Observability

Every operation automatically captures telemetry spans:

```typescript
// Operations are automatically traced
yield* MemoriesService.add({ content: "..." });
// → Span: supermemory.memories.add
//   → Attributes: content_length, container_tag, etc.
```

### 4. Dependency Injection Without Frameworks

Services are composed through Effect's layer system—no DI container required:

```typescript
// Swap implementations for testing without mocks
const TestLayer = Layer.succeed(MemoriesService, {
  add: () => Effect.succeed({ id: "test-id", status: "done" }),
  get: () => Effect.succeed({ id: "test-id", content: "test" }),
  // ...
});
```

## Migration Guide

### Step 1: Install Dependencies

```bash
bun add effect-supermemory effect @effect/platform-node
```

Keep `supermemory` as a dev dependency if you want type references during migration:

```bash
bun add -D supermemory
```

### Step 2: Set Up the Service Layer

Create a centralized layer file that composes all services:

```typescript
// src/services/supermemory.ts
import { NodeHttpClient } from "@effect/platform-node";
import {
  SupermemoryConfigFromEnv,
  SupermemoryHttpClientService,
  MemoriesService,
  SearchService,
  ConnectionsService,
  SettingsService,
} from "effect-supermemory";
import { Layer } from "effect";

// Platform HTTP client
const platformHttpLayer = NodeHttpClient.layer;

// Configuration from environment variables
const baseLayer = Layer.merge(SupermemoryConfigFromEnv, platformHttpLayer);

// Supermemory HTTP client with auth and error handling
const httpClientLayer = Layer.provide(
  SupermemoryHttpClientService.Default, 
  baseLayer
);

// Compose all service layers
export const SupermemoryLayer = Layer.mergeAll(
  Layer.provide(MemoriesService.Default, httpClientLayer),
  Layer.provide(SearchService.Default, httpClientLayer),
  Layer.provide(ConnectionsService.Default, httpClientLayer),
  Layer.provide(SettingsService.Default, httpClientLayer),
);
```

### Step 3: Configure Environment

Create or update your `.env` file:

```bash
SUPERMEMORY_API_KEY=sk-your-api-key-here
SUPERMEMORY_BASE_URL=https://api.supermemory.ai  # Optional
SUPERMEMORY_TIMEOUT_MS=30000                      # Optional
```

### Step 4: Migrate Functions

Here's the pattern for converting Promise-based code to Effect:

#### Before: Promise-based

```typescript
import Supermemory from "supermemory";

const client = new Supermemory({ 
  apiKey: process.env.SUPERMEMORY_API_KEY! 
});

async function addDocument(content: string, userId: string) {
  try {
    const result = await client.memories.add({
      content,
      containerTag: userId,
      metadata: { source: "api", timestamp: Date.now() }
    });
    console.log(`Added document: ${result.id}`);
    return result;
  } catch (error) {
    console.error("Failed to add document:", error);
    throw error;
  }
}

async function searchUserDocuments(userId: string, query: string) {
  const results = await client.search.documents({
    q: query,
    containerTags: [userId],
    limit: 10,
    rerank: true
  });
  return results.results;
}
```

#### After: Effect-based

```typescript
import { Effect } from "effect";
import { MemoriesService, SearchService } from "effect-supermemory";

const addDocument = (content: string, userId: string) =>
  Effect.gen(function* () {
    const result = yield* MemoriesService.add({
      content,
      containerTag: userId,
      metadata: { source: "api", timestamp: Date.now() }
    });
    yield* Effect.log(`Added document: ${result.id}`);
    return result;
  }).pipe(
    Effect.catchTag("SupermemoryValidationError", (error) =>
      Effect.logError(`Validation failed: ${error.message}`).pipe(
        Effect.andThen(Effect.fail(error))
      )
    )
  );

const searchUserDocuments = (userId: string, query: string) =>
  SearchService.searchDocuments(query, {
    containerTags: [userId],
    topK: 10,  // Note: 'limit' becomes 'topK'
    rerank: true
  });
```

### Step 5: Run Effects at Entry Points

Wrap your entry points with the layer:

```typescript
import { Effect } from "effect";
import { SupermemoryLayer } from "./services/supermemory";
import { addDocument, searchUserDocuments } from "./memory-ops";

// API route handler
export async function POST(request: Request) {
  const { content, userId } = await request.json();
  
  const program = addDocument(content, userId);
  
  const result = await Effect.runPromise(
    program.pipe(Effect.provide(SupermemoryLayer))
  );
  
  return Response.json(result);
}
```

## API Reference: Method Mapping

### Memories

| Official SDK | effect-supermemory |
|-------------|-------------------|
| `client.memories.add({ content, ... })` | `MemoriesService.add({ content, ... })` |
| `client.memories.get(id)` | `MemoriesService.get(id)` |
| `client.memories.list({ ... })` | `MemoriesService.list({ ... })` |
| `client.memories.update(id, { ... })` | `MemoriesService.update(id, { ... })` |
| `client.memories.delete(id)` | `MemoriesService.delete(id)` |
| `client.memories.uploadFile({ file })` | `MemoriesService.uploadFile({ file })` |

### Search

| Official SDK | effect-supermemory |
|-------------|-------------------|
| `client.search.documents({ q, ... })` | `SearchService.searchDocuments(query, { ... })` |
| `client.search.execute({ q, ... })` | `SearchService.execute(query, { ... })` |
| `client.search.memories({ q, ... })` | `SearchService.searchMemories(query, { ... })` |

**Note:** The query (`q`) moves from the options object to the first positional argument.

### Parameter Changes

| Official SDK | effect-supermemory | Notes |
|-------------|-------------------|-------|
| `limit` | `topK` | Search result count |
| `chunkThreshold` | `threshold` | Similarity threshold |
| `q` | First argument | Query is positional |

### Connections

| Official SDK | effect-supermemory |
|-------------|-------------------|
| `client.connections.create(provider, { ... })` | `ConnectionsService.create(provider, { ... })` |
| `client.connections.list({ ... })` | `ConnectionsService.list({ ... })` |
| `client.connections.getByID(id)` | `ConnectionsService.getByID(id)` |
| `client.connections.deleteByID(id)` | `ConnectionsService.deleteByID(id)` |
| `client.connections.import(provider, { ... })` | `ConnectionsService.importData(provider, { ... })` |

### Settings

| Official SDK | effect-supermemory |
|-------------|-------------------|
| `client.settings.get()` | `SettingsService.get()` |
| `client.settings.update({ ... })` | `SettingsService.update({ ... })` |

## Error Types

effect-supermemory provides typed errors you can catch precisely:

```typescript
import { Effect } from "effect";
import { MemoriesService } from "effect-supermemory";

const robustGet = (id: string) =>
  MemoriesService.get(id).pipe(
    // Handle specific errors
    Effect.catchTag("SupermemoryNotFoundError", () =>
      Effect.succeed(null)
    ),
    Effect.catchTag("SupermemoryRateLimitError", (error) =>
      Effect.log(`Rate limited, retry after ${error.retryAfter}ms`).pipe(
        Effect.andThen(Effect.sleep(error.retryAfter ?? 1000)),
        Effect.andThen(MemoriesService.get(id))
      )
    ),
    Effect.catchTag("SupermemoryAuthenticationError", (error) =>
      Effect.die(new Error("Invalid API key"))
    ),
    Effect.catchTag("SupermemoryServerError", (error) =>
      Effect.logError(`Server error: ${error.message}`).pipe(
        Effect.andThen(Effect.fail(error))
      )
    )
  );
```

### Available Error Types

| Error Type | HTTP Status | Description |
|-----------|-------------|-------------|
| `SupermemoryValidationError` | 400 | Invalid request parameters |
| `SupermemoryAuthenticationError` | 401, 403 | Invalid or missing API key |
| `SupermemoryNotFoundError` | 404 | Resource not found |
| `SupermemoryRateLimitError` | 429 | Rate limit exceeded |
| `SupermemoryServerError` | 5xx | Server-side error |

## Testing Without Mocks

One of Effect's strengths is testing without mocking frameworks. Create test implementations:

```typescript
import { Effect, Layer } from "effect";
import { MemoriesService } from "effect-supermemory";

// Test layer with controlled responses
const TestMemoriesLayer = Layer.succeed(MemoriesService, {
  add: (params) => Effect.succeed({ 
    id: "test-memory-id", 
    status: "done" 
  }),
  get: (id) => id === "exists" 
    ? Effect.succeed({ id, content: "test content", /* ... */ })
    : Effect.fail(new SupermemoryNotFoundError({ id })),
  list: () => Effect.succeed({ 
    memories: [], 
    pagination: { currentPage: 1, totalPages: 1, totalItems: 0 } 
  }),
  update: (id, params) => Effect.succeed({ id, status: "updated" }),
  delete: (id) => Effect.void,
  uploadFile: (params) => Effect.succeed({ id: "uploaded", status: "done" }),
});

// Use in tests
describe("Memory operations", () => {
  it("handles missing memories gracefully", async () => {
    const program = Effect.gen(function* () {
      const result = yield* MemoriesService.get("missing").pipe(
        Effect.catchTag("SupermemoryNotFoundError", () => 
          Effect.succeed(null)
        )
      );
      return result;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(TestMemoriesLayer))
    );
    
    expect(result).toBeNull();
  });
});
```

## Migration Checklist

Use this checklist to track your migration progress:

- [ ] Install `effect-supermemory`, `effect`, and `@effect/platform-node`
- [ ] Create the service layer file (`services/supermemory.ts`)
- [ ] Set up environment variables
- [ ] Identify all `new Supermemory()` instantiations and remove them
- [ ] Convert async functions to `Effect.gen`
- [ ] Update method calls to use service accessors
- [ ] Adjust parameter names (`limit` → `topK`, query position)
- [ ] Replace try/catch with `Effect.catchTag`
- [ ] Add `Effect.provide(SupermemoryLayer)` at entry points
- [ ] Update tests to use test layers instead of mocks
- [ ] Remove `supermemory` from dependencies (keep as devDependency if needed)

## Conclusion

Migrating to effect-supermemory brings type-safe error handling, composable operations, and testability without mocks. While the initial migration requires updating your code patterns, the result is more maintainable and robust code for production AI applications.

The library maintains full compatibility with the Supermemory API—you're not losing any functionality, just gaining better developer experience and runtime safety.

---

**Resources:**
- [effect-supermemory on GitHub](https://github.com/PaulJPhilp/effect-supermemory)
- [Effect Documentation](https://effect.website)
- [Supermemory API Documentation](https://docs.supermemory.ai)
