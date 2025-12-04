# Effect Package Agent Guidelines

## Build/Lint/Test Commands
- **Build**: `pnpm build` (ESM + CJS + annotations)
- **Type check**: `pnpm check`
- **Test all**: `pnpm test`
- **Test coverage**: `pnpm coverage`
- **Run single test**: `pnpm vitest run test/File.test.ts`
- **Run code**: `pnpm tsx ./src/File.ts`

## Architecture
- Effect-based TypeScript library template
- Uses pnpm, Vitest (@effect/vitest), tsx runner
- Separate `src/` (main code) and `test/` directories
- Builds to both ESM (`build/esm`) and CJS (`build/cjs`)
- Project references: src and test in separate tsconfigs

## Code Style and Conventions

### Anti-Mocking Policy
**FORBIDDEN**: All forms of mocking, mocking frameworks, and mock servers are strictly prohibited.

- **No Mock Servers**: Do not create mock HTTP servers or API endpoints
- **No Mock Frameworks**: Do not use mocking libraries like vi.mock, jest.mock, or similar
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

### TypeScript Configuration
- Strict TypeScript: `strict: true`, `exactOptionalPropertyTypes: true`
- Effect imports: `import { Effect } from "effect"`
- Functional programming with Effect framework
- Test imports: `import { describe, expect, it } from "@effect/vitest"`
- Module resolution: NodeNext, target ES2022
- No unused locals, strict null checks, no implicit any
