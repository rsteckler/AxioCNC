#!/bin/bash

set -e

yarn run package-sync

mkdir -p output
rm -rf output/*

pushd src
mkdir -p ../output/axiocnc/
cp -af package.json ../output/axiocnc/
cross-env NODE_ENV=development babel "*.js" \
    --config-file ../babel.config.js \
    --out-dir ../output/axiocnc
cross-env NODE_ENV=development babel "electron-app/**/*.js" \
    --config-file ../babel.config.js \
    --out-dir ../output/axiocnc/electron-app
popd

# Build shared modules
babel -d output/axiocnc/shared src/shared

# Build server
babel -d output/axiocnc/server src/server
i18next-scanner --config i18next-scanner.server.config.js "src/server/**/*.{html,js,jsx}" "!src/server/i18n/**" "!**/node_modules/**"

# Ensure output directories exist before vite build
mkdir -p output/axiocnc/app
mkdir -p output/axiocnc/server

# Build new frontend with Vite
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${PROJECT_ROOT}/src/app" && yarn build:dev && cd "${PROJECT_ROOT}"

# Ensure we're in project root for the copy command
cd "${PROJECT_ROOT}"
# Copy i18n and views (these don't need babel transformation)
cp -af src/server/{i18n,views} output/axiocnc/server/
# Copy config JSON files only (JS files already transformed by babel above)
cp -af src/server/config/*.json output/axiocnc/server/config/ 2>/dev/null || true
# Copy index.hbs template to app directory (needed by Express views)
cp -af index.hbs output/axiocnc/app/ 2>/dev/null || true
# Copy favicon if it exists
[ -f src/app/public/favicon.ico ] && cp -af src/app/public/favicon.ico output/axiocnc/app/ || true