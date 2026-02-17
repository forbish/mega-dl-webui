# syntax=docker/dockerfile:1@sha256:b6afd42430b15f2d2a4c5a02b919e98a525b785b1aaff16747d2f623364e39b6

# -- Build stage --
FROM node:24.13.1-bookworm-slim@sha256:a81a03dd965b4052269a57fac857004022b522a4bf06e7a739e25e18bce45af2 AS build

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
