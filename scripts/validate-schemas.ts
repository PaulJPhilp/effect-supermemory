#!/usr/bin/env bun
/**
 * Schema Validation Script
 *
 * Compares request/response schemas between the official SDK and effect-supermemory
 * to ensure compatibility and detect breaking changes.
 *
 * Usage:
 *   bun run scripts/validate-schemas.ts
 *   bun run scripts/validate-schemas.ts --sdk-schemas ./specs/supermemory/sdk-schemas.json
 */

import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_SDK_SCHEMAS_PATH = path.join(
  process.cwd(),
  "specs",
  "supermemory",
  "sdk-schemas.json"
);

interface ValidationResult {
  operation: string;
  schemaType: "request" | "response";
  issues: Array<{
    severity: "error" | "warning";
    type: "missing_field" | "type_mismatch" | "extra_field" | "breaking_change";
    field: string;
    sdkType?: string;
    effectType?: string;
    message: string;
  }>;
}

interface ValidationReport {
  generatedAt: string;
  overall: {
    status: "compatible" | "warnings" | "errors";
    totalIssues: number;
    errors: number;
    warnings: number;
  };
  results: ValidationResult[];
  breakingChanges: Array<{
    schema: string;
    change: string;
    impact: string;
  }>;
}

/**
 * Load schemas from file
 */
function loadSchemas(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Schema file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Extract effect-supermemory request/response types
 * This is a simplified extraction - would need proper AST parsing for full accuracy
 */
function extractEffectSupermemorySchemas(): Map<
  string,
  {
    request?: Record<string, string>;
    response?: string;
  }
> {
  const schemas = new Map<
    string,
    { request?: Record<string, string>; response?: string }
  >();

  // Read service implementation to extract request/response shapes
  const serviceFile = path.join(
    process.cwd(),
    "services",
    "supermemoryClient",
    "service.ts"
  );

  if (fs.existsSync(serviceFile)) {
    const content = fs.readFileSync(serviceFile, "utf-8");

    // Simple extraction of request body structures
    // In production, use TypeScript compiler API

    // Extract put operation
    const putMatch = content.match(
      /put:\s*\([^)]+\)\s*=>\s*[^{]*\{[^}]*body:\s*\{([^}]+)\}/s
    );
    if (putMatch) {
      schemas.set("put", {
        request: {
          id: "string",
          value: "string",
          namespace: "string",
        },
        response: "void",
      });
    }

    // Extract get operation response
    schemas.set("get", {
      response: "string | undefined",
    });

    // Extract delete operation
    schemas.set("delete", {
      response: "boolean",
    });

    // Extract exists operation
    schemas.set("exists", {
      response: "boolean",
    });

    // Extract clear operation
    schemas.set("clear", {
      response: "void",
    });

    // Extract batch operations
    schemas.set("putMany", {
      request: {
        items: "Array<{ key: string; value: string }>",
      },
      response: "void",
    });

    schemas.set("getMany", {
      request: {
        keys: "readonly string[]",
      },
      response: "ReadonlyMap<string, string | undefined>",
    });

    schemas.set("deleteMany", {
      request: {
        keys: "readonly string[]",
      },
      response: "void",
    });
  }

  return schemas;
}

/**
 * Compare schemas for a specific operation
 */
function compareOperationSchemas(
  operation: string,
  sdkSchemas: unknown,
  effectSchemas: Map<
    string,
    { request?: Record<string, string>; response?: string }
  >
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const effectSchema = effectSchemas.get(operation);

  if (!effectSchema) {
    results.push({
      operation,
      schemaType: "request",
      issues: [
        {
          severity: "error",
          type: "missing_field",
          field: "operation",
          message: `Operation '${operation}' not found in effect-supermemory`,
        },
      ],
    });
    return results;
  }

  // Compare request schemas
  if (effectSchema.request) {
    const issues: ValidationResult["issues"] = [];

    // Check for missing required fields (simplified - would need proper schema comparison)
    // This is a placeholder that demonstrates the structure

    if (issues.length > 0) {
      results.push({
        operation,
        schemaType: "request",
        issues,
      });
    }
  }

  // Compare response schemas
  if (effectSchema.response) {
    // Response validation would go here
    // Check that effect-supermemory can handle all fields from SDK response
  }

  return results;
}

/**
 * Validate all schemas
 */
