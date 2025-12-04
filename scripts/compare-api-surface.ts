#!/usr/bin/env bun
/**
 * API Surface Comparison Script
 *
 * Compares the effect-supermemory API surface with the official Supermemory SDK
 * to identify missing operations, type mismatches, and compatibility issues.
 *
 * Usage:
 *   bun run scripts/compare-api-surface.ts
 *   bun run scripts/compare-api-surface.ts --sdk-api ./specs/supermemory/sdk-api.json
 *   bun run scripts/compare-api-surface.ts --output ./compatibility-report.json
 */

import * as fs from "node:fs";
import * as path from "node:path";

const DEFAULT_SDK_API_PATH = path.join(
  process.cwd(),
  "specs",
  "supermemory",
  "sdk-api.json"
);
const DEFAULT_OUTPUT_PATH = path.join(
  process.cwd(),
  "docs",
  "compatibility-report.json"
);

interface Operation {
  name: string;
  service?: string;
  parameters: Array<{ name: string; type: string; optional: boolean }>;
  returnType: string;
  description?: string;
}

interface ComparisonReport {
  generatedAt: string;
  sdkVersion: string;
  compatibility: {
    overall: "compatible" | "partial" | "incompatible";
    score: number; // 0-100
  };
  missingOperations: Array<{
    operation: string;
    service?: string;
    method?: string;
    description?: string;
    priority: "high" | "medium" | "low";
    suggestedMapping?: string;
  }>;
  extraOperations: Array<{
    operation: string;
    service: string;
    description?: string;
  }>;
  mappedOperations: Array<{
    sdkOperation: string;
    effectOperation: string;
    confidence: "high" | "medium" | "low";
    notes?: string;
  }>;
  typeMismatches: Array<{
    operation: string;
    parameter: string;
    sdkType: string;
    effectType: string;
    severity: "breaking" | "warning" | "info";
    notes?: string;
  }>;
  parameterDifferences: Array<{
    operation: string;
    missingParams: Array<{ name: string; type: string; optional: boolean }>;
    extraParams: Array<{ name: string; type: string }>;
    severity: "breaking" | "warning";
  }>;
  returnTypeDifferences: Array<{
    operation: string;
    sdkReturnType: string;
    effectReturnType: string;
    severity: "breaking" | "warning" | "info";
  }>;
  summary: {
    totalSdkOperations: number;
    implementedOperations: number;
    missingOperations: number;
    mappedOperations: number;
    typeIssues: number;
    parameterIssues: number;
  };
}

/**
 * Parse parameters from a function signature
 */
function parseParameters(paramString: string): Array<{
  name: string;
  type: string;
  optional: boolean;
}> {
  const parameters: Array<{ name: string; type: string; optional: boolean }> =
    [];

  if (!paramString.trim()) {
    return parameters;
  }

  // Simple parameter parsing (handles most common cases)
  const params = paramString
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  for (const param of params) {
    // Handle optional: param?: type
    // Handle default: param: type = value
    // Handle destructured: { prop: type }

    const colonIndex = param.indexOf(":");
    if (colonIndex > 0) {
      const namePart = param.substring(0, colonIndex).trim();
      const typePart = param
        .substring(colonIndex + 1)
        .trim()
        .replace(/=\s*[^,]+/, "")
        .trim();
      const optional = namePart.endsWith("?");
      const name = optional ? namePart.slice(0, -1) : namePart;

      parameters.push({
        name,
        type: typePart,
        optional,
      });
    } else if (param) {
      // Parameter without explicit type
      parameters.push({
        name: param.replace("?", ""),
        type: "unknown",
        optional: param.includes("?"),
      });
    }
  }

  return parameters;
}

/**
 * Extract effect-supermemory API surface from service definitions
 */
