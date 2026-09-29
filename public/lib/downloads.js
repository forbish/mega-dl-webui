import { TASK_STATUS } from "./constants.js";
import { state, $ } from "./state.js";
import {
  formatBytes,
  formatSpeed,
  formatDuration,
  escapeHtml,
} from "./format.js";
import { showToast } from "./toast.js";

const STATUS_ORDER = {
  [TASK_STATUS.DOWNLOADING]: 0,
  [TASK_STATUS.PAUSED]: 1,
  [TASK_STATUS.VERIFYING]: 2,
  [TASK_STATUS.PENDING]: 3,
  [TASK_STATUS.COMPLETED]: 4,
  [TASK_STATUS.SKIPPED]: 5,
  [TASK_STATUS.FAILED]: 6,
  [TASK_STATUS.CANCELLED]: 7,
};

const STATUS_CONFIG = {
  [TASK_STATUS.DOWNLOADING]: {
    detail: (task) => {
      const pct =
        task.size > 0
          ? Math.round((task.bytesDownloaded / task.size) * 100)
          : 0;
      const speedStr = task.speed > 0 ? ` — ${formatSpeed(task.speed)}` : "";
      const etaStr =
        task.speed > 0
          ? ` — ${formatDuration(((task.size - task.bytesDownloaded) / task.speed) * 1000)}`
          : "";
      return `${formatBytes(task.bytesDownloaded)} / ${formatBytes(task.size)} — ${pct}%${speedStr}${etaStr}`;
    },
    canCancel: true,
    canRetry: false,
  },
  [TASK_STATUS.COMPLETED]: {
    detail: (task) => formatBytes(task.size),
    canCancel: false,
    canRetry: false,
  },
  [TASK_STATUS.VERIFYING]: {
    detail: (task) => `${formatBytes(task.size)} — Verifying integrity…`,
    canCancel: true,
    canRetry: false,
  },
  [TASK_STATUS.PAUSED]: {
    detail: (task) =>
      `${formatBytes(task.bytesDownloaded)} / ${formatBytes(task.size)} — Paused`,
    canCancel: true,
    canRetry: false,
  },
  [TASK_STATUS.FAILED]: {
    detail: (task) =>
      `${formatBytes(task.bytesDownloaded)} / ${formatBytes(task.size)}`,
    canCancel: false,
    canRetry: true,
  },
  [TASK_STATUS.SKIPPED]: {
    detail: "Already exists",
    canCancel: false,
    canRetry: false,
  },
  [TASK_STATUS.PENDING]: {
    detail: "Waiting...",
    canCancel: true,
    canRetry: false,
  },
  [TASK_STATUS.CANCELLED]: {
    detail: "Cancelled",
    canCancel: false,
    canRetry: true,
  },
};

