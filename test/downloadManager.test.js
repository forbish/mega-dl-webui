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
        _verifyStream: null,
        _tracker: { speed: 0 },
        _existingStat: null,
      };

      const clean = dm._sanitizeTask(task);

      assert.equal(clean.id, "s1-0");
      assert.equal(clean.name, "test.txt");
      assert.equal(clean.size, 1024);
      assert.equal(clean.status, "pending");
      assert.equal(clean._stream, undefined);
      assert.equal(clean._verifyStream, undefined);
      assert.equal(clean._tracker, undefined);
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

    it("does nothing for completed tasks", () => {
      const dm = new DownloadManager("/tmp");
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 100,
        status: TASK_STATUS.COMPLETED,
        bytesDownloaded: 100,
        speed: 0,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: null,
        completedAt: new Date().toISOString(),
        _stream: null,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);
      dm.cancelTask("s1-0");
      assert.equal(task.status, TASK_STATUS.COMPLETED);
    });
  });

  describe("retryTask", () => {
    it("does nothing for nonexistent task", () => {
      const dm = new DownloadManager("/tmp");
      dm.retryTask("nonexistent");
    });

    it("does not retry paused tasks", () => {
      const dm = new DownloadManager("/tmp");
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 100,
        status: TASK_STATUS.PAUSED,
        bytesDownloaded: 50,
        speed: 0,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
        _demo: false,
      };
      dm.tasks.set("s1-0", task);
      dm.retryTask("s1-0");
      assert.equal(task.status, TASK_STATUS.PAUSED);
      assert.equal(dm.queue.length, 0);
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

    it("preserves paused tasks", () => {
      const dm = new DownloadManager("/tmp");
      const makeTask = (id, status) => ({
        id,
        name: `${id}.txt`,
        size: 100,
        status,
        bytesDownloaded: 50,
        speed: 0,
        error: null,
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
      });

      dm.tasks.set("s1-0", makeTask("s1-0", TASK_STATUS.PAUSED));
      dm.tasks.set("s1-1", makeTask("s1-1", TASK_STATUS.COMPLETED));

      dm.clearFinished();

      assert.equal(dm.tasks.size, 1);
      assert.equal(dm.tasks.get("s1-0").status, TASK_STATUS.PAUSED);
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
      assert.equal(dm.paused, false);
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

  describe("pause", () => {
    it("sets paused flag to true", () => {
      const dm = new DownloadManager("/tmp");
      dm.pause();
      assert.equal(dm.paused, true);
    });

    it("is idempotent when already paused", () => {
      const dm = new DownloadManager("/tmp");
      dm.pause();
      dm.pause();
      assert.equal(dm.paused, true);
    });

    it("transitions DOWNLOADING tasks to PAUSED and calls stream.pause()", () => {
      const dm = new DownloadManager("/tmp");
      let streamPaused = false;
      const fakeStream = { pause() { streamPaused = true; } };
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 1000,
        status: TASK_STATUS.DOWNLOADING,
        bytesDownloaded: 500,
        speed: 1000,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: new Date().toISOString(),
        completedAt: null,
        _stream: fakeStream,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);

      dm.pause();

      assert.equal(task.status, TASK_STATUS.PAUSED);
      assert.equal(task.speed, 0);
      assert.equal(streamPaused, true);
    });

    it("emits task:update for each transitioned task", () => {
      const dm = new DownloadManager("/tmp");
      const fakeStream = { pause() {} };
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 1000,
        status: TASK_STATUS.DOWNLOADING,
        bytesDownloaded: 500,
        speed: 1000,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: new Date().toISOString(),
        completedAt: null,
        _stream: fakeStream,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);

      const emitted = [];
      dm.on("task:update", (t) => emitted.push(t));
      dm.pause();

      assert.equal(emitted.length, 1);
      assert.equal(emitted[0].id, "s1-0");
      assert.equal(emitted[0].status, TASK_STATUS.PAUSED);
    });

    it("does not touch non-DOWNLOADING tasks", () => {
      const dm = new DownloadManager("/tmp");
      const pending = {
        id: "s1-0",
        name: "a.txt",
        size: 100,
        status: TASK_STATUS.PENDING,
        bytesDownloaded: 0,
        speed: 0,
        error: null,
        destPath: "/tmp/a.txt",
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", pending);

      dm.pause();

      assert.equal(pending.status, TASK_STATUS.PENDING);
    });

    it("marks DOWNLOADING task as PAUSED even without _stream", () => {
      const dm = new DownloadManager("/tmp");
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 1000,
        status: TASK_STATUS.DOWNLOADING,
        bytesDownloaded: 0,
        speed: 0,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: new Date().toISOString(),
        completedAt: null,
        _stream: null,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);

      dm.pause();

      assert.equal(task.status, TASK_STATUS.PAUSED);
    });
  });

  describe("resume", () => {
    it("sets paused flag to false", () => {
      const dm = new DownloadManager("/tmp");
      dm.paused = true;
      dm.resume();
      assert.equal(dm.paused, false);
    });

    it("is idempotent when not paused", () => {
      const dm = new DownloadManager("/tmp");
      dm.resume();
      assert.equal(dm.paused, false);
    });

    it("transitions PAUSED tasks to DOWNLOADING and calls stream.resume()", () => {
      const dm = new DownloadManager("/tmp");
      dm.paused = true;
      let streamResumed = false;
      const fakeStream = { resume() { streamResumed = true; } };
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 1000,
        status: TASK_STATUS.PAUSED,
        bytesDownloaded: 500,
        speed: 0,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: new Date().toISOString(),
        completedAt: null,
        _stream: fakeStream,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);

      dm.resume();

      assert.equal(task.status, TASK_STATUS.DOWNLOADING);
      assert.equal(streamResumed, true);
    });

    it("does not touch non-PAUSED tasks", () => {
      const dm = new DownloadManager("/tmp");
      dm.paused = true;
      const pending = {
        id: "s1-0",
        name: "a.txt",
        size: 100,
        status: TASK_STATUS.PENDING,
        bytesDownloaded: 0,
        speed: 0,
        error: null,
        destPath: "/tmp/a.txt",
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
      };
      const failed = {
        id: "s1-1",
        name: "b.txt",
        size: 100,
        status: TASK_STATUS.FAILED,
        bytesDownloaded: 50,
        speed: 0,
        error: "oops",
        destPath: "/tmp/b.txt",
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", pending);
      dm.tasks.set("s1-1", failed);

      dm.resume();

      assert.equal(pending.status, TASK_STATUS.PENDING);
      assert.equal(failed.status, TASK_STATUS.FAILED);
    });

    it("transitions PAUSED task to DOWNLOADING even without _stream", () => {
      const dm = new DownloadManager("/tmp");
      dm.paused = true;
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 1000,
        status: TASK_STATUS.PAUSED,
        bytesDownloaded: 0,
        speed: 0,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: new Date().toISOString(),
        completedAt: null,
        _stream: null,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);

      dm.resume();

      assert.equal(task.status, TASK_STATUS.DOWNLOADING);
    });
  });

  describe("_processQueue", () => {
    it("does not dequeue when paused", () => {
      const dm = new DownloadManager("/tmp", { maxConcurrent: 4 });
      dm.paused = true;
      dm.queue.push("s1-0");
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 100,
        status: TASK_STATUS.PENDING,
        bytesDownloaded: 0,
        speed: 0,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);

      dm._processQueue();

      assert.equal(task.status, TASK_STATUS.PENDING);
      assert.equal(dm.activeCount, 0);
    });
  });

  describe("cancelAll", () => {
    it("cancels PAUSED tasks", () => {
      const dm = new DownloadManager("/tmp");
      let streamDestroyed = false;
      const fakeStream = { destroy() { streamDestroyed = true; } };
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 1000,
        status: TASK_STATUS.PAUSED,
        bytesDownloaded: 500,
        speed: 0,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: null,
        completedAt: null,
        _stream: fakeStream,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);

      dm.cancelAll();

      assert.equal(task.status, TASK_STATUS.CANCELLED);
      assert.equal(streamDestroyed, true);
    });

    it("cancels VERIFYING tasks", () => {
      const dm = new DownloadManager("/tmp");
      const task = {
        id: "s1-0",
        name: "test.txt",
        size: 1000,
        status: TASK_STATUS.VERIFYING,
        bytesDownloaded: 1000,
        speed: 0,
        error: null,
        destPath: "/tmp/test.txt",
        startedAt: null,
        completedAt: null,
        _stream: null,
        _existingStat: null,
      };
      dm.tasks.set("s1-0", task);

      dm.cancelAll();

      assert.equal(task.status, TASK_STATUS.CANCELLED);
    });
  });
});
