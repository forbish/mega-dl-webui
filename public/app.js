import { state, $ } from "./lib/state.js";
import { initTheme, toggleTheme } from "./lib/theme.js";
import { showToast } from "./lib/toast.js";
import {
  renderFileTree,
  handleTreeClick,
  selectAll,
  selectNone,
} from "./lib/tree.js";
import {
  downloadSelected,
  cancelDownload,
  retryDownload,
  clearCompleted,
} from "./lib/downloads.js";
import { connectWs } from "./lib/websocket.js";

async function fetchSettings() {
  try {
    const res = await fetch("/api/settings");
    const data = await res.json();
    $("#verify-downloads").checked = data.verifyDownloads;
  } catch {
    /* use default */
  }
}

async function loadUrl(url) {
  const btn = $("#load-btn");
  btn.classList.add("loading");
  btn.disabled = true;

  try {
    const res = await fetch("/api/load", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to load");

    state.selection.clear();
    renderFileTree(data);
    $("#file-browser").classList.remove("hidden");
    $("#mega-url").value = "";
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

function init() {
  initTheme();

  $("#theme-toggle").addEventListener("click", toggleTheme);

  $("#url-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const url = $("#mega-url").value.trim();
    if (url) loadUrl(url);
  });

  $("#file-tree").addEventListener("click", handleTreeClick);
  $("#select-all").addEventListener("click", selectAll);
  $("#select-none").addEventListener("click", selectNone);
  $("#download-selected").addEventListener("click", downloadSelected);

  $("#downloads-list").addEventListener("click", (e) => {
    const cancelBtn = e.target.closest("[data-cancel]");
    if (cancelBtn) cancelDownload(cancelBtn.dataset.cancel);
    const retryBtn = e.target.closest("[data-retry]");
    if (retryBtn) retryDownload(retryBtn.dataset.retry);
  });

  $("#clear-completed").addEventListener("click", clearCompleted);

  $("#verify-downloads").addEventListener("change", async (e) => {
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifyDownloads: e.target.checked }),
      });
    } catch {
      showToast("Failed to update setting", "error");
      e.target.checked = !e.target.checked;
    }
  });

  fetchSettings();
  connectWs();
}

init();
