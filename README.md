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
  └── memoryClient/         # MemoryClient service (Effect.Service)
      ├── __tests__/        # unit.test.ts
      ├── api.ts            # Interface contract
      ├── errors.ts         # Discriminated error types
      ├── types.ts          # Data types
      ├── service.ts        # Effect.Service implementation + Default layer
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
