import { describe, expect, it } from "vitest";
import { Filter } from "../filterBuilder.js";
import { buildSearchParams } from "../helpers.js";

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

    it("includes containerTag when provided", () => {
      const result = buildSearchParams("test", { containerTag: "user-123" });
      expect(result).toEqual({ query: "test", containerTag: "user-123" });
    });

    it("includes containerTags when provided", () => {
      const result = buildSearchParams("test", {
        containerTags: ["user-123", "project-456"],
      });
      expect(result).toEqual({
        query: "test",
        containerTags: ["user-123", "project-456"],
      });
    });

    it("does not include containerTags when empty array", () => {
      const result = buildSearchParams("test", { containerTags: [] });
      expect(result).toEqual({ query: "test" });
    });

    it("includes both containerTag and containerTags when provided", () => {
      const result = buildSearchParams("test", {
        containerTag: "single-tag",
        containerTags: ["tag1", "tag2"],
      });
      expect(result).toEqual({
        query: "test",
        containerTag: "single-tag",
        containerTags: ["tag1", "tag2"],
      });
    });

    it("includes containerTags with other options", () => {
      const result = buildSearchParams("test query", {
        topK: 5,
        threshold: 0.7,
        containerTags: ["user-123"],
      });
      expect(result).toEqual({
        query: "test query",
        topK: 5,
        threshold: 0.7,
        containerTags: ["user-123"],
      });
    });
  });
});
