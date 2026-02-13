export const TASK_STATUS = Object.freeze({
  PENDING: "pending",
  DOWNLOADING: "downloading",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  SKIPPED: "skipped",
  VERIFYING: "verifying",
});

export const WS_MESSAGE = Object.freeze({
  STATUS: "status",
  TASKS_UPDATE: "tasks:update",
});
