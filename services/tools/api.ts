/**
 * Tools Service API
 *
 * Pre-packaged tool definitions for AI SDKs (Vercel AI SDK, OpenAI, etc.).
 * These tools allow AI agents to search memories and remember information.
 *
 * @since 1.0.0
 * @module Tools
 */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */

import type { SupermemoryError } from "@/Errors.js";
import type { Effect } from "effect";
import type { ToolDefinition } from "./types.js";

/**
 * Tools service interface.
 *
 * Provides factory functions for creating tool definitions compatible with
 * Vercel AI SDK, OpenAI, and other AI frameworks.
 *
 * @since 1.0.0
 * @category Services
 */
export type ToolsServiceOps = {
  /**
   * Create a search tool definition.
   *
   * Returns a tool definition that allows AI agents to search memories
   * using semantic search. The tool is pre-wired to call `SearchService.searchMemories`.
   *
   * @param options - Optional configuration for the tool
   * @returns Effect that resolves to a tool definition compatible with AI SDKs
   *
   * @example
   * ```typescript
   * const searchTool = yield* ToolsService.makeSearchTool();
   * // Use with Vercel AI SDK or OpenAI
   * ```
   */
  readonly makeSearchTool: (
    options?: SearchToolOptions
  ) => Effect.Effect<ToolDefinition, SupermemoryError>;

  /**
   * Create a remember tool definition.
   *
   * Returns a tool definition that allows AI agents to save information
   * to memory. The tool is pre-wired to call `MemoriesService.add` or `IngestService.addText`.
   *
   * @param options - Optional configuration for the tool
   * @returns Effect that resolves to a tool definition compatible with AI SDKs
   *
   * @example
   * ```typescript
   * const rememberTool = yield* ToolsService.makeRememberTool();
   * // Use with Vercel AI SDK or OpenAI
   * ```
   */
  readonly makeRememberTool: (
    options?: RememberToolOptions
  ) => Effect.Effect<ToolDefinition, SupermemoryError>;
};

/**
 * Options for configuring the search tool.
 *
 * @since 1.0.0
 */
export type SearchToolOptions = {
  /**
   * Custom name for the tool (default: "search_memories").
   */
  readonly name?: string;

  /**
   * Custom description for the tool.
   */
  readonly description?: string;

  /**
   * Default search options to apply to all searches.
   */
  readonly defaultSearchOptions?: {
    readonly topK?: number;
    readonly threshold?: number;
    readonly rerank?: boolean;
  };
};

/**
 * Options for configuring the remember tool.
 *
 * @since 1.0.0
 */
export type RememberToolOptions = {
  /**
   * Custom name for the tool (default: "remember").
   */
  readonly name?: string;

  /**
   * Custom description for the tool.
   */
  readonly description?: string;

  /**
   * Default container tag to use for all remembered items.
   */
  readonly defaultContainerTag?: string;
};
