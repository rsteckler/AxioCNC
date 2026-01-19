#!/bin/bash

# Quick rebuild of Electron main process and server for dev
# Faster than full build-dev.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Change to project root
cd "${PROJECT_ROOT}" || {
  echo "Error: Failed to cd to ${PROJECT_ROOT}" >&2
  exit 1
}

# Ensure output directory exists
mkdir -p output/axiocnc/app

# Build Electron app files (menu-template, etc.)
# Use same pattern as build-dev.sh
npx cross-env NODE_ENV=development npx babel apps/desktop/src \
  --config-file "${PROJECT_ROOT}/babel.config.js" \
  --out-dir output/axiocnc/electron-app

# Build Electron main process
npx cross-env NODE_ENV=development npx babel apps/desktop/src/main.js \
  --out-file output/axiocnc/main.js \
  --config-file "${PROJECT_ROOT}/babel.config.js"

# Build server (needed for launchServer import)
npx babel -d output/axiocnc/server apps/server/src

# Build shared (if needed)
npx babel -d output/axiocnc/shared packages/shared/src

# Copy package.json (needed by both main.js and server/cli.js)
cp -f apps/server/package.json output/axiocnc/
# Also copy to server/ directory for server/cli.js require('./package.json')
cp -f apps/server/package.json output/axiocnc/server/

# Copy non-JS assets
cp -af apps/server/src/{i18n,views} output/axiocnc/server/ 2>/dev/null || true
cp -af apps/server/src/config/*.json output/axiocnc/server/config/ 2>/dev/null || true
cp -af apps/server/assets output/axiocnc/server/assets 2>/dev/null || true

# Build new frontend with Vite (dev mode) if not already built
# Only build if app directory is empty or index.html doesn't exist
if [ ! -f "output/axiocnc/app/index.html" ]; then
  echo "Building frontend..."
  cd "${PROJECT_ROOT}/apps/web" && yarn build:dev && cd "${PROJECT_ROOT}"
  # Copy Vite output
  cp -af apps/web/dist/* output/axiocnc/app/
fi

# Copy index.hbs template to app directory (needed by Express views)
cp -af index.hbs output/axiocnc/app/ 2>/dev/null || true

# Copy favicon if it exists
[ -f apps/web/public/favicon.ico ] && cp -af apps/web/public/favicon.ico output/axiocnc/app/ || true

echo "Electron dev build complete: output/axiocnc/"
