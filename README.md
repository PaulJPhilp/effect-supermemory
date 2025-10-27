# effect-supermemory

Effect-native client abstractions for Supermemory long-term memory API.

## Quick Start

```bash
pnpm install
pnpm build
pnpm test
```

## Project Structure

```
services/
  ├── memoryClient/         # MemoryClient service (Effect.Service)
  │   ├── __tests__/        # unit.test.ts
  │   ├── api.ts            # Interface contract
  │   ├── errors.ts         # Discriminated error types
  │   ├── types.ts          # Data types
  │   ├── service.ts        # Effect.Service implementation + Default layer
  │   └── index.ts          # Public exports
  ├── httpClient/           # HttpClient service (Effect.Service)
  │   ├── __tests__/        # unit.test.ts
  │   ├── api.ts            # Interface contract
  │   ├── errors.ts         # Discriminated error types
  │   ├── types.ts          # Configuration types
  │   ├── service.ts        # Effect.Service implementation + Default layer
  │   └── index.ts          # Public exports
  └── supermemoryClient/    # SupermemoryClient service (Effect.Service)
      ├── __tests__/        # unit.test.ts
      ├── api.ts            # Interface contract
      ├── errors.ts         # Error translation
      ├── types.ts          # API data structures and config
      ├── service.ts        # Effect.Service implementation + Default layer
      ├── utils.ts          # Base64 encoding/decoding
      └── index.ts          # Public exports
docs/
  └── adr/                  # Architecture Decision Records
src/
  └── index.ts              # Root re-exports
```

## Development

- `pnpm typecheck` – TypeScript strict mode check
- `pnpm build` – Emit to `dist/`
- `pnpm test` – Run all tests
- `pnpm test:watch` – Watch mode
- `pnpm format` – Check formatting

## API

### MemoryClient

Core in-memory memory operations (MVP):
- `put(key, value): Effect<void>`
- `get(key): Effect<string | undefined>`
- `delete(key): Effect<boolean>` (idempotent)
- `exists(key): Effect<boolean>`
- `clear(): Effect<void>`

All operations are Effect-native and return discriminated errors on failure.

### HttpClient

Effect-native HTTP client for making requests to external APIs. Parameterized by `baseUrl` and default headers.

```ts
import * as Effect from "effect/Effect";
import { HttpClientImpl } from "effect-supermemory"; // assuming re-exported from root

const supermemoryClientLayer = HttpClientImpl.Default({
  baseUrl: "https://api.supermemory.dev",
  headers: {
    "Authorization": "Bearer YOUR_API_KEY",
    "X-App-Name": "my-effect-agent"
  },
  timeoutMs: 5000 // 5 seconds
});

const fetchMemories = Effect.gen(function* () {
  const client = yield* HttpClientImpl;
  const response = yield* client.request("/memories", { method: "GET" });
  return response.body; // Array of memories
}).pipe(Effect.provide(supermemoryClientLayer));

Effect.runPromise(fetchMemories).then(console.log);
```

### SupermemoryClient

Provides an HTTP-backed implementation of the `MemoryClient` interface, integrating with the Supermemory API. This service is parameterized by `namespace`, `baseUrl`, and `apiKey`.

**Configuration:**

```ts
import * as Effect from "effect/Effect";
import { SupermemoryClientImpl } from "effect-supermemory"; // assuming re-exported from root

const supermemoryLiveLayer = SupermemoryClientImpl.Default({
  namespace: "my-app-data",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "sk-YOUR_SUPERMEMORY_API_KEY",
  timeoutMs: 8000 // Optional: timeout for API requests
});

const myProgram = Effect.gen(function* () {
  const memory = yield* SupermemoryClientImpl; // Use the configured SupermemoryClient
  yield* memory.put("user:123:profile", "encoded-user-profile-data");
  const profile = yield* memory.get("user:123:profile");
  console.log("Fetched profile:", profile);
}).pipe(Effect.provide(supermemoryLiveLayer));

Effect.runPromise(myProgram).then(() => console.log("Program finished."));
```

**Error Translation Policy Summary:**

-   **`MemoryClient.get` (404 HTTP):** Returns `undefined` (not an error).
-   **`MemoryClient.delete` (404 HTTP):** Returns `true` (idempotent; not an error).
-   **`MemoryClient.exists` (404 HTTP):** Returns `false` (not an error).
-   **401/403 HTTP (Authorization failures):** Translated to `MemoryValidationError`.
-   **Other HTTP errors (4xx/5xx), Network errors, Request errors:** Translated to `MemoryValidationError`.
-   All values are Base64 encoded before sending to Supermemory API and decoded upon retrieval.

**Assumption for `clear()`:** This method assumes the Supermemory backend provides a `DELETE /api/v1/memories?namespace=:namespace` bulk endpoint. If the actual backend API deviates, this will need to be addressed via an ADR.

### Retries

The `SupermemoryClient` supports optional, configurable retries for transient HTTP errors. This improves reliability for operations susceptible to temporary network issues or backend unavailability.

**Configuration:**

Retries are enabled and configured at the `SupermemoryClientImpl.Default` layer construction time, as part of the `SupermemoryClientConfigType`.

```ts
import { SupermemoryClientImpl } from "effect-supermemory";

const resilientClientLayer = SupermemoryClientImpl.Default({
  namespace: "my-resilient-app",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "sk-YOUR_API_KEY",
  retries: {
    attempts: 3,   // Total attempts including the first one (so 2 retries)
    delayMs: 2000  // 2-second fixed delay between retries
  }
});

// Use resilientClientLayer when providing the SupermemoryClient to your program
```

