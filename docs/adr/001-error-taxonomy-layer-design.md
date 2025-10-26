# ADR-001: Error Taxonomy & Layer Design

**Status:** Proposed

**Date:** 2025-10-26

**Context:**

effect-supermemory needs to establish error handling and dependency injection patterns that:
- Are SDK-agnostic (in-memory MVP, HTTP client in 0.2+)
- Scale across multiple services (MemoryClient, future SearchClient, etc.)
- Are composable with other Effect error handling in downstream projects
- Remain stable and backward-compatible as new adapters (HTTP, vector store, etc.) are added

**Options Considered:**

### Option 1: Discriminated errors via Data.TaggedError (Selected)

**Approach:**
- All service errors extend `Data.TaggedError`
- Error union type (e.g., `MemoryError = NotFound | ValidationError`)
- Errors are discriminated; consumers pattern-match via `Effect.catchTag()` or `Effect.either()`

**Pros:**
- Type-safe; full compile-time error discrimination
- Effect idiomatic; aligns with Effect error handling best practices
- Composable with other Effect error types via union
- Extensible: new error types don't break existing code if used idiomatically
- No external dependencies; native Effect + Data

**Cons:**
- Verbose for consumers (pattern matching required)
- Slightly more code per error type

**Example:**
```ts
export class MemoryNotFoundError extends Data.TaggedError("MemoryNotFoundError")<{
  readonly key: string;
}> {}

// Usage
const get = (key: string) =>
  Effect.gen(function* () {
    if (!store.has(key)) {
      return yield* Effect.fail(new MemoryNotFoundError({ key }));
    }
    return store.get(key);
  });

// Consumer catches it
const program = get("x").pipe(
  Effect.catchTag("MemoryNotFoundError", (err) => Effect.succeed(undefined))
);
```

### Option 2: String error codes + shared Error base class

**Approach:**
- Define error codes as string constants (e.g., "NOT_FOUND", "VALIDATION_ERROR")
- Share a base Error class with code + message fields
- Consumers check `error.code`

**Pros:**
- Simpler mental model
- Lighter for consumers; no pattern matching required

**Cons:**
- Runtime-only error discrimination; no compile-time safety
- Generic Error type loses type information
- Conflicts with other libraries' error handling strategies
- Harder to evolve (adding codes requires base class changes)

### Option 3: Native JS Error exceptions

**Approach:**
- Throw native Error with custom properties
- Consumers catch via `try/catch`

**Pros:**
- Familiar to all JavaScript developers

**Cons:**
- Runtime-only; no type information
- Not composable in Effect error channel
- Breaks Effect's compositional error handling
- Hard to recover from programmatically

---

**Decision:**

We choose **Option 1: Discriminated errors via Data.TaggedError**.

**Rationale:**

1. **Effect Idiomatic:** Aligns with Effect's compositional error model and Effect error channel (`E` in `Effect<A, E, R>`).
2. **Type Safety:** Full compile-time discrimination; impossible to forget error cases.
3. **Extensibility:** New error types (e.g., `NetworkError`, `AuthError` in 0.2+ HTTP adapter) don't require changes to existing code if composed via union.
4. **Composability:** Error unions compose cleanly across services. Multiple service errors can be handled uniformly.
5. **Ecosystem Alignment:** Matches patterns used in effect-cli-tui and other Effect-native libraries.

---

**Consequences:**

**Positive:**
- Error handling is explicit, type-safe, and caught at compile time.
- Consumers using `Effect.gen()` can use `yield*` to fail immediately with discriminated errors.
- Downstream projects (create-effect-agent, effect-cli-tui) can pattern-match on all service errors uniformly.
- New error types (0.2+) integrate seamlessly via union extension.

**Negative:**
- Consumers must learn Effect error handling (pattern matching, `Effect.either()`, `Effect.catchTag()`).
- Slightly more verbose than generic exceptions.
- Requires discipline: all errors must be discriminated, not thrown.

**On Other Branches:**
- **effect-cli-tui:** Should follow the same pattern for CLI/TUI errors (already using discriminated errors).
- **create-effect-agent:** Should consume discriminated errors from both effect-cli-tui and effect-supermemory; compose them in generated code via union.

---

## Layer Design (Dependency Injection)

**Context:**
Services need configuration (namespaces, credentials, retry policy). How should this flow?

**Options Considered:**

### Option 1: Effect.Service with separate instances (Selected)

**Approach:**
- Services are `Effect.Service` implementations with `Layer.succeed()`
- Configuration is baked into service instances at creation time
- Parameters flow through method signatures (not environment)
- Multiple instances provide isolation (different "namespaces")

