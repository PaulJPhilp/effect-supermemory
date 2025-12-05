#!/usr/bin/env bun

/**
 * SDK Change Monitoring Script
 *
 * Monitors the npm registry for new versions of the official Supermemory SDK
 * and compares API surfaces to detect changes.
 *
 * Usage:
 *   bun run scripts/monitor-sdk-changes.ts
 *   bun run scripts/monitor-sdk-changes.ts --package supermemory
 *   bun run scripts/monitor-sdk-changes.ts --force  # Force re-analysis
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const SDK_PACKAGE_NAME = "supermemory";
const METADATA_FILE = path.join(
  process.cwd(),
  "specs",
  "supermemory",
  "sdk-metadata.json"
);
const SDK_API_FILE = path.join(
  process.cwd(),
  "specs",
  "supermemory",
  "sdk-api.json"
);

type SdkMetadata = {
  packageName: string;
  lastAnalyzedVersion: string | null;
  lastAnalyzedAt: string | null;
  apiSurfaceSnapshots: Array<{
    version: string;
    timestamp: string;
    apiSurfacePath?: string;
  }>;
  notes?: string;
};

type ChangeReport = {
  generatedAt: string;
  packageName: string;
  currentVersion: string;
  previousVersion: string | null;
  status: "new_version" | "changes_detected" | "no_changes" | "error";
  changes: {
    breaking: Array<{
      type: "removed_operation" | "signature_change" | "type_change";
      operation?: string;
      description: string;
    }>;
    additions: Array<{
      type: "new_operation" | "new_parameter" | "new_type";
      operation?: string;
      description: string;
    }>;
    modifications: Array<{
      type: "parameter_change" | "type_modification";
      operation?: string;
      description: string;
    }>;
  };
  compatibilityImpact?: {
    score: number;
    missingOperations: number;
    typeIssues: number;
  };
};

/**
 * Load SDK metadata
 */
function loadMetadata(): SdkMetadata {
  if (!fs.existsSync(METADATA_FILE)) {
    return {
      packageName: SDK_PACKAGE_NAME,
      lastAnalyzedVersion: null,
      lastAnalyzedAt: null,
      apiSurfaceSnapshots: [],
    };
  }

  const content = fs.readFileSync(METADATA_FILE, "utf-8");
  return JSON.parse(content) as SdkMetadata;
}

/**
 * Save SDK metadata
 */