function extractEffectSupermemoryApi(): {
  operations: Operation[];
  services: Array<{ name: string; operations: Operation[] }>;
} {
  const operations: Operation[] = [];
  const services: Array<{ name: string; operations: Operation[] }> = [];

  // Extract from SupermemoryClient
  const supermemoryClientFile = path.join(
    process.cwd(),
    "services",
    "supermemoryClient",
    "api.ts"
  );

  if (fs.existsSync(supermemoryClientFile)) {
    const content = fs.readFileSync(supermemoryClientFile, "utf-8");
    const serviceOps: Operation[] = [];

    // Extract method signatures
    const methodRegex =
      /readonly\s+(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*Effect\.Effect<([^,>]+)/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const params = match[2] || "";
      const returnType = match[3].trim();

      const parameters = parseParameters(params);

      const op: Operation = {
        name: methodName,
        service: "SupermemoryClient",
        parameters,
        returnType,
      };

      operations.push(op);
      serviceOps.push(op);
    }

    services.push({ name: "SupermemoryClient", operations: serviceOps });
  }

  // Extract from SearchClient if it exists
  const searchClientFile = path.join(
    process.cwd(),
    "services",
    "searchClient",
    "api.ts"
  );

  if (fs.existsSync(searchClientFile)) {
    const content = fs.readFileSync(searchClientFile, "utf-8");
    const serviceOps: Operation[] = [];

    const methodRegex =
      /readonly\s+(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*Effect\.Effect<([^,>]+)/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const params = match[2] || "";
      const returnType = match[3].trim();

      const op: Operation = {
        name: methodName,
        service: "SearchClient",
        parameters,
        returnType,
      };

      operations.push(op);
      serviceOps.push(op);
    }

    services.push({ name: "SearchClient", operations: serviceOps });
  }

  // Extract from MemoryStreamClient if it exists
  const streamClientFile = path.join(
    process.cwd(),
    "services",
    "memoryStreamClient",
    "api.ts"
  );

  if (fs.existsSync(streamClientFile)) {
    const content = fs.readFileSync(streamClientFile, "utf-8");
    const serviceOps: Operation[] = [];

    const methodRegex =
      /readonly\s+(\w+)\s*:\s*\(([^)]*)\)\s*=>\s*Effect\.Effect<([^,>]+)/g;
    let match;

    while ((match = methodRegex.exec(content)) !== null) {
      const methodName = match[1];
      const params = match[2] || "";
      const returnType = match[3].trim();

      const op: Operation = {
        name: methodName,
        service: "MemoryStreamClient",
        parameters,
        returnType,
      };

      operations.push(op);
      serviceOps.push(op);
    }

    services.push({ name: "MemoryStreamClient", operations: serviceOps });
  }

  return { operations, services };
}

/**
 * Load SDK API surface from extracted JSON
 */
function loadSdkApiSurface(filePath: string): unknown {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `SDK API file not found: ${filePath}. Run 'bun run compat:extract' first.`
    );
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(content);
}

/**
 * Normalize operation names for comparison
 */
function normalizeOperationName(name: string): string {
  return name.toLowerCase().replace(/[_-]/g, "");
}

/**
 * Map SDK operations to effect-supermemory operations
 */
function mapOperations(
  sdkOps: Operation[],
  effectOps: Operation[]
): Array<{
  sdkOp: Operation;
  effectOp?: Operation;
  confidence: "high" | "medium" | "low";
  notes?: string;
}> {
  const mappings: Array<{
    sdkOp: Operation;
    effectOp?: Operation;
    confidence: "high" | "medium" | "low";
    notes?: string;
  }> = [];

  const effectOpsByName = new Map<string, Operation>();
  const effectOpsNormalized = new Map<string, Operation>();

  for (const op of effectOps) {
    effectOpsByName.set(op.name, op);
    effectOpsNormalized.set(normalizeOperationName(op.name), op);
  }

  // Known mappings
  const knownMappings: Record<string, string> = {
    create: "put",
    put: "put",
    get: "get",
    retrieve: "get",
    delete: "delete",
    remove: "delete",
    exists: "exists",
    has: "exists",
    clear: "clear",
    batch: "putMany",
    batchCreate: "putMany",
    batchGet: "getMany",
    batchDelete: "deleteMany",
    search: "search",
    query: "search",
  };

  for (const sdkOp of sdkOps) {
    // Try exact match first
    let effectOp = effectOpsByName.get(sdkOp.name);
    let confidence: "high" | "medium" | "low" = "high";
    let notes: string | undefined;

    if (!effectOp) {
      // Try normalized match
      const normalized = normalizeOperationName(sdkOp.name);
      effectOp = effectOpsNormalized.get(normalized);
      confidence = "medium";
    }

    if (!effectOp && knownMappings[sdkOp.name]) {
      // Try known mapping
      const mappedName = knownMappings[sdkOp.name];
      effectOp = effectOpsByName.get(mappedName);
      confidence = "medium";
      notes = `Mapped from SDK "${sdkOp.name}" to effect-supermemory "${mappedName}"`;
    }

    if (!effectOp) {
      // Try partial match
      for (const [normalized, op] of effectOpsNormalized.entries()) {
        if (
          normalized.includes(normalizeOperationName(sdkOp.name)) ||
          normalizeOperationName(sdkOp.name).includes(normalized)
        ) {
          effectOp = op;
          confidence = "low";
          notes = "Possible match based on name similarity";
          break;
        }
      }
    }

    mappings.push({
      sdkOp,
      effectOp,
      confidence,
      notes,
    });
  }

  return mappings;
}

