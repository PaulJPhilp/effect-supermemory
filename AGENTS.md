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

## Code Style
- Strict TypeScript: `strict: true`, `exactOptionalPropertyTypes: true`
- Effect imports: `import * as Effect from "effect/Effect"`
- Functional programming with Effect framework
- Test imports: `import { describe, expect, it } from "@effect/vitest"`
- Module resolution: NodeNext, target ES2022
- No unused locals, strict null checks, no implicit any
