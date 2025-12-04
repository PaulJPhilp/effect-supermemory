#!/usr/bin/env bun
/**
 * OpenAPI Type Generation Script
 *
 * Generates TypeScript types from OpenAPI specifications using openapi-typescript CLI.
 * This script is part of the API synchronization automation strategy.
 *
 * Usage:
 *   bun run scripts/codegen.ts          # Generate types for all configured versions
 *   bun run scripts/codegen.ts v4       # Generate types for specific version
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

type ApiVersion = {
  version: string;
  specFile: string;
  outputDir: string;
};

// Configuration for API versions to generate
const apiVersions: ApiVersion[] = [
  {
    version: "v4",
    specFile: "specs/supermemory/openapi-v4.json",
    outputDir: "src/generated/types/v4",
  },
  // Phase 1: Add v3 and v1
  // {
  //   version: "v3",
  //   specFile: "specs/supermemory/openapi-v3.json",
  //   outputDir: "src/generated/types/v3",
  // },
  // {
  //   version: "v1",
  //   specFile: "specs/supermemory/openapi-v1.json",
  //   outputDir: "src/generated/types/v1",
  // },
];

/**
 * Main codegen function
 */
async function main() {
  const args = process.argv.slice(2);
  const targetVersion = args[0];

  // Filter versions to generate
  const versions = targetVersion
    ? apiVersions.filter((v) => v.version === targetVersion)
    : apiVersions;

  if (targetVersion && versions.length === 0) {
    console.error(`❌ Version "${targetVersion}" not found in configuration`);
    console.error(
      `Available versions: ${apiVersions.map((v) => v.version).join(", ")}`
    );
    process.exit(1);
  }

  let successCount = 0;
  let failureCount = 0;

  for (const apiVersion of versions) {
    try {
      await generateTypes(apiVersion);
      successCount += 1;
    } catch (error) {
      console.error(`\n❌ Failed to generate types for ${apiVersion.version}`);
      console.error(error instanceof Error ? error.message : String(error));
      failureCount += 1;
    }
  }

  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log(`✅ Generated: ${successCount} version(s)`);
  if (failureCount > 0) {
    console.log(`❌ Failed: ${failureCount} version(s)`);
    process.exit(1);
  }
  console.log(`${"=".repeat(60)}\n`);
}

/**
 * Generate types for a specific API version using CLI
 */
async function generateTypes(apiVersion: ApiVersion): Promise<void> {
  const specPath = apiVersion.specFile;
  const outputDir = apiVersion.outputDir;
  const outputFile = join(outputDir, "index.ts");

  // Check if spec file exists
  if (!existsSync(specPath)) {
    throw new Error(`Spec file not found: ${specPath}`);
  }

  console.log(`\n📖 Processing: ${apiVersion.version}`);
  console.log(`   Spec:   ${specPath}`);
  console.log(`   Output: ${outputFile}`);

  // Ensure output directory exists
  mkdirSync(outputDir, { recursive: true });

  return new Promise((resolve, reject) => {
    // Use openapi-typescript CLI via bunx
    const proc = spawn("bunx", [
      "openapi-typescript",
      specPath,
      "-o",
      outputFile,
    ]);

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ Generated ${apiVersion.version} types successfully`);
        console.log(`   File: ${outputFile}`);
        resolve();
      } else {
        reject(new Error(`Failed to generate types: ${stderr || stdout}`));
      }
    });

    proc.on("error", (error) => {
      reject(new Error(`Failed to spawn openapi-typescript: ${error.message}`));
    });
  });
}

// Run the codegen script
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
