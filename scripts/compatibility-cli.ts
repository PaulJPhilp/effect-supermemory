#!/usr/bin/env bun
/**
 * Compatibility CLI Tool
 *
 * Interactive command-line tool for checking SDK compatibility,
 * diffing SDK versions, and generating migration guides.
 *
 * Usage:
 *   bun run scripts/compatibility-cli.ts check
 *   bun run scripts/compatibility-cli.ts diff --version1 1.0.0 --version2 1.1.0
 *   bun run scripts/compatibility-cli.ts report
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SDK_PACKAGE_NAME = "supermemory";
const _METADATA_FILE = join(
  process.cwd(),
  "specs",
  "supermemory",
  "sdk-metadata.json"
);

type CliCommand = {
  name: string;
  description: string;
  handler: (args: string[]) => void | Promise<void>;
};

/**
 * Check compatibility status
 */
function checkCompatibility(_args: string[]): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("🔍 Compatibility Check");
  console.log("=".repeat(60));

  const compatReportPath = join(
    process.cwd(),
    "docs",
    "compatibility-report.json"
  );

  if (!existsSync(compatReportPath)) {
    console.log("\n⚠️  No compatibility report found.");
    console.log("   Run: bun run scripts/compare-api-surface.ts");
    console.log(`\n${"=".repeat(60)}\n`);
    return;
  }

  const report = JSON.parse(readFileSync(compatReportPath, "utf-8")) as {
    compatibility: { overall: string; score: number };
    summary: {
      totalSdkOperations: number;
      implementedOperations: number;
      missingOperations: number;
    };
  };

  console.log("\n📊 Compatibility Status:");
  console.log(`   Overall: ${report.compatibility.overall.toUpperCase()}`);
  console.log(`   Score: ${report.compatibility.score}%`);
  console.log("\n📋 Operations:");
  console.log(`   Total SDK: ${report.summary.totalSdkOperations}`);
  console.log(`   Implemented: ${report.summary.implementedOperations}`);
  console.log(`   Missing: ${report.summary.missingOperations}`);

  if (report.compatibility.score < 100) {
    console.log("\n⚠️  Some operations are missing from effect-supermemory");
    console.log("   Review the full report for details.");
  } else {
    console.log("\n✅ Full compatibility achieved!");
  }

  console.log(`\n${"=".repeat(60)}\n`);
}

/**
 * Diff two SDK versions
 */
function diffVersions(args: string[]): void {
  const version1Index = args.indexOf("--version1");
  const version2Index = args.indexOf("--version2");

  if (version1Index === -1 || version2Index === -1) {
    console.error("Usage: diff --version1 <version1> --version2 <version2>");
    process.exit(1);
  }

  const version1 = args[version1Index + 1];
  const version2 = args[version2Index + 1];

  console.log(`\n${"=".repeat(60)}`);
  console.log("📊 SDK Version Diff");
  console.log("=".repeat(60));

  console.log(`\n📦 Package: ${SDK_PACKAGE_NAME}`);
  console.log(`   Version 1: ${version1}`);
  console.log(`   Version 2: ${version2}`);

  // This would extract and compare the two versions
  // For now, show placeholder
  console.log("\n⚠️  Version diff not yet implemented.");
  console.log("   Requires extracting API surfaces from both versions.");

  console.log(`\n${"=".repeat(60)}\n`);
}

/**
 * Show compatibility report
 */
function showReport(_args: string[]): void {
  const reportPath = join(process.cwd(), "docs", "compatibility-report.md");

  if (!existsSync(reportPath)) {
    console.error(
      "Compatibility report not found. Run compatibility checks first."
    );
    process.exit(1);
  }

  const report = readFileSync(reportPath, "utf-8");
  console.log(report);
}

/**
 * Show help
 */
function showHelp(): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log("Compatibility CLI Tool");
  console.log("=".repeat(60));
  console.log("\nCommands:");
  console.log("  check                    Check current compatibility status");
  console.log("  diff                     Diff two SDK versions");
  console.log("  report                   Show full compatibility report");
  console.log("  help                     Show this help message");
  console.log("\nExamples:");
  console.log("  bun run scripts/compatibility-cli.ts check");
  console.log(
    "  bun run scripts/compatibility-cli.ts diff --version1 1.0.0 --version2 1.1.0"
  );
  console.log("  bun run scripts/compatibility-cli.ts report");
  console.log(`\n${"=".repeat(60)}\n`);
}

/**
 * Main CLI function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const commands: CliCommand[] = [
    {
      name: "check",
      description: "Check compatibility status",
      handler: checkCompatibility,
    },
    {
      name: "diff",
      description: "Diff two SDK versions",
      handler: diffVersions,
    },
    {
      name: "report",
      description: "Show compatibility report",
      handler: showReport,
    },
  ];

  if (
    !command ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    showHelp();
    return;
  }

  const cmd = commands.find((c) => c.name === command);

  if (!cmd) {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  try {
    await cmd.handler(args.slice(1));
  } catch (error) {
    console.error(`Error executing command: ${error}`);
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
