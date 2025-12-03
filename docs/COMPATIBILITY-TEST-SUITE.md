# Compatibility Test Suite

## Overview

The compatibility test suite verifies that effect-supermemory produces functionally equivalent results to the official Supermemory TypeScript SDK. It uses an adapter pattern to run the same operations through both libraries and compare results.

## Test Files

### Core Tests

- **`test/compatibility/operations.test.ts`** - Main compatibility tests
  - Side-by-side operation comparisons
  - Tests all core operations (put, get, delete, exists, clear)
  - Tests batch operations (putMany, getMany, deleteMany)
  - Edge case testing (special characters, empty values, etc.)

- **`test/compatibility/http-request.test.ts`** - HTTP request verification
  - Verifies HTTP request formats
  - Tracks requests made by effect-supermemory
  - Documents expected request structure for SDK comparison

- **`test/compatibility/helpers.ts`** - Test utilities
  - Adapter implementations for both libraries
  - Comparison utilities
  - Test data generators
  - SDK availability detection

## Architecture

### Adapter Pattern

Both libraries are wrapped in adapters implementing the same `CompatibilityAdapter` interface:

```typescript
interface CompatibilityAdapter {
  put(key: string, value: string): Promise<void>;
  get(key: string): Promise<string | undefined>;
  delete(key: string): Promise<boolean>;
  exists(key: string): Promise<boolean>;
  clear(): Promise<void>;
  putMany(items: Array<{ key: string; value: string }>): Promise<void>;
  getMany(keys: readonly string[]): Promise<Map<string, string | undefined>>;
  deleteMany(keys: readonly string[]): Promise<void>;
}
```

This allows the same test code to run operations through both libraries.

### SDK Adapter Implementation

The official SDK adapter (`createOfficialSdkAdapter`) maps effect-supermemory operations to SDK API calls:

- `put(key, value)` → `client.memories.create({ content: value, containerTags: [key] })`
- `get(key)` → Search by containerTags or get by customId
- `delete(key)` → Delete by ID or containerTags
- Batch operations → SDK batch methods if available

## Running Tests

```bash
# Run all compatibility tests
bun run test:compatibility

# Run specific test file
bun run vitest run test/compatibility/operations.test.ts

# Run in watch mode
bun run vitest test/compatibility

# Run with mock server (required)
bun run mock:server &
bun run test:compatibility
```

## Test Configuration

Tests use a mock server running on `http://localhost:3001`:

```typescript
const TEST_CONFIG = {
  namespace: "test-compatibility",
  baseUrl: "http://localhost:3001",
  apiKey: "test-api-key",
  timeoutMs: 5000,
};
```

Start the mock server before running tests:
```bash
bun run mock:server
```

## Official SDK Integration

### Installation

To enable side-by-side comparisons with the official SDK:

```bash
bun add -d supermemory
```

### Automatic Detection

Tests automatically detect if the official SDK is available:

- If installed: Runs full side-by-side comparison tests
- If not installed: Runs effect-supermemory-only tests (tests still pass)

### SDK Client Creation

```typescript
const sdkAdapter = await createOfficialSdkClient({
  apiKey: TEST_CONFIG.apiKey,
  baseUrl: TEST_CONFIG.baseUrl,
  namespace: TEST_CONFIG.namespace,
});
```

## Test Categories

### 1. Core Operations

Tests verify each operation produces equivalent results:

- **put() / get()** - Store and retrieve values
- **delete()** - Delete with idempotent behavior
- **exists()** - Check existence
- **clear()** - Clear namespace

### 2. Batch Operations

- **putMany()** - Store multiple values
- **getMany()** - Retrieve multiple values
- **deleteMany()** - Delete multiple values

### 3. Edge Cases

- Special characters in keys/values
- Unicode characters
- Empty values
- Non-existent keys
- Large batches (performance)

### 4. Error Handling

- Network errors (when mocked)
- Invalid keys
- Empty arrays

### 5. HTTP Request Format

- Request method verification
- Path verification
- Header verification
- Body format verification

## Comparison Logic

### Result Comparison

Results are compared using deep equality:

```typescript
const comparison = compareResults(
  "get",
  [testKey],
  effectResult,
  sdkResult
);

expect(comparison.match).toBe(true);
```

### Helper Function

The `runCompatibilityTest()` helper makes it easy to run the same operation through both adapters:

```typescript
const testResult = await runCompatibilityTest(
  "get",
  effectAdapter,
  sdkAdapter,
  async (adapter) => await adapter.get(key)
);

expect(testResult.effectResult).toBe(expected);
if (testResult.comparison) {
  expect(testResult.comparison.match).toBe(true);
}
```

## Test Utilities

### Generate Test Data

```typescript
const testData = generateTestData("prefix", 5);
// Returns: [
//   { key: "prefix-1", value: "value-1" },
//   { key: "prefix-2", value: "value-2" },
//   ...
// ]
```

### Cleanup

```typescript
await cleanupTestData(adapter, keys);
// Safely deletes test data, ignores errors
```

### SDK Availability

```typescript
const availability = skipIfSdkUnavailable();
if (availability.skip) {
  // Skip tests that require SDK
}
```

## Example Test Output

```
✓ Compatibility Tests
  ✓ put() / get() operations
    ✓ should store and retrieve values equivalently
    ✓ should return undefined for non-existent keys
    ✓ should handle special characters in keys and values
  ✓ delete() operation
    ✓ should delete values and return true
    ✓ should be idempotent
  ✓ batch operations
    ✓ putMany()
      ✓ should store multiple values in a single request
      ✓ should handle empty arrays
```

## Known Limitations

1. **SDK API Mapping**: The SDK adapter uses best-effort mapping based on documented API. Some operations may need refinement as the SDK is analyzed.

2. **Streaming Operations**: Streaming operation tests are not yet implemented (coming soon).

3. **Search Operations**: Search compatibility tests would require additional analysis of SDK search API.

4. **Error Format Differences**: Official SDK throws errors; effect-supermemory uses Effect error channel. Tests focus on semantic equivalence.

## Future Enhancements

- [ ] Streaming operation compatibility tests
- [ ] Search operation compatibility tests
- [ ] Automatic SDK adapter generation from extracted API
- [ ] Request/response format validation
- [ ] Performance benchmarking comparisons
- [ ] Error message comparison

## Contributing

When adding new operations:

1. Add to `CompatibilityAdapter` interface
2. Implement in both adapters
3. Add comprehensive test cases
4. Include edge cases and error scenarios
5. Update this documentation

The compatibility test suite ensures effect-supermemory maintains functional equivalence with the official SDK!
