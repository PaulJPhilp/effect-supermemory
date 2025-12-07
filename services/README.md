# Services Overview

This directory contains all service implementations for the `effect-supermemory` library. All services follow the **Effect.Service pattern** with parameterized layers for dependency injection and namespace isolation.

## Service Architecture

All services in this directory follow a consistent structure:

```
services/[serviceName]/
├── __tests__/          # Unit tests
├── api.ts              # Interface/type definitions
├── errors.ts           # Discriminated error types (Data.TaggedError)
├── service.ts          # Effect.Service implementation
├── helpers.ts          # Utility functions (optional)
├── types.ts            # Type definitions (optional)
└── index.ts            # Public exports
```

## Core Services

### `inMemoryClient/`

**Purpose:** In-memory key-value store with namespace isolation.

**Use Case:** Local, ephemeral storage for testing or development. Data is stored in a local `Map` and is not persisted.

**Key Features:**
- Namespace-isolated storage (each namespace has its own data)
- Standard CRUD operations (`put`, `get`, `delete`, `exists`, `clear`)
- Batch operations (`putMany`, `getMany`, `deleteMany`)
- Type-safe error handling with discriminated errors

**Example:**
```typescript
import { InMemoryClient } from "@services/inMemoryClient/service.js";

const layer = InMemoryClient.Default("my-namespace");
const program = Effect.gen(function* () {
  const client = yield* InMemoryClient;
  yield* client.put("key", "value");
  const result = yield* client.get("key");
  return result; // "value"
}).pipe(Effect.provide(layer));
```

---

### `httpClient/`

**Purpose:** Generic HTTP client for making external API requests.

**Use Case:** Low-level HTTP operations with proper error handling, streaming support, and request/response management.

**Key Features:**
- JSON request/response handling
- Streaming support for large responses (`requestStream`)
- Automatic error status code handling (>= 400)
- Configurable base URL and headers

**Example:**
```typescript
import { HttpClient } from "@services/httpClient/service.js";

const layer = HttpClient.Default({
  baseUrl: "https://api.example.com",
  headers: { "Authorization": "Bearer token" },
});

const program = Effect.gen(function* () {
  const client = yield* HttpClient;
  const response = yield* client.request("/users", {
    method: "GET",
  });
  return response;
}).pipe(Effect.provide(layer));
```

---

### `supermemoryClient/`

**Purpose:** HTTP-backed memory client that implements the `InMemoryClientApi` interface using the Supermemory API.

**Use Case:** Persistent storage of key-value pairs in Supermemory's cloud service. All values are automatically Base64 encoded/decoded for transmission.

**Key Features:**
- Implements `InMemoryClientApi` interface (drop-in replacement)
- Automatic Base64 encoding/decoding
- Retry logic for network errors and 5xx responses
- Batch operations with partial failure handling
- Namespace isolation via API configuration

**Dependencies:** Requires `HttpClient` service

**Example:**
```typescript
import { SupermemoryClient } from "@services/supermemoryClient/service.js";

const layer = SupermemoryClient.Default({
  namespace: "my-app",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "sk-...",
  retries: {
    attempts: 3,
    delayMs: 2000,
  },
});

const program = Effect.gen(function* () {
  const client = yield* SupermemoryClient;
  yield* client.put("user:123", "John Doe");
  const value = yield* client.get("user:123");
  return value; // "John Doe"
}).pipe(Effect.provide(layer));
```

---

### `memoryStreamClient/`

**Purpose:** Streaming operations for large datasets using `Effect.Stream`.

**Use Case:** Efficiently processing large result sets without loading everything into memory at once.

**Key Features:**
- Stream all keys in a namespace (`listAllKeys`)
- Stream search results (`streamSearch`)
- Proper resource management and cancellation support
- NDJSON (Newline-Delimited JSON) content format

**Dependencies:** Requires `SupermemoryClient` layer

**Example:**
```typescript
import { MemoryStreamClient } from "@services/memoryStreamClient/service.js";

const program = Effect.gen(function* () {
  const client = yield* MemoryStreamClient;
  const keyStream = yield* client.listAllKeys();
  
  yield* Stream.runForEach(keyStream, (key) =>
    Effect.log(`Found key: ${key}`)
  );
}).pipe(Effect.provide(MemoryStreamClient.Default({ ... })));
```

