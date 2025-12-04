# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build, Test, and Development Commands

All commands use **Bun** as the package manager.

```bash
# Install dependencies
bun install

# Type checking (strict mode)
bun run typecheck

# Build (emits to dist/)
bun run build

# Testing
bun run test              # Run all unit tests
bun run test:watch        # Watch mode
bun run test:integration  # Run integration tests only
bun run test:integration:watch  # Watch mode for integration tests

# Code quality (using Biome with Ultracite preset)
bun run lint              # Check code with Biome
bun run format            # Same as lint (checks formatting)
bun run format:fix        # Fix formatting issues with Biome

# Development utilities
bun run mock:server       # Start mock Supermemory API server for testing
```

### Running Individual Tests

```bash
# Run a specific test file
bun run vitest run services/inMemoryClient/__tests__/unit.test.ts

# Run tests in watch mode for a specific file
bun run vitest services/httpClient/__tests__/unit.test.ts
```

## Architecture Overview

effect-supermemory is an Effect-native TypeScript client library for Supermemory's long-term memory API. The architecture is organized as a **modular, service-based library** with distinct layers:

- **Service Layer** (`services/`): Core Effect.Service implementations
  - `inMemoryClient/` - In-memory key-value store with namespace isolation
  - `httpClient/` - Generic HTTP client for external API requests
  - `supermemoryClient/` - HTTP-backed InMemoryClient implementation for Supermemory API
  - `memoryStreamClient/` - Streaming operations for large datasets (Effect.Stream)
  - `searchClient/` - Search and reranking operations

- **Domain Layer** (`src/`): High-level services and domain models
  - `Client.ts` - Supermemory HTTP client with error mapping
  - `Config.ts` - Configuration service
  - `Domain.ts` - Domain schemas using Effect.Schema
  - `Search.ts` - Search service with fluent filter API
  - `Ingest.ts` - Document ingestion service
  - `FilterBuilder.ts` - Fluent filter DSL for semantic filtering
  - `Errors.ts` - Typed error hierarchy

- **Root Exports** (`src/index.ts`): Re-exports all public APIs from services and domain layer

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

// api.ts - Interface definition
export interface InMemoryClientApi {
  put: (key: string, value: string) => Effect.Effect<void, MemoryError>;
  get: (key: string) => Effect.Effect<string | undefined, MemoryError>;
  // ...
}

// service.ts - Effect.Service implementation
export class InMemoryClient extends Effect.Service<InMemoryClient>()(
  "InMemoryClient",
  {
    effect: Effect.fn(function* (namespace: string) {
      // Service implementation with namespace isolation
      return {
        put: (key, value) => Effect.sync(() => { /* ... */ }),
        get: (key) => Effect.sync(() => { /* ... */ }),
      } satisfies InMemoryClientApi;
    }),
  }
) {}

// Usage - parameterized layer creation
const layer = InMemoryClient.Default("my-namespace");
const program = Effect.gen(function* () {
  const client = yield* InMemoryClient;
  return yield* client.get("key");
}).pipe(Effect.provide(layer));
```

### Service Hierarchy

```
src/index.ts (root exports)
  ├── inMemoryClient/          # Base InMemoryClient interface (in-memory impl)
  ├── httpClient/            # Generic HTTP client service
  ├── supermemoryClient/     # HTTP-backed InMemoryClient (uses HttpClient)
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

## Code Quality & Standards

This project uses **Ultracite**, a zero-config Biome preset that enforces strict code quality standards through automated formatting and linting.

**Key principles enforced:**
- **Type Safety**: Explicit types, use `unknown` instead of `any`, const assertions for immutable values
- **Modern JavaScript**: Arrow functions, `for...of` loops, optional chaining (`?.`), nullish coalescing (`??`)
- **Code Organization**: Functions focused and under reasonable complexity, early returns over nesting, named conditions
- **Error Handling**: Throw `Error` objects with descriptive messages, meaningful try-catch blocks
- **Imports**: Specific imports preferred (except for Effect namespace imports), no barrel files
- **Performance**: Avoid spread in loops, top-level regex literals
- **Security**: Proper input validation, no `dangerouslySetInnerHTML`, no `eval()`

Biome provides extremely fast Rust-based linting and formatting with automatic fixes for most issues.

## Code Style and Conventions

### TypeScript Configuration
- **Strict mode**: `strict: true`, `exactOptionalPropertyTypes: true`
- **Module resolution**: Bundler
- **Target**: ES2022
- **Module**: ESNext
- **Declaration maps**: Enabled for source debugging
- **No unused locals**, strict null checks, no implicit any

### Import Conventions
```typescript
// Effect imports - always use namespace imports
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import type { Effect as EffectType } from "effect";

// Internal imports - use absolute path aliases
import { MyService } from "@services/MyService/service.js"; // .js extension required for ESM
import { MyModel } from "@/Domain.js"; // Using path alias

// Test imports
import { describe, it, expect } from "vitest";
```

Note: Path aliases `@/*` map to `src/*` and `@services/*` map to `services/*`, defined in `tsconfig.json`.

### File Structure Convention
Each service follows this structure:
```
services/[serviceName]/
  ├── __tests__/
  │   └── unit.test.ts      # Vitest unit tests
  ├── api.ts                # Interface contract (e.g., export type MemoryClient)
  ├── errors.ts             # Discriminated error types (Data.TaggedError)
  ├── types.ts              # Data types and config (e.g., HttpClientConfigType)
  ├── service.ts            # Effect.Service class with Effect.fn() parameterization
  ├── helpers.ts            # (optional) Helper utilities
  └── index.ts              # Public exports (re-exports from other files)
```

**Naming conventions:**
- Interface types: PascalCase + "Api" suffix (e.g., `InMemoryClientApi`, `HttpClientApi`)
- Service classes: PascalCase (no suffix) (e.g., `InMemoryClient`, `HttpClient`)
- **FORBIDDEN:** Never use "Impl" suffix for service classes (e.g., `MemoryClientImpl` is forbidden)
- Error classes: PascalCase + "Error" suffix (e.g., `MemoryNotFoundError`)
- Files: PascalCase for types/services, lowercase for utilities (e.g., `service.ts`, `helpers.ts`)

### Testing Patterns

**Unit Tests** (`**/__tests__/*.test.ts` and `test/**/*.test.ts`):
- Environment: Node.js
- Use `vitest` with `@effect/vitest`

**Integration Tests** (`test/integration.test.ts`):
- Setup: `test-setup/integration-setup.ts`
- Mock server: `test-setup/mock-server.ts`
- Timeout: 10s (elevated)

**Test pattern:**
```typescript
import * as Effect from "effect/Effect";
import { describe, it, expect } from "vitest";
import { InMemoryClient } from "../service.js";

describe("InMemoryClient", () => {
  const testLayer = InMemoryClient.Default("test-namespace");

  it("puts and gets a value", async () => {
    const program = Effect.gen(function* () {
      const client = yield* InMemoryClient;
      yield* client.put("key", "value");
      const result = yield* client.get("key");
      return result;
    }).pipe(Effect.provide(testLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBe("value");
  });
});
```

**Key patterns:**
- Create test layer with `ServiceImpl.Default(config)`
- Use `Effect.gen()` for test logic, `yield*` to access services
- Provide layer with `.pipe(Effect.provide(testLayer))`
- Run with `Effect.runPromise()` in async tests
- Assert on resolved values, not Effect objects

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
