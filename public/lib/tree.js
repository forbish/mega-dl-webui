import { state, $, $$ } from "./state.js";
import { formatBytes, escapeHtml } from "./format.js";

export function renderFileTree(tree) {
  const name = tree.name || "Shared File";
  $("#folder-name").textContent = name;

  if (tree.directory && tree.children) {
    $("#file-tree").innerHTML = tree.children
      .map((c) => renderTreeNode(c, 0))
      .join("");
  } else {
    $("#file-tree").innerHTML = renderTreeNode(tree, 0);
  }
  updateCheckboxStates();
}

function renderTreeNode(node, depth) {
  const isDir = node.directory;
  const size = node.size || 0;
  const hasChildren = isDir && node.children?.length > 0;

  const toggleHtml = hasChildren
    ? `<span class="tree-toggle expanded"><svg class="icon"><use href="#icon-chevron"/></svg></span>`
    : `<span class="tree-toggle placeholder"></span>`;

  const iconHtml = isDir
    ? `<svg class="icon tree-icon folder"><use href="#icon-folder"/></svg>`
    : `<svg class="icon tree-icon"><use href="#icon-file"/></svg>`;

  const childrenHtml = hasChildren
    ? `<div class="tree-children" data-parent="${node.id}">${node.children.map((c) => renderTreeNode(c, depth + 1)).join("")}</div>`
    : "";

  return `<div class="tree-item" data-id="${escapeHtml(node.id)}" data-dir="${isDir}" style="--depth:${depth}">
    ${toggleHtml}
    <input type="checkbox" class="tree-checkbox" data-id="${escapeHtml(node.id)}" data-dir="${isDir}">
    ${iconHtml}
    <span class="tree-name">${escapeHtml(node.name)}</span>
    <span class="tree-size">${formatBytes(size)}</span>
  </div>${childrenHtml}`;
}

function updateCheckboxStates() {
  const folders = Array.from($$('.tree-checkbox[data-dir="true"]')).reverse();
  folders.forEach((cb) => {
    const nodeId = cb.dataset.id;
    const container = document.querySelector(
      `.tree-children[data-parent="${nodeId}"]`,
    );
    if (!container) return;

    const directChildCheckboxes = container.querySelectorAll(
      `:scope > .tree-item > .tree-checkbox`,
    );
    if (directChildCheckboxes.length === 0) return;

    const allChecked = Array.from(directChildCheckboxes).every(
      (c) => c.checked && !c.indeterminate,
    );
    const someChecked = Array.from(directChildCheckboxes).some(
      (c) => c.checked || c.indeterminate,
    );
    cb.checked = allChecked;
    cb.indeterminate = someChecked && !allChecked;
  });
}

export function handleTreeClick(e) {
  const item = e.target.closest(".tree-item");
  if (!item) return;

  const checkbox = item.querySelector(".tree-checkbox");
  const toggle = item.querySelector(".tree-toggle:not(.placeholder)");
  const isDir = item.dataset.dir === "true";
  const nodeId = item.dataset.id;

  if (e.target.closest(".tree-checkbox")) {
    const isChecked = checkbox.checked;
    if (isDir) {
      const container = document.querySelector(
        `.tree-children[data-parent="${nodeId}"]`,
      );
      if (container) {
        const childFileIds = Array.from(
          container.querySelectorAll('.tree-checkbox[data-dir="false"]'),
        ).map((cb) => cb.dataset.id);
        state.selection.set(nodeId, true, childFileIds, isChecked);
        container.querySelectorAll(".tree-checkbox").forEach((cb) => {
          cb.checked = isChecked;
          cb.indeterminate = false;
        });
      }
    } else {
      state.selection.set(nodeId, false, [], isChecked);
    }
    updateCheckboxStates();
    return;
  }

  if (isDir && toggle) {
    toggle.classList.toggle("expanded");
    const container = document.querySelector(
      `.tree-children[data-parent="${nodeId}"]`,
    );
    if (container) {
      if (container.classList.contains("collapsed")) {
        container.classList.remove("collapsed");
        container.style.maxHeight = container.scrollHeight + "px";
        setTimeout(() => (container.style.maxHeight = "none"), 200);
      } else {
        container.style.maxHeight = container.scrollHeight + "px";
        requestAnimationFrame(() => {
          container.style.maxHeight = "0";
          container.classList.add("collapsed");
        });
      }
    }
  }
}

export function selectAll() {
  const fileIds = [];
  $$(".tree-checkbox").forEach((cb) => {
    cb.checked = true;
    cb.indeterminate = false;
    if (cb.dataset.dir === "false") fileIds.push(cb.dataset.id);
  });
  state.selection.selectAll(fileIds);
}

export function selectNone() {
  $$(".tree-checkbox").forEach((cb) => {
    cb.checked = false;
    cb.indeterminate = false;
  });
  state.selection.clear();
}
