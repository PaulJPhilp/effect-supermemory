# Code Review & Refactoring Order

This document outlines the recommended order for manual code review and refactoring of the effect-supermemory project. The order follows dependency chains from foundational services upward to integration points.

## Review Strategy

1. **Bottom-up approach**: Review foundational services first, then dependent services
2. **Domain-first**: Review domain models before services that use them
3. **Test alongside**: Review tests immediately after reviewing the code they test
4. **Integration last**: Review integration points and root exports after all components

---

## Phase 1: Foundational Services (No Dependencies)

### 1.1 HTTP Client Service
**Path**: `services/httpClient/`
**Dependencies**: None (foundational)
**Files to review**:
- `api.ts` - Interface contract
- `errors.ts` - Error types (Data.TaggedError)
- `types.ts` - Configuration types
- `service.ts` - Effect.Service implementation
- `index.ts` - Public exports

**Test**: `services/httpClient/__tests__/unit.test.ts`

**Focus areas**:
- Error taxonomy (discriminated errors)
- Effect.Service pattern with Effect.fn()
- HTTP request/response handling
- Retry logic (if any)

---

### 1.2 Memory Client Service (In-Memory)
**Path**: `services/memoryClient/`
**Dependencies**: None (foundational, in-memory implementation)
**Files to review**:
- `api.ts` - MemoryClient interface
- `errors.ts` - Memory error types
- `types.ts` - Configuration types
- `helpers.ts` - Utility functions
- `service.ts` - Effect.Service implementation
- `index.ts` - Public exports

**Test**: `services/memoryClient/__tests__/unit.test.ts`

**Focus areas**:
- Namespace isolation pattern
- Error handling (404 → undefined semantic)
- Batch operation error handling (MemoryBatchPartialFailure)
- Effect.Service with Effect.fn() parameterization

---

## Phase 2: HTTP-Dependent Services

### 2.1 Supermemory Client Service
**Path**: `services/supermemoryClient/`
**Dependencies**: `httpClient`, `memoryClient` (errors)
**Files to review**:
- `api.ts` - SupermemoryClient interface
- `errors.ts` - Error translation (HttpClientError → MemoryError)
- `types.ts` - Configuration types
- `helpers.ts` - Base64 encoding/decoding utilities
- `service.ts` - Effect.Service implementation
- `index.ts` - Public exports

**Test**: `services/supermemoryClient/__tests__/unit.test.ts`

**Focus areas**:
- HTTP client integration
- Error translation logic
- Base64 encoding convention
- Retry policy implementation
- Semantic 404 handling
- Batch operations

---

### 2.2 Memory Stream Client Service
**Path**: `services/memoryStreamClient/`
**Dependencies**: `httpClient`, `memoryClient` (errors), `searchClient` (types)
**Files to review**:
- `api.ts` - MemoryStreamClient interface
- `errors.ts` - Stream error types
- `types.ts` - Configuration types
- `helpers.ts` - NDJSON parsing, UTF-8 validation
- `service.ts` - Effect.Service implementation
- `index.ts` - Public exports

**Test**: `services/memoryStreamClient/__tests__/unit.test.ts`

**Focus areas**:
- Effect.Stream integration
- NDJSON parsing logic
- UTF-8 validation
- Stream cancellation handling
- Error propagation

---

### 2.3 Search Client Service
**Path**: `services/searchClient/`
**Dependencies**: `httpClient`, `memoryClient` (errors)
**Files to review**:
- `api.ts` - SearchClient interface
- `errors.ts` - Search error types
- `types.ts` - Search types (SearchResult, SearchOptions, etc.)
- `schema.ts` - Schema definitions (if exists)
- `helpers.ts` - Search utilities
- `service.ts` - Effect.Service implementation
- `index.ts` - Public exports

**Test**: `services/searchClient/__tests__/unit.test.ts`

**Focus areas**:
- Search query construction
- Filter encoding
- Result parsing
- Error handling

---

## Phase 3: Domain Layer (Foundation)

### 3.1 Domain Schemas
**Path**: `src/Domain.ts`
**Dependencies**: None (pure schemas)
**Focus areas**:
- Effect.Schema definitions
- Domain model validation
- Type safety
- Schema composition

---

### 3.2 Domain Errors
**Path**: `src/Errors.ts`
**Dependencies**: None (error definitions)
**Focus areas**:
- Error hierarchy
- Discriminated error types
- Error mapping consistency

---

### 3.3 Configuration Service
**Path**: `src/Config.ts`
**Dependencies**: None (configuration only)
**Focus areas**:
- Config validation
- Environment variable handling
- Type safety

---

## Phase 4: Domain Layer (High-Level Services)

