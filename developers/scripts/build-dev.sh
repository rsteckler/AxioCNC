#!/bin/bash

# Build development artifacts for AxioCNC
# Uses new apps/ and packages/ structure

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

bash developers/scripts/package-sync.sh

mkdir -p output
rm -rf output/*

mkdir -p output/axiocnc/
cp -af apps/server/package.json output/axiocnc/

# Build desktop/electron files
cross-env NODE_ENV=development babel apps/desktop/src \
    --config-file babel.config.js \
    --out-dir output/axiocnc/electron-app

# Build main.js
cross-env NODE_ENV=development babel apps/desktop/src/main.js \
    --out-file output/axiocnc/main.js \
    --config-file babel.config.js

# Build shared modules
babel -d output/axiocnc/shared packages/shared/src

# Build server
babel -d output/axiocnc/server apps/server/src
i18next-scanner --config i18next-scanner.server.config.js "apps/server/src/**/*.{html,js,jsx}" "!apps/server/src/i18n/**" "!**/node_modules/**"

# Ensure output directories exist before vite build
mkdir -p output/axiocnc/app
mkdir -p output/axiocnc/server

# Build new frontend with Vite (dev mode)
cd "${PROJECT_ROOT}/apps/web" && yarn build:dev && cd "${PROJECT_ROOT}"

# Copy Vite output
cp -af apps/web/dist/* output/axiocnc/app/

# Copy i18n and views (these don't need babel transformation)
cp -af apps/server/src/{i18n,views} output/axiocnc/server/
# Copy config JSON files only (JS files already transformed by babel above)
cp -af apps/server/src/config/*.json output/axiocnc/server/config/ 2>/dev/null || true
# Copy assets (themes, default configs, etc.)
cp -af apps/server/assets output/axiocnc/server/assets 2>/dev/null || true
# Copy index.hbs template to app directory (needed by Express views)
cp -af index.hbs output/axiocnc/app/ 2>/dev/null || true
# Copy favicon if it exists
[ -f apps/web/public/favicon.ico ] && cp -af apps/web/public/favicon.ico output/axiocnc/app/ || true

echo "Dev build complete: output/axiocnc/"
