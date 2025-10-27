# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, and Development Commands

```bash
# Install dependencies
pnpm install

# Type checking
pnpm typecheck

# Build (emits to dist/)
pnpm build

# Testing
pnpm test              # Run all tests
pnpm test:watch        # Watch mode

# Code formatting
pnpm format            # Check formatting
```

### Running Individual Tests

```bash
# Run a single test file
pnpm vitest run services/memoryClient/__tests__/unit.test.ts

# Run tests in watch mode for a specific file
pnpm vitest services/httpClient/__tests__/unit.test.ts
```

## Architecture Overview

effect-supermemory is an Effect-native client library for Supermemory's long-term memory API. The architecture follows strict Effect patterns with discriminated error types and service-based dependency injection.

### Service Architecture Pattern (ADR-001)

All services follow the **Effect.Service with Effect.fn() parameterization** pattern:

1. **Services** are defined using `Effect.Service<T>()` with `Effect.fn()` for parameterized construction
2. **Errors** are discriminated union types using `Data.TaggedError`
3. **Configuration** flows through parameterized layers via `Service.Default(config)`
4. **Namespace isolation** is achieved through separate service instances

**Example Service Structure:**
```typescript
// errors.ts - Discriminated error types
export class MemoryNotFoundError extends Data.TaggedError("MemoryNotFoundError")<{
  readonly key: string;
}> {}

// service.ts - Effect.Service with Effect.fn()
export class MemoryClientImpl extends Effect.Service<MemoryClientImpl>()(
  "MemoryClient",
  {
    effect: Effect.fn(function* (namespace: string) {
      // Service implementation with namespace isolation
      return {
        put: (key, value) => Effect.sync(() => { /* ... */ }),
        get: (key) => Effect.sync(() => { /* ... */ }),
      } satisfies MemoryClient;
    }),
  }
) {}

// Usage - parameterized layer creation
const layer = MemoryClientImpl.Default("my-namespace");
const program = Effect.gen(function* () {
  const client = yield* MemoryClientImpl;
  return yield* client.get("key");
}).pipe(Effect.provide(layer));
```

### Service Hierarchy

```
src/index.ts (root exports)
  ├── memoryClient/          # Base MemoryClient interface (in-memory impl)
  ├── httpClient/            # Generic HTTP client service
  ├── supermemoryClient/     # HTTP-backed MemoryClient (uses HttpClient)
  ├── memoryStreamClient/    # Streaming operations (Effect.Stream)
  └── searchClient/          # Search and reranking operations
```

**Key Dependencies:**
- `SupermemoryClient` depends on `HttpClient`
- `MemoryStreamClient` depends on `HttpClient` (via SupermemoryClient layer)
- All services export via `services/*/index.ts` → `src/index.ts`

### Error Handling Philosophy

- **All errors are discriminated** using `Data.TaggedError`
- **Type-safe pattern matching** via `Effect.catchTag()` or `Effect.either()`
- **404 handling is semantic**: `get()` returns `undefined`, `delete()` returns `true`, `exists()` returns `false`
- **Authorization errors (401/403)** translate to `MemoryValidationError`
- **Batch operations** use `MemoryBatchPartialFailure` for mixed success/failure states

### Base64 Encoding Convention

All memory values are **Base64 encoded** before sending to the Supermemory API and **decoded upon retrieval**. See `services/supermemoryClient/utils.ts` for encoding/decoding logic.

### Retry Policy (SupermemoryClient)

Retries are configured at layer construction time:

```typescript
SupermemoryClientImpl.Default({
  namespace: "my-app",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "sk-...",
  retries: {
    attempts: 3,    // Total attempts (includes initial request)
    delayMs: 2000   // Fixed delay between retries
  }
})
```

**Retry Logic:**
- **Retried**: Network errors, 5xx errors, 429 Too Many Requests
- **No Retries**: 4xx client errors (except 429), 401/403
- **Special 404 handling**: No retries; immediately returns expected semantic value

### Streaming Operations

`MemoryStreamClient` provides `Effect.Stream`-based methods for large datasets:

- **`listAllKeys()`**: Streams all keys in namespace
- **`streamSearch(query, options?)`**: Streams search results

**Content Format**: Expects NDJSON (Newline-Delimited JSON) from backend
**Cancellation**: Properly propagates to underlying HTTP requests

### Batch Operations

Batch methods (`putMany`, `getMany`, `deleteMany`) handle multiple items in a single HTTP request.

**Partial Failure Handling:**
- Success: Returns `void` or `ReadonlyMap` with all results
- Partial failure: Returns `MemoryBatchPartialFailure` with `successes` count and `failures` array
- Each failure includes the specific `key` and its `MemoryError`

**Limits:**
- Recommended max payload: 1-5 MB
- Soft limit: ~1,000 items per batch

## Code Style and Conventions

### TypeScript Configuration
- **Strict mode**: `strict: true`, `exactOptionalPropertyTypes: true`
- **Module resolution**: NodeNext
- **Target**: ES2022
- **No unused locals**, strict null checks, no implicit any

### Import Conventions
```typescript
// Effect imports - always namespace imports
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

// Test imports
import { describe, it, expect } from "vitest";
```

### File Structure Convention
Each service follows this structure:
```
services/[serviceName]/
  ├── __tests__/
  │   └── unit.test.ts
  ├── api.ts          # Interface contract (type definitions)
  ├── errors.ts       # Discriminated error types
  ├── types.ts        # Data types and config
  ├── service.ts      # Effect.Service implementation
  ├── utils.ts        # (optional) Helper utilities
  └── index.ts        # Public exports
```

### Testing Patterns

Tests use `vitest` with `@effect/vitest`:

```typescript
describe("ServiceName", () => {
  const testLayer = ServiceImpl.Default("test-namespace");

  it("description", async () => {
    const program = Effect.gen(function* () {
      const service = yield* ServiceImpl;
      const result = yield* service.method("arg");
      return result;
    }).pipe(Effect.provide(testLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBe(expected);
  });
});
```

## Important Implementation Notes

1. **Never use bare Context.Tag** - Always use `Effect.Service` with `Effect.fn()` for parameterization
2. **Always export via index.ts** - Each service's public API exports through its `index.ts`
3. **Namespace isolation** - Services with namespaces create isolated instances via parameterized layers
4. **Satisfy interface contracts** - Service implementations must `satisfies` their interface type
5. **Error translation** - HTTP errors are translated to domain-specific `MemoryError` types in `SupermemoryClient`
6. **Idempotent operations** - `delete()` and `clear()` are idempotent (no errors on missing keys)

## ADR References

See `docs/adr/001-error-taxonomy-layer-design.md` for the architectural decision establishing:
- Discriminated error types via `Data.TaggedError`
- Effect.Service pattern with Effect.fn() parameterization
- Layer-based dependency injection
- Implementation standards for all services
