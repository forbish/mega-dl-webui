# mega-dl-webui

## Architecture

- **Backend**: Express 5 + WebSocket (ws) on Node.js, ESM throughout
- **Frontend**: Vanilla HTML/CSS/JS ES modules — no framework, no build step, no bundler
- **Container**: Multi-stage Dockerfile — Node build stage → `gcr.io/distroless/nodejs22-debian12` runtime (no shell)
- **Zero devDependencies**: Test runner is Node.js built-in (`node --test`), formatting/linting via Trunk (not in package.json)

## Critical: Duplicated Constants

`TASK_STATUS` and `WS_MESSAGE` are defined identically in `server/constants.js` and `public/lib/constants.js`. **Both files must be updated together** — there is no shared import or codegen step.

## Data Flow & Key Patterns

- **Task ID = Node ID**: Session-scoped IDs (`s1-0`, `s1-1`, `s2-0`…) serve as both MEGA node identifiers and download task IDs
- **Three module-level Maps** in `server/megaClient.js` (singleton per process): `nodeMap` (id→megajs File), `reverseMap` (File→id), `pathMap` (id→parent path, excludes own name)
- **Batched WS broadcast**: Task updates collect in `broadcastQueue` Map (coalescing rapid updates per task ID), flushed every 50ms
- **Two WS message types**: `STATUS` (full snapshot, replaces client state) vs `TASKS_UPDATE` (incremental delta, per-card DOM patch)
- **`.part` files**: Downloads write to `dest.part`, renamed on success. Left on disk after failure to enable resume via byte offset
- **`_sanitizeTask()`**: Strips fields prefixed `_` and `destPath` before client delivery — prevents leaking server filesystem paths
- **Exponential backoff**: Retries use `1000 * 2^tries` — uncapped, default 12 retries (~67 min total window)

## Non-Obvious Behaviors

- **`clearFinished` clears completed, skipped, and cancelled** — failed tasks stay visible for retry
- **Session cleanup requires ALL tasks at COMPLETED/SKIPPED**: Failed/cancelled tasks pin MEGA node references in memory until explicitly cleared
- **Skip detection is size-only**: If destination file exists and `stat.size >= megaNode.size`, task is `SKIPPED` without integrity check
- **`VERIFY_DOWNLOADS` env var**: `!== "false"` — any value other than the exact string `"false"` enables verification
- **Verification gated on key length**: Only runs when `megaNode.key?.length === 32` (MEGA AES-256 key format)

## Workflows

- `npm run dev` — Node `--watch` mode for local development
- `npm test` — Node.js built-in test runner (`node --test test/*.test.js`)
- `docker compose -f compose.dev.yaml up -d --build` — local containerized run
- Tag `v*` → multi-arch GHCR release (requires matching `## [x.y.z]` entry in CHANGELOG.md)
- Branch ruleset requires `test`, `build`, `analyze` status checks — all changes go through PRs
- `POST /api/demo` — dev-only endpoint to populate fake tasks for screenshots (guarded by `NODE_ENV === "development"`). Demo tasks carry `_demo: true` — `retryTask` silently skips them to avoid hitting missing MEGA nodes

## Compose Files

- `compose.dev.yaml` — local build with `.env` interpolation (PUID, PGID, DOWNLOAD_PATH), sets `NODE_ENV: development` for dev-only endpoints
- `compose.yaml` — end-user reference (pulls from GHCR), `.env` interpolation (PUID, PGID, DOWNLOAD_PATH)

## Testing Conventions

- Pure function/stateless tests only — no HTTP integration, no WS tests, no filesystem tests
- `node:assert/strict` for assertions, inline fake objects for mocks (no mocking framework)
- `megaClient` tests inject fake megaNodes with mock `.download()` methods