/**
 * Compare parameter lists
 */
function compareParameters(
  sdkParams: Array<{ name: string; type: string; optional: boolean }>,
  effectParams: Array<{ name: string; type: string; optional: boolean }>
): {
  missing: Array<{ name: string; type: string; optional: boolean }>;
  extra: Array<{ name: string; type: string }>;
  mismatched: Array<{
    name: string;
    sdkType: string;
    effectType: string;
  }>;
} {
  const missing: Array<{ name: string; type: string; optional: boolean }> = [];
  const extra: Array<{ name: string; type: string }> = [];
  const mismatched: Array<{
    name: string;
    sdkType: string;
    effectType: string;
  }> = [];

  const effectParamsByName = new Map<
    string,
    { name: string; type: string; optional: boolean }
  >();
  for (const param of effectParams) {
    effectParamsByName.set(param.name, param);
  }

  // Find missing and mismatched
  for (const sdkParam of sdkParams) {
    const effectParam = effectParamsByName.get(sdkParam.name);
    if (!effectParam) {
      // Only report missing if it's required
      if (!sdkParam.optional) {
        missing.push(sdkParam);
      }
    } else if (sdkParam.type !== effectParam.type) {
      // Type mismatch
      mismatched.push({
        name: sdkParam.name,
        sdkType: sdkParam.type,
        effectType: effectParam.type,
      });
    }
  }

  // Find extra parameters
  const sdkParamsByName = new Set(sdkParams.map((p) => p.name));
  for (const effectParam of effectParams) {
    if (!sdkParamsByName.has(effectParam.name)) {
      extra.push({ name: effectParam.name, type: effectParam.type });
    }
  }

  return { missing, extra, mismatched };
}

/**
 * Extract SDK operations from API surface
 */
function extractSdkOperations(sdkApi: unknown): Operation[] {
  const operations: Operation[] = [];
  const sdkApiTyped = sdkApi as {
    exports?: {
      classes?: Array<{
        name: string;
        methods?: Array<{
          name: string;
          parameters?: Array<{ name: string; type: string; optional: boolean }>;
          returnType?: string;
        }>;
      }>;
      functions?: Array<{
        name: string;
        parameters?: Array<{ name: string; type: string; optional: boolean }>;
        returnType?: string;
      }>;
    };
  };

  // Extract from classes (main SDK client)
  if (sdkApiTyped.exports?.classes) {
    for (const cls of sdkApiTyped.exports.classes) {
      // Look for main client class (Supermemory or Client)
      if (
        (cls.name === "Supermemory" ||
          cls.name.includes("Client") ||
          cls.name.includes("SDK")) &&
        cls.methods
      ) {
        for (const method of cls.methods) {
          // Check if it's a nested property (like memories.create)
          // For now, treat all methods as potential operations
          operations.push({
            name: method.name,
            service: cls.name,
            parameters: method.parameters || [],
            returnType: method.returnType || "unknown",
          });
        }
      }
    }

    // Also check for nested classes (like MemoriesClient)
    for (const cls of sdkApiTyped.exports.classes) {
      if (
        (cls.name.includes("Memory") || cls.name.includes("Search")) &&
        cls.methods
      ) {
        for (const method of cls.methods) {
          operations.push({
            name: method.name,
            service: cls.name,
            parameters: method.parameters || [],
            returnType: method.returnType || "unknown",
          });
        }
      }
    }
  }

  // Extract from functions
  if (sdkApiTyped.exports?.functions) {
    for (const func of sdkApiTyped.exports.functions) {
      operations.push({
        name: func.name,
        parameters: func.parameters || [],
        returnType: func.returnType || "unknown",
      });
    }
  }

  return operations;
}

/**
 * Determine priority for missing operations
 */
