import { createServer } from "http";
import { URL } from "url";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Mock data store
const mockStore = new Map<string, string>();

const server = createServer((req, res) => {
  const url = new URL(req.url!, BASE_URL);

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Supermemory-Namespace"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const namespace = req.headers["x-supermemory-namespace"] as string;
    const key = url.searchParams.get("key");

    console.log(
      `${req.method} ${url.pathname} - Namespace: ${namespace}, Key: ${key}`
    );
    console.log(`Full URL: ${url.toString()}`);

    // Handle different endpoints
    // Normalize path to remove optional /api prefix
    const normalizedPath = url.pathname.startsWith("/api")
      ? url.pathname.substring(4)
      : url.pathname;
    console.log(`Normalized path: ${normalizedPath}`);

    if (normalizedPath === "/v1/memories" && req.method === "GET") {
      // Get memory
      if (!key) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing key parameter" }));
        return;
      }

      const fullKey = `${namespace}:${key}`;
      const value = mockStore.get(fullKey);

      if (!value) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Memory not found" }));
        return;
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ key, value }));
    } else if (normalizedPath === "/v1/memories" && req.method === "PUT") {
      // Put memory
      if (!key) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing key parameter" }));
        return;
      }

      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { value } = JSON.parse(body);
          const fullKey = `${namespace}:${key}`;
          mockStore.set(fullKey, value);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
    } else if (normalizedPath === "/v1/memories" && req.method === "DELETE") {
      // Delete memory
      if (!key) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing key parameter" }));
        return;
      }

      const fullKey = `${namespace}:${key}`;
      const existed = mockStore.has(fullKey);
      mockStore.delete(fullKey);

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ deleted: existed }));
    } else if (normalizedPath.startsWith("/v1/keys/") && req.method === "GET") {
      // List all keys for namespace
      const namespaceFromPath = normalizedPath.split("/")[3];
      const keys = Array.from(mockStore.keys())
        .filter((k) => k.startsWith(`${namespaceFromPath}:`))
        .map((k) => k.split(":").slice(1).join(":"));

      // Return as NDJSON
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      keys.forEach((key) => {
        res.write(JSON.stringify({ key }) + "\n");
      });
      res.end();
    } else if (
      normalizedPath.startsWith("/v1/search/") &&
      req.method === "GET"
    ) {
      // Search memories
      const namespaceFromPath = normalizedPath.split("/")[3];
      const query = url.searchParams.get("q") || "";

      const results = Array.from(mockStore.entries())
        .filter(([k]) => k.startsWith(`${namespaceFromPath}:`))
        .filter(([_, v]) => v.toLowerCase().includes(query.toLowerCase()))
        .map(([k, v]) => ({
          key: k.split(":").slice(1).join(":"),
          value: v,
          score: 0.95,
        }));

      // Return as NDJSON
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      results.forEach((result) => {
        res.write(JSON.stringify(result) + "\n");
      });
      res.end();
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Endpoint not found" }));
    }
  } catch (error) {
    console.error("Server error:", error);
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Mock Supermemory API server running on ${BASE_URL}`);
  console.log(`📝 Mock store has ${mockStore.size} items`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down mock server...");
  server.close(() => {
    console.log("✅ Mock server stopped");
    process.exit(0);
  });
});

export { BASE_URL, server };
