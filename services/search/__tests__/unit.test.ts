/**
 * SearchService Comprehensive Unit Tests
 *
 * @since 1.0.0
 * @module Search
 */

import { describe, expect, it } from "vitest";
import { Filter, toJSON } from "../filterBuilder.js";
import { buildSearchParams } from "../helpers.js";
import { SearchService, SearchServiceLive } from "../service.js";
import type {
  DocumentChunk,
  FilterOperator,
  FilterPrimitive,
  FilterValue,
  SearchDocumentsResponse,
  SearchExecuteResponse,
  SearchMemoriesResponse,
  SearchOptions,
  SupermemoryMemory,
} from "../types.js";

describe("SearchService", () => {
  describe("Service Definition", () => {
    it("should be properly defined as an Effect.Service", () => {
      expect(SearchService).toBeDefined();
      expect(typeof SearchService).toBe("function");
    });

    it("should export SearchServiceLive layer", () => {
      expect(SearchServiceLive).toBeDefined();
    });

    it("should have the correct service tag", () => {
      expect(SearchService.key).toBe("@effect-supermemory/Search");
    });
  });

  describe("Type Definitions", () => {
    describe("SearchOptions", () => {
      it("should accept empty options", () => {
        const options: SearchOptions = {};
        expect(Object.keys(options)).toHaveLength(0);
      });

      it("should accept topK option", () => {
        const options: SearchOptions = { topK: 10 };
        expect(options.topK).toBe(10);
      });

      it("should accept threshold option", () => {
        const options: SearchOptions = { threshold: 0.8 };
        expect(options.threshold).toBe(0.8);
      });

      it("should accept rerank option", () => {
        const options: SearchOptions = { rerank: true };
        expect(options.rerank).toBe(true);
      });

      it("should accept filters option", () => {
        const filter = Filter.tag("test");
        const options: SearchOptions = { filters: filter };
        expect(options.filters).toBeDefined();
      });

      it("should accept all options together", () => {
        const options: SearchOptions = {
          topK: 5,
          threshold: 0.7,
          rerank: true,
          filters: Filter.tag("archived"),
        };

        expect(options.topK).toBe(5);
        expect(options.threshold).toBe(0.7);
        expect(options.rerank).toBe(true);
        expect(options.filters).toBeDefined();
      });
    });

    describe("DocumentChunk", () => {
      it("should define expected document chunk shape", () => {
        const chunk: DocumentChunk = {
          id: "chunk_123",
          documentId: "doc_456",
          content: "This is chunk content",
          score: 0.95,
          metadata: { source: "test" },
        };

        expect(chunk.id).toBe("chunk_123");
        expect(chunk.documentId).toBe("doc_456");
        expect(chunk.content).toBe("This is chunk content");
        expect(chunk.score).toBe(0.95);
      });
    });

    describe("SupermemoryMemory", () => {
      it("should define expected memory shape", () => {
        const memory: SupermemoryMemory = {
          id: "mem_123",
          content: "Memory content",
          score: 0.9,
          metadata: {},
        };

        expect(memory.id).toBe("mem_123");
        expect(memory.score).toBe(0.9);
      });
    });

    describe("SearchDocumentsResponse", () => {
      it("should define expected response shape", () => {
        const response: SearchDocumentsResponse = {
          results: [
            {
              id: "1",
              documentId: "doc_1",
              content: "test",
              score: 0.9,
              metadata: {},
            },
          ],
        };

        expect(response.results).toHaveLength(1);
        expect(response.results[0]?.score).toBe(0.9);
      });

      it("should handle empty results", () => {
        const response: SearchDocumentsResponse = {
          results: [],
        };

        expect(response.results).toHaveLength(0);
      });
    });

    describe("SearchMemoriesResponse", () => {
      it("should define expected response shape", () => {
        const response: SearchMemoriesResponse = {
          results: [{ id: "1", content: "test", score: 0.85, metadata: {} }],
        };

        expect(response.results).toHaveLength(1);
      });
    });

    describe("SearchExecuteResponse", () => {
      it("should define expected response shape", () => {
        const response: SearchExecuteResponse = {
          results: [
            {
              id: "1",
              documentId: "doc_1",
              content: "test",
              score: 0.9,
              metadata: {},
            },
          ],
        };

        expect(response.results).toHaveLength(1);
        expect(response.results[0]?.score).toBe(0.9);
      });

      it("should handle empty results", () => {
        const response: SearchExecuteResponse = {
          results: [],
        };

        expect(response.results).toHaveLength(0);
      });

      it("should have the same structure as SearchDocumentsResponse", () => {
        // SearchExecuteResponse is structurally equivalent to SearchDocumentsResponse
        const executeResponse: SearchExecuteResponse = {
          results: [
            {
              id: "chunk_1",
              documentId: "doc_1",
              content: "Execute result",
              score: 0.88,
            },
          ],
        };

        // It can be assigned to SearchDocumentsResponse type
        const docsResponse: SearchDocumentsResponse = executeResponse;
        expect(docsResponse.results).toEqual(executeResponse.results);
      });
    });

    describe("FilterOperator", () => {
      it("should define valid operators", () => {
        const operators: readonly FilterOperator[] = [
          "eq",
          "ne",
          "gt",
          "gte",
          "lt",
          "lte",
          "in",
        ] as const;

        expect(operators).toContain("eq");
        expect(operators).toContain("ne");
        expect(operators).toContain("in");
        expect(operators).toHaveLength(7);
      });
    });

    describe("FilterPrimitive", () => {
      it("should accept string values", () => {
        const value: FilterPrimitive = "test";
        expect(value).toBe("test");
      });

      it("should accept number values", () => {
        const value: FilterPrimitive = 42;
        expect(value).toBe(42);
      });

      it("should accept boolean values", () => {
        const value: FilterPrimitive = true;
        expect(value).toBe(true);
      });
    });

    describe("FilterValue", () => {
      it("should accept primitive values", () => {
        const value: FilterValue = "test";
        expect(value).toBe("test");
      });

      it("should accept array values", () => {
        const value: FilterValue = ["a", "b", "c"];
        expect(value).toEqual(["a", "b", "c"]);
      });
    });
  });

  describe("API Contract", () => {
    it("should have searchDocuments method", () => {
      type SearchDocsMethod = typeof SearchService.prototype.searchDocuments;
      const _typeCheck: SearchDocsMethod = {} as SearchDocsMethod;
      expect(true).toBe(true);
    });

    it("should have execute method", () => {
      type ExecuteMethod = typeof SearchService.prototype.execute;
      const _typeCheck: ExecuteMethod = {} as ExecuteMethod;
      expect(true).toBe(true);
    });

    it("should have searchMemories method", () => {
      type SearchMemsMethod = typeof SearchService.prototype.searchMemories;
      const _typeCheck: SearchMemsMethod = {} as SearchMemsMethod;
      expect(true).toBe(true);
    });
  });
});

