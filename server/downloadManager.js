import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { verify } from "megajs";
import * as megaClient from "./megaClient.js";
import { orderBy } from "natural-orderby";
import { TASK_STATUS, extractSessionId } from "./constants.js";
import { ProgressTracker } from "./progressTracker.js";
import { assertPathSafe } from "./utils.js";

export class DownloadManager extends EventEmitter {
  constructor(
    downloadDir,
    { maxConcurrent = 4, retryCount = 12, verifyDownloads = true } = {},
  ) {
    super();
    this.downloadDir = downloadDir;
    this.maxConcurrent = maxConcurrent;
    this.retryCount = retryCount;
    this.verifyDownloads = verifyDownloads;
    this.tasks = new Map();
    this.sessions = new Map();
    this.activeCount = 0;
    this.queue = [];
    this.handleRetries = (tries, error, cb) => {
      if (tries >= this.retryCount) return cb(error);
      setTimeout(cb, 1000 * Math.pow(2, tries));
    };
  }

  async addUrl(url) {
    return megaClient.loadSharedLink(url);
  }

  async enqueueFiles(fileIds) {
    const taskIds = [];
    for (const id of fileIds) {
      const megaNode = megaClient.getNodeById(id);
      if (!megaNode) continue;

      const relativePath = megaClient.getNodePath(id);
      await this._enqueueNode(id, megaNode, relativePath, taskIds);
    }

    this._processQueue();
    return taskIds;
  }