export async function downloadSelected() {
  if (state.selection.size === 0) {
    showToast("No files selected", "error");
    return;
  }

  const btn = $("#download-selected");
  btn.disabled = true;

  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: state.selection.toArray() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to start downloads");

    showToast(`Queued ${data.taskIds.length} download(s)`);
    state.selection.clear();
    $("#file-browser").classList.add("hidden");
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

export async function cancelDownload(taskId) {
  try {
    const res = await fetch("/api/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Cancel failed");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function retryDownload(taskId) {
  try {
    const res = await fetch("/api/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Retry failed");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function retryAllFailed() {
  try {
    const res = await fetch("/api/retry-all", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Retry failed");
    }
  } catch (err) {
    showToast(err.message, "error");
  }
}

export async function clearFinished() {
  try {
    const res = await fetch("/api/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Clear failed");
    }
    const clearable = new Set([
      TASK_STATUS.COMPLETED,
      TASK_STATUS.SKIPPED,
      TASK_STATUS.CANCELLED,
    ]);
    for (const [id, task] of state.downloads) {
      if (clearable.has(task.status)) {
        if (state.downloadCounts[task.status] > 0) {
          state.downloadCounts[task.status]--;
        }
        state.downloads.delete(id);
      }
    }
    renderDownloads();
  } catch (err) {
    showToast(err.message, "error");
  }
}

export function renderDownloadCard(task) {
  const pct =
    task.size > 0 ? Math.round((task.bytesDownloaded / task.size) * 100) : 0;
  const config = STATUS_CONFIG[task.status] || {};
  const detailText =
    typeof config.detail === "function"
      ? config.detail(task)
      : config.detail || "";

  const cancelHtml = config.canCancel
    ? `<button class="dl-cancel" data-cancel="${escapeHtml(task.id)}" title="Cancel"><svg class="icon"><use href="#icon-x"/></svg></button>`
    : "";

  const retryHtml = config.canRetry
    ? `<button class="dl-retry" data-retry="${escapeHtml(task.id)}" title="Retry"><svg class="icon"><use href="#icon-download"/></svg></button>`
    : "";

  const errorHtml =
    task.status === TASK_STATUS.FAILED && task.error
      ? `<div class="dl-error">${escapeHtml(task.error)}</div>`
      : "";

  return `<div class="dl-card status-${escapeHtml(task.status)}" data-task-id="${escapeHtml(task.id)}">
    <div class="dl-card-header">
      <span class="dl-name" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</span>
      ${retryHtml}${cancelHtml}
    </div>
    <div class="dl-progress-bar"><div class="dl-progress-fill" style="width:${pct}%"></div></div>
    <div class="dl-info">
      <span>${escapeHtml(detailText)}</span>
      <span class="dl-badge ${escapeHtml(task.status)}">${escapeHtml(task.status)}</span>
    </div>
    ${errorHtml}
  </div>`;
}

export function updateDownloadSummary() {
  const el = $("#dl-summary");
  const counts = state.downloadCounts;

  if (state.downloads.size === 0) {
    el.textContent = "";
    $("#retry-all-failed").classList.add("hidden");
    $("#clear-finished").classList.add("hidden");
    updatePauseButton();
    return;
  }

  const parts = [];
  if (counts.downloading) parts.push(`${counts.downloading} downloading`);
  if (counts.paused) parts.push(`${counts.paused} paused`);
  if (counts.verifying) parts.push(`${counts.verifying} verifying`);
  if (counts.pending) parts.push(`${counts.pending} pending`);
  if (counts.completed) parts.push(`${counts.completed} completed`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  if (counts.cancelled) parts.push(`${counts.cancelled} cancelled`);

  el.textContent = parts.join(" · ");

  const retryBtn = $("#retry-all-failed");
  retryBtn.classList.toggle("hidden", !counts.failed);

  const clearBtn = $("#clear-finished");
  const hasFinished = counts.completed || counts.skipped || counts.cancelled;
  clearBtn.classList.toggle("hidden", !hasFinished);

  updatePauseButton();
}

export function renderDownloads() {
  const list = $("#downloads-list");
  const empty = $("#no-downloads");

  if (state.downloads.size === 0) {
    list.innerHTML = "";
    empty.style.display = "";
    updateDownloadSummary();
    return;
  }

  empty.style.display = "none";
  const sorted = Array.from(state.downloads.values()).sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9),
  );
  list.innerHTML = sorted.map(renderDownloadCard).join("");
  updateDownloadSummary();
}

export function updateSingleDownload(task) {
  const existing = state.downloads.get(task.id);
  if (existing) {
    if (state.downloadCounts[existing.status] > 0) {
      state.downloadCounts[existing.status]--;
    }
  }
  state.downloadCounts[task.status] =
    (state.downloadCounts[task.status] || 0) + 1;

  state.downloads.set(task.id, task);
}

export function updatePauseButton() {
  const btn = $("#pause-resume");
  const hasActive =
    state.downloadCounts.downloading > 0 ||
    state.downloadCounts.pending > 0 ||
    state.downloadCounts.paused > 0;
  btn.classList.toggle("hidden", !hasActive);

  if (state.paused) {
    btn.textContent = "Resume";
    btn.title = "Resume all downloads";
  } else {
    btn.textContent = "Pause";
    btn.title = "Pause all downloads";
  }
}

export async function togglePause() {
  const endpoint = state.paused ? "/api/resume" : "/api/pause";
  state.paused = !state.paused;
  updatePauseButton();
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed");
    }
  } catch (err) {
    state.paused = !state.paused;
    updatePauseButton();
    showToast(err.message, "error");
  }
}

export function checkAllDoneNotification() {
  if (state.downloads.size === 0 || state.allDoneNotified) return;
  const counts = state.downloadCounts;
  if (counts.downloading || counts.pending || counts.paused || counts.verifying)
    return;
  const parts = [];
  if (counts.completed) parts.push(`${counts.completed} completed`);
  if (counts.skipped) parts.push(`${counts.skipped} skipped`);
  if (counts.failed) parts.push(`${counts.failed} failed`);
  if (counts.cancelled) parts.push(`${counts.cancelled} cancelled`);
  showToast(`All downloads finished: ${parts.join(", ")}`);
  state.allDoneNotified = true;
}