### 4.1 Filter Builder
**Path**: `src/FilterBuilder.ts`
**Dependencies**: `Domain.ts` (schemas)
**Focus areas**:
- Fluent API design
- Filter expression building
- Type safety
- JSON serialization

---

### 4.2 HTTP Client Wrapper
**Path**: `src/Client.ts`
**Dependencies**: `httpClient` service, `Config.ts`
**Focus areas**:
- Error mapping (HTTP → Domain errors)
- API version handling
- Request signing/authentication
- Integration with HttpClient service

---

### 4.3 Search Service
**Path**: `src/Search.ts`
**Dependencies**: `searchClient`, `Domain.ts`, `FilterBuilder.ts`, `Config.ts`
**Focus areas**:
- High-level search API
- Filter builder integration
- Schema validation
- Error handling

---

### 4.4 Ingest Service
**Path**: `src/Ingest.ts`
**Dependencies**: `Client.ts`, `Domain.ts`, `Config.ts`
**Focus areas**:
- Document ingestion logic
- Schema validation
- Chunking strategy
- Error handling

---

### 4.5 Program (CLI/Entry Point)
**Path**: `src/Program.ts`
**Dependencies**: All domain services
**Focus areas**:
- Program composition
- Layer provisioning
- Error handling at top level

---

## Phase 5: Integration & Root Exports

### 5.1 Root Exports
**Path**: `src/index.ts`
**Dependencies**: All services and domain layer
**Focus areas**:
- Export completeness
- Public API surface
- Re-export organization
- Type exports
- Documentation comments

---

## Phase 6: Tests & Integration

### 6.1 Unit Tests (Review alongside services)
**Path**: `services/*/__tests__/unit.test.ts`
**Review order**: Follow the same order as service review (Phase 1-2)

**Focus areas**:
- Test coverage
- Test patterns (Effect.gen, Effect.provide)
- Mock usage (custom mocks, not Vitest mocks)
- Error case testing
- Edge cases

---

### 6.2 Integration Tests
**Path**: `test/integration.test.ts`
**Dependencies**: All services
**Focus areas**:
- End-to-end scenarios
- Mock server integration
- Real API interaction patterns
- Error propagation

---

### 6.3 Compatibility Tests
**Path**: `test/compatibility/`
**Focus areas**:
- API compatibility checks
- Schema validation
- HTTP request/response matching

---

## Phase 7: Configuration & Build

### 7.1 TypeScript Configuration
**Files**:
- `tsconfig.json`
- `tsconfig.base.json`
- `tsconfig.build.json`
- `tsconfig.src.json`
- `tsconfig.test.json`

**Focus areas**:
- Module resolution
- Path aliases
- Strict mode settings
- Project references

---

### 7.2 Build Configuration
**Files**:
- `package.json`
- `biome.jsonc`
- `vitest.config.ts`
- `vitest.integration.config.ts`

**Focus areas**:
- Build scripts
- Dependency versions
- Linting/formatting rules
- Test configuration

---

## Phase 8: Documentation & ADRs

### 8.1 Architecture Documentation
**Files**:
- `docs/Architecture.md`
- `docs/adr/001-error-taxonomy-layer-design.md`
- `CLAUDE.md`
- `README.md`

**Focus areas**:
- Accuracy of documentation
- Code examples
- Architecture diagrams
- Usage patterns

---

## Review Checklist Template

For each file/service, check:

- [ ] **Effect.Service Pattern**: Uses `Effect.Service` with `Effect.fn()` parameterization
- [ ] **Error Handling**: All errors use `Data.TaggedError`, discriminated unions
- [ ] **Type Safety**: No `any`, proper type annotations, satisfies interfaces
- [ ] **Code Style**: Follows Biome/Ultracite rules, consistent formatting
- [ ] **Namespace Isolation**: Services properly isolate namespaces via parameterization
- [ ] **Error Translation**: HTTP errors properly translated to domain errors
- [ ] **Base64 Encoding**: Values encoded/decoded correctly (SupermemoryClient)
- [ ] **Retry Logic**: Retries configured correctly (if applicable)
- [ ] **Stream Handling**: Proper cancellation and error propagation (Stream clients)
- [ ] **Test Coverage**: Tests cover happy path, errors, edge cases
- [ ] **Documentation**: JSDoc comments for public APIs
- [ ] **Exports**: Properly exported via `index.ts` files

---

## Notes

- **Dependency Order**: Always review dependencies before dependents
- **Test Alongside**: Review tests immediately after the code they test
- **Incremental**: Complete one service/domain area before moving to the next
- **Document Issues**: Note any refactoring opportunities as you go
- **Consistency**: Check that patterns established in Phase 1 are followed throughout

