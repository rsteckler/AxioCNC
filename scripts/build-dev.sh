#!/bin/bash

set -e

yarn run package-sync

mkdir -p output
rm -rf output/*

pushd src
mkdir -p ../output/cncjs/
cp -af package.json ../output/cncjs/
cross-env NODE_ENV=development babel "*.js" \
    --config-file ../babel.config.js \
    --out-dir ../output/cncjs
cross-env NODE_ENV=development babel "electron-app/**/*.js" \
    --config-file ../babel.config.js \
    --out-dir ../output/cncjs/electron-app
popd

# Build shared modules
babel -d output/cncjs/shared src/shared

# Build server
babel -d output/cncjs/server src/server
i18next-scanner --config i18next-scanner.server.config.js "src/server/**/*.{html,js,jsx}" "!src/server/i18n/**" "!**/node_modules/**"

# Build new frontend with Vite
cd src/app && npm run build:dev && cd ../..

mkdir -p output/cncjs/app
mkdir -p output/cncjs/server

# Ensure we're in project root for the copy command
cd "$(dirname "$0")/.."
cp -af src/server/{i18n,views} output/cncjs/server/
