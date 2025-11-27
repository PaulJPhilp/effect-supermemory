import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/integration.test.ts"],
    environment: "node",
    setupFiles: ["./test-setup/integration-setup.ts"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
  resolve: {
    alias: {
      "effect-supermemory": resolve(__dirname, "./src/index.ts"),
    },
  },
});
