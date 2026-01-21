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

DIST_ROOT="apps/desktop/dist"
DEV_PLATFORM="$(node -p "process.platform === 'win32' ? 'win' : (process.platform === 'darwin' ? 'mac' : 'linux')")"
DEV_ARCH="$(node -p "process.arch")"
DEV_BUNDLE="build/${DEV_PLATFORM}-${DEV_ARCH}/axiocnc"

# Ensure output directory exists
mkdir -p "${DEV_BUNDLE}/app"

# Build Electron app files (menu-template, etc.)
# Use same pattern as build-dev.sh
npx cross-env NODE_ENV=development npx babel apps/desktop/src \
  --config-file "${PROJECT_ROOT}/babel.config.js" \
  --out-dir "${DIST_ROOT}/electron-app"

# Build Electron main process
npx cross-env NODE_ENV=development npx babel apps/desktop/src/main.js \
  --out-file "${DIST_ROOT}/main.js" \
  --config-file "${PROJECT_ROOT}/babel.config.js"

# Build server (needed for launchServer import)
npx babel -d "${DEV_BUNDLE}/server" apps/server/src

# Build shared (if needed)
npx babel -d "${DEV_BUNDLE}/shared" packages/shared/src

# Copy package.json (needed by both main.js and server/cli.js)
cp -f apps/server/package.json "${DEV_BUNDLE}/"
# Also copy to server/ directory for server/cli.js require('./package.json')
cp -f apps/server/package.json "${DEV_BUNDLE}/server/"

# Copy non-JS assets
cp -af apps/server/src/{i18n,views} "${DEV_BUNDLE}/server/" 2>/dev/null || true
cp -af apps/server/src/config/*.json "${DEV_BUNDLE}/server/config/" 2>/dev/null || true
cp -af apps/server/assets "${DEV_BUNDLE}/server/assets" 2>/dev/null || true

# Build new frontend with Vite (dev mode) if not already built
# Only build if app directory is empty or index.html doesn't exist
if [ ! -f "${DEV_BUNDLE}/app/index.html" ]; then
  echo "Building frontend..."
  cd "${PROJECT_ROOT}/apps/web" && yarn build:dev && cd "${PROJECT_ROOT}"
  # Copy Vite output
  cp -af apps/web/dist/* "${DEV_BUNDLE}/app/"
fi

# Copy index.hbs template to app directory (needed by Express views)
cp -af index.hbs "${DEV_BUNDLE}/app/" 2>/dev/null || true

# Copy favicon if it exists
[ -f apps/web/public/favicon.ico ] && cp -af apps/web/public/favicon.ico "${DEV_BUNDLE}/app/" || true

echo "Electron dev build complete: ${DEV_BUNDLE}/"
