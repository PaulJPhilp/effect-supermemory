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
- **0.2.0** HTTP client (Supermemory SDK integration)
- **0.3.0** Search/reranking, semantic filtering
- **0.4.0** Batch operations, streaming

## License

MIT
