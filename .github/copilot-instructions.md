# mega-dl-webui

## Architecture

- **Backend**: Express 5 + WebSocket (ws) on Node.js 22, ESM throughout
- **Frontend**: Vanilla HTML/CSS/JS ES modules — no framework, no build tools
- **Container**: Distroless (gcr.io/distroless/nodejs22-debian12), no shell, `user:` directive for UID/GID

## Project Structure

- **Server** (7 modules): `index.js` (Express + WS), `downloadManager.js` (queue/resume/verify), `megaClient.js` (MEGA API wrapper), `constants.js` (TASK_STATUS, WS_MESSAGE, extractSessionId), `utils.js` (asyncHandler, assertPathSafe, broadcastToClients), `validation.js` (isValidMegaUrl, requireArray, requireString), `progressTracker.js` (throttled speed/ETA)
- **Frontend** (10 ES modules under `public/lib/`): state, constants, tree, tree-selection, downloads, websocket, format, theme, toast; entry point `public/app.js`

## Key Patterns

- Session-scoped node IDs (`s1-0`, `s1-1`, `s2-0`…) in `server/megaClient.js`
- Three maps track MEGA nodes: `nodeMap` (id→node), `reverseMap` (node→id), `pathMap` (id→parent path)
- `DownloadManager` extends `EventEmitter`; emits `task:update` with sanitized task objects
- Batched WS broadcast: `broadcastQueue` Map collects sanitized tasks, flushed every 50ms
- Internal task fields prefixed `_` are stripped by `_sanitizeTask()` before client delivery
- Downloads write to `.part` files, renamed to final path on success; enables resume and prevents incomplete files masquerading as complete
- Input validation in `validation.js`; path traversal protection via `assertPathSafe`
- CSS custom properties + `[data-theme]` / `prefers-color-scheme` for theming

## Container Hardening

- Multi-stage build: `node:22.22.0-bookworm-slim` (build) → `gcr.io/distroless/nodejs22-debian12` (runtime)
- `read_only`, `cap_drop: ALL`, `no-new-privileges`, `tmpfs /tmp`
- `healthcheck.js` uses Node HTTP module (no shell, exec-form HEALTHCHECK)
- No entrypoint.sh, no su-exec — file ownership via compose `user:` directive

## Compose Files

- `docker-compose.yml` — production defaults (pulls from ghcr.io)
- `compose.dev.yaml` — local build with `.env` interpolation (PUID, PGID, DOWNLOAD_PATH)
- `compose.example.yaml` — clean reference for end users

## Workflows

- `docker compose -f compose.dev.yaml up -d --build` — build and run locally
- `npm run dev` — watch mode for local development
- Tag `v*` to trigger multi-arch GHCR release via `.github/workflows/release.yml`
- `npm test` — Node.js built-in test runner (`node --test`)
