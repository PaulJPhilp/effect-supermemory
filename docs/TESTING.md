# Testing Guide

This document describes the testing strategy and requirements for effect-supermemory.

## Anti-Mocking Policy

**FORBIDDEN**: All forms of mocking, mocking frameworks, and mock servers are strictly prohibited.

- **No Mock Servers**: Do not create mock HTTP servers or API endpoints
- **No Mock Frameworks**: Do not use mocking libraries like `vi.mock`, `jest.mock`, or similar
- **No Test Doubles**: Do not create fake implementations of services for testing
- **No Mock Data**: Do not use hardcoded mock responses or fixtures

**Rationale**: 
- Mocks create artificial test environments that don't match real-world behavior
- Mocks require constant maintenance and diverge from actual API implementations
- Mocks hide integration issues and network-related problems
- Real testing should validate actual behavior and error handling

**Alternatives**:
- Write integration tests against real services
- Use test environments with actual API endpoints
- Focus on unit testing pure functions and business logic
- Test error conditions by triggering actual error states

## Test Categories

### 1. Pure Function Tests (No Network Required)

These tests verify pure functions and business logic without any external dependencies.

**Location**: `services/*/__tests__/*.test.ts`

**Examples**:
- `services/search/__tests__/filterBuilder.test.ts` - Filter builder API and serialization
- `services/search/__tests__/helpers.test.ts` - Search parameter building
- `services/supermemoryClient/__tests__/helpers.test.ts` - Base64 encoding/decoding
- `services/inMemoryClient/__tests__/unit.test.ts` - In-memory client operations

**Run**: `bun run test services/search/__tests__/ services/inMemoryClient/__tests__/`

**Status**: ✅ All passing (68 tests)

### 2. In-Memory Service Tests (No Network Required)

These tests use the `InMemoryClient` service which stores data in memory.

**Location**: `services/inMemoryClient/__tests__/unit.test.ts`

**Features**:
- Namespace isolation
- CRUD operations
- Batch operations
- No external dependencies

**Run**: `bun run test services/inMemoryClient/__tests__/`

**Status**: ✅ All passing (6 tests)

### 3. Integration Tests (Requires Real API Access)

These tests require a real Supermemory API server running.

**Location**: `test/integration.test.js`

**Requirements**:
- Supermemory API access (cloud service at `https://api.supermemory.dev` or local dev server)
- Valid API key from Supermemory
- Network connectivity to API endpoint

**Configuration**:
```typescript
const TEST_CONFIG = {
  namespace: "test-integration",
  baseUrl: "http://localhost:3001", // Real API server
  apiKey: "test-api-key",
  timeoutMs: 5000,
};
```

**Run**: 
```bash
# Ensure API server is running, then:
bun run test test/integration.test.js
```

**Status**: ⚠️ Requires real API server

### 4. Compatibility Tests (Requires Real API Access)

These tests compare behavior with the official Supermemory SDK.

**Location**: `test/compatibility/`

**Requirements**:
- Real API server running
- Official SDK installed (optional, tests skip if unavailable)
- Network connectivity

**Run**: 
```bash
# Ensure API server is running, then:
bun run test:compatibility
```

**Status**: ⚠️ Requires real API server

### 5. Service Tests with Real API (Conditional)

Some service tests can run with real API access when configured.

**Location**: `services/*/__tests__/unit.test.ts`

**Pattern**: Tests use `it.skipIf(!hasRealApiKey)` to conditionally run

**Requirements**:
- `SUPERMEMORY_API_KEY` environment variable set
- API key must not be "test-api-key" (to distinguish from test config)

**Run**: 
```bash
SUPERMEMORY_API_KEY=your-real-key bun run test services/supermemoryClient/__tests__/
```

**Status**: ⚠️ Requires real API key

## Running Tests

### Run All Pure Function Tests (Recommended)

```bash
# Tests that don't require network access
bun run test services/search/__tests__/ \
              services/inMemoryClient/__tests__/ \
              services/supermemoryClient/__tests__/helpers.test.ts
```

### Run All Tests (Including Network-Dependent)

```bash
# Requires real API server running
bun run test
```

### Run Specific Test File

```bash
bun run test path/to/test.test.ts
```

### Run Tests in Watch Mode

```bash
bun run test:watch
```

## Test Environment Setup

### For Pure Function Tests

No setup required - these tests run in isolation.

### For Integration Tests

The Supermemory API is a **cloud service** hosted at `https://api.supermemory.dev`. You have two options:

