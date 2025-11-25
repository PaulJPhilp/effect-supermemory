Here is the **Implementation Plan** for `effect-supermemory`.

This plan is designed to be executed sequentially by your coding agent. It builds the system from the bottom up (Infrastructure → Domain → Logic → API).

---

# Implementation Plan: `effect-supermemory`

## Phase 1: Infrastructure & Transport Layer
*Goal: Establish the ability to talk to the API securely and robustly.*

- [ ] **Project Scaffold:** Initialize standard Effect-TS library structure (tsconfig, eslint, vitest).
- [ ] **Configuration Definition:**
    - Create `SupermemoryConfig` using `Effect.Config`.
    - Map `EFFECT_SUPERMEMORY_API_KEY` and `EFFECT_SUPERMEMORY_WORKSPACE_ID`.
    - Define default values (e.g., default timeout).
- [ ] **HTTP Client Base:**
    - Create `SupermemoryClient` layer using `@effect/platform/HttpClient`.
    - Implement middleware for:
        - **Auth:** Auto-inject `Authorization: Bearer <key>`.
        - **Base URL:** Prepend `https://api.supermemory.ai`.
        - **Error Tagging:** Catch raw 4xx/5xx and tag them as generic `HttpError` for now (refined later).

## Phase 2: The "Schema Firewall" (Domain Modeling)
*Goal: Define the contract. Nothing moves in or out without passing these checks.*

- [ ] **Define Core Entities:**
    - Define `SupermemoryDocument` schema (raw content).
    - Define `SupermemoryMemory` schema (synthesized context).
    - **Constraint:** Ensure strict distinction between the two.
- [ ] **Define Request Schemas:**
    - `IngestOptions` (tags, customId, metadata).
    - `SearchOptions` (filters, threshold, limit).
- [ ] **Define Response Schemas:**
    - Typed responses for Search endpoints (Document chunks vs Memories).
    - Success/Status responses for Ingestion.

## Phase 3: The Service Layer (Core Logic)
*Goal: Implement the business logic and explicit error handling.*

- [ ] **Error Taxonomy:**
    - Define the specific error class hierarchy: `AuthError`, `RateLimitError`, `ValidationError`, `ServerError`.
    - Create a mapping function to translate `HttpClient` errors into these specific types.
- [ ] **Ingest Service:**
    - Implement `addText`: Validate input -> Call API -> Handle 200/Errors.
    - Implement `addUrl`: Trigger scraper -> Monitor status (if applicable).
    - Implement `addFile`: Use `@effect/platform/FileSystem` and `FormData` to handle multipart uploads safely.
- [ ] **Search Service:**
    - Implement `searchDocuments`: The RAG path.
    - Implement `searchMemories`: The Chat context path.
    - **Critical:** Implement the "Fluent Filter Builder" logic here to convert code-based filters into the JSON syntax Supermemory expects.

## Phase 4: The "Killer Feature" (AI Integration)
*Goal: Make this plug-and-play for AI Agents.*

- [ ] **Tool Definitions:**
    - Create `makeSearchTool()`: Returns a definition compliant with `effect-ai-sdk` (or standard OpenAI tool schemas) that wraps `searchMemories`.
    - Create `makeRememberTool()`: Wraps `addText` for agents to save their own context.
- [ ] **Context Middleware (Optional but High Value):**
    - Create a helper `withSupermemoryContext` that takes a user query, fetches relevant memories, and creates a System Message to prepend to the chat history.

## Phase 5: Documentation & Polish
*Goal: Ensure the library explains *why* it exists, not just *how*.*

- [ ] **README - The "Sound Systems" Pitch:**
    - Write the introduction explaining why managing Memory as an Effect Dependency is safer than raw API calls.
- [ ] **Examples:**
    - `examples/basic-rag.ts`: Simple ingestion and retrieval.
    - `examples/agent-tool.ts`: Wiring it up to a mock agent.
- [ ] **Export Hygiene:** Ensure `index.ts` only exports the public API (Services, Schemas, Errors) and hides internal implementation details.

---

**Ready to Execute?**
I suggest starting with **Phase 1 & 2 combined**. Give your agent the PRD and ask it to scaffold the Config, Client, and Schema definitions first. This sets the type-safe foundation for the rest.