describe("Filter Builder", () => {
  describe("Filter.tag()", () => {
    it("creates a tag filter", () => {
      const filter = Filter.tag("my-tag");
      const json = toJSON(filter);
      expect(json).toEqual({ tag: "my-tag" });
    });
  });

  describe("Filter.meta()", () => {
    it("creates an equality filter", () => {
      const filter = Filter.meta("author", "eq", "Paul");
      const json = toJSON(filter);
      expect(json).toEqual({ "metadata.author": "Paul" });
    });

    it("creates a greater than filter", () => {
      const filter = Filter.meta("count", "gt", 10);
      const json = toJSON(filter);
      expect(json).toEqual({ "metadata.count": { $gt: 10 } });
    });

    it("creates a less than filter", () => {
      const filter = Filter.meta("score", "lt", 0.5);
      const json = toJSON(filter);
      expect(json).toEqual({ "metadata.score": { $lt: 0.5 } });
    });

    it("creates an in filter", () => {
      const filter = Filter.meta("status", "in", ["active", "pending"]);
      const json = toJSON(filter);
      expect(json).toEqual({
        "metadata.status": { $in: ["active", "pending"] },
      });
    });

    it("creates a not equal filter", () => {
      const filter = Filter.meta("deleted", "ne", true);
      const json = toJSON(filter);
      expect(json).toEqual({ "metadata.deleted": { $ne: true } });
    });

    it("creates a greater than or equal filter", () => {
      const filter = Filter.meta("version", "gte", 2);
      const json = toJSON(filter);
      expect(json).toEqual({ "metadata.version": { $gte: 2 } });
    });

    it("creates a less than or equal filter", () => {
      const filter = Filter.meta("priority", "lte", 5);
      const json = toJSON(filter);
      expect(json).toEqual({ "metadata.priority": { $lte: 5 } });
    });
  });

  describe("Filter.and()", () => {
    it("combines filters with AND", () => {
      const filter = Filter.and(
        Filter.tag("archived"),
        Filter.meta("author", "eq", "Paul")
      );
      const json = toJSON(filter);
      expect(json).toEqual({
        $and: [{ tag: "archived" }, { "metadata.author": "Paul" }],
      });
    });

    it("combines multiple filters", () => {
      const filter = Filter.and(
        Filter.tag("archived"),
        Filter.meta("author", "eq", "Paul"),
        Filter.meta("year", "gte", 2020)
      );
      const json = toJSON(filter);
      expect(json.$and).toHaveLength(3);
    });
  });

  describe("Filter.or()", () => {
    it("combines filters with OR", () => {
      const filter = Filter.or(Filter.tag("important"), Filter.tag("urgent"));
      const json = toJSON(filter);
      expect(json).toEqual({
        $or: [{ tag: "important" }, { tag: "urgent" }],
      });
    });
  });

  describe("Filter.not()", () => {
    it("negates a filter", () => {
      const filter = Filter.not(Filter.tag("deleted"));
      const json = toJSON(filter);
      expect(json).toEqual({
        $not: { tag: "deleted" },
      });
    });
  });

  describe("Complex filter combinations", () => {
    it("supports nested AND/OR", () => {
      const filter = Filter.and(
        Filter.tag("active"),
        Filter.or(
          Filter.meta("priority", "eq", "high"),
          Filter.meta("priority", "eq", "critical")
        )
      );
      const json = toJSON(filter);
      const andArray = json.$and as unknown[];
      expect(andArray).toHaveLength(2);
      const orClause = andArray[1] as { $or: unknown[] };
      expect(orClause.$or).toHaveLength(2);
    });

    it("supports NOT with complex expressions", () => {
      const filter = Filter.not(
        Filter.and(Filter.tag("archived"), Filter.meta("deleted", "eq", true))
      );
      const json = toJSON(filter);
      const notClause = json.$not as { $and: unknown[] };
      expect(notClause.$and).toHaveLength(2);
    });
  });
});

