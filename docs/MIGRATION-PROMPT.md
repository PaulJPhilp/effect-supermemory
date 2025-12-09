# Migration Prompt: Supermemory SDK to effect-supermemory

Use this prompt when asking a coding agent to refactor code from the official Supermemory TypeScript SDK to the Effect-native `effect-supermemory` library.

---

## Prompt for Coding Agent

You are refactoring a codebase from using the official **Supermemory TypeScript SDK** (`supermemory`) to the **Effect-native implementation** (`effect-supermemory`).

### Key Differences

| Aspect | Official SDK (`supermemory`) | Effect Library (`effect-supermemory`) |
|--------|------------------------------|---------------------------------------|
| Async Model | Promise-based | Effect-based (lazy, composable) |
| Error Handling | try/catch with thrown errors | Typed errors in Effect channel |
| Client Creation | `new Supermemory({ apiKey })` | Layer-based dependency injection |
| Method Calls | `await client.memories.add(...)` | `yield* MemoriesService.add(...)` |
| Configuration | Constructor options | `SupermemoryConfigFromEnv` layer |

### Service Mapping

```typescript
// OLD: Official SDK
import Supermemory from "supermemory";
const client = new Supermemory({ apiKey: "sk-..." });

// NEW: Effect Library
import { MemoriesService, SearchService, ConnectionsService, SettingsService } from "effect-supermemory";
import { SupermemoryConfigFromEnv, SupermemoryHttpClientService } from "effect-supermemory";
```

### Method Mapping

#### Memories Service

| Official SDK | Effect Library |
|-------------|----------------|
| `client.memories.add({ content, ... })` | `MemoriesService.add({ content, ... })` |
| `client.memories.get(id)` | `MemoriesService.get(id)` |
| `client.memories.list({ ... })` | `MemoriesService.list({ ... })` |
| `client.memories.update(id, { ... })` | `MemoriesService.update(id, { ... })` |
| `client.memories.delete(id)` | `MemoriesService.delete(id)` |
| `client.memories.uploadFile({ file })` | `MemoriesService.uploadFile({ file })` |

#### Search Service

| Official SDK | Effect Library |
|-------------|----------------|
| `client.search.documents({ q, ... })` | `SearchService.searchDocuments(q, { ... })` |
| `client.search.execute({ q, ... })` | `SearchService.execute(q, { ... })` |
| `client.search.memories({ q, ... })` | `SearchService.searchMemories(q, { ... })` |

#### Connections Service

| Official SDK | Effect Library |
|-------------|----------------|
| `client.connections.create(provider, { ... })` | `ConnectionsService.create(provider, { ... })` |
| `client.connections.list({ ... })` | `ConnectionsService.list({ ... })` |
| `client.connections.getByID(id)` | `ConnectionsService.getByID(id)` |
| `client.connections.getByTags(provider, { ... })` | `ConnectionsService.getByTags(provider, { ... })` |
| `client.connections.deleteByID(id)` | `ConnectionsService.deleteByID(id)` |
| `client.connections.deleteByProvider(provider, { ... })` | `ConnectionsService.deleteByProvider(provider, { ... })` |
| `client.connections.import(provider, { ... })` | `ConnectionsService.importData(provider, { ... })` |
| `client.connections.listDocuments(provider, { ... })` | `ConnectionsService.listDocuments(provider, { ... })` |

#### Settings Service

| Official SDK | Effect Library |
|-------------|----------------|
| `client.settings.get()` | `SettingsService.get()` |
| `client.settings.update({ ... })` | `SettingsService.update({ ... })` |

### Migration Patterns

#### Pattern 1: Basic Function Migration

**Before (Promise-based):**
```typescript
import Supermemory from "supermemory";

async function addMemory(content: string) {
  const client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY! });
  
  try {
    const result = await client.memories.add({ content });
    console.log("Added memory:", result.id);
    return result;
  } catch (error) {
    console.error("Failed to add memory:", error);
    throw error;
  }
}
```

**After (Effect-based):**
```typescript
import { MemoriesService } from "effect-supermemory";
import { Effect } from "effect";

const addMemory = (content: string) =>
  Effect.gen(function* () {
    const result = yield* MemoriesService.add({ content });
    yield* Effect.log(`Added memory: ${result.id}`);
    return result;
  }).pipe(
    Effect.catchTag("SupermemoryValidationError", (error) =>
      Effect.logError(`Validation failed: ${error.message}`).pipe(
        Effect.andThen(Effect.fail(error))
      )
    )
  );
```

#### Pattern 2: Search with Options

**Before:**
```typescript
async function searchDocuments(query: string) {
  const client = new Supermemory({ apiKey: "..." });
  
  const results = await client.search.documents({
    q: query,
    containerTags: ["user-123"],
    limit: 10,
    rerank: true,
  });
  
  return results.results;
}
```

