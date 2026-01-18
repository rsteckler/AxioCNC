# syntax=docker/dockerfile:1.4

# Build stage
FROM node:18-slim as builder

WORKDIR /build

# Copy package files first for better layer caching
COPY package.json yarn.lock ./
COPY .yarnrc.yml .yarnrc.yml
COPY .yarn/releases .yarn/releases
COPY src/app/package.json ./src/app/

# Install system packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies (including dev dependencies for build)
# Use BuildKit cache mount for yarn cache to speed up rebuilds
RUN --mount=type=cache,target=/root/.yarn \
    --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile

# Copy source files
COPY . .

# Build the application
RUN find scripts -name "*.sh" -type f -exec chmod +x {} \; && bash scripts/build-prod.sh

# Runtime stage
FROM node:18-slim

# Install system dependencies (udev for serialport)
RUN apt-get update && apt-get install -y --no-install-recommends \
  udev \
  ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /opt/axiocnc

# Copy built application from build stage
COPY --from=builder /build/dist/axiocnc ./

# Copy Yarn 3 binary for consistent behavior
COPY --from=builder /build/.yarnrc.yml ./.yarnrc.yml
COPY --from=builder /build/.yarn/releases ./.yarn/releases

# Install production dependencies only
# dist/axiocnc is a standalone package (not a workspace), so we install without lockfile
# Since package.json only has dependencies (no devDependencies), all deps are production
RUN yarn install

# Create non-root user for better security (optional, commented out for now)
# RUN useradd -m -u 1000 axiocnc && chown -R axiocnc:axiocnc /opt/axiocnc
# USER axiocnc

# Expose port
EXPOSE 8000

# Health check - /api returns 401 when healthy (not authenticated)
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8000/api', (r) => process.exit(r.statusCode === 401 ? 0 : 1))"

# Labels for GHCR (Open Container Initiative)
LABEL org.opencontainers.image.title="AxioCNC"
LABEL org.opencontainers.image.description="A web-based interface for CNC milling controller running Grbl, Marlin, Smoothieware, or TinyG"
LABEL org.opencontainers.image.vendor="AxioCNC"
LABEL org.opencontainers.image.version="1.10.112"

# Entrypoint
ENTRYPOINT ["node", "server-cli.js"]

# Default command arguments
CMD ["--port", "8000", "--host", "0.0.0.0", "--allow-remote-access"]
