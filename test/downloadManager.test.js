import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DownloadManager } from "../server/downloadManager.js";

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
  });

  describe("constructor defaults", () => {
    it("uses default settings", () => {
      const dm = new DownloadManager("/tmp");
      assert.equal(dm.maxConcurrent, 4);
      assert.equal(dm.retryCount, 8);
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
