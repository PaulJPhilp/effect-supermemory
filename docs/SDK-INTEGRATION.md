# Official SDK Integration Guide

This document provides information about integrating with the official Supermemory TypeScript SDK for compatibility testing.

## Package Information

- **Package Name:** `supermemory`
- **Installation:** `npm install supermemory` or `bun add supermemory`
- **Documentation:** https://supermemory.ai/docs

## SDK Structure

Based on the official SDK documentation:

### Initialization

```typescript
import { Supermemory } from 'supermemory';

const client = new Supermemory({
  apiKey: process.env.SUPERMEMORY_API_KEY!,
});
```

### Key Methods

The official SDK uses a different API structure than effect-supermemory:

**Creating Memories:**
```typescript
await client.memories.create({
  content: "The user likes coffee in the morning.",
  containerTags: ["user-123"], // Used for organization/namespace
});
```

**Key Differences:**
- Official SDK uses `memories.create()` with `content` and `containerTags`
- effect-supermemory uses `put(key, value)` with explicit keys
- Official SDK uses `containerTags` for organization (similar to namespaces)

## Compatibility Mapping

To ensure functional compatibility, we need to map between the two APIs:

| effect-supermemory | Official SDK |
|-------------------|--------------|
| `put(key, value)` | `memories.create({ content: value, containerTags: [key] })` |
| `get(key)` | Query by containerTags or search |
| `delete(key)` | Delete by ID or containerTag |
| `exists(key)` | Query existence |
| `clear()` | Bulk delete by namespace/containerTags |

## Integration Steps

1. **Install the official SDK:**
   ```bash
   bun add -d supermemory
   ```

2. **Update compatibility tests:**
   - Implement `createOfficialSdkAdapter()` in `test/compatibility/helpers.ts`
   - Map effect-supermemory operations to official SDK calls
   - Ensure both produce equivalent results

3. **Run compatibility checks:**
   ```bash
   bun run compat:extract    # Extract official SDK API
   bun run compat:compare    # Compare APIs
   bun run test:compatibility # Run compatibility tests
   ```

## Notes

- The official SDK may have additional features not yet implemented in effect-supermemory
- Error handling differs: official SDK throws errors, effect-supermemory uses Effect error channel
- Some operations may require multiple API calls to achieve equivalent functionality
