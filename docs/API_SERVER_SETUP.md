# API Server Setup Guide

## Overview

effect-supermemory is a client library for the **Supermemory API**, which is a cloud service. The tests require access to this API to run integration tests.

## What is the Supermemory API?

The Supermemory API is a **cloud-hosted service** for long-term memory storage for AI agents. It's not something you run locally - it's a service provided by Supermemory.ai.

**Production Endpoints:**
- `https://api.supermemory.dev` (primary)
- `https://api.supermemory.ai` (alternative)

## Getting API Access

### 1. Sign Up for Supermemory

1. Visit [https://supermemory.ai](https://supermemory.ai)
2. Sign up for an account
3. Navigate to your dashboard/API settings
4. Generate an API key

### 2. Get Support

If you need help:
- **Email**: support@supermemory.ai
- **Discord**: https://discord.gg/supermemory
- Request: "API access and OpenAPI specification"

## Configuration for Tests

### Using Production API (Recommended)

Update your test configuration to use the production API:

```typescript
// test/integration.test.js
const TEST_CONFIG = {
  namespace: "test-integration",
  baseUrl: "https://api.supermemory.dev", // Production API
  apiKey: process.env.SUPERMEMORY_API_KEY || "your-api-key-here",
  timeoutMs: 5000,
};
```

**Set API Key:**
```bash
export SUPERMEMORY_API_KEY=sk-your-actual-api-key
bun run test test/integration.test.js
```

### Using Local Development Server (If Available)

If Supermemory provides a local development server:

1. **Check Supermemory Documentation**: Look for local development setup instructions
2. **Start the Server**: Follow Supermemory's instructions to run the server locally
3. **Update Test Config**: Point tests to local server:

```typescript
const TEST_CONFIG = {
  namespace: "test-integration",
  baseUrl: "http://localhost:3001", // Local dev server
  apiKey: "test-api-key", // Use test key provided by dev server
  timeoutMs: 5000,
};
```

**Note**: The `localhost:3001` reference in existing tests is a placeholder. Replace it with the actual endpoint provided by Supermemory's local development server.

## Environment Variables

### Using .env File (Recommended)

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API key
SUPERMEMORY_API_KEY=sk-your-api-key-here
```

The `.env` file is automatically loaded by Bun and Vitest. **Never commit `.env` to git** (it's already in `.gitignore`).

### Using Environment Variables Directly

Alternatively, set environment variables directly:

```bash
# Required for tests that use real API
export SUPERMEMORY_API_KEY=sk-your-api-key-here

# Optional: Override base URL
export SUPERMEMORY_BASE_URL=https://api.supermemory.dev

# Optional: Set test namespace
export SUPERMEMORY_TEST_NAMESPACE=test-integration
```

## Running Tests

### Pure Function Tests (No API Required)

These tests don't need the API server:

```bash
bun run test services/search/__tests__/ \
              services/inMemoryClient/__tests__/ \
              services/supermemoryClient/__tests__/helpers.test.ts
```

### Integration Tests (Requires API)

```bash
# Set your API key
export SUPERMEMORY_API_KEY=sk-your-api-key

# Run integration tests
bun run test test/integration.test.js
```

### All Tests

```bash
# Set your API key
export SUPERMEMORY_API_KEY=sk-your-api-key

# Run all tests (some will skip if API unavailable)
bun run test
```

## Troubleshooting

### "NetworkError" or Connection Refused

**Problem**: Tests fail with network errors

**Solutions**:
1. **Check API Key**: Ensure `SUPERMEMORY_API_KEY` is set correctly
2. **Check Base URL**: Verify the baseUrl in test config matches your API endpoint
3. **Check Network**: Ensure you can reach the API endpoint:
   ```bash
   curl https://api.supermemory.dev/health
   # or
   curl http://localhost:3001/health  # if using local dev server
   ```
4. **Check Firewall**: Ensure your firewall allows outbound HTTPS connections

### Tests Skip Unexpectedly

**Problem**: Tests are marked as skipped

**Solutions**:
1. **Check Environment Variable**: Ensure `SUPERMEMORY_API_KEY` is set
2. **Check API Key Format**: API key should not be "test-api-key" (that's a placeholder)
3. **Check Test Conditions**: Some tests use `it.skipIf(!hasRealApiKey)` - they need a real API key

### 401/403 Authorization Errors

**Problem**: Tests fail with authorization errors

**Solutions**:
1. **Verify API Key**: Ensure your API key is valid and active
2. **Check Key Format**: API keys typically start with `sk-` prefix
3. **Check Permissions**: Ensure your API key has necessary permissions
4. **Contact Support**: If key appears valid but still fails, contact Supermemory support

## CI/CD Setup

For continuous integration, use environment secrets:

```yaml
# GitHub Actions example
env:
  SUPERMEMORY_API_KEY: ${{ secrets.SUPERMEMORY_API_KEY }}

# Run tests
- run: bun run test test/integration.test.js
```

**Security Note**: Never commit API keys to version control. Always use environment variables or secrets management.

## Alternative: Skip Integration Tests

If you don't have API access, you can still run pure function tests:

```bash
# Run only tests that don't require API
bun run test services/search/__tests__/ \
              services/inMemoryClient/__tests__/ \
              services/supermemoryClient/__tests__/helpers.test.ts
```

These tests provide good coverage of the core functionality without requiring API access.

## Summary

- **Supermemory API** is a cloud service, not something you run locally
- **Get API Key** from Supermemory.ai dashboard
- **Configure Tests** to use production API or local dev server (if available)
- **Set Environment Variables** for API key and configuration
- **Run Tests** with proper API access configured

For questions or issues, contact Supermemory support at support@supermemory.ai or Discord.

