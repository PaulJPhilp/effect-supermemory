/**
 * Unit tests for Tools Service
 *
 * @since 1.0.0
 */

import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { ToolsService } from "../service.js";

describe("ToolsService", () => {
  const testLayer = ToolsService.Default;

  describe("makeSearchTool", () => {
    it("creates a search tool definition with default options", async () => {
      const program = Effect.gen(function* () {
        const tools = yield* ToolsService;
        return yield* tools.makeSearchTool();
      }).pipe(Effect.provide(testLayer));

      const tool = await Effect.runPromise(program);

      expect(tool.name).toBe("search_memories");
      expect(tool.description).toContain("Search through stored memories");
      expect(tool.parameters.type).toBe("object");
      expect(tool.parameters.properties.query).toBeDefined();
      expect(tool.parameters.properties.topK).toBeDefined();
      expect(tool.parameters.required).toContain("query");
    });

    it("creates a search tool with custom name and description", async () => {
      const program = Effect.gen(function* () {
        const tools = yield* ToolsService;
        return yield* tools.makeSearchTool({
          name: "custom_search",
          description: "Custom search description",
        });
      }).pipe(Effect.provide(testLayer));

      const tool = await Effect.runPromise(program);

      expect(tool.name).toBe("custom_search");
      expect(tool.description).toBe("Custom search description");
    });
  });

  describe("makeRememberTool", () => {
    it("creates a remember tool definition with default options", async () => {
      const program = Effect.gen(function* () {
        const tools = yield* ToolsService;
        return yield* tools.makeRememberTool();
      }).pipe(Effect.provide(testLayer));

      const tool = await Effect.runPromise(program);

      expect(tool.name).toBe("remember");
      expect(tool.description).toContain(
        "Save information to long-term memory"
      );
      expect(tool.parameters.type).toBe("object");
      expect(tool.parameters.properties.content).toBeDefined();
      expect(tool.parameters.properties.containerTag).toBeDefined();
      expect(tool.parameters.required).toContain("content");
    });

    it("creates a remember tool with custom name and description", async () => {
      const program = Effect.gen(function* () {
        const tools = yield* ToolsService;
        return yield* tools.makeRememberTool({
          name: "save_memory",
          description: "Custom remember description",
        });
      }).pipe(Effect.provide(testLayer));

      const tool = await Effect.runPromise(program);

      expect(tool.name).toBe("save_memory");
      expect(tool.description).toBe("Custom remember description");
    });
  });
});
