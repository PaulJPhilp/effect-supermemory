#!/usr/bin/env bun

/**
 * SDK API Extraction Script
 *
 * Downloads and analyzes the official Supermemory TypeScript SDK npm package
 * to extract its public API surface (methods, types, configuration).
 *
 * Usage:
 *   bun run scripts/extract-sdk-api.ts                    # Extract latest version
 *   bun run scripts/extract-sdk-api.ts --version 1.2.3    # Extract specific version
 *   bun run scripts/extract-sdk-api.ts --output ./output   # Custom output directory
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const SDK_PACKAGE_NAME = "supermemory";
const TEMP_DIR = path.join(process.cwd(), ".sdk-extract");
const DEFAULT_OUTPUT = path.join(
  process.cwd(),
  "specs",
  "supermemory",
  "sdk-api.json"
);

interface MethodSignature {
  name: string;
  parameters: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;
  returnType: string;
  isAsync: boolean;
}

interface ClassInfo {
  name: string;
  methods: MethodSignature[];
  properties: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;
  constructorParams?: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;
}

interface TypeInfo {
  name: string;
  kind: "interface" | "type" | "enum" | "class";
  properties?: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;
}

interface FunctionInfo {
  name: string;
  parameters: Array<{
    name: string;
    type: string;
    optional: boolean;
  }>;
  returnType: string;
  isAsync: boolean;
}

interface SdkApiSurface {
  packageName: string;
  version: string;
  extractedAt: string;
  mainEntry?: string;
  exports: {
    classes?: ClassInfo[];
    functions?: FunctionInfo[];
    types?: TypeInfo[];
  };
  configuration?: {
    constructorOptions?: Array<{
      name: string;
      type: string;
      optional: boolean;
      description?: string;
    }>;
  };
}

/**
 * Get package version from npm registry
 */
async function getPackageVersion(
  packageName: string,
  version?: string
): Promise<string> {
  const url = version
    ? `https://registry.npmjs.org/${packageName}/${version}`
    : `https://registry.npmjs.org/${packageName}/latest`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch package info: ${response.statusText}`);
    }
    const data = (await response.json()) as {
      version: string;
      dist?: { tarball: string };
    };
    return data.version;
  } catch (error) {
    console.error(`Failed to fetch package version: ${error}`);
    throw error;
  }
}

/**
 * Install package to temporary directory
 */
async function installPackage(
  packageName: string,
  version: string,
  targetDir: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Clean up target directory
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(targetDir, { recursive: true });

    // Create a minimal package.json
    const packageJson = {
      name: "sdk-extraction",
      version: "1.0.0",
      type: "module",
      dependencies: {
        [packageName]: version,
      },
    };
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    console.log(`Installing ${packageName}@${version}...`);

    const proc = spawn("bun", ["install"], {
      cwd: targetDir,
      stdio: "inherit",
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Installation failed with code ${code}`));
      }
    });

    proc.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Find TypeScript declaration files and main entry point
 */
function findDeclarationFiles(dir: string): {
  files: string[];
  mainEntry?: string;
} {
  const files: string[] = [];
  const nodeModulesPath = path.join(dir, "node_modules", SDK_PACKAGE_NAME);

  if (!fs.existsSync(nodeModulesPath)) {
    console.warn(`Package not found at ${nodeModulesPath}`);
    return { files };
  }

  // Try to find package.json to get main entry point
  const packageJsonPath = path.join(nodeModulesPath, "package.json");
  let mainEntry: string | undefined;
  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath, "utf-8")
      ) as { main?: string; types?: string; exports?: unknown };
      mainEntry = packageJson.types || packageJson.main;
    } catch {
      // Ignore parse errors
    }
  }

  function walk(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (
          entry.isDirectory() &&
          entry.name !== "node_modules" &&
          !entry.name.startsWith(".")
        ) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".d.ts")) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walk(nodeModulesPath);
  return { files, mainEntry };
}

