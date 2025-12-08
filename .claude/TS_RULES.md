# TypeScript Rules & Preferences

Rules extracted from reviewed services, merged with user preferences.

## Type Safety & Configuration

- Enable `strict: true` in tsconfig.json with:
  - `noImplicitAny: true`
  - `strictNullChecks: true`
  - `strictFunctionTypes: true`
  - `exactOptionalPropertyTypes: true`
- Use `--noEmitOnError` compiler flag
- Never use `// @ts-ignore` without explanatory comments

## Type Definitions

- **Never use `any`** - use `unknown` with type guards instead
- **Never use Enums** - use union types: `type Status = "active" | "inactive"`
- Use `readonly` for immutable properties and arrays
- Explicitly type function parameters and return types
- Use discriminated unions with exhaustiveness checking

## Interfaces vs Types

- **Use `interface` for object contracts** (all `api.ts` files)
- Use `type` only for: unions, intersections, branded types
- Add `// biome-ignore lint: Interface preferred for object contracts` when needed

```typescript
// Good
export interface HttpClientApi {
  readonly request: <T>(path: string) => Effect.Effect<T, HttpClientError>;
}

// Bad - Don't use type for object contracts
export type HttpClientApi = { ... }
```

## Service Pattern

Use `Effect.Service` with `Effect.fn()`:

```typescript
export class ServiceName extends Effect.Service<ServiceName>()("ServiceName", {
  effect: Effect.fn(function* (config: ConfigType) {
    return { ... } satisfies ServiceApi;
  }),
}) {}
```

## Error Types

Use `Data.TaggedError` for discriminated errors:

```typescript
export class MemoryNotFoundError extends Data.TaggedError("MemoryNotFoundError")<{
  readonly key: string;
}> {}

export type MemoryError = MemoryNotFoundError | MemoryValidationError;
```

## Branded Types

Use `Brand.refined` for validated types:

```typescript
export type Namespace = string & Brand.Brand<"Namespace">;
export const Namespace = Brand.refined<Namespace>(
  (ns) => ns.length > 0 && /^[a-zA-Z0-9_-]+$/.test(ns),
  (ns) => Brand.error("Invalid namespace")
);
```

## File Structure

```
services/[name]/
├── api.ts       # Interface contract (use interface, not type)
├── errors.ts    # Data.TaggedError classes
├── types.ts     # Branded types, config types
├── service.ts   # Effect.Service implementation
├── helpers.ts   # Pure utility functions
└── index.ts     # Public exports
```

## Naming Conventions

- Interface types: PascalCase + "Api" suffix (e.g., `InMemoryClientApi`)
- Service classes: PascalCase, no suffix (e.g., `InMemoryClient`)
- Error classes: PascalCase + "Error" suffix (e.g., `MemoryNotFoundError`)

## Imports

```typescript
// Effect - named imports from "effect"
import { Effect, Data, Brand } from "effect";

// Types - use import type
import type { HttpClientError } from "./errors.js";

// Internal - use path aliases with .js extension
import { MyService } from "@services/MyService/service.js";
```

## JSDoc

Add JSDoc for public APIs with `@since`, `@param`, `@returns`, `@example`.

## Satisfies Operator

Use `satisfies` for type checking without widening:

```typescript
return {
  put: (key, value) => Effect.succeed(void 0),
} satisfies ServiceApi;
```

## Advanced Patterns

- Implement generics with appropriate constraints
- Use mapped types and conditional types to reduce duplication
- Use `const` assertions for literal types
- Use branded/nominal types for type-level validation
- Create type guard functions for type narrowing
