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

# Build new frontend with Vite
cd src/app && yarn build:dev && cd ../..

mkdir -p output/axiocnc/app
mkdir -p output/axiocnc/server

# Ensure we're in project root for the copy command
cd "$(dirname "$0")/.." || cd ..
cp -af src/server/{i18n,views} output/axiocnc/server/
# Copy favicon if it exists
[ -f src/app/public/favicon.ico ] && cp -af src/app/public/favicon.ico output/axiocnc/app/ || true