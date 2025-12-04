import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { URL } from "node:url";

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

// Mock data store
const mockStore = new Map<string, string>();

// Helper functions
function normalizePath(pathname: string): string {
  return pathname.startsWith("/api") ? pathname.substring(4) : pathname;
}

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Supermemory-Namespace"
  );
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      resolve(body);
    });
  });
}

function decodeBase64(b64: string): string {
  try {
    return Buffer.from(b64, "base64").toString("utf8");
  } catch {
    return b64; // Return as-is if not valid base64
  }
}

function sendJsonResponse(
  res: ServerResponse,
  status: number,
  data: unknown
): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function sendNdjsonResponse(res: ServerResponse, items: unknown[]): void {
  const ndjsonLines = items.map((item) => JSON.stringify(item)).join("\n");
  const responseBody = ndjsonLines + (ndjsonLines ? "\n" : "");
  res.writeHead(200, { "Content-Type": "application/x-ndjson" });
  res.end(responseBody);
}

// Route handlers
async function handlePostMemory(
  req: IncomingMessage,
  res: ServerResponse,
  namespace: string
): Promise<void> {
  const body = await readRequestBody(req);
  try {
    const { id, value, namespace: bodyNamespace } = JSON.parse(body);
    const effectiveNamespace = namespace || bodyNamespace;
    const fullKey = `${effectiveNamespace}:${id}`;
    const now = new Date().toISOString();
    mockStore.set(fullKey, value);

    sendJsonResponse(res, 200, {
      id,
      value,
      namespace: effectiveNamespace,
      createdAt: now,
      updatedAt: now,
    });
  } catch {
    sendJsonResponse(res, 400, { error: "Invalid JSON" });
  }
}

function handleGetMemory(
  res: ServerResponse,
  id: string,
  namespace: string
): void {
  const fullKey = `${namespace}:${id}`;
  const value = mockStore.get(fullKey);

  if (!value) {
    sendJsonResponse(res, 404, { error: "Memory not found" });
    return;
  }

  const now = new Date().toISOString();
  sendJsonResponse(res, 200, {
    id,
    value,
    namespace,
    createdAt: now,
    updatedAt: now,
  });
}

function handleDeleteMemory(
  res: ServerResponse,
  id: string,
  namespace: string
): void {
  const fullKey = `${namespace}:${id}`;
  mockStore.delete(fullKey);
  res.writeHead(204);
  res.end();
}

function handleClearNamespace(
  res: ServerResponse,
  namespaceParam: string
): void {
  const keysToDelete = Array.from(mockStore.keys()).filter((k) =>
    k.startsWith(`${namespaceParam}:`)
  );
  for (const key of keysToDelete) {
    mockStore.delete(key);
  }
  res.writeHead(204);
  res.end();
}

function handleListKeys(res: ServerResponse, namespace: string): void {
  const keys = Array.from(mockStore.keys())
    .filter((k) => k.startsWith(`${namespace}:`))
    .map((k) => k.split(":").slice(1).join(":"));
  const items = keys.map((key) => ({ key }));
  sendNdjsonResponse(res, items);
}

function handleSearch(
  res: ServerResponse,
  namespace: string,
  query: string
): void {
  const results = Array.from(mockStore.entries())
    .filter(([k]) => k.startsWith(`${namespace}:`))
    .filter(([_, v]) => {
      const decodedValue = decodeBase64(v);
      return decodedValue.toLowerCase().includes(query.toLowerCase());
    })
    .map(([k, v]) => ({
      memory: {
        key: k.split(":").slice(1).join(":"),
        value: v,
      },
      relevanceScore: 0.95,
    }));
  sendNdjsonResponse(res, results);
}

async function handleBatchPut(
  req: IncomingMessage,
  res: ServerResponse,
  namespace: string
): Promise<void> {
  const body = await readRequestBody(req);
  try {
    const { items, namespace: bodyNamespace } = JSON.parse(body);
    const effectiveNamespace = namespace || bodyNamespace;
    const results: Array<{ id: string; status: number }> = [];

    if (!(items && Array.isArray(items))) {
      sendJsonResponse(res, 400, { error: "Invalid items array" });
      return;
    }

    if (items.length === 0) {
      sendJsonResponse(res, 200, { results: [] });
      return;
    }

    for (const item of items) {
      const fullKey = `${effectiveNamespace}:${item.id}`;
      mockStore.set(fullKey, item.value);
      results.push({ id: item.id, status: 201 });
    }

    sendJsonResponse(res, 200, { results });
  } catch {
    sendJsonResponse(res, 400, { error: "Invalid JSON" });
  }
}

async function handleBatchDelete(
  req: IncomingMessage,
  res: ServerResponse,
  namespace: string
): Promise<void> {
  const body = await readRequestBody(req);
  try {
    const { keys, namespace: bodyNamespace } = JSON.parse(body);
    const effectiveNamespace = namespace || bodyNamespace;
    const results: Array<{ id: string; status: number }> = [];

    if (!(keys && Array.isArray(keys))) {
      sendJsonResponse(res, 400, { error: "Invalid keys array" });
      return;
    }

    if (keys.length === 0) {
      sendJsonResponse(res, 200, { results: [] });
      return;
    }

    for (const key of keys) {
      const fullKey = `${effectiveNamespace}:${key}`;
      const existed = mockStore.has(fullKey);
      mockStore.delete(fullKey);
      results.push({ id: key, status: existed ? 204 : 404 });
    }

    sendJsonResponse(res, 200, { results });
  } catch {
    sendJsonResponse(res, 400, { error: "Invalid JSON" });
  }
}

