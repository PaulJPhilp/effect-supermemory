/**
 * @since 1.0.0
 * @module Ingest
 */
import type { Effect } from "effect";
import type { SupermemoryError } from "@/Errors.js";
import type { IngestOptions, IngestResponse } from "./types.js";

/**
 * Ingest service interface.
 *
 * @since 1.0.0
 * @category Services
 */
export type IngestServiceOps = {
  /**
   * Add text content to Supermemory.
   *
   * @param content - The text content to ingest.
   * @param options - Optional ingestion options (tags, customId, metadata).
   * @returns Effect that resolves to the ingestion response.
   */
  readonly addText: (
    content: string,
    options?: IngestOptions
  ) => Effect.Effect<IngestResponse, SupermemoryError>;

  /**
   * Add content from a URL to Supermemory.
   * Triggers Supermemory's scraper to fetch and process the content.
   *
   * @param url - The URL to scrape and ingest.
   * @param options - Optional ingestion options.
   * @returns Effect that resolves to the ingestion response.
   */
  readonly addUrl: (
    url: string,
    options?: IngestOptions
  ) => Effect.Effect<IngestResponse, SupermemoryError>;
};
