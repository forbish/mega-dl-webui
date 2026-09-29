import { TreeSelection } from "./tree-selection.js";

export const state = {
  selection: new TreeSelection(),
  downloads: new Map(),
  downloadCounts: {
    pending: 0,
    downloading: 0,
    paused: 0,
    verifying: 0,
    completed: 0,
    skipped: 0,
    failed: 0,
    cancelled: 0,
  },
  allDoneNotified: false,
  paused: false,
};

export const $ = (sel) => document.querySelector(sel);
export const $$ = (sel) => document.querySelectorAll(sel);
