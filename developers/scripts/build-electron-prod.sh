#!/bin/bash
# Production build for Electron app
# Builds desktop app, server, shared, and web app to output/axiocnc/

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Change to project root
cd "${PROJECT_ROOT}" || {
  echo "Error: Failed to cd to ${PROJECT_ROOT}" >&2
  exit 1
}

echo "🔨 Building Electron app for production..."

# Clean output directory
rm -rf output/axiocnc
mkdir -p output/axiocnc/app

# Build Electron app files (menu-template, etc.)
echo "📦 Building Electron app files..."
npx cross-env NODE_ENV=production npx babel apps/desktop/src \
  --config-file "${PROJECT_ROOT}/babel.config.js" \
  --out-dir output/axiocnc/electron-app

# Build Electron main process
echo "📦 Building Electron main process..."
npx cross-env NODE_ENV=production npx babel apps/desktop/src/main.js \
  --out-file output/axiocnc/main.js \
  --config-file "${PROJECT_ROOT}/babel.config.js"

# Build server (needed for launchServer import)
echo "📦 Building server..."
npx babel -d output/axiocnc/server apps/server/src

# Build shared (if needed)
echo "📦 Building shared package..."
npx babel -d output/axiocnc/shared packages/shared/src

# Copy Electron package.json (main entry already points to main.js for built output)
echo "📦 Copying Electron package.json..."
cp -f apps/desktop/package.json output/axiocnc/package.json

# Also copy to server/ directory for server/cli.js require('./package.json')
cp -f apps/server/package.json output/axiocnc/server/

# Copy non-JS assets
echo "📦 Copying server assets..."
cp -af apps/server/src/{i18n,views} output/axiocnc/server/ 2>/dev/null || true
cp -af apps/server/src/config/*.json output/axiocnc/server/config/ 2>/dev/null || true
cp -af apps/server/assets output/axiocnc/server/assets 2>/dev/null || true

# Build frontend with Vite (production mode)
echo "📦 Building web frontend (production)..."
cd "${PROJECT_ROOT}/apps/web" && yarn build && cd "${PROJECT_ROOT}"
# Copy Vite output
cp -af apps/web/dist/* output/axiocnc/app/

# Copy index.hbs template to app directory (needed by Express views)
cp -af index.hbs output/axiocnc/app/ 2>/dev/null || true

# Copy favicon if it exists
[ -f apps/web/public/favicon.ico ] && cp -af apps/web/public/favicon.ico output/axiocnc/app/ || true

# Note: Native module rebuild is handled by electron-builder during packaging
# If rebuild fails, ensure you have g++ >= 10 (supports C++20) or configure node-gyp to use C++17

echo "✅ Electron production build complete: output/axiocnc/"