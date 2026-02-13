# syntax=docker/dockerfile:1

# -- Build stage --
FROM node:22.22.0-bookworm-slim@sha256:5373f1906319b3a1f291da5d102f4ce5c77ccbe29eb637f072b6c7b70443fc36 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ server/
COPY public/ public/
COPY healthcheck.js ./

# -- Runtime stage --
FROM gcr.io/distroless/nodejs22-debian12@sha256:61ac74f7ae19c65e87fdfcd5a0b0cb7172074ecbbbf0c26820ec5c09fd2ff9d1

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
    RETRY_COUNT=8 \
    VERIFY_DOWNLOADS=true

EXPOSE 8080

USER 65532:65532

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["/nodejs/bin/node", "/app/healthcheck.js"]

CMD ["server/index.js"]