---

### `searchClient/`

**Purpose:** Semantic search operations against the Supermemory API.

**Use Case:** Finding relevant memories based on semantic similarity, with filtering and relevance scoring.

**Key Features:**
- Semantic search queries
- Relevance score ranking (0.0-1.0)
- Metadata filtering
- Age-based filtering (`maxAgeHours`)
- Pagination support (`limit`, `offset`)

**Example:**
```typescript
import { SearchClient } from "@services/searchClient/service.js";

const program = Effect.gen(function* () {
  const client = yield* SearchClient;
  const results = yield* client.search("user preferences", {
    limit: 10,
    minRelevanceScore: 0.7,
    filters: {
      category: "preferences",
    },
    maxAgeHours: 24,
  });
  return results;
}).pipe(Effect.provide(SearchClient.Default({ ... })));
```

---

### `search/`

**Purpose:** High-level search service for both document (RAG) and memory (Chat) search paths.

**Use Case:** Unified interface for searching documents and synthesized memories with advanced filtering capabilities.

**Key Features:**
- Document search (`searchDocuments`) - Returns document chunks
- Memory search (`searchMemories`) - Returns synthesized memories
- Fluent filter builder API
- Reranking support
- Threshold-based filtering

**Example:**
```typescript
import { SearchService } from "@services/search/service.js";

const program = Effect.gen(function* () {
  const service = yield* SearchService;
  
  // Search documents
  const docs = yield* service.searchDocuments("TypeScript patterns", {
    topK: 5,
    threshold: 0.8,
  });
  
  // Search memories
  const memories = yield* service.searchMemories("user context", {
    topK: 10,
  });
  
  return { docs, memories };
}).pipe(Effect.provide(SearchService.Default({ ... })));
```

---

### `ingest/`

**Purpose:** Document ingestion service for adding content to Supermemory.

**Use Case:** Adding text content or URLs to Supermemory for later retrieval and search.

**Key Features:**
- Add text content (`addText`)
- Add content from URLs (`addUrl`) - Triggers Supermemory's scraper
- Optional tags, custom IDs, and metadata
- Returns ingestion response with document IDs

**Example:**
```typescript
import { IngestService } from "@services/ingest/service.js";

const program = Effect.gen(function* () {
  const service = yield* IngestService;
  
  // Ingest text
  const textResponse = yield* service.addText("Hello, world!", {
    tags: ["greeting"],
    customId: "greeting-1",
  });
  
  // Ingest from URL
  const urlResponse = yield* service.addUrl("https://example.com/article", {
    tags: ["article"],
  });
  
  return { textResponse, urlResponse };
}).pipe(Effect.provide(IngestService.Default({ ... })));
```

---

### `client/`

**Purpose:** High-level Supermemory HTTP client with versioned API endpoints.

**Use Case:** Direct access to Supermemory API v3 and v4 endpoints with schema validation.

**Key Features:**
- Versioned endpoints (`requestV3`, `requestV4`)
- Schema validation via Effect.Schema
- Automatic error mapping to `SupermemoryError`
- Telemetry support

**Example:**
```typescript
import { SupermemoryHttpClientService } from "@services/client/service.js";

const program = Effect.gen(function* () {
  const client = yield* SupermemoryHttpClientService;
  
  // V3 endpoint (documents, RAG search)
  const docs = yield* client.requestV3("POST", "/documents", {
    body: { content: "Hello" },
    schema: DocumentSchema,
  });
  
  // V4 endpoint (memory search)
  const memories = yield* client.requestV4("GET", "/memories/search", {
    schema: MemorySearchSchema,
  });
  
  return { docs, memories };
}).pipe(Effect.provide(SupermemoryHttpClientService.Default({ ... })));
```

---

### `config/`

**Purpose:** Configuration service for managing environment variables and API settings.

**Use Case:** Centralized configuration management using `effect-env` for typed, testable environment variable handling.

**Key Features:**
- Schema-driven environment variable validation
- Type-safe configuration access
- Test-friendly layer composition
- Support for optional values with defaults

