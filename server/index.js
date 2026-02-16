import express from "express";
import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DownloadManager } from "./downloadManager.js";
import { asyncHandler, broadcastToClients } from "./utils.js";
import { isValidMegaUrl, requireArray, requireString } from "./validation.js";
import { WS_MESSAGE } from "./constants.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 8080;
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR || "/data";
const MAX_CONCURRENT = parseInt(process.env.MAX_CONCURRENT, 10) || 4;
const RETRY_COUNT = parseInt(process.env.RETRY_COUNT, 10) || 8;
const VERIFY_DOWNLOADS = process.env.VERIFY_DOWNLOADS !== "false";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: "1h" }));

const downloadManager = new DownloadManager(DOWNLOAD_DIR, {
  maxConcurrent: MAX_CONCURRENT,
  retryCount: RETRY_COUNT,
  verifyDownloads: VERIFY_DOWNLOADS,
});

app.post(
  "/api/load",
  asyncHandler(async (req, res) => {
    const { url } = req.body;
    if (!isValidMegaUrl(url)) {
      return res.status(400).json({ error: "Invalid MEGA URL" });
    }
    const tree = await downloadManager.addUrl(url);
    res.json(tree);
  }),
);

app.post(
  "/api/download",
  asyncHandler(async (req, res) => {
    const { fileIds } = req.body;
    requireArray(fileIds, "fileIds");
    const taskIds = await downloadManager.enqueueFiles(fileIds);
    res.json({ taskIds });
  }),
);

app.post(
  "/api/cancel",
  asyncHandler((req, res) => {
    const { taskId } = req.body;
    requireString(taskId, "taskId");
    downloadManager.cancelTask(taskId);
    res.json({ success: true });
  }),
);

app.post(
  "/api/retry",
  asyncHandler((req, res) => {
    const { taskId } = req.body;
    requireString(taskId, "taskId");
    downloadManager.retryTask(taskId);
    res.json({ success: true });
  }),
);

app.post(
  "/api/clear",
  asyncHandler((req, res) => {
    downloadManager.clearFinished();
    broadcastQueue.clear();
    broadcastToClients(
      wss,
      JSON.stringify({
        type: WS_MESSAGE.STATUS,
        tasks: downloadManager.getStatus(),
      }),
    );
    res.json({ success: true });
  }),
);

app.get(
  "/api/status",
  asyncHandler((req, res) => {
    res.json(downloadManager.getStatus());
  }),
);

app.get(
  "/api/settings",
  asyncHandler((req, res) => {
    res.json({ verifyDownloads: downloadManager.verifyDownloads });
  }),
);

app.patch(
  "/api/settings",
  asyncHandler((req, res) => {
    const { verifyDownloads } = req.body;
    if (typeof verifyDownloads === "boolean") {
      downloadManager.verifyDownloads = verifyDownloads;
    }
    res.json({ verifyDownloads: downloadManager.verifyDownloads });
  }),
);

app.get(
  "/api/health",
  asyncHandler((req, res) => {
    res.json({ status: "ok" });
  }),
);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws) => {
  try {
    ws.send(
      JSON.stringify({
        type: WS_MESSAGE.STATUS,
        tasks: downloadManager.getStatus(),
      }),
    );
  } catch {
    /* client disconnected */
  }
});

const broadcastQueue = new Map();
downloadManager.on("task:update", (task) => {
  broadcastQueue.set(task.id, task);
});

setInterval(() => {
  if (broadcastQueue.size === 0) return;
  const message = JSON.stringify({
    type: WS_MESSAGE.TASKS_UPDATE,
    data: Array.from(broadcastQueue.values()),
  });
  broadcastToClients(wss, message);
  broadcastQueue.clear();
}, 50);

server.listen(PORT, () => {
  console.log(`mega-dl-webui listening on port ${PORT}`);
  console.log(`Download directory: ${DOWNLOAD_DIR}`);
  console.log(`Max concurrent downloads: ${MAX_CONCURRENT}`);
  console.log(`Retry count: ${RETRY_COUNT}`);
  console.log(`Verify downloads: ${VERIFY_DOWNLOADS}`);
});

function shutdown() {
  console.log("Shutting down...");
  for (const client of wss.clients) {
    client.close();
  }
  downloadManager.cancelAll();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
