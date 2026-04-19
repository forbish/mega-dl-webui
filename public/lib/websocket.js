import { TASK_STATUS, WS_MESSAGE } from "./constants.js";
import { state, $ } from "./state.js";
import {
  updateSingleDownload,
  renderDownloads,
  renderDownloadCard,
  updateDownloadSummary,
  checkAllDoneNotification,
  updatePauseButton,
} from "./downloads.js";

let reconnectDelay = 1000;

export function connectWs() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  const ws = new WebSocket(`${protocol}//${location.host}/ws`);

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
        paused: 0,
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
      if (typeof msg.paused === "boolean") {
        state.paused = msg.paused;
        updatePauseButton();
      }
      renderDownloads();
    } else if (
      msg.type === WS_MESSAGE.TASKS_UPDATE &&
      Array.isArray(msg.data)
    ) {
      let needsFullRender = false;
      for (const task of msg.data) {
        const isNew = !state.downloads.has(task.id);
        updateSingleDownload(task);
        if (isNew) {
          needsFullRender = true;
        } else if (!needsFullRender) {
          const card = $(`.dl-card[data-task-id="${CSS.escape(task.id)}"]`);
          if (card) {
            const temp = document.createElement("div");
            temp.innerHTML = renderDownloadCard(task);
            card.replaceWith(temp.firstElementChild);
          } else {
            needsFullRender = true;
          }
        }
      }
      if (needsFullRender) renderDownloads();
      else updateDownloadSummary();
      const empty = $("#no-downloads");
      if (state.downloads.size > 0) empty.style.display = "none";

      const hasActive = msg.data.some(
        (t) =>
          t.status === TASK_STATUS.DOWNLOADING ||
          t.status === TASK_STATUS.PENDING ||
          t.status === TASK_STATUS.PAUSED ||
          t.status === TASK_STATUS.VERIFYING,
      );
      if (hasActive) state.allDoneNotified = false;

      checkAllDoneNotification();
    }
  });

  ws.addEventListener("close", () => {
    setTimeout(() => {
      connectWs();
      reconnectDelay = Math.min(reconnectDelay * 2, 30000);
    }, reconnectDelay);
  });

  ws.addEventListener("error", () => {
    ws.close();
  });
}
