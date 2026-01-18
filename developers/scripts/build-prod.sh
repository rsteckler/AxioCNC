#!/bin/bash

# Build production artifacts for AxioCNC
# Uses new apps/ and packages/ structure

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Sync package dependencies
bash developers/scripts/package-sync.sh

mkdir -p dist
rm -rf dist/*

mkdir -p dist/axiocnc/
cp -af apps/server/package.json dist/axiocnc/

# Build desktop/electron files
NODE_ENV=production yarn babel apps/desktop/src \
    --config-file babel.config.js \
    --out-dir dist/axiocnc/electron-app

# Build the main.js entry point for desktop
NODE_ENV=production yarn babel apps/desktop/src/main.js \
    --out-file dist/axiocnc/main.js \
    --config-file babel.config.js

# Build server CLI
mkdir -p dist/axiocnc
yarn babel apps/server/src/cli.js --out-file dist/axiocnc/server-cli.js --config-file babel.config.js

# Build shared modules
yarn babel -d dist/axiocnc/shared packages/shared/src

# Build server
yarn babel -d dist/axiocnc/server apps/server/src
yarn i18next-scanner --config i18next-scanner.server.config.js "apps/server/src/**/*.{html,js,jsx}" "!apps/server/src/i18n/**" "!**/node_modules/**"

# Build new frontend with Vite
cd apps/web && yarn build && cd "${PROJECT_ROOT}"

# Copy Vite build output to dist (vite now outputs to apps/web/dist)
mkdir -p dist/axiocnc/app
cp -af apps/web/dist/* dist/axiocnc/app/

mkdir -p dist/axiocnc/server

# Copy i18n and views (these don't need babel transformation)
cp -af apps/server/src/{i18n,views} dist/axiocnc/server/
# Copy config JSON files only (JS files already transformed by babel above)
cp -af apps/server/src/config/*.json dist/axiocnc/server/config/ 2>/dev/null || true
# Copy assets (themes, default configs, etc.)
cp -af apps/server/assets dist/axiocnc/server/assets 2>/dev/null || true
# Copy index.hbs template to app directory (needed by Express views)
cp -af index.hbs dist/axiocnc/app/ 2>/dev/null || true

echo "Build complete: dist/axiocnc/"
