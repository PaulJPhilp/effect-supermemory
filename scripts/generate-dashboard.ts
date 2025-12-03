#!/usr/bin/env bun
/**
 * Compatibility Dashboard Generator
 *
 * Generates a comprehensive dashboard showing current compatibility status,
 * SDK version tracking, and recent changes.
 *
 * Usage:
 *   bun run scripts/generate-dashboard.ts
 */

import * as fs from "node:fs";
import * as path from "node:path";

const DASHBOARD_PATH = path.join(
  process.cwd(),
  "docs",
  "compatibility-dashboard.md"
);
const COMPATIBILITY_REPORT_PATH = path.join(
  process.cwd(),
  "docs",
  "compatibility-report.json"
);
const CHANGE_REPORT_PATH = path.join(
  process.cwd(),
  "docs",
  "sdk-change-report.json"
);
const METADATA_PATH = path.join(
  process.cwd(),
  "specs",
  "supermemory",
  "sdk-metadata.json"
);

interface CompatibilityReport {
  generatedAt: string;
  sdkVersion: string;
  compatibility: {
    overall: "compatible" | "partial" | "incompatible";
    score: number;
  };
  summary: {
    totalSdkOperations: number;
    implementedOperations: number;
    missingOperations: number;
    typeIssues: number;
  };
}

interface ChangeReport {
  generatedAt: string;
  packageName: string;
  currentVersion: string;
  previousVersion: string | null;
  status: string;
  changes: {
    breaking: unknown[];
    additions: unknown[];
    modifications: unknown[];
  };
}

interface SdkMetadata {
  packageName: string;
  lastAnalyzedVersion: string | null;
  lastAnalyzedAt: string | null;
  apiSurfaceSnapshots: Array<{
    version: string;
    timestamp: string;
  }>;
}

/**
 * Load JSON file if it exists
 */
function loadJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateString;
  }
}

/**
 * Get status emoji
 */
function getStatusEmoji(status: string): string {
  const statusLower = status.toLowerCase();
  if (
    statusLower.includes("compatible") ||
    statusLower.includes("no_changes")
  ) {
    return "✅";
  }
  if (
    statusLower.includes("partial") ||
    statusLower.includes("changes_detected")
  ) {
    return "⚠️";
  }
  if (statusLower.includes("incompatible") || statusLower.includes("error")) {
    return "❌";
  }
  return "📊";
}

/**
 * Generate dashboard markdown
 */