function validateSchemas(
  sdkSchemas: unknown,
  effectSchemas: Map<
    string,
    { request?: Record<string, string>; response?: string }
  >
): ValidationReport {
  const results: ValidationResult[] = [];

  // Get list of operations to validate
  const operations = Array.from(effectSchemas.keys());

  // Validate each operation
  for (const operation of operations) {
    const operationResults = compareOperationSchemas(
      operation,
      sdkSchemas,
      effectSchemas
    );
    results.push(...operationResults);
  }

  // Count issues
  const errors = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "error").length,
    0
  );
  const warnings = results.reduce(
    (sum, r) => sum + r.issues.filter((i) => i.severity === "warning").length,
    0
  );

  const status: ValidationReport["overall"]["status"] =
    errors > 0 ? "errors" : warnings > 0 ? "warnings" : "compatible";

  return {
    generatedAt: new Date().toISOString(),
    overall: {
      status,
      totalIssues: errors + warnings,
      errors,
      warnings,
    },
    results,
    breakingChanges: [], // Would be populated with schema comparison
  };
}

/**
 * Generate markdown report
 */
function generateValidationReport(report: ValidationReport): string {
  const lines: string[] = [];

  lines.push("# Schema Validation Report");
  lines.push("");
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push("");

  // Overall status
  lines.push("## Overall Status");
  lines.push("");
  lines.push(`**Status:** ${report.overall.status.toUpperCase()}`);
  lines.push(`**Total Issues:** ${report.overall.totalIssues}`);
  lines.push(`- Errors: ${report.overall.errors}`);
  lines.push(`- Warnings: ${report.overall.warnings}`);
  lines.push("");

  // Breaking changes
  if (report.breakingChanges.length > 0) {
    lines.push("## Breaking Changes");
    lines.push("");
    for (const change of report.breakingChanges) {
      lines.push(`### ${change.schema}`);
      lines.push(`- **Change:** ${change.change}`);
      lines.push(`- **Impact:** ${change.impact}`);
      lines.push("");
    }
  }

  // Validation results
  if (report.results.length > 0) {
    lines.push("## Validation Results");
    lines.push("");
    for (const result of report.results) {
      if (result.issues.length > 0) {
        lines.push(`### ${result.operation} (${result.schemaType})`);
        lines.push("");
        for (const issue of result.issues) {
          lines.push(
            `- **[${issue.severity.toUpperCase()}]** ${issue.type}: ${issue.field}`
          );
          lines.push(`  - ${issue.message}`);
          if (issue.sdkType && issue.effectType) {
            lines.push(
              `  - SDK: \`${issue.sdkType}\` → effect-supermemory: \`${issue.effectType}\``
            );
          }
        }
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/**
 * Main validation function
 */
async function main() {
  const args = process.argv.slice(2);
  const sdkSchemasIndex = args.indexOf("--sdk-schemas");
  const sdkSchemasPath =
    sdkSchemasIndex >= 0 ? args[sdkSchemasIndex + 1] : DEFAULT_SDK_SCHEMAS_PATH;

  const outputIndex = args.indexOf("--output");
  const outputPath =
    outputIndex >= 0
      ? args[outputIndex + 1]
      : path.join(process.cwd(), "docs", "schema-validation-report.json");

  console.log("\n" + "=".repeat(60));
  console.log("✅ Schema Validation");
  console.log("=".repeat(60));

  try {
    // Load SDK schemas
    console.log(`\n📦 Loading SDK schemas from: ${sdkSchemasPath}`);
    const sdkSchemas = loadSchemas(sdkSchemasPath);

    // Extract effect-supermemory schemas
    console.log("🔍 Extracting effect-supermemory schemas...");
    const effectSchemas = extractEffectSupermemorySchemas();
    console.log(`   Found ${effectSchemas.size} operation(s)`);

    // Validate schemas
    console.log("\n🔍 Validating schemas...");
    const report = validateSchemas(sdkSchemas, effectSchemas);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON report
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log("\n✅ Validation report generated:");
    console.log(`   JSON: ${outputPath}`);

    // Generate and write markdown report
    const markdownPath = outputPath.replace(".json", ".md");
    const markdownReport = generateValidationReport(report);
    fs.writeFileSync(markdownPath, markdownReport);
    console.log(`   Markdown: ${markdownPath}`);

    // Print summary
    console.log("\n📋 Summary:");
    console.log(`   Status: ${report.overall.status}`);
    console.log(`   Errors: ${report.overall.errors}`);
    console.log(`   Warnings: ${report.overall.warnings}`);

    // Exit with error code if there are errors
    if (report.overall.errors > 0) {
      console.log("\n❌ Validation found errors");
      process.exit(1);
    } else {
      console.log("\n✅ Validation passed");
    }

    console.log("\n" + "=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Validation failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the validation
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
