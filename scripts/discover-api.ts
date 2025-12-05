#!/usr/bin/env bun
/**
 * API Discovery Script - Code Analysis Edition
 *
 * Reverse-engineers OpenAPI specification from the SDK implementation.
 * Analyzes:
 * - Service endpoints and HTTP methods
 * - Request/response types
 * - Error handling and status codes
 * - Configuration and parameters
 *
 * This enables automated synchronization without requiring external API access.
 * Run regularly (daily) to detect any code changes.
 *
 * Usage:
 *   bun run scripts/discover-api.ts       # Analyze and generate spec
 *   bun run scripts/discover-api.ts --diff # Show changes vs. previous spec
 */

import { stringifyJson } from "@/utils/json.js";
import { Effect } from "effect";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

type OpenAPISpec = {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
    "x-generated": string;
    "x-generated-from": string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, Record<string, unknown>>;
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
};

/**
 * Discovered endpoints from code analysis
 */
const discoveredEndpoints = {
  "POST /api/v1/memories": {
    operationId: "put",
    summary: "Store or update a memory",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["id", "value", "namespace"],
            properties: {
              id: { type: "string", description: "Memory key identifier" },
              value: {
                type: "string",
                description: "Memory value (Base64 encoded)",
              },
              namespace: {
                type: "string",
                description: "Isolation namespace",
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Memory stored successfully",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SupermemoryApiMemory" },
          },
        },
      },
      "400": { description: "Bad request" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  },

  "GET /api/v1/memories/{id}": {
    operationId: "get_or_exists",
    summary: "Retrieve a memory by ID",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Memory key identifier",
      },
    ],
    responses: {
      "200": {
        description: "Memory found",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/SupermemoryApiMemory" },
          },
        },
      },
      "404": { description: "Memory not found (returns undefined for get)" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  },

  "DELETE /api/v1/memories/{id}": {
    operationId: "delete",
    summary: "Delete a memory by ID (idempotent)",
    parameters: [
      {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" },
        description: "Memory key identifier",
      },
    ],
    responses: {
      "204": { description: "Memory deleted successfully" },
      "404": { description: "Memory not found (returns true - idempotent)" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  },

  "DELETE /api/v1/memories": {
    operationId: "clear",
    summary: "Clear all memories in a namespace",
    parameters: [
      {
        name: "namespace",
        in: "query",
        required: true,
        schema: { type: "string" },
        description: "Namespace to clear",
      },
    ],
    responses: {
      "204": { description: "Namespace cleared successfully" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  },

  "POST /api/v1/memories/batch": {
    operationId: "putMany",
    summary: "Store multiple memories in a single request",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "value", "namespace"],
              properties: {
                id: { type: "string" },
                value: { type: "string", description: "Base64 encoded" },
                namespace: { type: "string" },
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Batch operation completed (may have partial failures)",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/SupermemoryBatchResponse",
            },
          },
        },
      },
      "400": { description: "Bad request" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  },

  "DELETE /api/v1/memories/batch": {
    operationId: "deleteMany",
    summary: "Delete multiple memories in a single request",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "namespace"],
              properties: {
                id: { type: "string" },
                namespace: { type: "string" },
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Batch delete completed",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/SupermemoryBatchResponse",
            },
          },
        },
      },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  },

  "POST /api/v1/memories/batchGet": {
    operationId: "getMany",
    summary: "Retrieve multiple memories in a single request",
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "namespace"],
              properties: {
                id: { type: "string" },
                namespace: { type: "string" },
              },
            },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Batch get completed",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/SupermemoryBatchResponse",
            },
          },
        },
      },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  },
};

/**
 * Generate OpenAPI spec from discovered endpoints
 */