  async _enqueueNode(id, megaNode, relativePath, taskIds) {
    const destPath = path.join(this.downloadDir, relativePath, megaNode.name);
    assertPathSafe(this.downloadDir, destPath);

    if (megaNode.directory) {
      fs.mkdirSync(destPath, { recursive: true });

      if (megaNode.children) {
        const sorted = orderBy(megaNode.children, (v) => v.name);
        for (const child of sorted) {
          const childId = megaClient.getIdForNode(child);
          if (childId) {
            await this._enqueueNode(
              childId,
              child,
              path.join(relativePath, megaNode.name),
              taskIds,
            );
          }
        }
      }
      return;
    }

    const existing = this.tasks.get(id);
    if (
      existing &&
      (existing.status === TASK_STATUS.PENDING ||
        existing.status === TASK_STATUS.DOWNLOADING ||
        existing.status === TASK_STATUS.VERIFYING)
    ) {
      taskIds.push(id);
      return;
    }

    const task = {
      id,
      name: megaNode.name,
      size: megaNode.size || 0,
      status: TASK_STATUS.PENDING,
      bytesDownloaded: 0,
      speed: 0,
      error: null,
      destPath,
      startedAt: null,
      completedAt: null,
      _stream: null,
      _existingStat: null,
    };

    const sessionId = extractSessionId(id);
    if (!this.sessions.has(sessionId)) this.sessions.set(sessionId, new Set());
    this.sessions.get(sessionId).add(id);

    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size >= megaNode.size) {
        task.status = TASK_STATUS.SKIPPED;
        task.bytesDownloaded = megaNode.size;
        task.completedAt = new Date().toISOString();
        this.tasks.set(id, task);
        this.emit("task:update", this._sanitizeTask(task));
        taskIds.push(id);
        return;
      }
    }

    const partPath = destPath + ".part";
    if (fs.existsSync(partPath)) {
      const stat = fs.statSync(partPath);
      task._existingStat = stat;
      task.bytesDownloaded = stat.size;
    }

    this.tasks.set(id, task);
    this.queue.push(id);
    taskIds.push(id);
    this.emit("task:update", this._sanitizeTask(task));
  }

  _processQueue() {
    while (this.activeCount < this.maxConcurrent && this.queue.length > 0) {
      const id = this.queue.shift();
      const task = this.tasks.get(id);
      if (!task || task.status !== TASK_STATUS.PENDING) continue;
      this.activeCount++;
      this._downloadTask(task).finally(() => {
        this.activeCount--;
        this._processQueue();
      });
    }
  }

  async _downloadTask(task) {
    task.status = TASK_STATUS.DOWNLOADING;
    task.startedAt = new Date().toISOString();
    this.emit("task:update", this._sanitizeTask(task));

    const megaNode = megaClient.getNodeById(task.id);
    if (!megaNode) {
      task.status = TASK_STATUS.FAILED;
      task.error = "MEGA node not found";
      this.emit("task:update", this._sanitizeTask(task));
      return;
    }

    let writeStream;
    try {
      fs.mkdirSync(path.dirname(task.destPath), { recursive: true });

      let start = 0;
      let resume = false;

      const partPath = task.destPath + ".part";
      let stat = task._existingStat;
      if (!stat && fs.existsSync(partPath)) {
        stat = fs.statSync(partPath);
      }
      if (stat && stat.size > 0 && stat.size < megaNode.size) {
        start = stat.size;
        resume = true;
      }

      const tracker = new ProgressTracker(megaNode.size);

      const { stream } = megaClient.downloadFile(megaNode, {
        start,
        handleRetries: this.handleRetries,
      });
      task._stream = stream;

      writeStream = fs.createWriteStream(
        partPath,
        resume ? { flags: "a" } : {},
      );

      console.log(`Downloading: ${task.name}`);

      await new Promise((resolve, reject) => {
        stream.on("progress", (info) => {
          if (task.status === TASK_STATUS.CANCELLED) return;
          task.bytesDownloaded = info.bytesLoaded + start;
          const update = tracker.update(task.bytesDownloaded);
          if (update) {
            task.speed = Math.round(update.speed);
            this.emit("task:update", this._sanitizeTask(task));
          }
        });

        stream.on("error", reject);
        writeStream.on("error", reject);
        writeStream.on("finish", resolve);

        stream.pipe(writeStream);
      });

      task.bytesDownloaded = megaNode.size;
      task.speed = 0;

      if (this.verifyDownloads && megaNode.key?.length === 32) {
        await this._verifyTask(task, megaNode, partPath);
      }

      fs.renameSync(partPath, task.destPath);
      task.status = TASK_STATUS.COMPLETED;
      task.completedAt = new Date().toISOString();
      console.log(`Completed: ${task.name}`);
    } catch (err) {
      writeStream?.destroy();
      if (task.status === TASK_STATUS.CANCELLED) return;
      if (task.status !== TASK_STATUS.FAILED) {
        task.status = TASK_STATUS.FAILED;
        task.error = err.message;
        console.error(`Failed: ${task.name} - ${err.message}`);
      }
      task.speed = 0;
    }

    task._stream = null;
    this.emit("task:update", this._sanitizeTask(task));
    this._tryCleanSession(task.id);
  }

  async _verifyTask(task, megaNode, filePath) {
    try {
      task.status = TASK_STATUS.VERIFYING;
      this.emit("task:update", this._sanitizeTask(task));
      console.log(`Verifying: ${task.name}`);

      const verifyStream = verify(megaNode.key);
      const readStream = fs.createReadStream(filePath);
      await new Promise((resolve, reject) => {
        readStream.on("error", reject);
        verifyStream.on("error", reject);
        verifyStream.on("finish", resolve);
        readStream.pipe(verifyStream);
      });
      console.log(`Verified: ${task.name}`);
    } catch (err) {
      task.status = TASK_STATUS.FAILED;
      task.error = `Verification failed: ${err.message}`;
      console.error(`Verification failed: ${task.name} - ${err.message}`);
      throw err;
    }
  }

  cancelTask(id) {
    const task = this.tasks.get(id);
    if (!task) return;

    if (task._stream) {
      task._stream.destroy(new Error("Download cancelled"));
    }

    task.status = TASK_STATUS.CANCELLED;
    task.speed = 0;
    task._stream = null;
    this.emit("task:update", this._sanitizeTask(task));
    this._tryCleanSession(id);
  }

  cancelAll() {
    for (const [id, task] of this.tasks) {
      if (
        task.status === TASK_STATUS.PENDING ||
        task.status === TASK_STATUS.DOWNLOADING
      ) {
        this.cancelTask(id);
      }
    }
    this.queue = [];
  }

  retryTask(id) {
    const task = this.tasks.get(id);
    if (!task) return;
    if (
      task.status !== TASK_STATUS.FAILED &&
      task.status !== TASK_STATUS.CANCELLED
    )
      return;

    task.status = TASK_STATUS.PENDING;
    task.error = null;
    task.speed = 0;
    task.completedAt = null;
    task._existingStat = null;
    this.queue.push(id);
    this.emit("task:update", this._sanitizeTask(task));
    this._processQueue();
  }

  retryAllFailed() {
    for (const [id, task] of this.tasks) {
      if (task.status !== TASK_STATUS.FAILED) continue;
      task.status = TASK_STATUS.PENDING;
      task.error = null;
      task.speed = 0;
      task.completedAt = null;
      task._existingStat = null;
      this.queue.push(id);
      this.emit("task:update", this._sanitizeTask(task));
    }
    this._processQueue();
  }

  clearFinished() {
    const clearable = new Set([
      TASK_STATUS.COMPLETED,
      TASK_STATUS.SKIPPED,
      TASK_STATUS.CANCELLED,
    ]);
    const affectedSessions = new Set();
    for (const [id, task] of this.tasks) {
      if (clearable.has(task.status)) {
        this.tasks.delete(id);
        const sessionId = extractSessionId(id);
        affectedSessions.add(sessionId);
      }
    }
    for (const sessionId of affectedSessions) {
      const taskIds = this.sessions.get(sessionId);
      if (!taskIds) continue;
      let canClean = true;
      for (const id of taskIds) {
        if (this.tasks.has(id)) {
          canClean = false;
          break;
        }
      }
      if (canClean) {
        megaClient.clearSession(sessionId);
        this.sessions.delete(sessionId);
      }
    }
  }

  getStatus() {
    return Array.from(this.tasks.values()).map((t) => this._sanitizeTask(t));
  }

  _tryCleanSession(taskId) {
    const sessionId = extractSessionId(taskId);
    const taskIds = this.sessions.get(sessionId);
    if (!taskIds) return;

    for (const id of taskIds) {
      const t = this.tasks.get(id);
      if (!t) continue;
      if (
        t.status === TASK_STATUS.PENDING ||
        t.status === TASK_STATUS.DOWNLOADING ||
        t.status === TASK_STATUS.VERIFYING
      )
        return;
      if (t.status === TASK_STATUS.FAILED || t.status === TASK_STATUS.CANCELLED)
        return;
    }

    megaClient.clearSession(sessionId);
    this.sessions.delete(sessionId);
  }

  _sanitizeTask(task) {
    const clean = {};
    for (const [key, value] of Object.entries(task)) {
      if (!key.startsWith("_") && key !== "destPath") {
        clean[key] = value;
      }
    }
    return clean;
  }
}
