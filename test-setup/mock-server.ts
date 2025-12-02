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

    console.log(
      `${req.method} ${url.pathname} - Namespace: ${namespace}`
    );
    console.log(`Full URL: ${url.toString()}`);

    // Handle different endpoints
    // Normalize path to remove optional /api prefix
    const normalizedPath = url.pathname.startsWith("/api")
      ? url.pathname.substring(4)
      : url.pathname;
    console.log(`Normalized path: ${normalizedPath}`);

    // POST /api/v1/memories - Create/update memory
    if (normalizedPath === "/v1/memories" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        try {
          const { id, value, namespace: bodyNamespace } = JSON.parse(body);
          const effectiveNamespace = namespace || bodyNamespace;
          const fullKey = `${effectiveNamespace}:${id}`;
          const now = new Date().toISOString();
          mockStore.set(fullKey, value);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id,
              value,
              namespace: effectiveNamespace,
              createdAt: now,
              updatedAt: now,
            })
          );
        } catch (error) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        }
      });
      return;
    }

    // GET /api/v1/memories/{id} - Get memory by ID
    if (normalizedPath.startsWith("/v1/memories/") && req.method === "GET") {
      const id = normalizedPath.split("/v1/memories/")[1];
      const fullKey = `${namespace}:${id}`;
      const value = mockStore.get(fullKey);

      if (!value) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Memory not found" }));
        return;
      }

      const now = new Date().toISOString();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id,
          value,
          namespace,
          createdAt: now,
          updatedAt: now,
        })
      );
      return;
    }

    // DELETE /api/v1/memories/{id} - Delete memory by ID
    if (normalizedPath.startsWith("/v1/memories/") && req.method === "DELETE") {
      const id = normalizedPath.split("/v1/memories/")[1];
      const fullKey = `${namespace}:${id}`;
      const existed = mockStore.has(fullKey);
      mockStore.delete(fullKey);

      res.writeHead(204);
      res.end();
      return;
    }

    // DELETE /api/v1/memories?namespace=... - Clear all memories in namespace
    if (normalizedPath === "/v1/memories" && req.method === "DELETE") {
      const namespaceParam = url.searchParams.get("namespace") || namespace;
      const keysToDelete = Array.from(mockStore.keys()).filter((k) =>
        k.startsWith(`${namespaceParam}:`)
      );
      keysToDelete.forEach((key) => mockStore.delete(key));

      res.writeHead(204);
      res.end();
      return;
    }

    // GET /v1/keys/{namespace} - List all keys for namespace (streaming)
    if (normalizedPath.startsWith("/v1/keys/") && req.method === "GET") {
      const namespaceFromPath = decodeURIComponent(
        normalizedPath.split("/v1/keys/")[1]
      );
      const keys = Array.from(mockStore.keys())
        .filter((k) => k.startsWith(`${namespaceFromPath}:`))
        .map((k) => k.split(":").slice(1).join(":"));

      // Build NDJSON response
      const ndjsonLines = keys.map((key) => JSON.stringify({ key })).join("\n");
      const responseBody = ndjsonLines + (ndjsonLines ? "\n" : "");

      // Return as NDJSON
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
      });
      res.end(responseBody);
      return;
    }

    // GET /v1/search/{namespace}/stream?q=... - Search memories (streaming)
    if (
      normalizedPath.startsWith("/v1/search/") &&
      normalizedPath.endsWith("/stream") &&
      req.method === "GET"
    ) {
      const pathParts = normalizedPath.split("/");
      const namespaceFromPath = decodeURIComponent(pathParts[3]);
      const query = url.searchParams.get("q") || "";

      // Helper to decode base64
      const decodeBase64 = (b64: string): string => {
        try {
          return Buffer.from(b64, "base64").toString("utf8");
        } catch {
          return b64; // Return as-is if not valid base64
        }
      };

      const results = Array.from(mockStore.entries())
        .filter(([k]) => k.startsWith(`${namespaceFromPath}:`))
        .filter(([_, v]) => {
          // Decode base64 value before searching
          const decodedValue = decodeBase64(v);
          return decodedValue.toLowerCase().includes(query.toLowerCase());
        })
        .map(([k, v]) => ({
          memory: {
            key: k.split(":").slice(1).join(":"),
            value: v, // Keep base64 encoded value in response
          },
          relevanceScore: 0.95,
        }));

      // Build NDJSON response
      const ndjsonLines = results
        .map((result) => JSON.stringify(result))
        .join("\n");
      const responseBody = ndjsonLines + (ndjsonLines ? "\n" : "");

      // Return as NDJSON
      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
      });
      res.end(responseBody);
      return;
    }

    // Unknown endpoint - log for debugging
    console.error(
      `[MOCK SERVER] 404 - Unmatched route: ${req.method} ${normalizedPath} (original: ${url.pathname})`
    );
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: "Endpoint not found",
        method: req.method,
        path: normalizedPath,
        originalPath: url.pathname,
      })
    );
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

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use. Please free the port or kill any existing mock server.`);
    process.exit(1);
  } else {
    console.error("❌ Server error:", error);
    process.exit(1);
  }
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