function saveMetadata(metadata: SdkMetadata): void {
  const dir = path.dirname(METADATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

/**
 * Get latest version from npm registry
 */
async function getLatestVersion(packageName: string): Promise<string> {
  const url = `https://registry.npmjs.org/${packageName}/latest`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch package info: ${response.statusText}`);
    }

    const data = (await response.json()) as { version: string };
    return data.version;
  } catch (error) {
    throw new Error(`Failed to get latest version: ${error}`);
  }
}

/**
 * Extract SDK API surface for a specific version
 */
async function extractApiSurface(version: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`Extracting API surface for version ${version}...`);

    const proc = spawn(
      "bun",
      ["run", "scripts/extract-sdk-api.ts", "--version", version],
      {
        stdio: "inherit",
      }
    );

    proc.on("close", (code) => {
      resolve(code === 0);
    });

    proc.on("error", () => {
      resolve(false);
    });
  });
}

/**
 * Compare two API surface files
 */
function compareApiSurfaceFiles(
  oldApiPath: string,
  newApiPath: string
): ChangeReport["changes"] {
  if (!(fs.existsSync(oldApiPath) && fs.existsSync(newApiPath))) {
    return {
      breaking: [],
      additions: [],
      modifications: [],
    };
  }

  const oldApi = JSON.parse(fs.readFileSync(oldApiPath, "utf-8")) as {
    exports?: {
      classes?: Array<{ name: string; methods?: Array<{ name: string }> }>;
      functions?: Array<{ name: string }>;
    };
  };

  const newApi = JSON.parse(fs.readFileSync(newApiPath, "utf-8")) as {
    exports?: {
      classes?: Array<{ name: string; methods?: Array<{ name: string }> }>;
      functions?: Array<{ name: string }>;
    };
  };

  const changes: ChangeReport["changes"] = {
    breaking: [],
    additions: [],
    modifications: [],
  };

  // Extract operation names from both
  const oldOps = new Set<string>();
  const newOps = new Set<string>();

  // Extract from old API
  if (oldApi.exports?.classes) {
    for (const cls of oldApi.exports.classes) {
      if (cls.methods) {
        for (const method of cls.methods) {
          oldOps.add(`${cls.name}.${method.name}`);
        }
      }
    }
  }
  if (oldApi.exports?.functions) {
    for (const func of oldApi.exports.functions) {
      oldOps.add(func.name);
    }
  }

  // Extract from new API
  if (newApi.exports?.classes) {
    for (const cls of newApi.exports.classes) {
      if (cls.methods) {
        for (const method of cls.methods) {
          newOps.add(`${cls.name}.${method.name}`);
        }
      }
    }
  }
  if (newApi.exports?.functions) {
    for (const func of newApi.exports.functions) {
      newOps.add(func.name);
    }
  }

  // Find removed operations (breaking)
  for (const op of oldOps) {
    if (!newOps.has(op)) {
      changes.breaking.push({
        type: "removed_operation",
        operation: op,
        description: `Operation "${op}" was removed in new version`,
      });
    }
  }

  // Find new operations (additions)
  for (const op of newOps) {
    if (!oldOps.has(op)) {
      changes.additions.push({
        type: "new_operation",
        operation: op,
        description: `New operation "${op}" added in new version`,
      });
    }
  }

  return changes;
}

/**
 * Run compatibility comparison
 */
async function runCompatibilityCheck(): Promise<
  ChangeReport["compatibilityImpact"] | undefined
> {
  try {
    // Run comparison script
    const compatReportPath = path.join(
      process.cwd(),
      "docs",
      "compatibility-report.json"
    );

    const proc = spawn("bun", ["run", "scripts/compare-api-surface.ts"], {
      stdio: "pipe",
    });

    await new Promise<void>((resolve) => {
      proc.on("close", () => resolve());
    });

    if (fs.existsSync(compatReportPath)) {
      const report = JSON.parse(fs.readFileSync(compatReportPath, "utf-8")) as {
        compatibility?: { score?: number };
        summary?: {
          missingOperations?: number;
          typeIssues?: number;
        };
      };

      return {
        score: report.compatibility?.score || 0,
        missingOperations: report.summary?.missingOperations || 0,
        typeIssues: report.summary?.typeIssues || 0,
      };
    }
  } catch {
    // Comparison failed - return undefined
  }

  return;
}

/**
 * Generate change report
 */
async function generateChangeReport(
  packageName: string,
  currentVersion: string,
  previousVersion: string | null,
  _force: boolean
): Promise<ChangeReport> {
  let changes: ChangeReport["changes"] = {
    breaking: [],
    additions: [],
    modifications: [],
  };

  let status: ChangeReport["status"] = "new_version";

  // If we have a previous version, compare API surfaces
  if (previousVersion) {
    const oldApiPath = path.join(
      process.cwd(),
      "specs",
      "supermemory",
      `sdk-api-${previousVersion}.json`
    );
    const newApiPath = SDK_API_FILE;

    // Extract new API surface
    const extracted = await extractApiSurface(currentVersion);
    if (!extracted) {
      return {
        generatedAt: new Date().toISOString(),
        packageName,
        currentVersion,
        previousVersion,
        status: "error",
        changes: {
          breaking: [],
          additions: [],
          modifications: [],
        },
      };
    }

    // Save copy of old API surface for comparison
    let oldApiPathToUse = oldApiPath;
    if (!fs.existsSync(oldApiPath) && fs.existsSync(SDK_API_FILE)) {
      // Use current API file as old version
      oldApiPathToUse = SDK_API_FILE;
    }

    // Compare if we have both
    if (fs.existsSync(oldApiPathToUse) && fs.existsSync(newApiPath)) {
      changes = compareApiSurfaceFiles(oldApiPathToUse, newApiPath);

      if (
        changes.breaking.length === 0 &&
        changes.additions.length === 0 &&
        changes.modifications.length === 0
      ) {
        status = "no_changes";
      } else {
        status = "changes_detected";
      }
    } else {
      status = "new_version";
    }

    // Save snapshot of new API for next comparison
    if (fs.existsSync(newApiPath)) {
      const snapshotPath = path.join(
        process.cwd(),
        "specs",
        "supermemory",
        `sdk-api-${currentVersion}.json`
      );
      fs.copyFileSync(newApiPath, snapshotPath);
    }
  } else {
    // First time analysis - extract API surface
    const extracted = await extractApiSurface(currentVersion);
    if (!extracted) {
      status = "error";
    }
  }

  // Run compatibility check to see impact
  const compatibilityImpact = await runCompatibilityCheck();

  return {
    generatedAt: new Date().toISOString(),
    packageName,
    currentVersion,
    previousVersion,
    status,
    changes,
    compatibilityImpact,
  };
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: ChangeReport): string {
  const lines: string[] = [];

  lines.push("# SDK Change Report");
  lines.push("");
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**Package:** ${report.packageName}`);
  lines.push(`**Current Version:** ${report.currentVersion}`);
  lines.push(`**Previous Version:** ${report.previousVersion || "none"}`);
  lines.push("");

  // Status
  lines.push("## Status");
  lines.push("");
  const statusEmoji =
    report.status === "new_version"
      ? "🆕"
      : report.status === "changes_detected"
        ? "🔔"
        : report.status === "no_changes"
          ? "✅"
          : "❌";
  lines.push(`${statusEmoji} **${report.status.toUpperCase()}**`);
  lines.push("");

  // Compatibility impact
  if (report.compatibilityImpact) {
    lines.push("## Compatibility Impact");
    lines.push("");
    lines.push(
      `**Current Compatibility Score:** ${report.compatibilityImpact.score}%`
    );
    lines.push(
      `**Missing Operations:** ${report.compatibilityImpact.missingOperations}`
    );
    lines.push(`**Type Issues:** ${report.compatibilityImpact.typeIssues}`);
    lines.push("");
  }

  // Breaking changes
  if (report.changes.breaking.length > 0) {
    lines.push("## ⚠️ Breaking Changes");
    lines.push("");
    for (const change of report.changes.breaking) {
      lines.push(`### ${change.type}`);
      lines.push(`- ${change.description}`);
      if (change.operation) {
        lines.push(`  - Operation: \`${change.operation}\``);
      }
      lines.push("");
    }
  }

  // Additions
  if (report.changes.additions.length > 0) {
    lines.push("## ✨ Additions");
    lines.push("");
    lines.push("New operations or features added in this version:");
    lines.push("");
    for (const change of report.changes.additions) {
      lines.push(`- **${change.type}:** ${change.description}`);
      if (change.operation) {
        lines.push(`  - Operation: \`${change.operation}\``);
      }
      lines.push("");
    }
  }

  // Modifications
  if (report.changes.modifications.length > 0) {
    lines.push("## 🔄 Modifications");
    lines.push("");
    for (const change of report.changes.modifications) {
      lines.push(`- **${change.type}:** ${change.description}`);
      if (change.operation) {
        lines.push(`  - Operation: \`${change.operation}\``);
      }
      lines.push("");
    }
  }

  if (
    report.changes.breaking.length === 0 &&
    report.changes.additions.length === 0 &&
    report.changes.modifications.length === 0 &&
    report.status !== "error"
  ) {
    lines.push("✅ No API changes detected.");
    lines.push("");
  }

  // Recommendations
  if (report.status === "changes_detected" || report.status === "new_version") {
    lines.push("## Recommended Actions");
    lines.push("");
    if (report.changes.breaking.length > 0) {
      lines.push(
        "1. ⚠️ **Breaking changes detected** - Review and update effect-supermemory"
      );
      lines.push("2. Run compatibility tests: `bun run test:compatibility`");
      lines.push("3. Update implementation to support new operations");
    } else if (report.changes.additions.length > 0) {
      lines.push(
        "1. ✨ **New operations available** - Consider adding to effect-supermemory"
      );
      lines.push("2. Review new operations for compatibility");
      lines.push("3. Run compatibility tests: `bun run test:compatibility`");
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Main monitoring function
 */
async function main() {
  const args = process.argv.slice(2);
  const packageIndex = args.indexOf("--package");
  const packageName =
    packageIndex >= 0 ? args[packageIndex + 1] : SDK_PACKAGE_NAME;

  const force = args.includes("--force");

  const outputIndex = args.indexOf("--output");
  const outputPath =
    outputIndex >= 0
      ? args[outputIndex + 1]
      : path.join(process.cwd(), "docs", "sdk-change-report.json");

  console.log(`\n${"=".repeat(60)}`);
  console.log("📦 SDK Change Monitoring");
  console.log("=".repeat(60));

  try {
    // Load metadata
    const metadata = loadMetadata();
    console.log(`\n📋 Package: ${packageName}`);
    console.log(`   Last analyzed: ${metadata.lastAnalyzedVersion || "never"}`);

    // Get latest version
    console.log("\n🔍 Checking for new versions...");
    const latestVersion = await getLatestVersion(packageName);
    console.log(`   Latest version: ${latestVersion}`);

    // Check if we've analyzed this version
    if (!force && metadata.lastAnalyzedVersion === latestVersion) {
      console.log("\n✅ Already analyzed latest version");
      console.log("   Use --force to re-analyze.");
      console.log(`\n${"=".repeat(60)}\n`);
      return;
    }

    // Generate change report
    console.log("\n📊 Analyzing changes...");
    const report = await generateChangeReport(
      packageName,
      latestVersion,
      metadata.lastAnalyzedVersion,
      force
    );

    // Update metadata
    metadata.lastAnalyzedVersion = latestVersion;
    metadata.lastAnalyzedAt = new Date().toISOString();

    // Add to snapshots if not already present
    const existingSnapshot = metadata.apiSurfaceSnapshots.find(
      (s) => s.version === latestVersion
    );
    if (!existingSnapshot) {
      metadata.apiSurfaceSnapshots.push({
        version: latestVersion,
        timestamp: metadata.lastAnalyzedAt,
        apiSurfacePath: SDK_API_FILE,
      });
    }

    // Keep only last 10 snapshots
    if (metadata.apiSurfaceSnapshots.length > 10) {
      metadata.apiSurfaceSnapshots = metadata.apiSurfaceSnapshots.slice(-10);
    }

    saveMetadata(metadata);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON report
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log("\n✅ Change report generated:");
    console.log(`   JSON: ${outputPath}`);

    // Generate and write markdown report
    const markdownPath = outputPath.replace(".json", ".md");
    const markdownReport = generateMarkdownReport(report);
    fs.writeFileSync(markdownPath, markdownReport);
    console.log(`   Markdown: ${markdownPath}`);

    // Print summary
    console.log("\n📋 Summary:");
    console.log(`   Status: ${report.status}`);
    console.log(`   Breaking Changes: ${report.changes.breaking.length}`);
    console.log(`   Additions: ${report.changes.additions.length}`);
    console.log(`   Modifications: ${report.changes.modifications.length}`);

    if (report.compatibilityImpact) {
      console.log("\n📊 Compatibility Impact:");
      console.log(`   Score: ${report.compatibilityImpact.score}%`);
      console.log(
        `   Missing Operations: ${report.compatibilityImpact.missingOperations}`
      );
    }

    // Exit with error code if breaking changes detected
    if (report.changes.breaking.length > 0) {
      console.log("\n⚠️ Breaking changes detected!");
      console.log(
        "   Review the change report and update effect-supermemory accordingly."
      );
      process.exit(1);
    }

    console.log(`\n${"=".repeat(60)}\n`);
  } catch (error) {
    console.error("\n❌ Monitoring failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the monitoring
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
