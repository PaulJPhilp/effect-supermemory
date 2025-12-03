# API Surface Comparison Tool

## Overview

The `scripts/compare-api-surface.ts` tool performs comprehensive comparison between the official Supermemory SDK and effect-supermemory to identify gaps, mismatches, and compatibility issues.

## Features

### Comprehensive Gap Detection

1. **Missing Operations**
   - Identifies SDK operations not implemented in effect-supermemory
   - Prioritizes missing operations (high/medium/low)
   - Suggests mappings where appropriate

2. **Operation Mapping**
   - Automatically maps SDK operations to effect-supermemory operations
   - Uses name matching, normalization, and known mappings
   - Provides confidence levels (high/medium/low)

3. **Parameter Comparison**
   - Compares parameter lists between SDK and effect-supermemory
   - Identifies missing parameters
   - Identifies extra parameters
   - Flags breaking vs warning-level differences

4. **Type Analysis**
   - Detects type mismatches for parameters
   - Compares return types (with Effect wrapper awareness)
   - Categorizes severity (breaking/warning/info)

5. **Return Type Comparison**
   - Understands Effect wrapping differences
   - Reports actual type differences vs Effect wrapper differences

### Multi-Service Support

The tool extracts operations from all effect-supermemory services:
- `SupermemoryClient` - Core memory operations
- `SearchClient` - Search and query operations
- `MemoryStreamClient` - Streaming operations

## Usage

```bash
# Compare with default SDK API file
bun run compat:compare

# Specify custom SDK API file
bun run scripts/compare-api-surface.ts --sdk-api ./custom-sdk-api.json

# Custom output location
bun run scripts/compare-api-surface.ts --output ./custom-report.json
```

## Output

The tool generates two files:

### 1. JSON Report (`compatibility-report.json`)

Structured data with detailed comparison results:

```json
{
  "compatibility": {
    "overall": "partial",
    "score": 85
  },
  "missingOperations": [...],
  "mappedOperations": [...],
  "typeMismatches": [...],
  "parameterDifferences": [...],
  "summary": {...}
}
```

### 2. Markdown Report (`compatibility-report.md`)

Human-readable report with:
- Compatibility status and score
- Summary statistics
- Mapped operations
- Missing operations (sorted by priority)
- Parameter differences
- Type mismatches
- Return type differences

## Comparison Logic

### Operation Mapping

The tool uses multiple strategies to map SDK operations to effect-supermemory:

1. **Exact Name Match** - Highest confidence
2. **Normalized Match** - Case-insensitive, ignores underscores/dashes
3. **Known Mappings** - Pre-defined mappings:
   - `create` → `put`
   - `retrieve` → `get`
   - `remove` → `delete`
   - `batch` → `putMany`
   - etc.
4. **Partial Match** - Name similarity (lowest confidence)

### Priority Detection

Missing operations are prioritized:
- **High**: Core operations (create, put, get, delete, update)
- **Medium**: Common operations (search, query, exists, clear, list)
- **Low**: Everything else

### Severity Classification

- **Breaking**: Missing required parameters, incompatible types
- **Warning**: Missing optional parameters, minor type differences
- **Info**: Return type differences (usually acceptable due to Effect wrapping)

## Example Output

```
🔍 API Surface Comparison
============================================================

📦 Loading SDK API surface from: specs/supermemory/sdk-api.json
🔍 Extracting effect-supermemory API surface...
   Found 11 operation(s) across 3 service(s)

📊 Comparing API surfaces...

✅ Comparison report generated:
   JSON: docs/compatibility-report.json
   Markdown: docs/compatibility-report.md

📋 Summary:
   Compatibility: partial (85%)
   Mapped Operations: 8
   Missing Operations: 2
   Type Mismatches: 1
   Parameter Differences: 0

⚠️  1 high-priority operation(s) missing
```

## Integration

The comparison tool works with:

1. **Extraction Tool** - Uses output from `scripts/extract-sdk-api.ts`
2. **Monitoring Tool** - Used by `scripts/monitor-sdk-changes.ts` to detect changes
3. **CI/CD** - Automatically run by GitHub Actions workflow
4. **Compatibility CLI** - Used by `scripts/compatibility-cli.ts` for quick checks

## Key Capabilities

### Gap Detection

- ✅ Finds all missing SDK operations
- ✅ Prioritizes by importance
- ✅ Maps similar operations automatically
- ✅ Identifies extra operations in effect-supermemory

### Type Safety Analysis

- ✅ Compares parameter types
- ✅ Compares return types
- ✅ Understands Effect wrapper differences
- ✅ Flags breaking changes

### Parameter Analysis

- ✅ Detects missing required parameters
- ✅ Detects missing optional parameters
- ✅ Identifies extra parameters
- ✅ Categorizes severity

### Reporting

- ✅ Structured JSON for programmatic use
- ✅ Human-readable Markdown for developers
- ✅ Detailed summaries and statistics
- ✅ Actionable recommendations

## Known Limitations

1. **Type Comparison**: Uses string matching - may not catch all semantic differences
2. **Nested Structures**: Parameter objects are compared as strings
3. **Effect Wrapping**: Return type differences due to Effect are marked as "info"
4. **Method Chaining**: Doesn't detect SDK methods accessed via properties (e.g., `client.memories.create`)

## Future Enhancements

- AST-based type comparison for more accurate analysis
- JSDoc comment extraction for better descriptions
- Support for method chaining patterns (`client.memories.create`)
- Semantic type comparison (not just string matching)
- Integration with TypeScript compiler API for deeper analysis

The comparison tool is ready to identify gaps and ensure compatibility between the SDKs!