async function handleBatchGet(
  req: IncomingMessage,
  res: ServerResponse,
  namespace: string
): Promise<void> {
  const body = await readRequestBody(req);
  try {
    const { keys, namespace: bodyNamespace } = JSON.parse(body);
    const effectiveNamespace = namespace || bodyNamespace;
    const results: Array<{
      id: string;
      status: number;
      value?: string;
    }> = [];

    if (!(keys && Array.isArray(keys))) {
      sendJsonResponse(res, 400, { error: "Invalid keys array" });
      return;
    }

    if (keys.length === 0) {
      sendJsonResponse(res, 200, { results: [] });
      return;
    }

    for (const key of keys) {
      const fullKey = `${effectiveNamespace}:${key}`;
      const value = mockStore.get(fullKey);
      if (value) {
        results.push({ id: key, status: 200, value });
      } else {
        results.push({ id: key, status: 404 });
      }
    }

    sendJsonResponse(res, 200, { results });
  } catch {
    sendJsonResponse(res, 400, { error: "Invalid JSON" });
  }
}

// Route handler options
type RouteHandlerOptions = {
  req: IncomingMessage;
  res: ServerResponse;
  url: URL;
  normalizedPath: string;
  namespace: string;
};

async function handleMemoryRoutes(
  options: RouteHandlerOptions
): Promise<boolean> {
  const { req, res, normalizedPath, namespace } = options;
  const method = req.method;

  // POST /v1/memories - Create/update memory
  if (normalizedPath === "/v1/memories" && method === "POST") {
    await handlePostMemory(req, res, namespace);
    return true;
  }

  // GET /v1/memories/{id} - Get memory
  if (normalizedPath.startsWith("/v1/memories/") && method === "GET") {
    const id = normalizedPath.split("/v1/memories/")[1];
    handleGetMemory(res, id, namespace);
    return true;
  }

  // DELETE /v1/memories/{id} - Delete memory
  if (normalizedPath.startsWith("/v1/memories/") && method === "DELETE") {
    const id = normalizedPath.split("/v1/memories/")[1];
    handleDeleteMemory(res, id, namespace);
    return true;
  }

  // DELETE /v1/memories - Clear namespace
  if (normalizedPath === "/v1/memories" && method === "DELETE") {
    const namespaceParam =
      options.url.searchParams.get("namespace") || namespace;
    handleClearNamespace(res, namespaceParam);
    return true;
  }

  return false;
}

async function handleBatchRoutes(
  options: RouteHandlerOptions
): Promise<boolean> {
  const { req, res, normalizedPath, namespace } = options;
  const method = req.method;

  // POST /v1/memories/batch - Batch put
  if (normalizedPath === "/v1/memories/batch" && method === "POST") {
    await handleBatchPut(req, res, namespace);
    return true;
  }

  // DELETE /v1/memories/batch - Batch delete
  if (normalizedPath === "/v1/memories/batch" && method === "DELETE") {
    await handleBatchDelete(req, res, namespace);
    return true;
  }

  // POST /v1/memories/batchGet - Batch get
  if (normalizedPath === "/v1/memories/batchGet" && method === "POST") {
    await handleBatchGet(req, res, namespace);
    return true;
  }

  return false;
}

function handleStreamRoutes(options: RouteHandlerOptions): boolean {
  const { res, normalizedPath, url } = options;
  const method = options.req.method;

  // GET /v1/keys/{namespace} - List keys
  if (normalizedPath.startsWith("/v1/keys/") && method === "GET") {
    const namespaceFromPath = decodeURIComponent(
      normalizedPath.split("/v1/keys/")[1]
    );
    handleListKeys(res, namespaceFromPath);
    return true;
  }

  // GET /v1/search/{namespace}/stream - Search
  if (
    normalizedPath.startsWith("/v1/search/") &&
    normalizedPath.endsWith("/stream") &&
    method === "GET"
  ) {
    const pathParts = normalizedPath.split("/");
    const namespaceFromPath = decodeURIComponent(pathParts[3]);
    const query = url.searchParams.get("q") || "";
    handleSearch(res, namespaceFromPath, query);
    return true;
  }

  return false;
}

// Route handler
async function handleRoute(options: RouteHandlerOptions): Promise<void> {
  const { req, res, url, normalizedPath } = options;

  if (await handleMemoryRoutes(options)) {
    return;
  }

  if (await handleBatchRoutes(options)) {
    return;
  }

  if (handleStreamRoutes(options)) {
    return;
  }

  // Unknown endpoint
  console.error(
    `[MOCK SERVER] 404 - Unmatched route: ${req.method} ${normalizedPath} (original: ${url.pathname})`
  );
  sendJsonResponse(res, 404, {
    error: "Endpoint not found",
    method: req.method,
    path: normalizedPath,
    originalPath: url.pathname,
  });
}

// Main request handler
const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    setCorsHeaders(res);

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url || "/", BASE_URL);
      const namespace =
        (req.headers["x-supermemory-namespace"] as string) || "";
      const normalizedPath = normalizePath(url.pathname);

      console.log(`${req.method} ${url.pathname} - Namespace: ${namespace}`);
      console.log(`Normalized path: ${normalizedPath}`);

      await handleRoute({ req, res, url, normalizedPath, namespace });
    } catch (error) {
      console.error("Server error:", error);
      sendJsonResponse(res, 500, { error: "Internal server error" });
    }
  }
);

server.listen(PORT, () => {
  console.log(`🚀 Mock Supermemory API server running on ${BASE_URL}`);
  console.log(`📝 Mock store has ${mockStore.size} items`);
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `❌ Port ${PORT} is already in use. Please free the port or kill any existing mock server.`
    );
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
