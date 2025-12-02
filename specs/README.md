# API Specifications

This directory contains OpenAPI specifications for the Supermemory API.

## Overview

- **v4** - Latest Supermemory API for memory operations with context search
- **v3** - Supermemory API for document search and RAG operations
- **v1** - Legacy API for core memory operations

## File Organization

```
specs/
└── supermemory/
    ├── openapi-v4.yaml  # Latest API specification
    ├── openapi-v3.yaml  # Document/RAG API (Phase 1)
    ├── openapi-v1.yaml  # Legacy API (Phase 1)
    └── metadata.json    # Version tracking (Phase 1)
```

## Usage

These specifications are used by the automated type generation system:

```bash
# Generate TypeScript types from specs
bun run codegen

# Specifications are fetched from Supermemory during Phase 1 automation
# but committed to this repository for reproducibility and offline builds
```

## Provenance

**v4 Specification:**
- Source: Supermemory official API documentation
- Last Updated: [Date obtained]
- Verified Against: Live API testing

**v3 Specification (Phase 1):**
- To be obtained from Supermemory

**v1 Specification (Phase 1):**
- To be obtained from Supermemory