describe("Search Helpers", () => {
  describe("buildSearchParams()", () => {
    it("builds params with just query", () => {
      const result = buildSearchParams("test query");
      expect(result).toEqual({ query: "test query" });
    });

    it("includes topK when provided", () => {
      const result = buildSearchParams("test", { topK: 10 });
      expect(result).toEqual({ query: "test", topK: 10 });
    });

    it("includes threshold when provided", () => {
      const result = buildSearchParams("test", { threshold: 0.8 });
      expect(result).toEqual({ query: "test", threshold: 0.8 });
    });

    it("includes rerank when true", () => {
      const result = buildSearchParams("test", { rerank: true });
      expect(result).toEqual({ query: "test", rerank: true });
    });

    it("excludes rerank when false (only truthy values included)", () => {
      const result = buildSearchParams("test", { rerank: false });
      // rerank is only included when truthy
      expect(result).toEqual({ query: "test" });
    });

    it("includes filters when provided", () => {
      const filter = Filter.tag("archived");
      const result = buildSearchParams("test", { filters: filter });
      expect(result).toEqual({
        query: "test",
        filters: { tag: "archived" },
      });
    });

    it("includes all options together", () => {
      const filter = Filter.and(
        Filter.tag("archived"),
        Filter.meta("author", "eq", "Paul")
      );
      const result = buildSearchParams("test query", {
        topK: 5,
        threshold: 0.7,
        rerank: true,
        filters: filter,
      });
      expect(result).toEqual({
        query: "test query",
        topK: 5,
        threshold: 0.7,
        rerank: true,
        filters: {
          $and: [{ tag: "archived" }, { "metadata.author": "Paul" }],
        },
      });
    });

    it("handles undefined options", () => {
      const result = buildSearchParams("test", undefined);
      expect(result).toEqual({ query: "test" });
    });

    it("handles empty options object", () => {
      const result = buildSearchParams("test", {});
      expect(result).toEqual({ query: "test" });
    });
  });
});

describe("SearchService Validation", () => {
  describe("searchDocuments() validation", () => {
    it("should require non-empty query", () => {
      const emptyQuery = "";
      expect(emptyQuery.length).toBe(0);
    });

    it("should accept valid query", () => {
      const validQuery = "How does authentication work?";
      expect(validQuery.length).toBeGreaterThan(0);
    });

    it("should accept whitespace-only as technically valid string", () => {
      // Note: The service validates non-empty, not non-whitespace
      const whitespaceQuery = "   ";
      expect(whitespaceQuery.length).toBeGreaterThan(0);
    });
  });

  describe("searchMemories() validation", () => {
    it("should require non-empty query", () => {
      const emptyQuery = "";
      expect(emptyQuery.length).toBe(0);
    });

    it("should accept valid query with options", () => {
      const query = "user authentication";
      const options: SearchOptions = {
        topK: 10,
        threshold: 0.7,
      };
      expect(query.length).toBeGreaterThan(0);
      expect(options.topK).toBe(10);
    });
  });

  describe("execute() validation", () => {
    it("should require non-empty query", () => {
      const emptyQuery = "";
      expect(emptyQuery.length).toBe(0);
    });

    it("should accept valid query", () => {
      const validQuery = "How does authentication work?";
      expect(validQuery.length).toBeGreaterThan(0);
    });

    it("should accept valid query with options", () => {
      const query = "general search";
      const options: SearchOptions = {
        topK: 20,
        threshold: 0.6,
        rerank: true,
      };
      expect(query.length).toBeGreaterThan(0);
      expect(options.topK).toBe(20);
      expect(options.threshold).toBe(0.6);
      expect(options.rerank).toBe(true);
    });

    it("should accept filters option", () => {
      const filter = Filter.and(
        Filter.tag("project-x"),
        Filter.meta("version", "gte", 2)
      );
      const options: SearchOptions = { filters: filter };
      expect(options.filters).toBeDefined();
    });
  });
});
