# Release Checklist

## Pre-Release

- [x] **Build passes**: `bun run build` ✅
- [x] **Type checking passes**: `bun run typecheck` ✅
- [ ] **Pure function tests pass**: `bun run test services/search/__tests__/ services/inMemoryClient/__tests__/` (no mocks, no network)
- [ ] **Integration tests pass**: `bun run test test/integration.test.js` (requires real API server)
- [ ] **Linting**: `bun run lint` (scripts have non-blocking lint issues)
- [x] **CHANGELOG.md created** ✅
- [x] **Version set in package.json**: `0.1.0` ✅

## Release Steps

1. **Final Verification**
   ```bash
   bun run build
   bun run typecheck
   ```

2. **Run Core Tests** (tests that don't require external dependencies)
   ```bash
   bun run test -- services/memoryClient
   bun run test -- services/httpClient
   ```

3. **Build Distribution**
   ```bash
   bun run build
   ```
   Verify `dist/` directory contains all expected files.

4. **Create Git Tag**
   ```bash
   git tag -a v0.1.0 -m "Release v0.1.0"
   git push origin v0.1.0
   ```

5. **Publish to npm** (when ready)
   ```bash
   npm publish --access public
   ```

## Post-Release

- [ ] Update README.md with any new information
- [ ] Create GitHub release notes from CHANGELOG.md
- [ ] Monitor for any issues after release

## Known Test Limitations

Some tests require external dependencies and may fail in CI without proper setup:

- **Integration tests** (`test/integration.test.ts`): Require real API server running
  - No mocks allowed per anti-mocking policy
  - Ensure API server is accessible before running tests

- **Compatibility tests** (`test/compatibility/`): Require official Supermemory SDK
  - These are optional and test SDK compatibility, not core functionality

- **Some service tests**: May require real API key for full coverage (use `SUPERMEMORY_API_KEY` env var)
  - Core functionality tests (memoryClient, httpClient) should pass without external deps

## Notes

- Scripts in `scripts/` have linting issues but are non-blocking (utility scripts)
- Build artifacts are properly excluded via `.gitignore`
- Package is configured for ESM with proper exports



