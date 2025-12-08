/**
 * Search Service API
 *
 * @since 1.0.0
 * @module Search
 */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */

import type { SupermemoryError } from "@/Errors.js";
import type { Effect } from "effect";
import type {
  DocumentChunk,
  SearchOptions,
  SupermemoryMemory,
} from "./types.js";

/**
 * Search service interface.
 *
 * Provides methods for searching documents (RAG path) and memories (Chat path).
 *
 * @since 1.0.0
 * @category Services
 */
export type SearchServiceOps = {
  /**
   * Search documents (RAG path).
   * Returns document chunks relevant to the query.
   *
   * @param query - The search query.
   * @param options - Optional search options (topK, threshold, rerank, filters).
   * @returns Effect that resolves to an array of document chunks.
   */
  readonly searchDocuments: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<readonly DocumentChunk[], SupermemoryError>;

  /**
   * Execute a general search.
   * Returns document chunks relevant to the query (same as searchDocuments).
   *
   * @param query - The search query.
   * @param options - Optional search options (topK, threshold, rerank, filters).
   * @returns Effect that resolves to an array of document chunks.
   */
  readonly execute: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<readonly DocumentChunk[], SupermemoryError>;

  /**
   * Search memories (Chat path).
   * Returns synthesized memories/context relevant to the query.
   *
   * @param query - The search query.
   * @param options - Optional search options (topK, threshold, rerank, filters).
   * @returns Effect that resolves to an array of memories.
   */
  readonly searchMemories: (
    query: string,
    options?: SearchOptions
  ) => Effect.Effect<readonly SupermemoryMemory[], SupermemoryError>;
};
