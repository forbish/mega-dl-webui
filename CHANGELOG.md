# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-13

### Added

- Web UI for browsing and downloading shared MEGA links
- Folder tree with checkbox selection for individual files
- Resume support via `.part` files for interrupted downloads
- Skip already-downloaded files with integrity verification (MAC)
- Configurable concurrent download limit
- Real-time progress, speed, and ETA via WebSocket
- Light/dark theme with system preference auto-detection
- Distroless container image with read-only filesystem, no shell, dropped capabilities
- Multi-arch Docker builds (amd64/arm64) via GitHub Actions
- CI workflow with tests and Docker build validation
- CodeQL security analysis
- Trunk linting with Prettier, hadolint, actionlint, markdownlint, yamllint, osv-scanner, trufflehog

[unreleased]: https://github.com/forbish/mega-dl-webui/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/forbish/mega-dl-webui/releases/tag/v1.0.0
