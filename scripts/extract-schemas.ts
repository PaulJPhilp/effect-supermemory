#!/usr/bin/env bun
/**
 * Schema Extraction Script
 *
 * Extracts TypeScript interfaces/types from the official Supermemory SDK
 * and converts them to JSON Schema format for comparison.
 *
 * Usage:
 *   bun run scripts/extract-schemas.ts
 *   bun run scripts/extract-schemas.ts --sdk-path ./node_modules/supermemory
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";

const DEFAULT_SDK_PATH = join(process.cwd(), "node_modules", "supermemory");
const DEFAULT_OUTPUT = join(
  process.cwd(),
  "specs",
  "supermemory",
  "sdk-schemas.json"
);

type ExtractedSchema = {
  name: string;
  kind: "interface" | "type" | "enum" | "class";
  properties: Array<{
    name: string;
    type: string;
    optional: boolean;
    description?: string;
  }>;
  description?: string;
};

type SchemaCollection = {
  extractedAt: string;
  sdkPath: string;
  schemas: ExtractedSchema[];
};

/**
 * Find all TypeScript declaration files in a directory
 */
function findDeclarationFiles(dir: string): string[] {
  const files: string[] = [];

  if (!existsSync(dir)) {
    return files;
  }

  function walk(currentDir: string) {
    try {
      const entries = readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);

        if (entry.isDirectory() && entry.name !== "node_modules") {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".d.ts")) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.warn(`Skipping directory ${currentDir}: ${error}`);
    }
  }

  walk(dir);
  return files;
}

/**
 * Extract schemas from a TypeScript declaration file
 * This is a simplified parser - for production, use TypeScript compiler API
 */
function extractSchemasFromFile(filePath: string): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = [];
  const content = readFileSync(filePath, "utf-8");

  // Simple regex-based extraction
  // In production, use @typescript/compiler-api or ts-morph

  // Extract interfaces
  const interfaceRegex =
    /(?:export\s+)?interface\s+(\w+)(?:<[^>]*>)?\s*\{([^}]+)\}/gs;
  let match: RegExpExecArray | null = null;

  match = interfaceRegex.exec(content);
  while (match !== null) {
    const name = match[1];
    const body = match[2];

    const properties: ExtractedSchema["properties"] = [];
    const propertyRegex = /(\w+\??)\s*:\s*([^;]+);/g;
    let propMatch: RegExpExecArray | null = null;

    propMatch = propertyRegex.exec(body);
    while (propMatch !== null) {
      properties.push({
        name: propMatch[1].replace("?", ""),
        type: propMatch[2].trim(),
        optional: propMatch[1].includes("?"),
      });
      propMatch = propertyRegex.exec(body);
    }

    schemas.push({
      name,
      kind: "interface",
      properties,
    });
    match = interfaceRegex.exec(content);
  }

  // Extract type aliases
  const typeRegex = /(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=\s*([^;]+);/gs;
  match = typeRegex.exec(content);
  while (match !== null) {
    schemas.push({
      name: match[1],
      kind: "type",
      properties: [
        {
          name: "value",
          type: match[2].trim(),
          optional: false,
        },
      ],
    });
    match = typeRegex.exec(content);
  }

  // Extract enums
  const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]+)\}/gs;
  match = enumRegex.exec(content);
  while (match !== null) {
    const name = match[1];
    const body = match[2];
    const properties: ExtractedSchema["properties"] = [];

    const enumMemberRegex = /(\w+)(?:\s*=\s*([^,\n]+))?/g;
    let enumMatch: RegExpExecArray | null = null;

    enumMatch = enumMemberRegex.exec(body);
    while (enumMatch !== null) {
      properties.push({
        name: enumMatch[1],
        type: enumMatch[2]?.trim() || "string",
        optional: false,
      });
      enumMatch = enumMemberRegex.exec(body);
    }

    schemas.push({
      name,
      kind: "enum",
      properties,
    });
    match = enumRegex.exec(content);
  }

  return schemas;
}

/**
 * Convert TypeScript type to JSON Schema type
 */
function _toJsonSchemaType(tsType: string): string {
  const normalized = tsType.toLowerCase().trim();

  if (normalized.includes("string")) {
    return "string";
  }
  if (normalized.includes("number")) {
    return "number";
  }
  if (normalized.includes("boolean")) {
    return "boolean";
  }
  if (normalized.includes("array")) {
    return "array";
  }
  if (normalized.includes("object") || normalized.includes("{")) {
    return "object";
  }
  if (normalized === "null" || normalized === "undefined") {
    return "null";
  }

  return "unknown";
}

/**
 * Main extraction function
 */
function main() {
  const args = process.argv.slice(2);
  const sdkPathIndex = args.indexOf("--sdk-path");
  const sdkPath = sdkPathIndex >= 0 ? args[sdkPathIndex + 1] : DEFAULT_SDK_PATH;

  const outputIndex = args.indexOf("--output");
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : DEFAULT_OUTPUT;

  console.log(`\n${"=".repeat(60)}`);
  console.log("📋 Schema Extraction");
  console.log("=".repeat(60));

  try {
    if (!existsSync(sdkPath)) {
      throw new Error(`SDK path not found: ${sdkPath}`);
    }

    console.log(`\n🔍 Scanning: ${sdkPath}`);

    // Find all declaration files
    const declarationFiles = findDeclarationFiles(sdkPath);
    console.log(`   Found ${declarationFiles.length} declaration file(s)`);

    // Extract schemas from all files
    const allSchemas: ExtractedSchema[] = [];
    for (const file of declarationFiles) {
      const schemas = extractSchemasFromFile(file);
      allSchemas.push(...schemas);
    }

    console.log(`   Extracted ${allSchemas.length} schema(s)`);

    // Create schema collection
    const collection: SchemaCollection = {
      extractedAt: new Date().toISOString(),
      sdkPath,
      schemas: allSchemas,
    };

    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Write output
    writeFileSync(outputPath, JSON.stringify(collection, null, 2));
    console.log("\n✅ Schemas extracted:");
    console.log(`   File: ${outputPath}`);
    console.log(`   Total: ${allSchemas.length}`);

    // Print summary by kind
    const byKind = allSchemas.reduce((acc, schema) => {
      acc[schema.kind] = (acc[schema.kind] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log("\n📊 Summary by kind:");
    for (const [kind, count] of Object.entries(byKind)) {
      console.log(`   ${kind}: ${count}`);
    }

    console.log(`\n${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("\n❌ Extraction failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the extraction
main();