function determinePriority(operation: Operation): "high" | "medium" | "low" {
  const name = operation.name.toLowerCase();

  // Core operations are high priority
  if (["create", "put", "get", "delete", "update"].includes(name)) {
    return "high";
  }

  // Common operations are medium priority
  if (["search", "query", "exists", "clear", "list"].includes(name)) {
    return "medium";
  }

  // Everything else is low priority
  return "low";
}

/**
 * Compare API surfaces and generate report
 */
function compareApiSurfaces(
  sdkApi: unknown,
  effectApi: {
    operations: Operation[];
    services: Array<{ name: string; operations: Operation[] }>;
  }
): ComparisonReport {
  const sdkApiTyped = sdkApi as { version: string };

  // Extract SDK operations
  const sdkOperations = extractSdkOperations(sdkApi);

  // Map operations
  const mappings = mapOperations(sdkOperations, effectApi.operations);

  // Find missing operations
  const missingOperations: ComparisonReport["missingOperations"] = [];
  const mappedOperations: ComparisonReport["mappedOperations"] = [];
  const typeMismatches: ComparisonReport["typeMismatches"] = [];
  const parameterDifferences: ComparisonReport["parameterDifferences"] = [];
  const returnTypeDifferences: ComparisonReport["returnTypeDifferences"] = [];

  for (const mapping of mappings) {
    if (mapping.effectOp) {
      // Operation is mapped - compare details
      mappedOperations.push({
        sdkOperation: mapping.sdkOp.name,
        effectOperation: mapping.effectOp.name,
        confidence: mapping.confidence,
        notes: mapping.notes,
      });

      // Compare parameters
      const paramComparison = compareParameters(
        mapping.sdkOp.parameters,
        mapping.effectOp.parameters
      );

      if (
        paramComparison.missing.length > 0 ||
        paramComparison.extra.length > 0
      ) {
        const severity = paramComparison.missing.some((p) => !p.optional)
          ? "breaking"
          : "warning";

        parameterDifferences.push({
          operation: mapping.sdkOp.name,
          missingParams: paramComparison.missing,
          extraParams: paramComparison.extra,
          severity,
        });
      }

      // Check for type mismatches
      for (const mismatch of paramComparison.mismatched) {
        typeMismatches.push({
          operation: mapping.sdkOp.name,
          parameter: mismatch.name,
          sdkType: mismatch.sdkType,
          effectType: mismatch.effectType,
          severity:
            mismatch.sdkType.includes("undefined") ||
            mismatch.effectType.includes("undefined")
              ? "warning"
              : "info",
        });
      }

      // Compare return types
      if (mapping.sdkOp.returnType !== mapping.effectOp.returnType) {
        // Extract base types (remove Effect wrapper, generics, etc.)
        const sdkBaseType = mapping.sdkOp.returnType
          .replace(/Promise<(.+)>/, "$1")
          .replace(/Effect\.Effect<(.+),.*>/, "$1")
          .trim();
        const effectBaseType = mapping.effectOp.returnType
          .replace(/Effect\.Effect<(.+),.*>/, "$1")
          .replace(/Effect\.Effect<(.+)>/, "$1")
          .trim();

        if (
          sdkBaseType !== effectBaseType &&
          !sdkBaseType.includes("void") &&
          !effectBaseType.includes("void")
        ) {
          returnTypeDifferences.push({
            operation: mapping.sdkOp.name,
            sdkReturnType: mapping.sdkOp.returnType,
            effectReturnType: mapping.effectOp.returnType,
            severity: "info", // Return type differences are usually OK (Effect wrapping)
          });
        }
      }
    } else {
      // Operation is missing
      missingOperations.push({
        operation: mapping.sdkOp.name,
        service: mapping.sdkOp.service,
        description: `SDK has "${mapping.sdkOp.name}" but effect-supermemory does not`,
        priority: determinePriority(mapping.sdkOp),
      });
    }
  }

  // Find extra operations (in effect-supermemory but not in SDK)
  const sdkOpNames = new Set(
    sdkOperations.map((op) => normalizeOperationName(op.name))
  );
  const extraOperations: ComparisonReport["extraOperations"] = [];

  for (const effectOp of effectApi.operations) {
    const normalized = normalizeOperationName(effectOp.name);
    if (!sdkOpNames.has(normalized)) {
      // Check if it's mapped to any SDK operation
      const isMapped = mappings.some((m) => m.effectOp?.name === effectOp.name);
      if (!isMapped) {
        extraOperations.push({
          operation: effectOp.name,
          service: effectOp.service || "unknown",
          description: "effect-supermemory specific operation",
        });
      }
    }
  }

  // Calculate compatibility score
  const totalSdkOps = sdkOperations.length;
  const implementedOps = mappedOperations.length;
  const score =
    totalSdkOps > 0 ? Math.round((implementedOps / totalSdkOps) * 100) : 0;

  const compatibility: ComparisonReport["compatibility"]["overall"] =
    score === 100 &&
    typeMismatches.length === 0 &&
    parameterDifferences.filter((p) => p.severity === "breaking").length === 0
      ? "compatible"
      : score >= 80
        ? "partial"
        : "incompatible";

  return {
    generatedAt: new Date().toISOString(),
    sdkVersion: sdkApiTyped.version || "unknown",
    compatibility: {
      overall: compatibility,
      score,
    },
    missingOperations,
    extraOperations,
    mappedOperations,
    typeMismatches,
    parameterDifferences,
    returnTypeDifferences,
    summary: {
      totalSdkOperations: totalSdkOps,
      implementedOperations: implementedOps,
      missingOperations: missingOperations.length,
      mappedOperations: mappedOperations.length,
      typeIssues: typeMismatches.length,
      parameterIssues: parameterDifferences.length,
    },
  };
}