**Option 1: Use Production API (Recommended for CI/CD)**
1. Get an API key from [Supermemory](https://supermemory.ai)
2. Update test config to use production baseUrl:
   ```typescript
   const TEST_CONFIG = {
     namespace: "test-integration",
     baseUrl: "https://api.supermemory.dev", // Production API
     apiKey: process.env.SUPERMEMORY_API_KEY || "your-api-key",
     timeoutMs: 5000,
   };
   ```
3. Run tests: `bun run test test/integration.test.js`

**Option 2: Use Local Development Server (If Available)**
If Supermemory provides a local development server:
1. Start the local server (check Supermemory documentation)
2. Update test config to use local baseUrl:
   ```typescript
   const TEST_CONFIG = {
     namespace: "test-integration",
     baseUrl: "http://localhost:3001", // Local dev server
     apiKey: "test-api-key",
     timeoutMs: 5000,
   };
   ```
3. Run tests: `bun run test test/integration.test.js`

**Note**: The `localhost:3001` reference in tests is a placeholder. Replace with your actual API endpoint.

### Environment Variables

Create a `.env` file in the project root (see `.env.example` for template):

```bash
SUPERMEMORY_API_KEY=sk-your-api-key-here
SUPERMEMORY_BASE_URL=https://api.supermemory.dev  # Optional
SUPERMEMORY_TEST_NAMESPACE=test-integration        # Optional
```

The `.env` file is automatically loaded by Bun and Vitest. **Never commit `.env` to git** (it's already in `.gitignore`).

**Environment Variables:**
- `SUPERMEMORY_API_KEY`: Real API key for service tests (required for integration tests)
- `SUPERMEMORY_BASE_URL`: API endpoint URL (defaults to `https://api.supermemory.dev`)
- `SUPERMEMORY_TEST_NAMESPACE`: Test namespace (defaults to `test-integration`)
- `NODE_ENV`: Set to `test` for test environment (optional)

## Test Coverage

### Current Coverage

- ✅ **Pure Functions**: 68 tests passing
  - Filter builder (37 tests)
  - Search helpers (7 tests)
  - Base64 helpers (18 tests)
  - In-memory client (6 tests)

- ⚠️ **Integration Tests**: Require real API server
- ⚠️ **Service Tests**: Some require real API key

### Coverage Goals

- [ ] 100% coverage of pure functions ✅ (Achieved)
- [ ] 100% coverage of error mapping logic
- [ ] 100% coverage of filter builder logic ✅ (Achieved)
- [ ] Integration test coverage (requires API server)

## Writing New Tests

### Pure Function Tests

```typescript
import { describe, expect, it } from "vitest";
import { myPureFunction } from "../helpers.js";

describe("MyPureFunction", () => {
  it("handles simple case", () => {
    const result = myPureFunction("input");
    expect(result).toBe("expected");
  });
});
```

### Service Tests (In-Memory)

```typescript
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { MyService } from "../service.js";

describe("MyService", () => {
  const testLayer = MyService.Default("test-namespace");

  it("performs operation", async () => {
    const program = Effect.gen(function* () {
      const service = yield* MyService;
      return yield* service.operation("input");
    }).pipe(Effect.provide(testLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBe("expected");
  });
});
```

### Integration Tests (Real API)

```typescript
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { MyClient } from "../client.js";

describe("MyClient Integration", () => {
  const testLayer = MyClient.Default({
    baseUrl: "http://localhost:3001",
    apiKey: "test-api-key",
  });

  it("performs real operation", async () => {
    const program = Effect.gen(function* () {
      const client = yield* MyClient;
      return yield* client.operation("input");
    }).pipe(Effect.provide(testLayer));

    const result = await Effect.runPromise(program);
    expect(result).toBeDefined();
  });
});
```

## Troubleshooting

### Tests Fail with Network Errors

- **Symptom**: `NetworkError` or connection refused
- **Solution**: Ensure API server is running and accessible
- **Alternative**: Run only pure function tests

### Tests Skip Unexpectedly

- **Symptom**: Tests marked as skipped
- **Solution**: Check `it.skipIf()` conditions and environment variables
- **Check**: Verify API key is set correctly

### Import Errors

- **Symptom**: Module not found errors
- **Solution**: Run `bun install` to ensure dependencies are installed
- **Check**: Verify file paths use `.js` extension for ESM imports

## Best Practices

1. **Prefer Pure Function Tests**: Write tests for pure functions whenever possible
2. **Use In-Memory Services**: Use `InMemoryClient` for testing service logic without network
3. **Skip Network Tests**: Use `it.skipIf()` for tests that require real API access
4. **Document Requirements**: Clearly document which tests require external services
5. **No Mocks**: Never use mocks, mock servers, or test doubles

## CI/CD Considerations

### Recommended CI Strategy

1. **Always Run**: Pure function tests (fast, reliable)
2. **Conditionally Run**: Integration tests (require API server)
3. **Skip**: Tests that require real API keys (use separate test environment)

### Example CI Configuration

```yaml
# Run pure function tests (always)
- run: bun run test services/search/__tests__/ services/inMemoryClient/__tests__/

# Run integration tests (if API server available)
- run: bun run test test/integration.test.js
  env:
    SUPERMEMORY_API_KEY: ${{ secrets.TEST_API_KEY }}
```

## Summary

- ✅ **68 pure function tests** - No mocks, no network required
- ✅ **6 in-memory service tests** - No network required  
- ⚠️ **Integration tests** - Require real API server
- ⚠️ **Some service tests** - Require real API key

All tests follow the anti-mocking policy and use real implementations or pure functions.

