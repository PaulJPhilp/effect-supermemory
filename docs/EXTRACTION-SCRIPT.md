# SDK API Extraction Script

## Overview

The `scripts/extract-sdk-api.ts` script downloads and analyzes the official Supermemory TypeScript SDK to extract its complete API surface, including classes, methods, functions, types, and configuration options.

## Features

### Comprehensive API Extraction

The script extracts:

1. **Classes**
   - Class name
   - Constructor parameters
   - Public/protected methods with signatures
   - Properties
   - Method return types and async indicators

2. **Functions**
   - Exported functions
   - Arrow function exports
   - Parameters and return types
   - Async indicators

3. **Types and Interfaces**
   - Interfaces with properties
   - Type aliases
   - Enums with members

4. **Configuration**
   - Constructor options from main class
   - Configuration parameters with types

### Advanced Parsing

- **Smart Parameter Parsing**: Handles complex parameter types including:
  - Generic types (`Array<T>`)
  - Nested generics (`Map<string, Array<number>>`)
  - Optional parameters (`param?: type`)
  - Rest parameters (`...args: string[]`)
  - Destructured parameters

- **Type Detection**: Identifies:
  - Constructor parameters
  - Async methods
  - Return types
  - Optional vs required properties

- **Main Entry Detection**: Automatically finds and prioritizes the main entry point file

## Usage

```bash
# Extract latest version
bun run compat:extract

# Extract specific version
bun run scripts/extract-sdk-api.ts --version 1.2.3

# Custom output location
bun run scripts/extract-sdk-api.ts --output ./custom-output.json
```

## Output Format

The script generates a JSON file with the following structure:

```json
{
  "packageName": "supermemory",
  "version": "1.0.0",
  "extractedAt": "2025-01-01T00:00:00.000Z",
  "mainEntry": "index.d.ts",
  "exports": {
    "classes": [
      {
        "name": "Supermemory",
        "constructorParams": [
          {
            "name": "options",
            "type": "{ apiKey: string; baseUrl?: string }",
            "optional": false
          }
        ],
        "methods": [
          {
            "name": "memories",
            "parameters": [],
            "returnType": "MemoryClient",
            "isAsync": false
          }
        ],
        "properties": []
      }
    ],
    "functions": [],
    "types": []
  },
  "configuration": {
    "constructorOptions": [...]
  }
}
```

## How It Works

1. **Package Installation**: Creates a temporary directory and installs the specified SDK version
2. **File Discovery**: Finds all `.d.ts` files in the package
3. **Main Entry Detection**: Identifies the main entry point from `package.json`
4. **Content Analysis**: Parses each declaration file using regex-based parsing
5. **API Extraction**: Extracts classes, methods, functions, and types
6. **Configuration Discovery**: Identifies configuration options from constructor parameters
7. **Output Generation**: Writes structured JSON output
8. **Cleanup**: Removes temporary files

## Parsing Details

### Class Extraction
- Matches: `class ClassName { ... }`
- Extracts constructor, methods, and properties
- Handles visibility modifiers (public, private, protected)
- Detects async methods

### Function Extraction
- Matches: `export function name(...)`
- Matches: `export const name = (...) =>`
- Extracts parameters and return types

### Type Extraction
- Interfaces: `interface Name { ... }`
- Type aliases: `type Name = ...`
- Enums: `enum Name { ... }`

### Parameter Parsing
Uses depth tracking to handle:
- Generic types: `Array<string>`
- Nested types: `Map<string, Array<number>>`
- Optional parameters: `param?: type`
- Rest parameters: `...args: string[]`

## Limitations

- Uses regex-based parsing (not a full AST parser)
- May have edge cases with complex TypeScript features
- Doesn't parse JSDoc comments (future enhancement)
- Doesn't handle namespace declarations (can be added)

## Future Enhancements

Consider using a proper TypeScript AST parser like:
- `ts-morph` - Wrapper around TypeScript compiler API
- `@typescript/compiler-api` - Direct TypeScript compiler access

This would provide:
- More accurate parsing
- Better handling of complex types
- JSDoc comment extraction
- Better error handling

## Integration

The extracted API surface is used by:
- `scripts/compare-api-surface.ts` - Compare with effect-supermemory
- `scripts/validate-schemas.ts` - Validate type compatibility
- `scripts/monitor-sdk-changes.ts` - Track API changes over time
- Compatibility tests - Verify functional equivalence

## Example Output

After running the extraction, you'll see output like:

```
📦 SDK API Extraction
============================================================

📋 Package: supermemory
   Version: 1.0.0

Installing supermemory@1.0.0...
📁 Found 5 declaration file(s)
   Main entry: index.d.ts

🔍 Extracting API surface...
  Processing: index.d.ts
  Processing: types.d.ts
  ...

✅ Extracted:
   Classes: 3
   Functions: 5
   Types: 12

✅ API surface extracted:
   File: specs/supermemory/sdk-api.json
```

The script is ready to use and will provide comprehensive API analysis of the official Supermemory SDK!