function generateDashboard(
  compatReport: CompatibilityReport | null,
  changeReport: ChangeReport | null,
  metadata: SdkMetadata | null
): string {
  const lines: string[] = [];

  lines.push("# SDK Compatibility Dashboard");
  lines.push("");
  lines.push(`**Last Updated:** ${new Date().toLocaleString()}`);
  lines.push("");

  // Overall Status
  lines.push("## Overall Status");
  lines.push("");

  if (compatReport) {
    const emoji = getStatusEmoji(compatReport.compatibility.overall);
    lines.push(
      `${emoji} **${compatReport.compatibility.overall.toUpperCase()}**`
    );
    lines.push(`**Compatibility Score:** ${compatReport.compatibility.score}%`);
    lines.push(`**SDK Version:** ${compatReport.sdkVersion}`);
    lines.push(`**Report Generated:** ${formatDate(compatReport.generatedAt)}`);
  } else {
    lines.push("📊 **Status:** Not yet analyzed");
    lines.push("Run compatibility checks to generate status.");
  }

  lines.push("");

  // SDK Tracking
  lines.push("## SDK Version Tracking");
  lines.push("");

  if (metadata) {
    lines.push(`**Package:** ${metadata.packageName}`);
    lines.push(
      `**Last Analyzed Version:** ${metadata.lastAnalyzedVersion || "None"}`
    );
    lines.push(`**Last Analyzed:** ${formatDate(metadata.lastAnalyzedAt)}`);

    if (metadata.apiSurfaceSnapshots.length > 0) {
      lines.push("");
      lines.push(
        `**Tracked Versions:** ${metadata.apiSurfaceSnapshots.length}`
      );
      lines.push("");
      lines.push("Recent versions:");
      lines.push("");
      for (const snapshot of metadata.apiSurfaceSnapshots.slice(-5).reverse()) {
        lines.push(`- ${snapshot.version} (${formatDate(snapshot.timestamp)})`);
      }
    }
  } else {
    lines.push("No SDK metadata found. Run monitoring to track SDK versions.");
  }

  lines.push("");

  // Compatibility Breakdown
  if (compatReport) {
    lines.push("## Compatibility Breakdown");
    lines.push("");
    lines.push(
      `- **Total SDK Operations:** ${compatReport.summary.totalSdkOperations}`
    );
    lines.push(
      `- **Implemented:** ${compatReport.summary.implementedOperations}`
    );
    lines.push(`- **Missing:** ${compatReport.summary.missingOperations}`);
    lines.push(`- **Type Issues:** ${compatReport.summary.typeIssues}`);
    lines.push("");
  }

  // Recent Changes
  if (changeReport) {
    lines.push("## Recent SDK Changes");
    lines.push("");
    lines.push(`**Status:** ${changeReport.status}`);
    lines.push(`**Current Version:** ${changeReport.currentVersion}`);
    lines.push(
      `**Previous Version:** ${changeReport.previousVersion || "None"}`
    );
    lines.push(`**Detected:** ${formatDate(changeReport.generatedAt)}`);
    lines.push("");

    if (changeReport.changes.breaking.length > 0) {
      lines.push(
        `⚠️ **Breaking Changes:** ${changeReport.changes.breaking.length}`
      );
    }
    if (changeReport.changes.additions.length > 0) {
      lines.push(`✨ **Additions:** ${changeReport.changes.additions.length}`);
    }
    if (changeReport.changes.modifications.length > 0) {
      lines.push(
        `🔄 **Modifications:** ${changeReport.changes.modifications.length}`
      );
    }
    lines.push("");
  }

  // Quick Actions
  lines.push("## Quick Actions");
  lines.push("");
  lines.push("```bash");
  lines.push("# Check compatibility status");
  lines.push("bun run compat:check");
  lines.push("");
  lines.push("# View full compatibility report");
  lines.push("bun run compat:report");
  lines.push("");
  lines.push("# Monitor for SDK changes");
  lines.push("bun run compat:monitor");
  lines.push("");
  lines.push("# Run compatibility tests");
  lines.push("bun run test:compatibility");
  lines.push("```");
  lines.push("");

  // Reports
  lines.push("## Reports");
  lines.push("");
  lines.push(
    "- [Compatibility Report](./compatibility-report.md) - Full compatibility analysis"
  );
  lines.push(
    "- [Schema Validation](./schema-validation-report.md) - Type compatibility validation"
  );
  lines.push(
    "- [SDK Changes](./sdk-change-report.md) - Recent SDK version changes"
  );
  lines.push("");

  // Automated Monitoring
  lines.push("## Automated Monitoring");
  lines.push("");
  lines.push("This dashboard is automatically updated by:");
  lines.push("- **Daily Checks:** GitHub Actions runs daily at 2 AM UTC");
  lines.push("- **On Push:** When SDK metadata or API specs change");
  lines.push("- **Manual Trigger:** Via GitHub Actions workflow_dispatch");
  lines.push("");
  lines.push("Breaking changes automatically create GitHub issues for review.");
  lines.push("");

  return lines.join("\n");
}

/**
 * Main dashboard generation function
 */
async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("📊 Compatibility Dashboard Generator");
  console.log("=".repeat(60));

  try {
    // Load all reports
    console.log("\n📋 Loading reports...");
    const compatReport = loadJsonFile<CompatibilityReport>(
      COMPATIBILITY_REPORT_PATH
    );
    const changeReport = loadJsonFile<ChangeReport>(CHANGE_REPORT_PATH);
    const metadata = loadJsonFile<SdkMetadata>(METADATA_PATH);

    if (compatReport) {
      console.log("   ✅ Compatibility report loaded");
    } else {
      console.log("   ⚠️  Compatibility report not found");
    }

    if (changeReport) {
      console.log("   ✅ Change report loaded");
    } else {
      console.log("   ⚠️  Change report not found");
    }

    if (metadata) {
      console.log("   ✅ SDK metadata loaded");
    } else {
      console.log("   ⚠️  SDK metadata not found");
    }

    // Generate dashboard
    console.log("\n📊 Generating dashboard...");
    const dashboard = generateDashboard(compatReport, changeReport, metadata);

    // Ensure output directory exists
    const outputDir = path.dirname(DASHBOARD_PATH);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write dashboard
    fs.writeFileSync(DASHBOARD_PATH, dashboard);
    console.log(`\n✅ Dashboard generated:`);
    console.log(`   File: ${DASHBOARD_PATH}`);

    console.log("\n" + "=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Dashboard generation failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run dashboard generation
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