**Configuration Variables:**
- `SUPERMEMORY_API_KEY` (required) - API key for authentication
- `SUPERMEMORY_WORKSPACE_ID` (optional) - Workspace identifier
- `SUPERMEMORY_BASE_URL` (optional, default: `https://api.supermemory.ai`)
- `SUPERMEMORY_DEFAULT_THRESHOLD` (optional, default: `0.7`)
- `SUPERMEMORY_TIMEOUT_MS` (optional, default: `30000`)

**Example:**
```typescript
import { SupermemoryConfigService, SupermemoryConfigLive } from "@services/config/service.js";

// Production: Use environment variables
const program = Effect.gen(function* () {
  const config = yield* SupermemoryConfigService;
  return config.apiKey; // Redacted<string>
}).pipe(Effect.provide(SupermemoryConfigLive));

// Testing: Provide explicit values
import { SupermemoryConfigFromValues } from "@services/config/service.js";
import { Redacted } from "effect";

const testLayer = SupermemoryConfigFromValues({
  apiKey: Redacted.make("test-key"),
  baseUrl: "https://test.api",
});
```

---

## Service Dependencies

```
config/
  └── (no dependencies)

httpClient/
  └── (no dependencies)

client/
  └── depends on: httpClient, config

inMemoryClient/
  └── (no dependencies)

supermemoryClient/
  └── depends on: httpClient, config

memoryStreamClient/
  └── depends on: supermemoryClient (via layer composition)

searchClient/
  └── depends on: httpClient, config

search/
  └── depends on: client

ingest/
  └── depends on: client
```

## Error Handling

All services use **discriminated error types** via `Data.TaggedError` for type-safe error handling:

```typescript
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const client = yield* InMemoryClient;
  return yield* client.get("key");
}).pipe(
  Effect.catchTag("MemoryNotFoundError", (error) =>
    Effect.succeed(`Key ${error.key} not found`)
  ),
  Effect.catchTag("MemoryValidationError", (error) =>
    Effect.fail(new Error(`Validation failed: ${error.message}`))
  )
);
```

## Testing

All services include unit tests in their `__tests__/` directories. Services are tested using:

- **Vitest** with `@effect/vitest` for Effect-aware testing
- **Real implementations** (no mocks per anti-mocking policy)
- **Layer composition** for dependency injection in tests

Example test pattern:
```typescript
import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { InMemoryClient } from "../service.js";

describe("InMemoryClient", () => {
  const testLayer = InMemoryClient.Default("test-namespace");

  it("puts and gets a value", async () => {
    const program = Effect.gen(function* () {
      const client = yield* InMemoryClient;
      yield* client.put("key", "value");
      return yield* client.get("key");
    }).pipe(Effect.provide(testLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBe("value");
  });
});
```

## Common Patterns

### Namespace Isolation

Services that support namespaces create isolated instances:

```typescript
const namespace1 = InMemoryClient.Default("namespace-1");
const namespace2 = InMemoryClient.Default("namespace-2");

// Data in namespace1 is completely isolated from namespace2
```

### Layer Composition

Combine multiple services using `Layer.merge`:

```typescript
import { Layer } from "effect";

const AppLayer = Layer.mergeAll(
  HttpClient.Default({ baseUrl: "https://api.example.com" }),
  SupermemoryConfigLive,
  SupermemoryClient.Default({ namespace: "my-app", ... })
);
```

### Batch Operations with Partial Failures

Batch operations return `MemoryBatchPartialFailure` when some items succeed and others fail:

```typescript
const result = yield* client.putMany([
  { key: "key1", value: "value1" },
  { key: "key2", value: "value2" },
]).pipe(
  Effect.catchTag("MemoryBatchPartialFailure", (error) => {
    console.log(`Succeeded: ${error.successes}, Failed: ${error.failures.length}`);
    return Effect.void;
  })
);
```

## See Also

- [Architecture Documentation](../../docs/Architecture.md) - High-level architecture overview
- [ADR-001: Error Taxonomy & Layer Design](../../docs/adr/001-error-taxonomy-layer-design.md) - Service pattern standards
- [Main README](../../README.md) - Library usage and examples
