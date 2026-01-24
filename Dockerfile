# syntax=docker/dockerfile:1.4
# Docker image for AxioCNC server — same content as package:server-amd64 (linux .deb).
# Build: pnpm package:server-docker

# ------------------------------------------------------------------------------
# Build stage: pnpm build:all + deploy + bundled Node.js (mirrors package-headless)
# ------------------------------------------------------------------------------
FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    curl \
    xz-utils \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10 --activate

# Copy package manifests and lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY apps/shared/package.json apps/shared/
COPY apps/desktop/package.json apps/desktop/

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source and config needed for build
COPY apps ./apps
COPY babel.config.js build.config.js ./
COPY developers ./developers
COPY i18next-scanner.server.config.js ./

# Generate Aptabase key config (if APTABASE_KEY is provided)
ARG APTABASE_KEY=""
RUN if [ -n "$APTABASE_KEY" ]; then \
      APTABASE_KEY="$APTABASE_KEY" node developers/scripts/generate-aptabase-key.js; \
    else \
      node developers/scripts/generate-aptabase-key.js; \
    fi

# Build server, web, shared, desktop runtime (same as build:all)
# VITE_APTABASE_KEY is passed as build arg and used during build
ARG VITE_APTABASE_KEY=""
RUN VITE_APTABASE_KEY="$VITE_APTABASE_KEY" pnpm build:all

# Deploy @axiocnc/server to standalone dir (same as package-headless)
RUN mkdir -p /build/deploy \
    && pnpm deploy --prod --filter @axiocnc/server --legacy /build/deploy

# Copy web app and shared into deploy (mirrors package-headless)
RUN mkdir -p /build/deploy/app /build/deploy/shared \
    && cp -r apps/web/dist/. /build/deploy/app/ \
    && cp -r apps/shared/dist/. /build/deploy/shared/

# Move cli.js to root as server-cli.js (same as package-headless)
RUN mv /build/deploy/dist/cli.js /build/deploy/server-cli.js

# Download and extract Node.js 20.18.0 linux-x64 (match package-headless)
ARG NODE_VERSION=20.18.0
RUN curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" -o /tmp/node.tar.xz \
    && tar -xJf /tmp/node.tar.xz -C /tmp \
    && mv /tmp/node-v${NODE_VERSION}-linux-x64 /build/nodejs \
    && rm /tmp/node.tar.xz

# Assemble final layout at /build/axiocnc (same as /opt/axiocnc in .deb)
RUN mkdir -p /build/axiocnc \
    && cp -r /build/deploy/. /build/axiocnc/ \
    && cp -r /build/nodejs /build/axiocnc/

# ------------------------------------------------------------------------------
# Runtime stage: minimal image with udev, bundled Node, server app
# ------------------------------------------------------------------------------
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    udev \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/axiocnc

# Version metadata (passed at build time)
ARG VERSION=unknown

COPY --from=builder /build/axiocnc .

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD /opt/axiocnc/nodejs/bin/node -e "require('http').get('http://localhost:8000/api', (r) => process.exit(r.statusCode === 401 ? 0 : 1))"

LABEL org.opencontainers.image.title="AxioCNC"
LABEL org.opencontainers.image.description="AxioCNC - Stability-focused G-code sender built around real CNC workflows. Control your machine from any device on your network. Version: $VERSION. Homepage: https://axiocnc.com"
LABEL org.opencontainers.image.vendor="AxioCNC"
LABEL org.opencontainers.image.version="$VERSION"
LABEL org.opencontainers.image.url="https://axiocnc.com"

ENTRYPOINT ["/opt/axiocnc/nodejs/bin/node", "server-cli.js"]
CMD ["--port", "8000", "--host", "0.0.0.0", "--allow-remote-access"]