/**
 * Generate markdown report from comparison
 */
function generateMarkdownReport(report: ComparisonReport): string {
  const lines: string[] = [];

  lines.push("# SDK Compatibility Report");
  lines.push("");
  lines.push(`**Generated:** ${report.generatedAt}`);
  lines.push(`**SDK Version:** ${report.sdkVersion}`);
  lines.push("");

  // Compatibility status
  lines.push("## Compatibility Status");
  lines.push("");
  lines.push(`**Overall:** ${report.compatibility.overall.toUpperCase()}`);
  lines.push(`**Score:** ${report.compatibility.score}%`);
  lines.push("");

  // Summary
  lines.push("## Summary");
  lines.push("");
  lines.push(
    `- **Total SDK Operations:** ${report.summary.totalSdkOperations}`
  );
  lines.push(`- **Mapped/Implemented:** ${report.summary.mappedOperations}`);
  lines.push(`- **Missing Operations:** ${report.summary.missingOperations}`);
  lines.push(`- **Type Issues:** ${report.summary.typeIssues}`);
  lines.push(`- **Parameter Issues:** ${report.summary.parameterIssues}`);
  lines.push("");

  // Mapped operations
  if (report.mappedOperations.length > 0) {
    lines.push("## Mapped Operations");
    lines.push("");
    lines.push(
      "These SDK operations are mapped to effect-supermemory operations:"
    );
    lines.push("");
    for (const mapping of report.mappedOperations) {
      lines.push(
        `- **SDK:** \`${mapping.sdkOperation}\` → **effect-supermemory:** \`${mapping.effectOperation}\` (${mapping.confidence})`
      );
      if (mapping.notes) {
        lines.push(`  - ${mapping.notes}`);
      }
    }
    lines.push("");
  }

  // Missing operations
  if (report.missingOperations.length > 0) {
    lines.push("## Missing Operations");
    lines.push("");
    lines.push(
      "These SDK operations are not yet implemented in effect-supermemory:"
    );
    lines.push("");
    for (const op of report.missingOperations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    })) {
      lines.push(
        `- **${op.operation}** (Priority: ${op.priority.toUpperCase()})`
      );
      if (op.service) {
        lines.push(`  - Service: ${op.service}`);
      }
      if (op.description) {
        lines.push(`  - ${op.description}`);
      }
      if (op.suggestedMapping) {
        lines.push(`  - Suggested: ${op.suggestedMapping}`);
      }
    }
    lines.push("");
  }

  // Extra operations
  if (report.extraOperations.length > 0) {
    lines.push("## Extra Operations");
    lines.push("");
    lines.push(
      "These operations exist in effect-supermemory but not in the official SDK:"
    );
    lines.push("");
    for (const op of report.extraOperations) {
      lines.push(`- **${op.operation}** (${op.service})`);
      if (op.description) {
        lines.push(`  - ${op.description}`);
      }
    }
    lines.push("");
  }

  // Parameter differences
  if (report.parameterDifferences.length > 0) {
    lines.push("## Parameter Differences");
    lines.push("");
    for (const diff of report.parameterDifferences) {
      lines.push(`### ${diff.operation}`);
      lines.push(`**Severity:** ${diff.severity}`);
      if (diff.missingParams.length > 0) {
        lines.push("- **Missing parameters:**");
        for (const param of diff.missingParams) {
          lines.push(
            `  - \`${param.name}: ${param.type}\` ${param.optional ? "(optional)" : "(required)"}`
          );
        }
      }
      if (diff.extraParams.length > 0) {
        lines.push("- **Extra parameters:**");
        for (const param of diff.extraParams) {
          lines.push(`  - \`${param.name}: ${param.type}\``);
        }
      }
      lines.push("");
    }
  }

  // Type mismatches
  if (report.typeMismatches.length > 0) {
    lines.push("## Type Mismatches");
    lines.push("");
    for (const mismatch of report.typeMismatches) {
      lines.push(`- **${mismatch.operation}.${mismatch.parameter}**`);
      lines.push(`  - SDK: \`${mismatch.sdkType}\``);
      lines.push(`  - effect-supermemory: \`${mismatch.effectType}\``);
      lines.push(`  - Severity: ${mismatch.severity}`);
      if (mismatch.notes) {
        lines.push(`  - ${mismatch.notes}`);
      }
      lines.push("");
    }
  }

  // Return type differences
  if (report.returnTypeDifferences.length > 0) {
    lines.push("## Return Type Differences");
    lines.push("");
    lines.push(
      "These are usually acceptable since effect-supermemory wraps returns in Effect types:"
    );
    lines.push("");
    for (const diff of report.returnTypeDifferences) {
      lines.push(`- **${diff.operation}**`);
      lines.push(`  - SDK: \`${diff.sdkReturnType}\``);
      lines.push(`  - effect-supermemory: \`${diff.effectReturnType}\``);
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * Main comparison function
 */
async function main() {
  const args = process.argv.slice(2);
  const sdkApiIndex = args.indexOf("--sdk-api");
  const sdkApiPath =
    sdkApiIndex >= 0 ? args[sdkApiIndex + 1] : DEFAULT_SDK_API_PATH;

  const outputIndex = args.indexOf("--output");
  const outputPath =
    outputIndex >= 0 ? args[outputIndex + 1] : DEFAULT_OUTPUT_PATH;

  console.log("\n" + "=".repeat(60));
  console.log("🔍 API Surface Comparison");
  console.log("=".repeat(60));

  try {
    // Load SDK API surface
    console.log(`\n📦 Loading SDK API surface from: ${sdkApiPath}`);
    const sdkApi = loadSdkApiSurface(sdkApiPath);

    // Extract effect-supermemory API surface
    console.log("🔍 Extracting effect-supermemory API surface...");
    const effectApi = extractEffectSupermemoryApi();
    console.log(
      `   Found ${effectApi.operations.length} operation(s) across ${effectApi.services.length} service(s)`
    );

    // Compare APIs
    console.log("\n📊 Comparing API surfaces...");
    const report = compareApiSurfaces(sdkApi, effectApi);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write JSON report
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log("\n✅ Comparison report generated:");
    console.log(`   JSON: ${outputPath}`);

    // Generate and write markdown report
    const markdownPath = outputPath.replace(".json", ".md");
    const markdownReport = generateMarkdownReport(report);
    fs.writeFileSync(markdownPath, markdownReport);
    console.log(`   Markdown: ${markdownPath}`);

    // Print summary
    console.log("\n📋 Summary:");
    console.log(
      `   Compatibility: ${report.compatibility.overall} (${report.compatibility.score}%)`
    );
    console.log(`   Mapped Operations: ${report.mappedOperations.length}`);
    console.log(`   Missing Operations: ${report.missingOperations.length}`);
    console.log(`   Type Mismatches: ${report.typeMismatches.length}`);
    console.log(
      `   Parameter Differences: ${report.parameterDifferences.length}`
    );

    if (report.missingOperations.length > 0) {
      const highPriority = report.missingOperations.filter(
        (op) => op.priority === "high"
      ).length;
      if (highPriority > 0) {
        console.log(`\n⚠️  ${highPriority} high-priority operation(s) missing`);
      }
    }

    console.log("\n" + "=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Comparison failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the comparison
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
