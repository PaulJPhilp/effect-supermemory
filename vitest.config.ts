import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/__tests__/*.test.{ts,js}", "test/**/*.test.{ts,js}"],
    env: loadEnv("test", process.cwd(), ""), // Load .env file
    globals: true, // Enable globals for .js files
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@services": path.resolve(__dirname, "./services"),
      "@test": path.resolve(__dirname, "./test"),
    },
  },
});
