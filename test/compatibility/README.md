# Compatibility Test Suite

This directory contains tests that verify functional compatibility between effect-supermemory and the official Supermemory TypeScript SDK.

## Test Files

- **`operations.test.ts`** - Side-by-side operation tests comparing results
- **`http-request.test.ts`** - HTTP request format verification
- **`helpers.ts`** - Test utilities and adapters

## Running Tests

```bash
# Run all compatibility tests
bun run test:compatibility

# Run specific test file
bun run vitest run test/compatibility/operations.test.ts

# Run in watch mode
bun run vitest test/compatibility
```

## Official SDK Requirements

To run full compatibility tests (including side-by-side comparisons), you need to install the official SDK:

```bash
bun add -d supermemory
```

Tests will automatically skip official SDK comparisons if the package is not installed.

## Test Structure

### Adapter Pattern

Both libraries are wrapped in adapters that implement the same interface (`CompatibilityAdapter`), allowing the same test code to run operations through both libraries and compare results.

### Test Categories

1. **Operation Tests** - Verify each operation produces equivalent results
2. **Error Handling** - Verify error handling is semantically equivalent
3. **Edge Cases** - Special characters, empty values, large batches
4. **HTTP Request Tests** - Verify request formats are correct

## Writing New Tests

When adding new operations to effect-supermemory:

1. Add the operation to `CompatibilityAdapter` interface in `helpers.ts`
2. Implement in both adapters (`createEffectSupermemoryAdapter` and `createOfficialSdkAdapter`)
3. Add test cases to `operations.test.ts`
4. Use `runCompatibilityTest()` helper for side-by-side comparisons

## Known Limitations

- Official SDK adapter is a best-effort mapping based on documented API
- Some operations may need manual verification if SDK API differs significantly
- Streaming operations are not yet tested (coming soon)
