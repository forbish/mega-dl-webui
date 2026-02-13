import path from "node:path";

export function asyncHandler(fn) {
  return (req, res) => {
    Promise.resolve(fn(req, res)).catch((err) => {
      console.error("Handler error:", err.message);
      res.status(err.status || 500).json({ error: err.message });
    });
  };
}

export function assertPathSafe(basePath, targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(path.resolve(basePath) + path.sep)) {
    throw new Error("Path traversal detected");
  }
}

export function broadcastToClients(wss, message, excludeClient = null) {
  const msgStr =
    typeof message === "string" ? message : JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === 1 && client !== excludeClient) {
      try {
        client.send(msgStr);
      } catch {
        // client disconnected
      }
    }
  }
}
