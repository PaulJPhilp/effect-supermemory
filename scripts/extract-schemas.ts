#!/usr/bin/env bun
/** biome-ignore-all assist/source/organizeImports: <> */

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

import { stringifyJson } from "@/utils/json.js";
import { Effect } from "effect";
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
 * Extract properties from an interface body string.
 */
function extractInterfaceProperties(
  body: string
): ExtractedSchema["properties"] {
  const properties: ExtractedSchema["properties"] = [];
  const propertyRegex = /(\w+\??)\s*:\s*([^;]+);/g;
  let propMatch: RegExpExecArray | null = null;

  propMatch = propertyRegex.exec(body);
  while (propMatch !== null) {
    const nameMatch = propMatch[1];
    const typeMatch = propMatch[2];
    if (nameMatch !== undefined && typeMatch !== undefined) {
      properties.push({
        name: nameMatch.replace("?", ""),
        type: typeMatch.trim(),
        optional: nameMatch.includes("?"),
      });
    }
    propMatch = propertyRegex.exec(body);
  }

  return properties;
}

/**
 * Extract interfaces from TypeScript content.
 */
function extractInterfaces(content: string): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = [];
  const interfaceRegex =
    /(?:export\s+)?interface\s+(\w+)(?:<[^>]*>)?\s*\{([^}]+)\}/gs;
  let match: RegExpExecArray | null = null;

  match = interfaceRegex.exec(content);
  while (match !== null) {
    const name = match[1];
    const body = match[2];

    if (name !== undefined && body !== undefined) {
      const properties = extractInterfaceProperties(body);
      schemas.push({
        name,
        kind: "interface",
        properties,
      });
    }
    match = interfaceRegex.exec(content);
  }

  return schemas;
}

/**
 * Extract type aliases from TypeScript content.
 */
function extractTypeAliases(content: string): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = [];
  const typeRegex = /(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=\s*([^;]+);/gs;
  let match: RegExpExecArray | null = null;

  match = typeRegex.exec(content);
  while (match !== null) {
    const typeName = match[1];
    const typeValue = match[2];
    if (typeName !== undefined && typeValue !== undefined) {
      schemas.push({
        name: typeName,
        kind: "type",
        properties: [
          {
            name: "value",
            type: typeValue.trim(),
            optional: false,
          },
        ],
      });
    }
    match = typeRegex.exec(content);
  }

  return schemas;
}

/**
 * Extract enum members from an enum body string.
 */
function extractEnumMembers(body: string): ExtractedSchema["properties"] {
  const properties: ExtractedSchema["properties"] = [];
  const enumMemberRegex = /(\w+)(?:\s*=\s*([^,\n]+))?/g;
  let enumMatch: RegExpExecArray | null = null;

  enumMatch = enumMemberRegex.exec(body);
  while (enumMatch !== null) {
    const memberName = enumMatch[1];
    if (memberName !== undefined) {
      properties.push({
        name: memberName,
        type: enumMatch[2]?.trim() || "string",
        optional: false,
      });
    }
    enumMatch = enumMemberRegex.exec(body);
  }

  return properties;
}

/**
 * Extract enums from TypeScript content.
 */
function extractEnums(content: string): ExtractedSchema[] {
  const schemas: ExtractedSchema[] = [];
  const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]+)\}/gs;
  let match: RegExpExecArray | null = null;

  match = enumRegex.exec(content);
  while (match !== null) {
    const name = match[1];
    const body = match[2];

    if (name !== undefined && body !== undefined) {
      const properties = extractEnumMembers(body);
      schemas.push({
        name,
        kind: "enum",
        properties,
      });
    }
    match = enumRegex.exec(content);
  }

  return schemas;
}

/**
 * Extract schemas from a TypeScript declaration file.
 * This is a simplified parser - for production, use TypeScript compiler API
 * or ts-morph for accurate parsing.
 */
function extractSchemasFromFile(filePath: string): ExtractedSchema[] {
  const content = readFileSync(filePath, "utf-8");

  // Simple regex-based extraction
  // In production, use @typescript/compiler-api or ts-morph

  const schemas: ExtractedSchema[] = [];
  schemas.push(...extractInterfaces(content));
  schemas.push(...extractTypeAliases(content));
  schemas.push(...extractEnums(content));

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
async function main() {
  const args = process.argv.slice(2);
  const sdkPathIndex = args.indexOf("--sdk-path");
  const sdkPathArg = sdkPathIndex >= 0 ? args[sdkPathIndex + 1] : undefined;
  const sdkPath: string =
    sdkPathArg !== undefined ? sdkPathArg : DEFAULT_SDK_PATH;

  const outputIndex = args.indexOf("--output");
  const outputPathArg = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
  const outputPath: string =
    outputPathArg !== undefined ? outputPathArg : DEFAULT_OUTPUT;

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
    const jsonOutput = await Effect.runPromise(
      stringifyJson(collection, { indent: 2 })
    );
    writeFileSync(outputPath, jsonOutput);
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
main().catch((error) => {
  console.error("\n❌ Extraction failed:");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
