Here is the **Test Plan** for `effect-supermemory`.

Because this is a "Sound System" library, testing isn't just about "does it work"; it's about **"does it fail correctly?"** We need to verify the error channels and the type safety just as much as the happy path.

---

# Test Plan: `effect-supermemory`

## 1. Testing Strategy
We will use **Vitest** as the runner. We will employ a "Mock First" strategy for the API to ensure we can test edge cases (rate limits, downtime) without needing the live Supermemory API for every run.

*   **Unit Tests:** Verify Schema validation, Filter Builder logic, and Error Mapping.
*   **Integration Tests (Mocked):** Verify the `Service` layer interacts correctly with the `Client` layer.
*   **Live E2E Tests (Optional/Manual):** A separate suite that hits the *real* API (requires env var), usually run only on release or manually.

## 2. Test Cases by Phase

### Phase 1: Configuration & Transport
*   **Config Loading:**
    *   [ ] Should load API key from `EFFECT_SUPERMEMORY_API_KEY`.
    *   [ ] Should fail gracefully (Effect failure, not throw) if API Key is missing.
*   **Client Middleware:**
    *   [ ] Should verify `Authorization` header is injected.
    *   [ ] Should verify Base URL is correct.

### Phase 2: Schema Validation (The Firewall)
*   **Ingest Options:**
    *   [ ] Should pass valid metadata objects.
    *   [ ] Should fail (Schema Error) if `threshold` is > 1.0 or < 0.0.
*   **Response Parsing:**
    *   [ ] Should parse a valid "Search Success" JSON into a `Chunk<Memory>`.
    *   [ ] Should fail (Parse Error) if the API returns an unexpected shape (simulating API drift).

### Phase 3: Service Logic & Error Mapping
*   **Error Handling (Crucial):**
    *   [ ] **401/403:** Mock a 401 response. Assert the Effect fails with `SupermemoryAuthError`.
    *   [ ] **429:** Mock a 429 response. Assert the Effect fails with `SupermemoryRateLimitError` and captures the `Retry-After` header value if present.
    *   [ ] **500:** Mock a 500 response. Assert `SupermemoryServerError`.
*   **Search Logic:**
    *   [ ] **Filter Builder:** Verify that `Filter.and(Filter.tag("a"), Filter.tag("b"))` produces the correct nested JSON object required by the API.
    *   [ ] **RAG vs Chat:** Verify `searchDocuments` hits `/v3/search` and `searchMemories` hits `/v4/search`.

### Phase 4: Tool Integration
*   **Tool Schema:**
    *   [ ] Verify `makeSearchTool().inputSchema` correctly matches the JSON Schema required by the LLM.
    *   [ ] **Simulation:** Mock an "Agent Call" (passing a JSON object representing a tool call) into the tool execution logic and verify it triggers the correct underlying `Search` service method.

## 3. Testing Infrastructure ("Test Kit")

To make testing easy for *consumers* of your library (and yourself), we will export a `SupermemoryTest` layer.

*   **`SupermemoryTest.layer`**: A Layer that replaces the real HTTP client with an in-memory mock.
    *   Allows developers to use `effect-supermemory` in their *own* tests without hitting the real API.
    *   Stores "ingested" text in a simple array.
    *   Returns that array on "search".

## 4. Success Criteria for Testing
*   100% coverage of the `Error Mapping` logic (we must know how it fails).
*   100% coverage of the `Filter Builder` (complex logic requires verification).
*   A passing CI run on GitHub Actions.

---

**Instruction for Coding Agent:**
"When implementing the test suite, prioritize the **Error Mapping** tests first. I want to see proof that a 429 error from the API becomes a typed `RateLimitError` in the Effect program before we worry about successful search results."