**After:**
```typescript
import { SearchService } from "effect-supermemory";
import { Effect } from "effect";

const searchDocuments = (query: string) =>
  Effect.gen(function* () {
    const results = yield* SearchService.searchDocuments(query, {
      containerTags: ["user-123"],
      topK: 10,  // Note: "limit" becomes "topK"
      rerank: true,
    });
    return results;
  });
```

#### Pattern 3: Layer Setup

**Setup file (e.g., `services/supermemory.ts`):**
```typescript
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

// Create the full service layer
const platformHttpLayer = NodeHttpClient.layer;
const baseLayer = Layer.merge(SupermemoryConfigFromEnv, platformHttpLayer);
const httpClientLayer = Layer.provide(SupermemoryHttpClientService.Default, baseLayer);

export const SupermemoryLayer = Layer.mergeAll(
  Layer.provide(MemoriesService.Default, httpClientLayer),
  Layer.provide(SearchService.Default, httpClientLayer),
  Layer.provide(ConnectionsService.Default, httpClientLayer),
  Layer.provide(SettingsService.Default, httpClientLayer),
);
```

**Usage:**
```typescript
import { Effect } from "effect";
import { SupermemoryLayer } from "./services/supermemory";
import { MemoriesService } from "effect-supermemory";

const program = Effect.gen(function* () {
  const result = yield* MemoriesService.add({ content: "Hello, world!" });
  return result;
});

// Run with layer
Effect.runPromise(program.pipe(Effect.provide(SupermemoryLayer)));
```

#### Pattern 4: Error Handling

**Before:**
```typescript
try {
  const memory = await client.memories.get("non-existent-id");
} catch (error) {
  if (error.status === 404) {
    console.log("Memory not found");
  } else {
    throw error;
  }
}
```

**After:**
```typescript
import { Effect } from "effect";
import { MemoriesService } from "effect-supermemory";

const getMemorySafe = (id: string) =>
  MemoriesService.get(id).pipe(
    Effect.catchTag("SupermemoryNotFoundError", () =>
      Effect.succeed(null)  // Return null for not found
    ),
    Effect.catchTag("SupermemoryAuthenticationError", (error) =>
      Effect.die(new Error(`Auth failed: ${error.message}`))
    )
  );
```

### Parameter Name Changes

| Official SDK | Effect Library | Notes |
|-------------|----------------|-------|
| `q` | First argument to search methods | Query is positional, not in options |
| `limit` | `topK` | Search result limit |
| `chunkThreshold` | `threshold` | Similarity threshold |
| `containerTags` | `containerTags` | Same (for v3 endpoints) |
| `containerTag` | `containerTag` | Same (for v4 endpoints) |

### Error Types

Effect library uses typed errors that can be caught with `Effect.catchTag`:

- `SupermemoryValidationError` - Invalid input or request
- `SupermemoryAuthenticationError` - 401/403 errors
- `SupermemoryNotFoundError` - 404 errors  
- `SupermemoryRateLimitError` - 429 errors (includes `retryAfter`)
- `SupermemoryServerError` - 5xx errors

### Environment Variables

Set these in your `.env` file:

```bash
SUPERMEMORY_API_KEY=sk-your-api-key
SUPERMEMORY_BASE_URL=https://api.supermemory.ai  # Optional
SUPERMEMORY_TIMEOUT_MS=30000  # Optional
```

### Migration Checklist

- [ ] Install `effect-supermemory` and `@effect/platform-node`
- [ ] Remove `supermemory` package (or keep as devDependency for types reference)
- [ ] Create a layer setup file for service composition
- [ ] Replace `new Supermemory()` with layer-based DI
- [ ] Convert `async/await` functions to `Effect.gen`
- [ ] Replace `try/catch` with `Effect.catchTag`
- [ ] Update parameter names (`limit` → `topK`, etc.)
- [ ] Move search query from options object to first argument
- [ ] Update imports to use service classes
- [ ] Add `.pipe(Effect.provide(SupermemoryLayer))` at program boundaries

### Running the Migrated Code

```typescript
import { Effect } from "effect";
import { SupermemoryLayer } from "./services/supermemory";

// Your Effect program
const main = Effect.gen(function* () {
  // ... your logic using MemoriesService, SearchService, etc.
});

// Entry point
Effect.runPromise(main.pipe(Effect.provide(SupermemoryLayer)))
  .then(() => console.log("Done"))
  .catch(console.error);
```

---

## Instructions for the Coding Agent

1. **Identify all imports** of `supermemory` and replace with `effect-supermemory` service imports
2. **Find client instantiation** (`new Supermemory(...)`) and remove it - we use layers instead
3. **Convert async functions** to use `Effect.gen` with `yield*`
4. **Update method calls** from `client.service.method()` to `ServiceName.method()`
5. **Adjust parameters** per the mapping tables above
6. **Add error handling** using `Effect.catchTag` for typed errors
7. **Create a layer file** that composes all services
8. **Wrap entry points** with `Effect.provide(SupermemoryLayer)`

When in doubt, refer to the acceptance tests in `test/acceptance/` for working examples of each service method.