**Retry Policy:**

The client adheres to the following retry policy:

-   **Retried Errors:**
    -   Network-level errors (e.g., connection refused, timeouts).
    -   HTTP 5xx server errors (e.g., 500 Internal Server Error, 503 Service Unavailable).
    -   HTTP 429 Too Many Requests (if encountered).
-   **Fail-Fast Errors (No Retries):**
    -   HTTP 4xx client errors (e.g., 400 Bad Request, 402 Payment Required), *except* 429.
    -   HTTP 401 Unauthorized and 403 Forbidden.
-   **Special Case Handling (No Retries):**
    -   **404 Not Found:**
        -   For `get(key)`: returns `undefined` immediately.
        -   For `delete(key)`: returns `true` immediately (idempotent).
        -   For `exists(key)`: returns `false` immediately.
    -   In all these special 404 cases, no retries will be attempted, ensuring prompt and expected behavior.

**Guidance:**

-   **`attempts`:** Start with 2-3 attempts (1 initial call + 1-2 retries) for most cases.
-   **`delayMs`:** Use a reasonable fixed delay (e.g., 100-500ms for fast backends, 1-2s for slower ones). Exponential backoff with jitter can be implemented in future versions if needed.
-   Retries add latency. Choose `attempts` and `delayMs` carefully to balance reliability with responsiveness.

### Batch Operations

The `MemoryClient` now supports batch `put`, `get`, and `delete` operations, allowing multiple memory interactions in a single HTTP request for efficiency.

**Methods:**

-   `putMany(items: { key: string; value: string }[]): Effect<void, MemoryError | MemoryBatchError>`
-   `deleteMany(keys: string[]): Effect<void, MemoryError | MemoryBatchError>`
-   `getMany(keys: string[]): Effect<ReadonlyMap<string, string | undefined>, MemoryError | MemoryBatchError>`

**Partial Failure Handling:**

-   Batch operations utilize `MemoryBatchPartialFailure` error for reporting mixed success and failure states. This error includes:
    -   `successes`: Count of successfully processed items.
    -   `correlationId?`: Optional ID for backend tracing.
    -   `failures`: An array detailing each failed item's `key` and specific `MemoryError`.
-   If all items succeed, the Effect returns `void` (for `putMany`/`deleteMany`) or `ReadonlyMap` (for `getMany`).

**Configuration and Limits:**

-   Batch operations inherit `SupermemoryClient`'s construction-time configuration (namespace, apiKey, retries).
-   Recommended maximum payload size: 1-5 MB.
-   Soft limit on items per batch: ~1,000 keys/items.
-   If a batch exceeds backend limits, it will likely result in a `MemoryValidationError`. The library does not currently perform client-side batch splitting (a future enhancement).

### Streaming Operations

The new `MemoryStreamClient` provides `Effect.Stream`-based methods for efficiently retrieving large sets of data, avoiding memory pressure.

**Methods:**

-   `listAllKeys(): Stream<string, MemoryError | StreamError>`: Streams all keys in the configured namespace.
-   `streamSearch(query: string, options?: SearchOptions): Stream<SearchResult, SearchError | StreamError>`: Streams search results.

**Usage Example:**

```ts
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { SupermemoryClientImpl, MemoryStreamClientImpl } from "effect-supermemory";

// Configure clients with shared config
const commonConfig = {
  namespace: "my-streaming-app",
  baseUrl: "https://api.supermemory.dev",
  apiKey: "sk-YOUR_API_KEY",
};

const streamingLayer = MemoryStreamClientImpl.Default(commonConfig).pipe(
  Effect.provide(SupermemoryClientImpl.Default(commonConfig)) // Provide HttpClient dependency via SupermemoryClient's layer
);

const streamKeysAndLog = Effect.gen(function* () {
  const streamClient = yield* MemoryStreamClientImpl;
  yield* streamClient.listAllKeys().pipe(
    Stream.tap((key) => Effect.log(`Streamed key: ${key}`)),
    Stream.runDrain // Consume the stream
  );
}).pipe(Effect.provide(streamingLayer));

Effect.runPromise(streamKeysAndLog).then(() => console.log("Key streaming finished."));
```

**Content Framing:**

-   Streaming endpoints are expected to return data in **NDJSON (Newline-Delimited JSON)** or **JSONL (JSON Lines)** format. Each line must be a complete JSON object.
-   The library handles incremental parsing of these formats.

**Error Handling and Cancellation:**

-   Streams fail immediately on initial HTTP errors (e.g., 401/403).
-   Mid-stream network errors or JSON parsing errors will terminate the stream with a `StreamReadError` or `JsonParsingError` (translated to `StreamReadError`).
-   Cancellation of the consuming stream (e.g., `Stream.take(N)`) correctly propagates to cancel the underlying HTTP request, ensuring proper resource release.

### Configuration

Memories are isolated by `namespace` via `MemoryConfig` Layer.

```ts
import { MemoryClientImpl, MemoryConfig, Default } from "effect-supermemory";
import * as Layer from "effect/Layer";

const layer = Layer.merge(
  Default,
  Layer.succeed(MemoryConfig, { namespace: "my-app" })
);
```

## Roadmap

- **0.1.0** ✓ Bootstrap: MemoryClient service, in-memory adapter, unit tests
- **0.2.0** ✓ HTTP client (Supermemory SDK integration)
- **0.3.0** ✓ Search/reranking, semantic filtering
- **0.4.0** ✓ Batch operations, streaming

## License

MIT
