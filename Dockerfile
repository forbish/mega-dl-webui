# syntax=docker/dockerfile:1@sha256:4a43a54dd1fedceb30ba47e76cfcf2b47304f4161c0caeac2db1c61804ea3c91

# -- Build stage --
FROM node:24.14.1-bookworm-slim@sha256:06e5c9f86bfa0aaa7163cf37a5eaa8805f16b9acb48e3f85645b09d459fc2a9f AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ server/
COPY public/ public/
COPY healthcheck.js ./

# -- Runtime stage --
FROM gcr.io/distroless/nodejs22-debian12@sha256:8a3e96fe3345b5d83ecec2066e7c498139a02a6d1214e4f6c39f9ce359f3f5bc

LABEL org.opencontainers.image.title="mega-dl-webui" \
      org.opencontainers.image.description="Lightweight, self-hosted web UI for downloading shared files and folders from MEGA" \
      org.opencontainers.image.url="https://github.com/forbish/mega-dl-webui" \
      org.opencontainers.image.source="https://github.com/forbish/mega-dl-webui" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY --from=build /app /app

ENV NODE_ENV=production \
    DOWNLOAD_DIR=/data \
    PORT=8080 \
    MAX_CONCURRENT=4 \
    RETRY_COUNT=12 \
    VERIFY_DOWNLOADS=true

EXPOSE 8080

USER 65532:65532

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["/nodejs/bin/node", "/app/healthcheck.js"]

CMD ["server/index.js"]
