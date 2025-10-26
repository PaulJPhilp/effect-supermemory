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

### Option 1: Layer-based via Context.Tag (Selected)

**Approach:**
- Config is a Context tag (e.g., `MemoryConfig`)
- Service reads config via `yield* MemoryConfig` inside Effect.gen
- Consumers provide config via `Layer.succeed(MemoryConfig, { ... })`
- Multiple services compose via `Layer.merge()`

**Pros:**
- Pure dependency injection; no global state
- Composable; multiple layers can coexist
- Testable; mock config by providing different layers
- Aligns with Effect Layer pattern

**Cons:**
- Requires understanding of Context tags and Layers
- Config is implicit (might not be obvious what's required)

**Example:**
```ts
export const MemoryConfig = Context.Tag<MemoryConfig>("MemoryConfig");

const program = Effect.gen(function* () {
  const config = yield* MemoryConfig;
  const namespace = config.namespace;
  // Use namespace...
});

const layer = Layer.succeed(MemoryConfig, { namespace: "my-app" });
await Effect.runPromise(program.pipe(Effect.provide(layer)));
```

### Option 2: Parameter-based (operation-level)

**Approach:**
- Config is passed as a parameter to each operation
- E.g., `put(namespace, key, value)`

**Pros:**
- Explicit; no hidden dependencies
- Simple for single operations

**Cons:**
- Pollutes API surface with config parameters
- Breaks composability; forces consumers to thread params through all effects
- Unmaintainable at scale

### Option 3: Singleton global config

**Approach:**
- Store config in a module-level variable
- Access via function (e.g., `getConfig()`)

**Pros:**
- Simple; no boilerplate

**Cons:**
- Not testable; singleton persists across tests
- Not composable; can't have multiple configs simultaneously
- Hidden dependencies; hard to reason about

---

**Decision:**

We choose **Option 1: Layer-based via Context.Tag**.

**Rationale:**

1. **Pure DI:** No global state; effects are pure functions of their dependencies.
2. **Composable:** Multiple services + configs can coexist; compose via `Layer.merge()`.
3. **Testable:** Mock configs by providing different layers; no test pollution.
4. **Effect Idiomatic:** Matches Effect's Layer/Context patterns; consistent with Effect ecosystem.
5. **Scalable:** As we add HTTP client (0.2+) with credentials, retry policy, etc., new config fields integrate cleanly via `Layer.merge()`.

---

**Consequences:**

**Positive:**
- Config is explicit and composable; multiple configurations can coexist.
- Testing is clean; provide mock config via layers, no test setup pollution.
- Backward compatible: adding new config fields doesn't break existing code.

**Negative:**
- Requires learning Context tags and Layers (but necessary for Effect mastery).
- Config is implicit in code; not immediately obvious what's required (mitigated via docs + types).

**On Other Branches:**
- **create-effect-agent:** Generated projects should use `Layer.merge()` to compose multiple services (MemoryClient + future services).
- **effect-cli-tui:** CLI/TUI state should follow same pattern (Logger, PromptConfig, etc.).

---

## Implementation Standard (All Services)

**For all future services in effect-supermemory:**

1. **Errors:** Define discriminated error types in `errors.ts` using `Data.TaggedError`.
2. **Config:** Define configuration interface in `types.ts`; expose via `Context.Tag` in `service.ts`.
3. **Service:** Use `Effect.Service` pattern with `Default` export (Live implementation).
4. **Composition:** Services compose via `Layer.merge()` in consuming code.

**Example (MemoryClient):**
```ts
// errors.ts
export class MemoryNotFoundError extends Data.TaggedError("MemoryNotFoundError")<{ readonly key: string }> {}

// types.ts
export interface MemoryConfig { readonly namespace: string; }

// service.ts
export const MemoryConfig = Context.Tag<MemoryConfig>("MemoryConfig");
export class MemoryClientImpl extends Effect.Service<MemoryClientImpl>()(...) {}
export const Default = Layer.succeed(MemoryClientImpl, new MemoryClientImpl());

// Consuming code
const layer = Layer.merge(Default, Layer.succeed(MemoryConfig, { namespace: "app" }));
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
