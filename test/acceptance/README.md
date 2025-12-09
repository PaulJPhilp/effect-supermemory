# Acceptance Tests

This directory contains acceptance tests that compare the official Supermemory SDK (`supermemory`) with our Effect-native implementation (`effect-supermemory`).

## Purpose

Acceptance tests ensure API compatibility by:

1. **Running the same operations** on both the official SDK and our Effect implementation
2. **Comparing response structures** to verify compatibility
3. **Testing error handling** to ensure similar behavior in failure cases
4. **Validating service interfaces** match expected signatures

## Requirements

- `SUPERMEMORY_API_KEY` environment variable must be set with a valid API key
- Optional: `SUPERMEMORY_BASE_URL` to override the default API URL
- Real API access (no mocking - per project anti-mocking policy)

## Running Tests

```bash
# Run all acceptance tests
bun run vitest run test/acceptance

# Run specific acceptance test file
bun run vitest run test/acceptance/memories.test.ts

# Run in watch mode
bun run vitest test/acceptance
```

## Test Files

| File | Description |
|------|-------------|
| `helpers.ts` | Shared utilities, SDK client setup, Effect layer creation |
| `memories.test.ts` | Tests for MemoriesService: add, get, list, update, delete |
| `search.test.ts` | Tests for SearchService: searchDocuments, execute, searchMemories |
| `connections.test.ts` | Tests for ConnectionsService: list, getByID, structure verification |
| `settings.test.ts` | Tests for SettingsService: get, update |

## Test Strategy

### Direct Comparison
For each operation, we:
1. Call the official SDK method
2. Call our Effect implementation
3. Compare response structures using `isStructurallySimilar()`

### Error Handling
Both implementations should:
- Fail on invalid inputs (empty queries, non-existent IDs)
- Return typed errors that can be caught and handled

### Structure Verification
We verify that:
- Response objects have the same keys
- Field types match between implementations
- Arrays contain similarly-structured items

## Notes

- Tests create real data in your Supermemory workspace
- Cleanup is attempted after tests, but may leave some data
- Use a test workspace/API key if possible to avoid polluting production data
- Some tests (like OAuth connections) only verify structure, not full flows

## Adding New Tests

When adding new acceptance tests:

1. Import helpers from `./helpers.js`
2. Use `SKIP_ACCEPTANCE` to skip when no API key is set
3. Use `TestCleanup` to track created resources
4. Compare both implementations' responses
5. Use `isStructurallySimilar()` for structure comparison