/**
 * Parse parameters from a function/method signature
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

  // Split by comma, but be careful with nested generics
  const params: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < paramString.length; i++) {
    const char = paramString[i];
    if (char === "<" || char === "(" || char === "[") {
      depth++;
      current += char;
    } else if (char === ">" || char === ")" || char === "]") {
      depth--;
      current += char;
    } else if (char === "," && depth === 0) {
      params.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    params.push(current.trim());
  }

  for (const param of params) {
    const trimmed = param.trim();
    if (!trimmed) continue;

    // Handle rest parameters
    if (trimmed.startsWith("...")) {
      const restParam = trimmed.slice(3).trim();
      const colonIndex = restParam.indexOf(":");
      if (colonIndex > 0) {
        const name = restParam.substring(0, colonIndex).trim();
        const type = restParam.substring(colonIndex + 1).trim();
        parameters.push({ name: `...${name}`, type, optional: false });
      }
      continue;
    }

    // Parse name: type or name?: type
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex > 0) {
      const namePart = trimmed.substring(0, colonIndex).trim();
      const typePart = trimmed.substring(colonIndex + 1).trim();
      const optional = namePart.endsWith("?");
      const name = optional ? namePart.slice(0, -1) : namePart;
      parameters.push({ name, type: typePart, optional });
    } else {
      // Just a type (e.g., in destructured parameters)
      parameters.push({ name: "", type: trimmed, optional: false });
    }
  }

  return parameters;
}

/**
 * Extract classes from TypeScript content
 */
function extractClasses(content: string): ClassInfo[] {
  const classes: ClassInfo[] = [];

  // Match class declarations: export class ClassName { ... }
  const classRegex =
    /(?:export\s+)?class\s+(\w+)(?:<[^>]*>)?\s*(?:extends\s+[^{]+)?\{([\s\S]*?)\n\}/g;
  let classMatch;

  while ((classMatch = classRegex.exec(content)) !== null) {
    const className = classMatch[1];
    const classBody = classMatch[2];
    const classInfo: ClassInfo = {
      name: className,
      methods: [],
      properties: [],
    };

    // Extract constructor
    const constructorRegex = /\s+constructor\s*\(([^)]*)\)/;
    const constructorMatch = classBody.match(constructorRegex);
    if (constructorMatch && constructorMatch[1]) {
      classInfo.constructorParams = parseParameters(constructorMatch[1]);
    }

    // Extract methods
    const methodRegex =
      /(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*([^;{]+))?/g;
    let methodMatch;

    while ((methodMatch = methodRegex.exec(classBody)) !== null) {
      const methodName = methodMatch[1];
      const params = methodMatch[2] || "";
      const returnType = methodMatch[3]?.trim() || "void";
      const isAsync = classBody
        .substring(methodMatch.index - 10, methodMatch.index)
        .includes("async");

      // Skip constructors
      if (methodName === "constructor") continue;

      classInfo.methods.push({
        name: methodName,
        parameters: parseParameters(params),
        returnType,
        isAsync,
      });
    }

    // Extract properties
    const propertyRegex =
      /(?:public|private|protected)?\s*(?:readonly\s+)?(\w+\??)\s*:\s*([^;]+);/g;
    let propertyMatch;

    while ((propertyMatch = propertyRegex.exec(classBody)) !== null) {
      const name = propertyMatch[1].replace("?", "");
      const type = propertyMatch[2].trim();
      const optional = propertyMatch[1].includes("?");

      // Skip methods (they have parentheses)
      if (type.includes("(")) continue;

      classInfo.properties.push({
        name,
        type,
        optional,
      });
    }

    classes.push(classInfo);
  }

  return classes;
}

/**
 * Extract exported functions
 */
function extractFunctions(content: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];

  // Match exported function declarations
  const functionRegex =
    /export\s+(?:async\s+)?function\s+(\w+)\s*<[^>]*>?\s*\(([^)]*)\)\s*(?::\s*([^{]+))?/g;
  let funcMatch;

  while ((funcMatch = functionRegex.exec(content)) !== null) {
    const funcName = funcMatch[1];
    const params = funcMatch[2] || "";
    const returnType = funcMatch[3]?.trim() || "void";
    const isAsync = funcMatch[0].includes("async");

    functions.push({
      name: funcName,
      parameters: parseParameters(params),
      returnType,
      isAsync,
    });
  }

  // Also match arrow function exports: export const func = (params) => returnType
  const arrowFunctionRegex =
    /export\s+(?:const|let)\s+(\w+)\s*[:=]\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*([^=]+))?\s*=>/g;
  let arrowMatch;

  while ((arrowMatch = arrowFunctionRegex.exec(content)) !== null) {
    const funcName = arrowMatch[1];
    const params = arrowMatch[2] || "";
    const returnType = arrowMatch[3]?.trim() || "unknown";
    const isAsync = arrowMatch[0].includes("async");

    functions.push({
      name: funcName,
      parameters: parseParameters(params),
      returnType,
      isAsync,
    });
  }

  return functions;
}

