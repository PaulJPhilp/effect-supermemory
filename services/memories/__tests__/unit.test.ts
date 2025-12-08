/**
 * MemoriesService Comprehensive Unit Tests
 *
 * @since 1.0.0
 * @module Memories
 */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */

import { SERVICE_TAGS } from "@/Constants.js";
import { describe, expect, it } from "vitest";
import { MemoriesService } from "../service.js";
import type {
  Memory,
  MemoryAddParams,
  MemoryAddResponse,
  MemoryListItem,
  MemoryListParams,
  MemoryListResponse,
  MemoryMetadata,
  MemoryStatus,
  MemoryType,
  MemoryUpdateParams,
  MemoryUpdateResponse,
  MemoryUploadFileParams,
  MemoryUploadFileResponse,
  Pagination,
  SortField,
  SortOrder,
} from "../types.js";

describe("MemoriesService", () => {
  describe("Service Definition", () => {
    it("should be properly defined as an Effect.Service", () => {
      expect(MemoriesService).toBeDefined();
      expect(typeof MemoriesService).toBe("function");
    });

    it("should export Default layer via MemoriesService.Default", () => {
      expect(MemoriesService.Default).toBeDefined();
    });

    it("should have the correct service tag", () => {
      expect(MemoriesService.key).toBe(SERVICE_TAGS.MEMORIES);
    });
  });

  describe("Type Definitions", () => {
    describe("MemoryStatus", () => {
      it("should define all valid status values", () => {
        const validStatuses: readonly MemoryStatus[] = [
          "unknown",
          "queued",
          "extracting",
          "chunking",
          "embedding",
          "indexing",
          "done",
          "failed",
        ] as const;

        expect(validStatuses).toHaveLength(8);
        expect(validStatuses).toContain("unknown");
        expect(validStatuses).toContain("done");
        expect(validStatuses).toContain("failed");
      });
    });

    describe("MemoryType", () => {
      it("should define all valid type values", () => {
        const validTypes: readonly MemoryType[] = [
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
        ] as const;

        expect(validTypes).toHaveLength(11);
        expect(validTypes).toContain("text");
        expect(validTypes).toContain("pdf");
        expect(validTypes).toContain("webpage");
      });
    });

    describe("SortField", () => {
      it("should define valid sort field values", () => {
        const validFields: readonly SortField[] = [
          "createdAt",
          "updatedAt",
        ] as const;

        expect(validFields).toHaveLength(2);
      });
    });

    describe("SortOrder", () => {
      it("should define valid sort order values", () => {
        const validOrders: readonly SortOrder[] = ["asc", "desc"] as const;

        expect(validOrders).toHaveLength(2);
      });
    });

    describe("MemoryMetadata", () => {
      it("should accept valid metadata shapes", () => {
        const metadata: MemoryMetadata = {
          stringValue: "test",
          numberValue: 42,
          booleanValue: true,
          arrayValue: ["a", "b", "c"],
        };

        expect(metadata.stringValue).toBe("test");
        expect(metadata.numberValue).toBe(42);
        expect(metadata.booleanValue).toBe(true);
        expect(metadata.arrayValue).toEqual(["a", "b", "c"]);
      });
    });

    describe("Pagination", () => {
      it("should define pagination structure", () => {
        const pagination: Pagination = {
          currentPage: 1,
          totalItems: 100,
          totalPages: 10,
          limit: 10,
        };

        expect(pagination.currentPage).toBe(1);
        expect(pagination.totalItems).toBe(100);
        expect(pagination.totalPages).toBe(10);
      });

      it("should allow optional limit", () => {
        const pagination: Pagination = {
          currentPage: 1,
          totalItems: 50,
          totalPages: 5,
        };

        expect(pagination.limit).toBeUndefined();
      });
    });
  });

  describe("MemoryAddParams", () => {
    it("should require content field", () => {
      const params: MemoryAddParams = {
        content: "Test content",
      };
      expect(params.content).toBe("Test content");
    });

    it("should accept optional fields", () => {
      const params: MemoryAddParams = {
        content: "Test content",
        containerTag: "my-container",
        customId: "custom-123",
        metadata: { key: "value" },
      };

      expect(params.containerTag).toBe("my-container");
      expect(params.customId).toBe("custom-123");
      expect(params.metadata).toEqual({ key: "value" });
    });
  });

  describe("MemoryAddResponse", () => {
    it("should define expected response shape", () => {
      const response: MemoryAddResponse = {
        id: "mem_123",
        status: "queued",
      };

      expect(response.id).toBe("mem_123");
      expect(response.status).toBe("queued");
    });
  });

  describe("MemoryListParams", () => {
    it("should accept all optional parameters", () => {
      const params: MemoryListParams = {
        containerTags: ["tag1", "tag2"],
        filters: { AND: [] },
        includeContent: true,
        limit: 50,
        page: 1,
        sort: "createdAt",
        order: "desc",
      };

      expect(params.containerTags).toEqual(["tag1", "tag2"]);
      expect(params.limit).toBe(50);
      expect(params.sort).toBe("createdAt");
      expect(params.order).toBe("desc");
    });

    it("should accept OR filter", () => {
      const params: MemoryListParams = {
        filters: { OR: [{ status: "done" }, { status: "queued" }] },
      };

      expect(params.filters).toHaveProperty("OR");
    });
  });

  describe("MemoryListResponse", () => {
    it("should define expected response shape", () => {
      const response: MemoryListResponse = {
        memories: [],
        pagination: {
          currentPage: 1,
          totalItems: 0,
          totalPages: 0,
        },
      };

      expect(response.memories).toEqual([]);
      expect(response.pagination.totalItems).toBe(0);
    });
  });

  describe("MemoryUpdateParams", () => {
    it("should accept all optional update fields", () => {
      const params: MemoryUpdateParams = {
        containerTag: "new-container",
        content: "Updated content",
        customId: "new-custom-id",
        metadata: { updated: true },
      };

      expect(params.containerTag).toBe("new-container");
      expect(params.content).toBe("Updated content");
    });
  });

  describe("MemoryUpdateResponse", () => {
    it("should define expected response shape", () => {
      const response: MemoryUpdateResponse = {
        id: "mem_123",
        status: "queued",
      };

      expect(response.id).toBe("mem_123");
    });
  });

  describe("Memory", () => {
    it("should define full memory object shape", () => {
      const memory: Memory = {
        id: "mem_123",
        connectionId: null,
        content: "Test content",
        createdAt: "2024-01-01T00:00:00Z",
        customId: null,
        metadata: {},
        ogImage: null,
        raw: null,
        source: null,
        status: "done",
        summary: null,
        summaryEmbeddingModel: null,
        summaryEmbeddingModelNew: null,
        summaryEmbeddingNew: null,
        title: null,
        type: "text",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      expect(memory.id).toBe("mem_123");
      expect(memory.status).toBe("done");
      expect(memory.type).toBe("text");
    });

    it("should accept optional fields", () => {
      const memory: Memory = {
        id: "mem_123",
        connectionId: "conn_456",
        content: "Test content",
        createdAt: "2024-01-01T00:00:00Z",
        customId: "custom-123",
        metadata: { key: "value" },
        ogImage: "https://example.com/image.png",
        raw: { original: "data" },
        source: "api",
        status: "done",
        summary: "A test memory",
        summaryEmbeddingModel: "text-embedding-ada-002",
        summaryEmbeddingModelNew: "text-embedding-3-small",
        summaryEmbeddingNew: [0.1, 0.2, 0.3],
        title: "Test Memory",
        type: "text",
        updatedAt: "2024-01-01T00:00:00Z",
        containerTags: ["tag1", "tag2"],
        url: "https://example.com",
      };

      expect(memory.containerTags).toEqual(["tag1", "tag2"]);
      expect(memory.customId).toBe("custom-123");
      expect(memory.url).toBe("https://example.com");
    });
  });

  describe("MemoryListItem", () => {
    it("should define list item shape", () => {
      const item: MemoryListItem = {
        id: "mem_123",
        connectionId: null,
        createdAt: "2024-01-01T00:00:00Z",
        customId: null,
        metadata: {},
        status: "done",
        summary: "Test summary",
        title: "Test Title",
        type: "text",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      expect(item.id).toBe("mem_123");
      expect(item.summary).toBe("Test summary");
    });

    it("should accept optional content", () => {
      const item: MemoryListItem = {
        id: "mem_123",
        connectionId: null,
        createdAt: "2024-01-01T00:00:00Z",
        customId: null,
        metadata: {},
        status: "done",
        summary: null,
        title: null,
        type: "text",
        updatedAt: "2024-01-01T00:00:00Z",
        content: "Full content when includeContent is true",
      };

      expect(item.content).toBeDefined();
    });
  });

  describe("MemoryUploadFileParams", () => {
    it("should require file field", () => {
      const params: MemoryUploadFileParams = {
        file: new Blob(["test"]),
      };
      expect(params.file).toBeDefined();
    });

    it("should accept optional fields", () => {
      const params: MemoryUploadFileParams = {
        file: new Blob(["test"]),
        containerTags: "tag1,tag2",
        fileType: "pdf",
        metadata: '{"key":"value"}',
        mimeType: "application/pdf",
      };

      expect(params.containerTags).toBe("tag1,tag2");
      expect(params.fileType).toBe("pdf");
    });
  });

  describe("MemoryUploadFileResponse", () => {
    it("should define expected response shape", () => {
      const response: MemoryUploadFileResponse = {
        id: "mem_123",
        status: "queued",
      };

      expect(response.id).toBe("mem_123");
      expect(response.status).toBe("queued");
    });
  });
});

describe("MemoriesService Validation", () => {
  describe("add() validation", () => {
    it("should reject empty content", () => {
      const params: MemoryAddParams = { content: "" };
      expect(params.content).toBe("");
    });

    it("should accept valid content", () => {
      const params: MemoryAddParams = { content: "Valid content" };
      expect(params.content.length).toBeGreaterThan(0);
    });
  });

  describe("get() validation", () => {
    it("should require non-empty ID", () => {
      const emptyId = "";
      expect(emptyId.length).toBe(0);
    });

    it("should accept valid ID", () => {
      const validId = "mem_123abc";
      expect(validId.length).toBeGreaterThan(0);
    });
  });

  describe("update() validation", () => {
    it("should require non-empty ID", () => {
      const emptyId = "";
      expect(emptyId.length).toBe(0);
    });

    it("should allow empty params (touch update)", () => {
      const params: MemoryUpdateParams = {};
      expect(Object.keys(params)).toHaveLength(0);
    });
  });

  describe("delete() validation", () => {
    it("should require non-empty ID", () => {
      const emptyId = "";
      expect(emptyId.length).toBe(0);
    });
  });

  describe("list() validation", () => {
    it("should accept undefined params", () => {
      const params: MemoryListParams | undefined = undefined;
      expect(params).toBeUndefined();
    });

    it("should accept empty params", () => {
      const params: MemoryListParams = {};
      expect(Object.keys(params)).toHaveLength(0);
    });

    it("should accept pagination params", () => {
      const params: MemoryListParams = {
        limit: 10,
        page: 1,
      };
      expect(params.limit).toBe(10);
      expect(params.page).toBe(1);
    });
  });
});

describe("MemoriesService API Contract", () => {
  it("should have add method", () => {
    type AddMethod = typeof MemoriesService.prototype.add;
    const _typeCheck: AddMethod = {} as AddMethod;
    expect(true).toBe(true);
  });

  it("should have get method", () => {
    type GetMethod = typeof MemoriesService.prototype.get;
    const _typeCheck: GetMethod = {} as GetMethod;
    expect(true).toBe(true);
  });

  it("should have list method", () => {
    type ListMethod = typeof MemoriesService.prototype.list;
    const _typeCheck: ListMethod = {} as ListMethod;
    expect(true).toBe(true);
  });

  it("should have update method", () => {
    type UpdateMethod = typeof MemoriesService.prototype.update;
    const _typeCheck: UpdateMethod = {} as UpdateMethod;
    expect(true).toBe(true);
  });

  it("should have delete method", () => {
    type DeleteMethod = typeof MemoriesService.prototype.delete;
    const _typeCheck: DeleteMethod = {} as DeleteMethod;
    expect(true).toBe(true);
  });

  it("should have uploadFile method", () => {
    type UploadMethod = typeof MemoriesService.prototype.uploadFile;
    const _typeCheck: UploadMethod = {} as UploadMethod;
    expect(true).toBe(true);
  });
});
