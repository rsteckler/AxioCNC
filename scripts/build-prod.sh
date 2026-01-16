#!/bin/bash

yarn run package-sync

mkdir -p dist
rm -rf dist/*

pushd src
mkdir -p ../dist/axiocnc/
cp -af package.json ../dist/axiocnc/
cross-env NODE_ENV=production babel "*.js" \
    --config-file ../babel.config.js \
    --out-dir ../dist/axiocnc
cross-env NODE_ENV=production babel "electron-app/**/*.js" \
    --config-file ../babel.config.js \
    --out-dir ../dist/axiocnc/electron-app
popd

# Build shared modules
babel -d dist/axiocnc/shared src/shared

# Build server
babel -d dist/axiocnc/server src/server
i18next-scanner --config i18next-scanner.server.config.js "src/server/**/*.{html,js,jsx}" "!src/server/i18n/**" "!**/node_modules/**"

# Build new frontend with Vite
cd src/app && yarn build && cd ../..

mkdir -p dist/axiocnc/app
mkdir -p dist/axiocnc/server

# Copy i18n and views (these don't need babel transformation)
cp -af src/server/{i18n,views} dist/axiocnc/server/
# Copy config JSON files only (JS files already transformed by babel above)
cp -af src/server/config/*.json dist/axiocnc/server/config/ 2>/dev/null || true
# Copy index.hbs template to app directory (needed by Express views)
cp -af index.hbs dist/axiocnc/app/ 2>/dev/null || true