**Pros:**
- Pure Effect.Service pattern; no bare Context.Tag
- Simple and explicit; parameters in method signatures
- Testable; mock by providing different service instances
- Isolation via separate service instances

**Cons:**
- Less composable than Context.Tag approach
- Configuration must be known at service instantiation time

**Example:**
```ts
// Service definition
export class MemoryClientImpl extends Effect.Service<MemoryClientImpl>()("MemoryClient", {
  sync: () => ({
    put: (key: string, value: string) => Effect.sync(() => store.set(key, value)),
    get: (key: string) => Effect.sync(() => store.get(key)),
    // ...
  })
}) {}

// Usage - separate instances for isolation
const store1 = new MemoryClientImpl();  // "namespace 1"
const store2 = new MemoryClientImpl();  // "namespace 2"

const layer1 = Layer.succeed(MemoryClientImpl, store1);
const layer2 = Layer.succeed(MemoryClientImpl, store2);
```

### Option 2: Layer-based via Context.Tag

**Approach:**
- Config is a Context tag (e.g., `MemoryConfig`)
- Service reads config via `yield* MemoryConfig` inside Effect.gen
- Consumers provide config via `Layer.succeed(MemoryConfig, { ... })`
- Multiple services compose via `Layer.merge()`

**Pros:**
- Highly composable; multiple layers can coexist
- Config injection is pure and testable

**Cons:**
- More complex; requires understanding Context tags
- Parameters vs config can be confusing
- Overkill for simple services

### Option 3: Parameter-based (operation-level)

**Approach:**
- Config is passed as a parameter to each operation
- E.g., `put(namespace, key, value)`

**Pros:**
- Explicit; no hidden dependencies

**Cons:**
- Pollutes API surface; breaks composability

---

**Decision:**

We choose **Option 1: Effect.Service with separate instances**.

**Rationale:**

1. **Effect.Service Pattern:** Pure Effect.Service usage without bare Context.Tag.
2. **Simplicity:** Parameters flow through method signatures; no environment confusion.
3. **Isolation:** Separate service instances provide clean namespace isolation.
4. **Testable:** Easy to mock by providing different service instances.
5. **Future-Proof:** For HTTP client (0.2+), we can extend with Context.Tag if needed.

---

**Consequences:**

**Positive:**
- Clean Effect.Service pattern; no bare Context.Tag usage.
- Method parameters are explicit and type-safe.
- Namespace isolation via separate instances is simple and testable.
- Easy to understand and maintain.

**Negative:**
- Less composable than full Context.Tag approach.
- Configuration must be known at service creation time.

**On Other Branches:**
- **create-effect-agent:** Generated projects should use `Effect.Service` pattern with separate instances where isolation is needed.
- **effect-cli-tui:** CLI/TUI services should follow same pattern; use separate instances for different contexts.

---

## Implementation Standard (All Services)

**For all future services in effect-supermemory:**

1. **Errors:** Define discriminated error types in `errors.ts` using `Data.TaggedError`.
2. **Service:** Use pure `Effect.Service` pattern with `Layer.succeed()` - no bare `Context.Tag`.
3. **Parameters:** Pass operation parameters through method signatures.
4. **Isolation:** Use separate service instances for different contexts/namespace isolation.

**Example (MemoryClient):**
```ts
// errors.ts
export class MemoryNotFoundError extends Data.TaggedError("MemoryNotFoundError")<{ readonly key: string }> {}

// service.ts
export class MemoryClientImpl extends Effect.Service<MemoryClientImpl>()("MemoryClient", {
  sync: () => ({
    put: (key: string, value: string) => Effect.sync(() => store.set(key, value)),
    get: (key: string) => Effect.sync(() => store.get(key)),
    // ...
  })
}) {}

export const Default = Layer.succeed(MemoryClientImpl, new MemoryClientImpl());

// Usage - separate instances for isolation
const store1 = new MemoryClientImpl();  // context 1
const store2 = new MemoryClientImpl();  // context 2
```

---

## Review & Sign-Off

**CTO:** Align on error taxonomy + layer design before marking Accepted.

**Target Review Date:** 2025-10-27 (within 24h of posting to master)

**Branches to Loop In:**
- effect-cli-tui (confirm error + layer patterns align)
- create-effect-agent (confirm generated templates can compose these patterns)

---

**Proposed by:** System Architect (effect-supermemory)  
**Status:** Proposed (awaiting CTO + cross-project sign-off)
