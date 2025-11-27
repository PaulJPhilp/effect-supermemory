import { spawn } from "child_process";
import { afterAll, beforeAll } from "vitest";

let mockServerProcess: any;

beforeAll(async () => {
  console.log("🚀 Starting mock Supermemory API server...");

  // Start the mock server
  mockServerProcess = spawn("bun", ["test-setup/mock-server.ts"], {
    stdio: "pipe",
    env: { ...process.env },
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("✅ Mock server started");
});

afterAll(async () => {
  console.log("🛑 Stopping mock server...");

  if (mockServerProcess) {
    mockServerProcess.kill("SIGINT");
    // Wait for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log("✅ Mock server stopped");
});
