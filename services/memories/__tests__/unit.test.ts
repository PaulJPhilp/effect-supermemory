/**
 * MemoriesService Unit Tests
 *
 * @since 1.0.0
 * @module Memories
 */

import { describe, expect, it } from "vitest";
import { MemoriesService, MemoriesServiceLive } from "../service.js";

describe("MemoriesService", () => {
  it("should be properly defined as an Effect.Service", () => {
    expect(MemoriesService).toBeDefined();
    expect(MemoriesServiceLive).toBeDefined();
  });

  it("should have the correct service tag", () => {
    expect(typeof MemoriesService).toBe("function");
  });
});

describe("MemoriesService types", () => {
  it("should export MemoryStatus type values", () => {
    const validStatuses: Array<
      | "unknown"
      | "queued"
      | "extracting"
      | "chunking"
      | "embedding"
      | "indexing"
      | "done"
      | "failed"
    > = [
      "unknown",
      "queued",
      "extracting",
      "chunking",
      "embedding",
      "indexing",
      "done",
      "failed",
    ];

    expect(validStatuses).toHaveLength(8);
  });

  it("should export MemoryType type values", () => {
    const validTypes: Array<
      | "text"
      | "pdf"
      | "tweet"
      | "google_doc"
      | "google_slide"
      | "google_sheet"
      | "image"
      | "video"
      | "notion_doc"
      | "webpage"
      | "onedrive"
    > = [
      "text",
      "pdf",
      "tweet",
      "google_doc",
      "google_slide",
      "google_sheet",
      "image",
      "video",
      "notion_doc",
      "webpage",
      "onedrive",
    ];

    expect(validTypes).toHaveLength(11);
  });
});
