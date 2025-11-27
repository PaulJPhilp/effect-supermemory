/**
 * @since 1.0.0
 * @module Domain
 *
 * Domain models and schemas for effect-supermemory.
 * All types are defined using @effect/schema for runtime validation.
 */
import { Schema } from "effect";
// =============================================================================
// Core Entity Schemas
// =============================================================================
/**
 * Document status indicating embedding progress.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const DocumentStatus = Schema.Literal("embedded", "pending", "failed");
/**
 * Metadata record for documents and memories.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const Metadata = Schema.Record({
  key: Schema.String,
  value: Schema.Union(Schema.String, Schema.Number, Schema.Boolean),
});
/**
 * A raw document ingested into Supermemory.
 * Represents unprocessed content like PDFs, URLs, or text.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const SupermemoryDocument = Schema.Struct({
  id: Schema.String,
  content: Schema.String,
  metadata: Schema.optional(Metadata),
  status: DocumentStatus,
  createdAt: Schema.optional(Schema.String),
  updatedAt: Schema.optional(Schema.String),
});
/**
 * A synthesized memory/insight from Supermemory.
 * Represents processed context with relevance scoring.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const SupermemoryMemory = Schema.Struct({
  id: Schema.String,
  content: Schema.String,
  score: Schema.Number.pipe(
    Schema.filter((n) => n >= 0 && n <= 1, {
      message: () => "Score must be between 0 and 1",
    })
  ),
  relations: Schema.optional(Schema.Array(Schema.String)),
  metadata: Schema.optional(Metadata),
});
/**
 * A chunk from a document search result.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const DocumentChunk = Schema.Struct({
  id: Schema.String,
  documentId: Schema.String,
  content: Schema.String,
  score: Schema.Number,
  metadata: Schema.optional(Metadata),
});
// =============================================================================
// Request Option Schemas
// =============================================================================
/**
 * Options for ingesting content.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const IngestOptions = Schema.Struct({
  /**
   * Tags for categorization and filtering.
   */
  tags: Schema.optional(Schema.Array(Schema.String)),
  /**
   * Custom ID for idempotent upserts.
   */
  customId: Schema.optional(Schema.String),
  /**
   * Additional metadata to attach.
   */
  metadata: Schema.optional(Metadata),
});
/**
 * Similarity threshold (0.0 to 1.0).
 *
 * @since 1.0.0
 * @category Schemas
 */
export const Threshold = Schema.Number.pipe(
  Schema.filter((n) => n >= 0 && n <= 1, {
    message: () => "Threshold must be between 0.0 and 1.0",
  })
);
/**
 * Options for search operations.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const SearchOptions = Schema.Struct({
  /**
   * Maximum number of results to return.
   * @default 10
   */
  topK: Schema.optional(
    Schema.Number.pipe(
      Schema.int(),
      Schema.filter((n) => n > 0 && n <= 100, {
        message: () => "topK must be between 1 and 100",
      })
    )
  ),
  /**
   * Minimum similarity threshold (0.0 to 1.0).
   */
  threshold: Schema.optional(Threshold),
  /**
   * Enable smart re-ranking of results.
   */
  rerank: Schema.optional(Schema.Boolean),
  /**
   * Filter expression (built via FilterBuilder).
   */
  filters: Schema.optional(Schema.Unknown),
});
// =============================================================================
// API Response Schemas
// =============================================================================
/**
 * Response from document ingestion.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const IngestResponse = Schema.Struct({
  id: Schema.String,
  status: Schema.Literal("success", "pending"),
  message: Schema.optional(Schema.String),
});
/**
 * Response from document search (RAG path).
 *
 * @since 1.0.0
 * @category Schemas
 */
export const SearchDocumentsResponse = Schema.Struct({
  results: Schema.Array(DocumentChunk),
  query: Schema.optional(Schema.String),
});
/**
 * Response from memory search (Chat path).
 *
 * @since 1.0.0
 * @category Schemas
 */
export const SearchMemoriesResponse = Schema.Struct({
  results: Schema.Array(SupermemoryMemory),
  query: Schema.optional(Schema.String),
});
/**
 * Response from document deletion.
 *
 * @since 1.0.0
 * @category Schemas
 */
export const DeleteResponse = Schema.Struct({
  success: Schema.Boolean,
  id: Schema.optional(Schema.String),
});
