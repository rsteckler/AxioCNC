#!/bin/bash
# Production build for Electron app
# Builds desktop runtime (apps/desktop/dist) and bundles server+web into output/axiocnc/
# Installs server production dependencies into output/axiocnc/node_modules

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${PROJECT_ROOT}"

echo "🔨 Building production artifacts (output/axiocnc/)..."

echo "🧹 Cleaning output folders..."
rm -rf output/axiocnc
mkdir -p output/axiocnc/app
mkdir -p output/axiocnc/server
mkdir -p output/axiocnc/shared

echo "📦 Building Electron runtime (apps/desktop -> apps/desktop/dist)..."
rm -rf apps/desktop/dist
mkdir -p apps/desktop/dist

# Build Electron app files (menu-template, etc.) into apps/desktop/dist/electron-app
npx cross-env NODE_ENV=production npx babel apps/desktop/src \
  --config-file "${PROJECT_ROOT}/babel.config.js" \
  --out-dir apps/desktop/dist/electron-app

# Build Electron main process into apps/desktop/dist/main.js
npx cross-env NODE_ENV=production npx babel apps/desktop/src/main.js \
  --out-file apps/desktop/dist/main.js \
  --config-file "${PROJECT_ROOT}/babel.config.js"

echo "📦 Building server bundle (apps/server/src -> output/axiocnc/server)..."
npx babel -d output/axiocnc/server apps/server/src

echo "📦 Building shared bundle (packages/shared/src -> output/axiocnc/shared)..."
npx babel -d output/axiocnc/shared packages/shared/src

echo "📦 Copying server package.json + assets..."
cp -f apps/server/package.json output/axiocnc/server/package.json
# Server index.js imports '../package.json', so also copy to parent directory
cp -f apps/server/package.json output/axiocnc/package.json

