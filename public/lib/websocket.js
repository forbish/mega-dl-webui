import { TASK_STATUS, WS_MESSAGE } from "./constants.js";
import { state, $ } from "./state.js";
import {
  updateSingleDownload,
  renderDownloads,
  checkAllDoneNotification,
} from "./downloads.js";

let reconnectDelay = 1000;

export function connectWs() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);
  state.ws = ws;

  ws.addEventListener("open", () => {
    reconnectDelay = 1000;
  });

  ws.addEventListener("message", (e) => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }

    if (msg.type === WS_MESSAGE.STATUS && Array.isArray(msg.tasks)) {
      state.downloads.clear();
      state.downloadCounts = {
        pending: 0,
        downloading: 0,
        verifying: 0,
        completed: 0,
        skipped: 0,
        failed: 0,
        cancelled: 0,
      };
      for (const task of msg.tasks) {
        state.downloads.set(task.id, task);
        state.downloadCounts[task.status] =
          (state.downloadCounts[task.status] || 0) + 1;
      }
      renderDownloads();
    } else if (
      msg.type === WS_MESSAGE.TASKS_UPDATE &&
      Array.isArray(msg.data)
    ) {
      for (const task of msg.data) {
        updateSingleDownload(task);
      }
      const empty = $("#no-downloads");
      if (state.downloads.size > 0) empty.style.display = "none";

      const hasActive = msg.data.some(
        (t) =>
          t.status === TASK_STATUS.DOWNLOADING ||
          t.status === TASK_STATUS.PENDING,
      );
      if (hasActive) state.allDoneNotified = false;

      checkAllDoneNotification();
    }
  });

  ws.addEventListener("close", () => {
    state.ws = null;
    setTimeout(() => {
      connectWs();
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    }, reconnectDelay);
  });

  ws.addEventListener("error", () => {
    ws.close();
  });
}
