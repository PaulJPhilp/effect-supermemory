## Project Overview

This is a TypeScript library that provides a client for the Supermemory API. It is built using the `effect-ts` library and provides a functional, type-safe, and composable interface for interacting with the Supermemory service.

The library is structured around several key services:
- `MemoryClient`: A generic interface for memory operations (e.g., `put`, `get`, `delete`).
- `HttpClient`: An Effect-native HTTP client for making requests.
- `SupermemoryClient`: An implementation of `MemoryClient` that uses the `HttpClient` to interact with the Supermemory API.
- `MemoryStreamClient`: A client for streaming data from the Supermemory API.

## Building and Running

### Build

To build the project, run the following command:

```bash
bun run build
```

This will compile the TypeScript code and output the JavaScript files to the `dist` directory.

### Testing

The project uses `vitest` for testing. To run the tests, use the following commands:

- Run all tests:
  ```bash
  bun run test
  ```
- Run tests in watch mode:
  ```bash
  bun run test:watch
  ```
- Run integration tests:
  ```bash
  bun run test:integration
  ```

### Linting and Formatting

The project uses `biome` for linting and formatting.

- To check for linting errors, run:
  ```bash
  bun run lint
  ```
- To format the code, run:
  ```bash
  bun run format
  ```
- To automatically fix formatting issues, run:
  ```bash
  bun run format:fix
  ```

## Development Conventions

- The project uses `effect-ts` for all its core logic. All functions are Effect-native and return discriminated errors on failure.
- The project is written in TypeScript and follows a functional programming style.
- Services are defined as `Effect.Service` and are managed by `Effect.Layer`.
- Errors are modeled as a union of discriminated types.
- Configuration is handled via `Effect.Layer` and `Effect.Config`.
- The project uses `vitest` for testing and `biome` for linting and formatting.
- All code is expected to be well-tested and documented.
- The project follows the directory structure outlined in the `README.md` file.