# Non-JS assets needed by server
cp -af apps/server/src/{i18n,views} output/axiocnc/server/ 2>/dev/null || true
mkdir -p output/axiocnc/server/config
cp -af apps/server/src/config/*.json output/axiocnc/server/config/ 2>/dev/null || true
cp -af apps/server/assets output/axiocnc/server/assets 2>/dev/null || true

#
# Install server production dependencies using Yarn Berry.
# We create a temp workspace that mirrors the monorepo structure,
# run yarn install, then copy the resulting node_modules.
#
echo "📦 Installing server production dependencies (Yarn Berry)..."

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT INT TERM

echo "   - Temp directory: ${TEMP_DIR}"

# Copy Yarn Berry runtime and config
cp -a "${PROJECT_ROOT}/.yarn" "${TEMP_DIR}/.yarn"
cp -f "${PROJECT_ROOT}/.yarnrc.yml" "${TEMP_DIR}/.yarnrc.yml"
cp -f "${PROJECT_ROOT}/yarn.lock" "${TEMP_DIR}/yarn.lock"

# Copy root package.json (needed for workspaces definition)
cp -f "${PROJECT_ROOT}/package.json" "${TEMP_DIR}/package.json"

# Copy all workspace package.json files (yarn needs them even if we only install server)
mkdir -p "${TEMP_DIR}/apps/server"
cp -f "${PROJECT_ROOT}/apps/server/package.json" "${TEMP_DIR}/apps/server/"

mkdir -p "${TEMP_DIR}/apps/desktop"
cp -f "${PROJECT_ROOT}/apps/desktop/package.json" "${TEMP_DIR}/apps/desktop/"

mkdir -p "${TEMP_DIR}/apps/web"
cp -f "${PROJECT_ROOT}/apps/web/package.json" "${TEMP_DIR}/apps/web/"

mkdir -p "${TEMP_DIR}/packages/shared"
cp -f "${PROJECT_ROOT}/packages/shared/package.json" "${TEMP_DIR}/packages/shared/"

# Create stub package.json for optional workspaces that might not exist
mkdir -p "${TEMP_DIR}/website/docs/user"
if [ -f "${PROJECT_ROOT}/website/docs/user/package.json" ]; then
  cp -f "${PROJECT_ROOT}/website/docs/user/package.json" "${TEMP_DIR}/website/docs/user/"
else
  echo '{"name":"axiocnc-docs-user","version":"1.0.0","private":true}' > "${TEMP_DIR}/website/docs/user/package.json"
fi

mkdir -p "${TEMP_DIR}/website/docs/developer"
if [ -f "${PROJECT_ROOT}/website/docs/developer/package.json" ]; then
  cp -f "${PROJECT_ROOT}/website/docs/developer/package.json" "${TEMP_DIR}/website/docs/developer/"
else
  echo '{"name":"axiocnc-docs-developer","version":"1.0.0","private":true}' > "${TEMP_DIR}/website/docs/developer/package.json"
fi

# Override .yarnrc.yml to ensure node_modules linker and proper hoisting
cat > "${TEMP_DIR}/.yarnrc.yml" << 'YARNRC'
nodeLinker: node-modules
nmHoistingLimits: none
enableGlobalCache: true
yarnPath: .yarn/releases/yarn-3.3.1.cjs
plugins:
  - path: .yarn/plugins/@yarnpkg/plugin-workspace-tools.cjs
    spec: "@yarnpkg/plugin-workspace-tools"
YARNRC

pushd "${TEMP_DIR}" >/dev/null

echo "   - Running yarn workspaces focus @axiocnc/server --production..."

# Use the project's Yarn Berry to install only server workspace deps
node .yarn/releases/yarn-3.3.1.cjs workspaces focus @axiocnc/server --production

echo "   - Checking node_modules..."

# With nmHoistingLimits: none, deps should be hoisted to root node_modules
if [ -d "${TEMP_DIR}/node_modules" ]; then
  echo "   - Found root node_modules (hoisted)"
  SERVER_NM_DIR="${TEMP_DIR}/node_modules"
elif [ -d "${TEMP_DIR}/apps/server/node_modules" ]; then
  echo "   - Found server node_modules"
  SERVER_NM_DIR="${TEMP_DIR}/apps/server/node_modules"
else
  echo "❌ No node_modules found!"
  echo "   Listing temp directory:"
  ls -la "${TEMP_DIR}"
  ls -la "${TEMP_DIR}/apps/server" || true
  exit 1
fi

# Verify critical modules
echo "   - Verifying critical modules..."
MISSING_MODS=""
for mod in core-js express socket.io serialport zod; do
  if [ ! -d "${SERVER_NM_DIR}/${mod}" ]; then
    MISSING_MODS="${MISSING_MODS} ${mod}"
  fi
done

if [ -n "${MISSING_MODS}" ]; then
  echo "⚠️  Warning: Missing modules:${MISSING_MODS}"
  echo "   Contents of node_modules:"
  ls "${SERVER_NM_DIR}" | head -20
fi

popd >/dev/null

# Copy node_modules to output (dereference symlinks)
echo "   - Copying node_modules to output/axiocnc/..."
cp -aL "${SERVER_NM_DIR}" "${PROJECT_ROOT}/output/axiocnc/node_modules"

# Final verification
if [ ! -d "${PROJECT_ROOT}/output/axiocnc/node_modules/core-js" ]; then
  echo "❌ FATAL: core-js not in output/axiocnc/node_modules after copy!"
  exit 1
fi

echo "   ✅ Dependencies installed"

#
# Rebuild native modules (serialport) for Electron's Node.js version
#
echo "🔧 Rebuilding native modules for Electron..."

ELECTRON_VERSION="$(node -p "require('./apps/desktop/package.json').devDependencies.electron")"
if [ -z "${ELECTRON_VERSION}" ]; then
  echo "❌ Could not read Electron version from apps/desktop/package.json"
  exit 1
fi
echo "   - Electron version: ${ELECTRON_VERSION}"

pushd "${PROJECT_ROOT}/output/axiocnc" >/dev/null

npx --yes @electron/rebuild \
  --version "${ELECTRON_VERSION}" \
  --module-dir . \
  --force

popd >/dev/null

echo "   ✅ Native modules rebuilt for Electron ${ELECTRON_VERSION}"

echo "📦 Building web frontend (apps/web)..."
pushd "${PROJECT_ROOT}/apps/web" >/dev/null
yarn build
popd >/dev/null

echo "📦 Copying web dist -> output/axiocnc/app..."
cp -af apps/web/dist/* output/axiocnc/app/
cp -af apps/web/dist/package.json output/axiocnc/app/ 2>/dev/null || true

# Copy index.hbs if used by server views
cp -af index.hbs output/axiocnc/app/ 2>/dev/null || true
[ -f apps/web/public/favicon.ico ] && cp -af apps/web/public/favicon.ico output/axiocnc/app/ || true

echo "✅ Electron production assets built:"
echo "   - Electron runtime: apps/desktop/dist/"
echo "   - Bundled assets:   output/axiocnc/"
echo "   - Dependencies:     output/axiocnc/node_modules/"
