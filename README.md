# mega-dl-webui

[![CI](https://github.com/forbish/mega-dl-webui/actions/workflows/ci.yml/badge.svg)](https://github.com/forbish/mega-dl-webui/actions/workflows/ci.yml)
[![CodeQL](https://github.com/forbish/mega-dl-webui/actions/workflows/codeql.yml/badge.svg)](https://github.com/forbish/mega-dl-webui/actions/workflows/codeql.yml)
[![Release](https://github.com/forbish/mega-dl-webui/actions/workflows/release.yml/badge.svg)](https://github.com/forbish/mega-dl-webui/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/github/license/forbish/mega-dl-webui)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/container-distroless-blue)](https://github.com/GoogleContainerTools/distroless)

A lightweight, self-hosted web UI for downloading shared files and folders from MEGA.

## Features

- **Clean, responsive UI** with light/dark mode and system preference auto-detection
- **Folder browsing** — explore shared MEGA links and select individual files
- **Resume support** — partial downloads resume where they left off
- **Skip completed** — already-downloaded files are detected and skipped
- **Concurrent downloads** — configurable parallel download limit
- **Real-time progress** — live speed, ETA, and progress via WebSocket
- **Hardened container** — distroless image with read-only filesystem, no shell, dropped capabilities

## Quick Start

```yaml
services:
  mega-dl-webui:
    image: ghcr.io/forbish/mega-dl-webui:latest
    user: 1000:1000
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    ports:
      - 8080:8080
    environment:
      DOWNLOAD_DIR: /data
    volumes:
      - ./downloads:/data
    tmpfs:
      - /tmp:noexec,nosuid,size=64m
    restart: unless-stopped
```

```bash
docker compose up -d
```

Open [http://localhost:8080](http://localhost:8080) and paste a MEGA link.

## Configuration

| Variable           | Default | Description                                                  |
| ------------------ | ------- | ------------------------------------------------------------ |
| `DOWNLOAD_DIR`     | `/data` | Download directory inside the container                      |
| `PORT`             | `8080`  | HTTP server port                                             |
| `MAX_CONCURRENT`   | `4`     | Maximum parallel downloads (megajs default)                  |
| `RETRY_COUNT`      | `8`     | Retry attempts per download with exponential backoff         |
| `VERIFY_DOWNLOADS` | `true`  | Verify file integrity (MAC) after download. Toggleable in UI |

Set `user: "UID:GID"` in your compose file to control file ownership.

> **Note:** MEGA does not publicly document a concurrent download limit, but the upstream [megajs](https://github.com/qgustavor/mega) library defaults to 4 connections per file. Aggressive concurrency may trigger temporary rate limiting from MEGA's servers.

## Building Locally

```bash
git clone https://github.com/forbish/mega-dl-webui.git
cd mega-dl-webui
docker compose -f compose.dev.yaml up -d --build
```

## Development

```bash
npm install
npm run dev
```

The dev server starts with `--watch` for auto-restart on file changes.

## License

[MIT](LICENSE)
