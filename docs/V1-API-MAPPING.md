# V1.0 API Mapping

**Source of truth:** Official Supermemory SDK v3.10.0

This document maps the official SDK methods to planned Effect services for effect-supermemory V1.0.

---

## Official SDK API Surface

### client.memories

| Method | Signature | Description |
|--------|-----------|-------------|
| `add` | `(body: MemoryAddParams) → MemoryAddResponse` | Add content (text, URL, etc.) |
| `get` | `(id: string) → MemoryGetResponse` | Get document by ID |
| `list` | `(params?) → MemoryListResponse` | List with pagination |
| `update` | `(id: string, body?) → MemoryUpdateResponse` | Update document |
| `delete` | `(id: string) → void` | Delete document |
| `uploadFile` | `(body: MemoryUploadFileParams) → MemoryUploadFileResponse` | Upload file |

### client.search

| Method | Signature | Description |
|--------|-----------|-------------|
| `documents` | `(body: SearchDocumentsParams) → SearchDocumentsResponse` | Search documents |
| `execute` | `(body: SearchExecuteParams) → SearchExecuteResponse` | Advanced search |
| `memories` | `(body: SearchMemoriesParams) → SearchMemoriesResponse` | Search memory entries |

### client.connections

| Method | Signature | Description |
|--------|-----------|-------------|
| `create` | `(provider, body?) → ConnectionCreateResponse` | Initialize OAuth |
| `list` | `(params?) → ConnectionListResponse` | List connections |
| `getByID` | `(id) → ConnectionGetByIDResponse` | Get connection |
| `deleteByID` | `(id) → ConnectionDeleteByIDResponse` | Delete connection |
| ... | ... | (additional methods) |

### client.settings

| Method | Signature | Description |
|--------|-----------|-------------|
| `get` | `() → SettingGetResponse` | Get org settings |
| `update` | `(body?) → SettingUpdateResponse` | Update settings |

---

## Proposed Effect Services for V1.0

### Priority 1: Core (Must Have)

```
MemoriesService
├── add(content, options?)      → Effect<MemoryAddResponse, SupermemoryError>
├── get(id)                     → Effect<MemoryGetResponse, SupermemoryError>
├── list(options?)              → Effect<MemoryListResponse, SupermemoryError>
├── update(id, options?)        → Effect<MemoryUpdateResponse, SupermemoryError>
├── delete(id)                  → Effect<void, SupermemoryError>
└── uploadFile(file, options?)  → Effect<MemoryUploadFileResponse, SupermemoryError>

SearchService
├── documents(query, options?)  → Effect<SearchDocumentsResponse, SupermemoryError>
├── execute(query, options?)    → Effect<SearchExecuteResponse, SupermemoryError>
└── memories(query, options?)   → Effect<SearchMemoriesResponse, SupermemoryError>
```

### Priority 2: Extended (Nice to Have)

```
ConnectionsService              # OAuth integrations
SettingsService                 # Org configuration
```

---

## What to Keep from Current Codebase

- ✅ Effect.Service pattern
- ✅ Error taxonomy (`SupermemoryError`, `SupermemoryValidationError`, etc.)
- ✅ Configuration service (`SupermemoryConfigService`)
- ✅ HTTP client infrastructure (`@effect/platform`)
- ✅ Telemetry/tracing patterns
- ✅ Filter builder (adapt for new filter format)

## What to Remove/Replace

- ❌ `SupermemoryClient` (key-value abstraction)
- ❌ `InMemoryClient` (not needed)
- ❌ `/api/v1/memories` endpoints
- ❌ Base64 encoding of values
- 🔄 Update `SearchService` endpoints to match SDK
- 🔄 Update `IngestService` → rename to `MemoriesService`

---

## Data Model Changes

### Old Model (to remove)
```typescript
// Key-value semantics
put(key: string, value: string)
get(key: string) → string | undefined
```

### New Model (from SDK)
```typescript
// Document semantics
add(params: { content: string, metadata?, containerTag?, customId? })
get(id: string) → { id, content, status, type, metadata, ... }
```

---

## Next Steps

1. [ ] Update `Constants.ts` with correct endpoints
2. [ ] Create `MemoriesService` matching SDK's `client.memories`
3. [ ] Update `SearchService` to match SDK's `client.search`
4. [ ] Remove deprecated services (`SupermemoryClient`, `InMemoryClient`)
5. [ ] Update types from SDK's TypeScript definitions
6. [ ] Write integration tests against real API
