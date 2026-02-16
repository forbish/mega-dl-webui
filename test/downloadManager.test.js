import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DownloadManager } from "../server/downloadManager.js";
import { TASK_STATUS } from "../server/constants.js";

describe("DownloadManager", () => {
  describe("_sanitizeTask", () => {
    it("strips internal fields prefixed with _", () => {
      const dm = new DownloadManager("/tmp", {
        maxConcurrent: 1,
        verifyDownloads: false,
      });
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 1024,
        status: "pending",
        bytesDownloaded: 0,
        speed: 0,
        error: null,
        destPath: "/data/test.txt",
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
      };

      const clean = dm._sanitizeTask(task);

      assert.equal(clean.id, "s1-0");
      assert.equal(clean.name, "test.txt");
      assert.equal(clean.size, 1024);
      assert.equal(clean.status, "pending");
      assert.equal(clean._stream, undefined);
      assert.equal(clean._existingStat, undefined);
      assert.equal(clean.destPath, undefined);
    });
  });

  describe("getStatus", () => {
    it("returns empty array when no tasks exist", () => {
      const dm = new DownloadManager("/tmp");
      assert.deepEqual(dm.getStatus(), []);
    });
  });

  describe("cancelTask", () => {
    it("does nothing for nonexistent task", () => {
      const dm = new DownloadManager("/tmp");
      dm.cancelTask("nonexistent");
    });
  });

  describe("retryTask", () => {
    it("does nothing for nonexistent task", () => {
      const dm = new DownloadManager("/tmp");
      dm.retryTask("nonexistent");
    });
  });

  describe("clearFinished", () => {
    it("does nothing when no tasks exist", () => {
      const dm = new DownloadManager("/tmp");
      dm.clearFinished();
      assert.deepEqual(dm.getStatus(), []);
    });

    it("removes completed, skipped, and cancelled but preserves failed", () => {
      const dm = new DownloadManager("/tmp");
      const makeTask = (id, status) => ({
        id,
        name: `${id}.txt`,
        size: 100,
        status,
        bytesDownloaded: 100,
        speed: 0,
        error: status === TASK_STATUS.FAILED ? "test error" : null,
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
      });

      dm.tasks.set("s1-0", makeTask("s1-0", TASK_STATUS.COMPLETED));
      dm.tasks.set("s1-1", makeTask("s1-1", TASK_STATUS.SKIPPED));
      dm.tasks.set("s1-2", makeTask("s1-2", TASK_STATUS.CANCELLED));
      dm.tasks.set("s1-3", makeTask("s1-3", TASK_STATUS.FAILED));

      dm.clearFinished();

      const remaining = dm.getStatus();
      assert.equal(remaining.length, 1);
      assert.equal(remaining[0].id, "s1-3");
      assert.equal(remaining[0].status, TASK_STATUS.FAILED);
    });
  });

  describe("retryAllFailed", () => {
    it("does nothing when no tasks exist", () => {
      const dm = new DownloadManager("/tmp");
      dm.retryAllFailed();
      assert.deepEqual(dm.getStatus(), []);
    });

    it("retries failed tasks and leaves others unchanged", () => {
      const dm = new DownloadManager("/tmp", { maxConcurrent: 0 });
      const makeTask = (id, status) => ({
        id,
        name: `${id}.txt`,
        size: 100,
        status,
        bytesDownloaded: 0,
        speed: 0,
        error: status === TASK_STATUS.FAILED ? "network error" : null,
        destPath: `/tmp/${id}.txt`,
        startedAt: null,
        completedAt: null,
      });

      dm.tasks.set("s1-0", makeTask("s1-0", TASK_STATUS.FAILED));
      dm.tasks.set("s1-1", makeTask("s1-1", TASK_STATUS.COMPLETED));
      dm.tasks.set("s1-2", makeTask("s1-2", TASK_STATUS.PENDING));
      dm.tasks.set("s1-3", makeTask("s1-3", TASK_STATUS.CANCELLED));

      dm.retryAllFailed();

      assert.equal(dm.tasks.get("s1-0").status, TASK_STATUS.PENDING);
      assert.equal(dm.tasks.get("s1-1").status, TASK_STATUS.COMPLETED);
      assert.equal(dm.tasks.get("s1-2").status, TASK_STATUS.PENDING);
      assert.equal(dm.tasks.get("s1-3").status, TASK_STATUS.CANCELLED);
    });
  });

  describe("constructor defaults", () => {
    it("uses default settings", () => {
      const dm = new DownloadManager("/tmp");
      assert.equal(dm.maxConcurrent, 4);
      assert.equal(dm.retryCount, 12);
      assert.equal(dm.verifyDownloads, true);
    });

    it("accepts custom settings", () => {
      const dm = new DownloadManager("/tmp", {
        maxConcurrent: 2,
        retryCount: 3,
        verifyDownloads: false,
      });
      assert.equal(dm.maxConcurrent, 2);
      assert.equal(dm.retryCount, 3);
      assert.equal(dm.verifyDownloads, false);
    });
  });
});
