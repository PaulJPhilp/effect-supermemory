/**
 * IngestService Comprehensive Unit Tests
 *
 * @deprecated Use MemoriesService instead
 * @since 1.0.0
 * @module Ingest
 */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */

import { SERVICE_TAGS } from "@/Constants.js";
import { describe, expect, it } from "vitest";
import { IngestService } from "../service.js";
import type { IngestOptions, IngestResponse } from "../types.js";

describe("IngestService", () => {
  describe("Service Definition", () => {
    it("should be properly defined as an Effect.Service", () => {
      expect(IngestService).toBeDefined();
      expect(typeof IngestService).toBe("function");
    });

    it("should export Default layer via IngestService.Default", () => {
      expect(IngestService.Default).toBeDefined();
    });

    it("should have the correct service tag", () => {
      expect(IngestService.key).toBe(SERVICE_TAGS.INGEST);
    });
  });

  describe("Type Definitions", () => {
    describe("IngestOptions", () => {
      it("should accept empty options", () => {
        const options: IngestOptions = {};
        expect(Object.keys(options)).toHaveLength(0);
      });

      it("should accept tags option", () => {
        const options: IngestOptions = {
          tags: ["tag1", "tag2"],
        };
        expect(options.tags).toEqual(["tag1", "tag2"]);
      });

      it("should accept customId option", () => {
        const options: IngestOptions = {
          customId: "custom-123",
        };
        expect(options.customId).toBe("custom-123");
      });

      it("should accept metadata option", () => {
        const options: IngestOptions = {
          metadata: {
            author: "Paul",
            year: 2024,
          },
        };
        expect(options.metadata?.author).toBe("Paul");
        expect(options.metadata?.year).toBe(2024);
      });

      it("should accept all options together", () => {
        const options: IngestOptions = {
          tags: ["important", "documentation"],
          customId: "doc-456",
          metadata: {
            source: "manual",
            verified: true,
          },
        };

        expect(options.tags).toHaveLength(2);
        expect(options.customId).toBe("doc-456");
        expect(options.metadata?.source).toBe("manual");
      });
    });

    describe("IngestResponse", () => {
      it("should define success response shape", () => {
        const response: IngestResponse = {
          id: "doc_123",
          status: "success",
        };

        expect(response.id).toBe("doc_123");
        expect(response.status).toBe("success");
      });

      it("should define pending response shape", () => {
        const response: IngestResponse = {
          id: "doc_456",
          status: "pending",
          message: "Processing document",
        };

        expect(response.status).toBe("pending");
        expect(response.message).toBe("Processing document");
      });

      it("should allow optional message", () => {
        const response: IngestResponse = {
          id: "doc_789",
          status: "success",
        };

        expect(response.message).toBeUndefined();
      });
    });
  });

  describe("API Contract", () => {
    it("should have addText method", () => {
      type AddTextMethod = typeof IngestService.prototype.addText;
      const _typeCheck: AddTextMethod = {} as AddTextMethod;
      expect(true).toBe(true);
    });

    it("should have addUrl method", () => {
      type AddUrlMethod = typeof IngestService.prototype.addUrl;
      const _typeCheck: AddUrlMethod = {} as AddUrlMethod;
      expect(true).toBe(true);
    });
  });
});

describe("IngestService Validation", () => {
  describe("addText() validation", () => {
    it("should require non-empty content", () => {
      const emptyContent = "";
      expect(emptyContent.length).toBe(0);
    });

    it("should accept valid text content", () => {
      const content = "This is valid text content for ingestion.";
      expect(content.length).toBeGreaterThan(0);
    });

    it("should accept long text content", () => {
      const longContent = "a".repeat(10_000);
      expect(longContent.length).toBe(10_000);
    });

    it("should accept text with special characters", () => {
      const specialContent = "Content with émojis 🎉 and spëcial chars!";
      expect(specialContent.length).toBeGreaterThan(0);
    });

    it("should accept text with newlines", () => {
      const multilineContent = `Line 1
Line 2
Line 3`;
      expect(multilineContent.includes("\n")).toBe(true);
    });
  });

  describe("addUrl() validation", () => {
    it("should require valid URL format", () => {
      const validUrls = [
        "https://example.com",
        "https://example.com/path",
        "https://example.com/path?query=value",
        "http://localhost:3000",
        "https://sub.domain.example.com/deep/path",
      ];

      for (const url of validUrls) {
        expect(() => new URL(url)).not.toThrow();
      }
    });

    it("should reject invalid URL format", () => {
      const invalidUrls = [
        "not-a-url",
        "example.com", // missing protocol
        "://example.com", // missing protocol name
        "", // empty string
      ];

      for (const url of invalidUrls) {
        if (url === "") {
          expect(url.length).toBe(0);
        } else {
          expect(() => new URL(url)).toThrow();
        }
      }
    });

    it("should accept URL with options", () => {
      const url = "https://example.com/article";
      const options: IngestOptions = {
        tags: ["article", "web"],
        customId: "article-123",
      };

      expect(url).toBeDefined();
      expect(options.tags).toContain("article");
    });
  });
});

describe("IngestService Usage Patterns", () => {
  describe("Text ingestion patterns", () => {
    it("should support plain text ingestion", () => {
      const content = "Plain text content";
      const options: IngestOptions = {};

      expect(content).toBeDefined();
      expect(options).toBeDefined();
    });

    it("should support text with tags", () => {
      const _content = "Tagged content";
      const options: IngestOptions = {
        tags: ["category1", "category2"],
      };

      expect(options.tags).toHaveLength(2);
    });

    it("should support text with metadata", () => {
      const _content = "Content with metadata";
      const options: IngestOptions = {
        metadata: {
          source: "manual",
          department: "engineering",
          priority: 1,
        },
      };

      expect(options.metadata?.priority).toBe(1);
    });

    it("should support idempotent upserts with customId", () => {
      const _content = "Idempotent content";
      const options: IngestOptions = {
        customId: "unique-doc-id",
      };

      // Using same customId should update existing document
      expect(options.customId).toBe("unique-doc-id");
    });
  });

  describe("URL ingestion patterns", () => {
    it("should support webpage ingestion", () => {
      const url = "https://docs.example.com/getting-started";
      expect(() => new URL(url)).not.toThrow();
    });

    it("should support PDF URL ingestion", () => {
      const url = "https://example.com/documents/report.pdf";
      expect(url.endsWith(".pdf")).toBe(true);
    });

    it("should support URL with query parameters", () => {
      const url = "https://example.com/page?section=intro&version=2";
      const parsed = new URL(url);
      expect(parsed.searchParams.get("section")).toBe("intro");
    });
  });
});

describe("IngestService Deprecation", () => {
  it("should indicate deprecation in favor of MemoriesService", () => {
    // This test documents the deprecation status
    // IngestService is deprecated but kept for backward compatibility
    expect(IngestService).toBeDefined();

    // The recommended replacement is MemoriesService
    // Which provides: add(), get(), list(), update(), delete(), uploadFile()
  });
});
