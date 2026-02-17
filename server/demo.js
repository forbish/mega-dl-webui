import { TASK_STATUS } from "./constants.js";

const DEMO_TASKS = [
  {
    id: "demo-0",
    name: "Project Documentation.pdf",
    size: 45_000_000,
    status: TASK_STATUS.DOWNLOADING,
    bytesDownloaded: 31_500_000,
    speed: 2_400_000,
    startedAt: new Date(Date.now() - 300_000).toISOString(),
  },
  {
    id: "demo-1",
    name: "Meeting Recording 2026-01-15.mp4",
    size: 890_000_000,
    status: TASK_STATUS.VERIFYING,
    bytesDownloaded: 890_000_000,
    speed: 0,
    startedAt: new Date(Date.now() - 600_000).toISOString(),
  },
  {
    id: "demo-2",
    name: "Budget Spreadsheet Q1.xlsx",
    size: 2_300_000,
    status: TASK_STATUS.PAUSED,
    bytesDownloaded: 1_150_000,
    speed: 0,
    startedAt: new Date(Date.now() - 240_000).toISOString(),
  },
  {
    id: "demo-7",
    name: "Weekly Report Template.docx",
    size: 850_000,
    status: TASK_STATUS.PENDING,
    bytesDownloaded: 0,
    speed: 0,
  },
  {
    id: "demo-3",
    name: "Team Photo Album.zip",
    size: 340_000_000,
    status: TASK_STATUS.COMPLETED,
    bytesDownloaded: 340_000_000,
    speed: 0,
    completedAt: new Date(Date.now() - 120_000).toISOString(),
  },
  {
    id: "demo-4",
    name: "Client Presentation.pptx",
    size: 28_000_000,
    status: TASK_STATUS.FAILED,
    bytesDownloaded: 14_200_000,
    speed: 0,
    startedAt: new Date(Date.now() - 180_000).toISOString(),
    error: "ESOCKETTIMEDOUT: network timeout",
  },
  {
    id: "demo-5",
    name: "Source Code Backup.tar.gz",
    size: 512_000_000,
    status: TASK_STATUS.SKIPPED,
    bytesDownloaded: 512_000_000,
    speed: 0,
    completedAt: new Date(Date.now() - 60_000).toISOString(),
  },
  {
    id: "demo-6",
    name: "Design Mockups.fig",
    size: 15_000_000,
    status: TASK_STATUS.CANCELLED,
    bytesDownloaded: 3_200_000,
    speed: 0,
  },
];

export function populateDemo(downloadManager) {
  for (const [id] of downloadManager.tasks) {
    if (id.startsWith("demo-")) downloadManager.tasks.delete(id);
  }

  for (const template of DEMO_TASKS) {
    const task = {
      error: null,
      destPath: `/data/${template.name}`,
      startedAt: null,
      completedAt: null,
      _demo: true,
      _stream: null,
      _existingStat: null,
      ...template,
    };
    downloadManager.tasks.set(task.id, task);
    downloadManager.emit("task:update", downloadManager._sanitizeTask(task));
  }
}
