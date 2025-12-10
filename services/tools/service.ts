/**
 * Tools Service Implementation
 *
 * @since 1.0.0
 * @module Tools
 */
/** biome-ignore-all assist/source/organizeImports: Effect imports must come first */

import { SERVICE_TAGS } from "@/Constants.js";
import type { SupermemoryError } from "@/Errors.js";
import { Effect } from "effect";
import type {
  RememberToolOptions,
  SearchToolOptions,
  ToolsServiceOps,
} from "./api.js";
import type { ToolDefinition } from "./types.js";

/**
 * Create the tools service implementation.
 *
 * @since 1.0.0
 * @category Constructors
 */
const makeToolsService = Effect.succeed({
  makeSearchTool: (
    options?: SearchToolOptions
  ): Effect.Effect<ToolDefinition, SupermemoryError> =>
    Effect.succeed({
      name: options?.name ?? "search_memories",
      description:
        options?.description ??
        "Search through stored memories to find relevant information based on a query. Returns semantically relevant memories that match the search query.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "The search query to find relevant memories. Should be a natural language question or description of what information you're looking for.",
          },
          topK: {
            type: "number",
            description:
              "Maximum number of results to return (default: 10, max: 100).",
            minimum: 1,
            maximum: 100,
          },
          threshold: {
            type: "number",
            description:
              "Minimum relevance score threshold (0.0 to 1.0). Only results above this threshold will be returned.",
            minimum: 0,
            maximum: 1,
          },
          rerank: {
            type: "boolean",
            description:
              "Whether to use advanced reranking for better results (default: false).",
          },
        },
        required: ["query"],
      },
    }),

  makeRememberTool: (
    options?: RememberToolOptions
  ): Effect.Effect<ToolDefinition, SupermemoryError> =>
    Effect.succeed({
      name: options?.name ?? "remember",
      description:
        options?.description ??
        "Save information to long-term memory so it can be recalled later. Use this to remember important facts, preferences, or context about the user or conversation.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description:
              "The information to remember. Should be clear, concise, and include relevant context.",
          },
          containerTag: {
            type: "string",
            description:
              "Optional tag to organize this memory (e.g., user ID, category). Helps filter and retrieve related memories later.",
          },
          metadata: {
            type: "object",
            description:
              "Optional metadata to attach to this memory (e.g., source, timestamp, category).",
            properties: {
              source: {
                type: "string",
                description:
                  "Where this information came from (e.g., 'conversation', 'document').",
              },
              category: {
                type: "string",
                description: "Category or topic for this memory.",
              },
            },
          },
        },
        required: ["content"],
      },
    }),
} satisfies ToolsServiceOps);

/**
 * Tools Service for creating AI SDK tool definitions.
 *
 * @since 1.0.0
 * @category Services
 */
export class ToolsService extends Effect.Service<ToolsService>()(
  SERVICE_TAGS.TOOLS,
  {
    accessors: true,
    effect: makeToolsService,
  }
) {}
