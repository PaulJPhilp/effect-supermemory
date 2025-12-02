import { spawn } from "child_process";
import { afterAll, beforeAll } from "vitest";

let mockServerProcess: any;

beforeAll(async () => {
  console.log("🚀 Starting mock Supermemory API server...");

  // Start the mock server
  mockServerProcess = spawn("bun", ["test-setup/mock-server.ts"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  // Pipe server output to test output
  mockServerProcess.stdout?.on("data", (data) => {
    console.log(`[MOCK SERVER] ${data.toString().trim()}`);
  });
  mockServerProcess.stderr?.on("data", (data) => {
    console.error(`[MOCK SERVER ERROR] ${data.toString().trim()}`);
  });

  // Wait for server to start
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log("✅ Mock server started");
});

afterAll(async () => {
  console.log("🛑 Stopping mock server...");

  if (mockServerProcess) {
    // Try graceful shutdown first
    mockServerProcess.kill("SIGINT");
    // Wait for graceful shutdown
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    // Force kill if still running
    if (!mockServerProcess.killed) {
      mockServerProcess.kill("SIGKILL");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log("✅ Mock server stopped");
});