/**
 * Extract types and interfaces
 */
function extractTypes(content: string): TypeInfo[] {
  const types: TypeInfo[] = [];

  // Extract interfaces
  const interfaceRegex =
    /(?:export\s+)?interface\s+(\w+)(?:<[^>]*>)?\s*\{([\s\S]*?)\n\}/g;
  let interfaceMatch;

  while ((interfaceMatch = interfaceRegex.exec(content)) !== null) {
    const name = interfaceMatch[1];
    const body = interfaceMatch[2];
    const properties: TypeInfo["properties"] = [];

    const propertyRegex = /(\w+\??)\s*:\s*([^;]+);/g;
    let propMatch;

    while ((propMatch = propertyRegex.exec(body)) !== null) {
      properties.push({
        name: propMatch[1].replace("?", ""),
        type: propMatch[2].trim(),
        optional: propMatch[1].includes("?"),
      });
    }

    types.push({
      name,
      kind: "interface",
      properties,
    });
  }

  // Extract type aliases
  const typeRegex = /(?:export\s+)?type\s+(\w+)(?:<[^>]*>)?\s*=\s*([^;]+);/g;
  let typeMatch;

  while ((typeMatch = typeRegex.exec(content)) !== null) {
    types.push({
      name: typeMatch[1],
      kind: "type",
      properties: [
        {
          name: "value",
          type: typeMatch[2].trim(),
          optional: false,
        },
      ],
    });
  }

  // Extract enums
  const enumRegex = /(?:export\s+)?enum\s+(\w+)\s*\{([^}]+)\}/g;
  let enumMatch;

  while ((enumMatch = enumRegex.exec(content)) !== null) {
    const name = enumMatch[1];
    const body = enumMatch[2];
    const properties: TypeInfo["properties"] = [];

    const enumMemberRegex = /(\w+)(?:\s*=\s*([^,\n]+))?/g;
    let enumMemberMatch;

    while ((enumMemberMatch = enumMemberRegex.exec(body)) !== null) {
      properties.push({
        name: enumMemberMatch[1],
        type: enumMemberMatch[2]?.trim() || "string",
        optional: false,
      });
    }

    types.push({
      name,
      kind: "enum",
      properties,
    });
  }

  return types;
}

/**
 * Extract main class configuration options from constructor
 */
function extractConfiguration(
  classes: ClassInfo[]
): SdkApiSurface["configuration"] {
  // Look for the main class (likely "Supermemory" or similar)
  const mainClass = classes.find(
    (cls) =>
      cls.name === "Supermemory" ||
      cls.name.toLowerCase().includes("client") ||
      cls.name.toLowerCase().includes("sdk")
  );

  if (mainClass?.constructorParams) {
    // Check if constructor has an options parameter
    const optionsParam = mainClass.constructorParams.find(
      (p) =>
        p.name === "options" ||
        p.name === "config" ||
        p.type.includes("Options") ||
        p.type.includes("Config")
    );

    if (optionsParam) {
      // Try to find the Options/Config interface/type
      return {
        constructorOptions: mainClass.constructorParams.map((p) => ({
          name: p.name,
          type: p.type,
          optional: p.optional,
        })),
      };
    }
  }

  return;
}

/**
 * Extract API surface from TypeScript declaration files
 */