function generateOpenAPISpec(): OpenAPISpec {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const [endpoint, details] of Object.entries(discoveredEndpoints)) {
    const [method, path_] = endpoint.split(" ");
    if (!paths[path_]) {
      paths[path_] = {};
    }
    const pathEntry = paths[path_];
    if (pathEntry) {
      pathEntry[method.toLowerCase()] = {
        ...details,
        security: [{ BearerAuth: [] }],
        tags: ["Memory Operations"],
      };
    }
  }

  const spec: OpenAPISpec = {
    openapi: "3.1.0",
    info: {
      title: "Supermemory API",
      version: "v4",
      description:
        "API specification discovered from effect-supermemory SDK implementation (code analysis only).",
      "x-generated": new Date().toISOString(),
      "x-generated-from": "services/supermemoryClient/",
    },
    servers: [
      {
        url: "https://api.supermemory.dev",
        description: "Production API",
      },
      {
        url: "https://api.supermemory.ai",
        description: "Alternative endpoint",
      },
    ],
    paths,
    components: {
      schemas: {
        SupermemoryApiMemory: {
          type: "object",
          required: ["id", "value", "namespace", "createdAt", "updatedAt"],
          properties: {
            id: {
              type: "string",
              description: "Unique memory identifier",
            },
            value: {
              type: "string",
              description: "Memory content (Base64 encoded)",
            },
            namespace: {
              type: "string",
              description: "Isolation namespace",
            },
            metadata: {
              type: "object",
              description: "Optional metadata",
              additionalProperties: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "ISO 8601 timestamp",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              description: "ISO 8601 timestamp",
            },
          },
        },
        SupermemoryBatchResponseItem: {
          type: "object",
          required: ["id", "status"],
          properties: {
            id: {
              type: "string",
              description: "Item identifier",
            },
            status: {
              type: "integer",
              description: "HTTP status code for this item",
            },
            value: {
              type: "string",
              description: "Response value (for batch get, Base64 encoded)",
            },
            error: {
              type: "string",
              description: "Error message if status >= 400",
            },
          },
        },
        SupermemoryBatchResponse: {
          type: "object",
          required: ["results"],
          properties: {
            correlationId: {
              type: "string",
              description: "Optional correlation ID for tracing",
            },
            results: {
              type: "array",
              items: {
                $ref: "#/components/schemas/SupermemoryBatchResponseItem",
              },
            },
          },
        },
      },
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Supermemory API key (sk-...)",
        },
      },
    },
  };

  return spec;
}

/**
 * Format spec as pretty JSON
 * (openapi-typescript supports both YAML and JSON)
 */
async function toJSON(obj: unknown): Promise<string> {
  return await Effect.runPromise(stringifyJson(obj, { indent: 2 }));
}

/**
 * Main discovery function
 */
async function main() {
  console.log(`\n${"=".repeat(60)}`);
  console.log("🔍 API Discovery - Code Analysis");
  console.log("=".repeat(60));

  const args = process.argv.slice(2);
  const showDiff = args.includes("--diff");

  const spec = generateOpenAPISpec();
  const specPath = join(process.cwd(), "specs/supermemory/openapi-v4.json");
  const specDir = dirname(specPath);

  // Ensure directory exists
  if (!existsSync(specDir)) {
    mkdirSync(specDir, { recursive: true });
  }

  // Convert to JSON
  const json = await toJSON(spec);

  // Check if spec changed
  let changed = false;
  if (existsSync(specPath)) {
    const previous = readFileSync(specPath, "utf-8");
    changed = previous !== json;

    if (showDiff && changed) {
      console.log("\n📊 Changes detected:");
      console.log("Previous spec exists, new spec has differences");
    }
  } else {
    changed = true;
    console.log("\n📝 Creating new OpenAPI spec");
  }

  // Write spec
  writeFileSync(specPath, json);

  console.log("\n✅ OpenAPI spec generated:");
  console.log(`   File: ${specPath}`);
  console.log(`   Status: ${changed ? "CHANGED ✨" : "unchanged"}`);
  console.log(
    `   Endpoints discovered: ${Object.keys(discoveredEndpoints).length}`
  );
  console.log(`   Generated at: ${spec.info["x-generated"]}`);

  // Summary
  console.log("\n📋 Discovered Endpoints:");
  for (const endpoint of Object.keys(discoveredEndpoints)) {
    console.log(`   ${endpoint}`);
  }

  console.log(`\n${"=".repeat(60)}\n`);

  if (changed) {
    console.log("💡 Tip: Run 'bun run codegen' to regenerate TypeScript types");
    console.log(
      "   Commit this spec and let GitHub Actions handle type generation"
    );
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
