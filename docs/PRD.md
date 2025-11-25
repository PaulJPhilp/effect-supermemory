Here is the **Product Requirement Document (PRD)** for `effect-supermemory`.

This document is architected to guide a coding agent (or you) to build a library that isn't just a wrapper, but a piece of **critical infrastructure** for your Agent Toolkit.

---

# Product Requirement Document: `effect-supermemory`

## 1. Executive Summary
`effect-supermemory` is a production-grade, Effect-TS native SDK for Supermemory.ai. It abstracts the complexity of managing long-term, semantic memory for AI agents into a set of type-safe, composable, and failure-aware services.

**The Core Promise:** "Treat Memory as a Sound Dependency."
Just as we treat a Database or a Redis cache as a managed dependency with explicit failure modes, `effect-supermemory` ensures that when an agent attempts to remember or recall information, it does so reliably, or fails with precision.

## 2. Design Philosophy & Architecture

### 2.1. The "Sound Systems" Approach
*   **Zero `any`:** All API inputs and outputs must be validated via `@effect/schema`.
*   **Explicit Errors:** No throwing. All failures (Network, RateLimit, Validation) are tracked in the `Error` channel of the Effect.
*   **Layered Design:** Separation between the raw HTTP transport (`Client`) and the high-level logic (`Service`).

### 2.2. Tech Stack
*   **Runtime:** `Effect-TS` (latest)
*   **Http:** `@effect/platform` (for unified Node/Bun/Browser fetch)
*   **Validation:** `@effect/schema`
*   **Config:** `Effect.Config`

## 3. Functional Specifications

### 3.1. Configuration Layer (`SupermemoryConfig`)
The library must load configuration from the environment safely.

*   **Schema:**
    *   `apiKey`: Secret (Redacted in logs).
    *   `workspaceId` (optional): For multi-tenant setups.
    *   `defaultThreshold`: (Default: 0.7)
*   **Capability:** Support loading via standard `EFFECT_SUPERMEMORY_API_KEY` env var.

### 3.2. Domain Models (The Schema)
We must explicitly distinguish between the two core data types to prevent developer confusion.

*   **`SupermemoryDocument`**:
    *   Represents raw knowledge (PDFs, URLs).
    *   Fields: `id`, `content`, `metadata` (Record), `status` (embedded/pending).
*   **`SupermemoryMemory`**:
    *   Represents synthesized insights/chat context.
    *   Fields: `id`, `content`, `relations` (graph links), `score` (relevance).

### 3.3. Service Module: Ingestion (`Ingest`)
The "Write" path. Must handle different media types robustly.

*   **`addText`**
    *   **Input:** `content: string`, `options?: IngestOptions`
    *   **Behavior:** Upserts text directly.
*   **`addUrl`**
    *   **Input:** `url: string`, `options?: IngestOptions`
    *   **Behavior:** Triggers Supermemory's scraper.
*   **`addFile`**
    *   **Input:** `path: string` (Node) or `File` (Browser).
    *   **Behavior:** Handles `multipart/form-data` upload via `@effect/platform`.
*   **`IngestOptions` Schema:**
    *   `tags`: `Array<string>` (Crucial for filtering).
    *   `customId`: `string` (Enable idempotent upserts).
    *   `metadata`: `Record<string, string | number | boolean>`.

### 3.4. Service Module: Retrieval (`Search`)
The "Read" path. Must distinguish between RAG and Chat.

*   **`searchDocuments` (The RAG Path)**
    *   **Use Case:** "Find me the PDF page where we discuss pricing."
    *   **Target:** `/v3/search`
    *   **Returns:** `Chunk<DocumentChunk>`
*   **`searchMemories` (The Context Path)**
    *   **Use Case:** "What does the user prefer regarding code style?"
    *   **Target:** `/v4/search`
    *   **Returns:** `Chunk<Memory>`
*   **`getProfile` (The Personalization Path)**
    *   **Use Case:** "Who is the user?"
    *   **Target:** User Profile endpoint.
    *   **Returns:** Static/Dynamic profile object.

*   **Shared `SearchOptions`:**
    *   `topK`: number
    *   `threshold`: number (0.0 - 1.0)
    *   `rerank`: boolean (Toggle smart re-ranking)
    *   `filters`: Type-safe filter builder (e.g., `Filter.and(Filter.tag("project-x"), Filter.meta("version", ">", 2))`).

### 3.5. Service Module: Agent Tools (`Tools`)
**The Killer Feature.** Pre-packaged tool definitions for `effect-ai-sdk`.

*   **`makeSearchTool()`**: Returns a tool definition compatible with Vercel AI SDK / OpenAI, pre-wired to call `searchMemories`.
*   **`makeRememberTool()`**: Returns a tool definition for `addText`.

## 4. Error Taxonomy (`Errors`)
We will not use generic errors.

*   `SupermemoryAuthenticationError`: 401/403.
*   `SupermemoryRateLimitError`: 429 (Includes `retry-after` logic).
*   `SupermemoryValidationError`: Schema mismatch or bad input.
*   `SupermemoryServerError`: 5xx upstream issues.

## 5. Developer Experience (DX) Requirements

1.  **Fluent Filter Builder:**
    *   Instead of raw JSON for filters, provide a helper:
    *   `Supermemory.filter().hasTag("archived").metadata("author", "Paul")`
2.  **Tracing:**
    *   Every search and ingest operation must be instrumented with `Effect.withSpan`.
    *   Attributes: `supermemory.query_length`, `supermemory.latency`, `supermemory.result_count`.

## 6. Release 1.0 Success Checklist
*   [ ] `npm install @paulphilp/effect-supermemory` works.
*   [ ] Typescript compiles strictly (noUncheckedIndexedAccess).
*   [ ] A "Chat with Knowledge" example script using `effect-ai-sdk` + `effect-supermemory` runs successfully.
*   [ ] README includes the "Why Effect?" justification.

---

**Implementation Order for Coding Agent:**
1.  **Schema Definitions:** Define the Zod/Effect Schemas for their API requests/responses first.
2.  **Client Layer:** Build the raw HTTP wrapper using `@effect/platform`.
3.  **Service Layer:** Build the high-level API (`addText`, `searchMemories`).
4.  **Tools Layer:** Build the AI SDK adapters.