async function extractApiSurface(
  packageName: string,
  version: string,
  declarationFiles: string[],
  mainEntry?: string
): Promise<SdkApiSurface> {
  const surface: SdkApiSurface = {
    packageName,
    version,
    extractedAt: new Date().toISOString(),
    mainEntry,
    exports: {},
  };

  const allClasses: ClassInfo[] = [];
  const allFunctions: FunctionInfo[] = [];
  const allTypes: TypeInfo[] = [];

  console.log(`Found ${declarationFiles.length} declaration file(s)`);

  // Process main entry file first if found
  let mainFile: string | undefined;
  if (mainEntry) {
    // Try to find the main entry file
    for (const file of declarationFiles) {
      if (
        file.includes(mainEntry.replace(".js", ".d.ts")) ||
        file.endsWith("index.d.ts")
      ) {
        mainFile = file;
        break;
      }
    }
  }

  // Process files in order: main file first, then others
  const filesToProcess = mainFile
    ? [mainFile, ...declarationFiles.filter((f) => f !== mainFile)]
    : declarationFiles;

  for (const file of filesToProcess) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(
        path.join(TEMP_DIR, "node_modules", SDK_PACKAGE_NAME),
        file
      );

      console.log(`  Processing: ${relativePath}`);

      // Extract different elements
      const classes = extractClasses(content);
      const functions = extractFunctions(content);
      const types = extractTypes(content);

      allClasses.push(...classes);
      allFunctions.push(...functions);
      allTypes.push(...types);
    } catch (error) {
      console.warn(`  Warning: Failed to process ${file}: ${error}`);
    }
  }

  // Remove duplicates (same name)
  const uniqueClasses = Array.from(
    new Map(allClasses.map((c) => [c.name, c])).values()
  );
  const uniqueFunctions = Array.from(
    new Map(allFunctions.map((f) => [f.name, f])).values()
  );
  const uniqueTypes = Array.from(
    new Map(allTypes.map((t) => [t.name, t])).values()
  );

  surface.exports.classes =
    uniqueClasses.length > 0 ? uniqueClasses : undefined;
  surface.exports.functions =
    uniqueFunctions.length > 0 ? uniqueFunctions : undefined;
  surface.exports.types = uniqueTypes.length > 0 ? uniqueTypes : undefined;

  // Extract configuration
  surface.configuration = extractConfiguration(uniqueClasses);

  console.log("\n✅ Extracted:");
  console.log(`   Classes: ${uniqueClasses.length}`);
  console.log(`   Functions: ${uniqueFunctions.length}`);
  console.log(`   Types: ${uniqueTypes.length}`);

  return surface;
}

/**
 * Main extraction function
 */
async function main() {
  const args = process.argv.slice(2);
  const versionIndex = args.indexOf("--version");
  const version = versionIndex >= 0 ? args[versionIndex + 1] : undefined;

  const outputIndex = args.indexOf("--output");
  const outputPath = outputIndex >= 0 ? args[outputIndex + 1] : DEFAULT_OUTPUT;

  console.log("\n" + "=".repeat(60));
  console.log("📦 SDK API Extraction");
  console.log("=".repeat(60));

  try {
    // Get package version
    const packageVersion =
      version || (await getPackageVersion(SDK_PACKAGE_NAME));
    console.log(`\n📋 Package: ${SDK_PACKAGE_NAME}`);
    console.log(`   Version: ${packageVersion}`);

    // Install package
    await installPackage(SDK_PACKAGE_NAME, packageVersion, TEMP_DIR);

    // Find declaration files
    const { files: declarationFiles, mainEntry } =
      findDeclarationFiles(TEMP_DIR);
    if (declarationFiles.length === 0) {
      throw new Error("No TypeScript declaration files found");
    }

    console.log(`\n📁 Found ${declarationFiles.length} declaration file(s)`);
    if (mainEntry) {
      console.log(`   Main entry: ${mainEntry}`);
    }

    // Extract API surface
    console.log("\n🔍 Extracting API surface...");
    const apiSurface = await extractApiSurface(
      SDK_PACKAGE_NAME,
      packageVersion,
      declarationFiles,
      mainEntry
    );

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output
    fs.writeFileSync(outputPath, JSON.stringify(apiSurface, null, 2));
    console.log("\n✅ API surface extracted:");
    console.log(`   File: ${outputPath}`);

    // Cleanup
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }

    console.log("\n" + "=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Extraction failed:");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the extraction
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
