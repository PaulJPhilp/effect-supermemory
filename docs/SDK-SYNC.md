# SDK Synchronization Workflow

This document describes the manual process for keeping effect-supermemory in sync with the official Supermemory TypeScript SDK.

## Overview

effect-supermemory is positioned as the **third SDK** for Supermemory (alongside Python and TypeScript). We track the official TypeScript SDK and ensure type-level compatibility.

## Version Tracking

Converted SDK versions are tracked in `sdk-versions.json`:

```json
{
  "sdkRepo": "supermemoryai/sdk-ts",
  "sdkPackage": "supermemory",
  "current": "3.10.0",
  "history": [
    { "version": "3.10.0", "convertedAt": "2025-12-08", "pr": "#123", "notes": "Initial sync" }
  ]
}
```

## Manual Sync Process

### 1. Check for New SDK Version

```bash
# Check latest version on npm
npm view supermemory version

# Or check GitHub releases
open https://github.com/supermemoryai/sdk-ts/releases
```

### 2. Review Release Notes

Visit the release page to understand what changed:
- https://github.com/supermemoryai/sdk-ts/releases

Look for:
- New API methods
- Changed parameters
- Breaking changes
- Deprecated features

### 3. Create a Sync Branch

```bash
git checkout -b sdk-sync/v3.10.0
```

### 4. Update the SDK DevDependency

```bash
bun add -d supermemory@3.10.0
```

### 5. Run Type Compatibility Checks

```bash
bun run typecheck
```

Review any type errors - these indicate where effect-supermemory needs updates.

### 6. Compare SDK Types

Inspect the official SDK types to understand the API surface:

```bash
# Open the SDK types
code node_modules/supermemory/dist/index.d.ts
```

Key files to review:
- `resources/memories.d.ts` - Memory operations
- `resources/search.d.ts` - Search operations
- `resources/documents.d.ts` - Document operations

### 7. Implement Changes

Update effect-supermemory services to match the SDK:

- `services/supermemoryClient/` - Core memory operations
- `services/searchClient/` - Search operations
- `src/Domain.ts` - Domain types
- `src/Errors.ts` - Error types

Follow existing Effect patterns:
- Use `Effect.Service` with `Effect.fn()` parameterization
- Use `Data.TaggedError` for errors
- Maintain semantic 404 handling
- Preserve retry policies

### 8. Update Version Tracking

Edit `sdk-versions.json`:

```json
{
  "current": "3.10.0",
  "history": [
    { "version": "3.10.0", "convertedAt": "2025-12-08", "pr": "#123", "notes": "Added metadata support" }
  ]
}
```

### 9. Run Tests

```bash
bun run test
bun run typecheck
```

### 10. Create Pull Request

```bash
git add .
git commit -m "sync: update to supermemory SDK v3.10.0"
git push -u origin sdk-sync/v3.10.0
gh pr create --title "SDK Sync: v3.10.0" --body "$(cat <<'EOF'
## SDK Sync: v3.10.0

### Changes from Official SDK
- [List changes from release notes]

### Implementation Changes
- [List what was updated in effect-supermemory]

### Checklist
- [ ] Type compatibility verified
- [ ] Tests passing
- [ ] sdk-versions.json updated
EOF
)"
```

## Type-Level Compatibility (Future)

Once the process is proven, we can add compile-time type assertions:

```typescript
// test/type-compatibility.ts
import type { Supermemory } from "supermemory"
import type { SupermemoryClient } from "../services/supermemoryClient/service.js"

// Assert parameter compatibility
type AssertPutParams = Parameters<Supermemory["memories"]["create"]>[0] extends
  Parameters<SupermemoryClient["put"]>[0] ? true : never

const _assert: AssertPutParams = true // Compile error if incompatible
```

## Resources

- **Official SDK Repo**: https://github.com/supermemoryai/sdk-ts
- **Releases**: https://github.com/supermemoryai/sdk-ts/releases
- **npm Package**: https://www.npmjs.com/package/supermemory
