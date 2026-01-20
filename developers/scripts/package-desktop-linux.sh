#!/bin/bash
# Package Electron desktop app for Linux
# Creates .deb package using electron-builder

set -e

ARCH_INPUT=${1:-amd64}  # amd64, arm64, or armv7l

# Map architecture names (accept both x64/amd64, but use amd64 as canonical)
case "${ARCH_INPUT}" in
    amd64|x64)
        ELECTRON_ARCH="x64"  # electron-builder uses --x64 flag
        DISPLAY_ARCH="amd64"
        ;;
    arm64)
        ELECTRON_ARCH="arm64"
        DISPLAY_ARCH="arm64"
        ;;
    armv7l|armhf)
        ELECTRON_ARCH="armv7l"
        DISPLAY_ARCH="armv7l"
        ;;
    *)
        echo "❌ Unsupported architecture: ${ARCH_INPUT}"
        echo "   Supported: amd64, arm64, armv7l"
        exit 1
        ;;
esac

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${PROJECT_ROOT}"

# Check g++ version (needs >= 10 for C++20 support)
if command -v g++ >/dev/null 2>&1; then
    GPP_VERSION=$(g++ --version | head -n1 | grep -oE '[0-9]+\.[0-9]+' | head -n1)
    GPP_MAJOR=$(echo "$GPP_VERSION" | cut -d. -f1)
    if [ -n "$GPP_MAJOR" ] && [ "$GPP_MAJOR" -lt 10 ]; then
        echo "⚠️  Warning: g++ version ${GPP_VERSION} detected. C++20 support requires g++ >= 10."
        echo "   Native module rebuild may fail. Consider upgrading:"
        echo "     Ubuntu/Debian: sudo apt-get install g++-10"
        echo "     Or set CXXFLAGS='-std=gnu++17' to use C++17 instead"
        echo ""
    fi
fi

echo "📦 Packaging AxioCNC desktop app for Linux (${DISPLAY_ARCH})..."

# Get current version
VERSION=$(node -e "console.log(require('./package.json').version)")
echo "Version: ${VERSION}"

# Build Electron app to output/axiocnc/ (artifacts only, not a project root)
echo "🔨 Building Electron app..."
bash developers/scripts/build-electron-prod.sh

# Create temp folder OUTSIDE the repo for the app
# This avoids Yarn workspace detection issues and doesn't mutate repo's node_modules
TEMP_APP_DIR="/tmp/axiocnc-electron-app-$$"
trap "rm -rf '${TEMP_APP_DIR}'" EXIT INT TERM

echo "📦 Preparing app in temp folder (outside repo for Yarn compatibility)..."
rm -rf "${TEMP_APP_DIR}"
mkdir -p "${TEMP_APP_DIR}"

# Copy built app to temp folder
cp -r output/axiocnc/* "${TEMP_APP_DIR}/"

# Copy FULL apps/desktop/package.json (keep devDeps for lockfile compatibility and electron rebuild)
# Remove only the 'build' field (not allowed in app package.json since electron-builder 3.0)
echo "📦 Preparing package.json for temp folder..."
node -e "
  const fs = require('fs');
  const pkg = require('./apps/desktop/package.json');
  const rootPkg = require('./package.json');
  pkg.name = 'axiocnc';
  pkg.homepage = rootPkg.homepage || 'https://github.com/rsteckler/axiocnc';
  delete pkg.build;  // Not allowed in app package.json
  fs.writeFileSync('${TEMP_APP_DIR}/package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Copy Yarn config for deterministic isolated install
cp "${PROJECT_ROOT}/yarn.lock" "${TEMP_APP_DIR}/"
# Create simplified .yarnrc.yml (no plugins - this is standalone, not a workspace)
cat > "${TEMP_APP_DIR}/.yarnrc.yml" << 'EOF'
nodeLinker: node-modules
yarnPath: .yarn/releases/yarn-3.3.1.cjs
EOF
mkdir -p "${TEMP_APP_DIR}/.yarn/releases"
cp -f "${PROJECT_ROOT}/.yarn/releases/yarn-3.3.1.cjs" "${TEMP_APP_DIR}/.yarn/releases/" 2>/dev/null || true

# Install dependencies in temp folder (deterministic via lockfile)
echo "📦 Installing app dependencies in temp folder..."
cd "${TEMP_APP_DIR}"
yarn install --immutable || {
  echo "Warning: --immutable failed, falling back to regular install"
  yarn install || {
    echo "Error: yarn install failed in temp folder"
    exit 1
  }
}

# Rebuild native modules for Electron
echo "📦 Rebuilding native modules for Electron..."
npx @electron/rebuild || {
  echo "⚠️  Warning: @electron/rebuild failed"
  echo "   electron-builder will attempt to rebuild during build, but native modules may fail"
}
cd "${PROJECT_ROOT}"

# Ensure output directory exists for electron-builder
mkdir -p output

# Build with electron-builder
# Use --config to override directories.app to point to temp folder
echo "📦 Building Linux package with electron-builder..."
# Try to build, but provide helpful error message if native rebuild fails
set +e  # Temporarily disable exit on error to catch rebuild failures
case "${ELECTRON_ARCH}" in
    x64)
        npx electron-builder --projectDir apps/desktop --config.directories.app="${TEMP_APP_DIR}" --linux deb --x64
        BUILD_EXIT=$?
        ;;
    arm64)
        npx electron-builder --projectDir apps/desktop --config.directories.app="${TEMP_APP_DIR}" --linux deb --arm64
        BUILD_EXIT=$?
        ;;
    armv7l)
        npx electron-builder --projectDir apps/desktop --config.directories.app="${TEMP_APP_DIR}" --linux deb --armv7l
        BUILD_EXIT=$?
        ;;
    *)
        echo "❌ Invalid architecture: ${ELECTRON_ARCH}"
        exit 1
        ;;
esac
set -e  # Re-enable exit on error

if [ $BUILD_EXIT -ne 0 ]; then
    echo ""
    echo "❌ Build failed. If the error is related to native module rebuild (serialport):"
    echo ""
    echo "   Option 1: Upgrade g++ to version 10 or later:"
    echo "     sudo apt-get update && sudo apt-get install g++-10"
    echo "     sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-10 100"
    echo ""
    echo "   Option 2: Use C++17 instead of C++20 (may require modifying @serialport/bindings-cpp):"
    echo "     export CXXFLAGS='-std=gnu++17'"
    echo "     Then run the build again"
    echo ""
    exit $BUILD_EXIT
fi

# Find the generated .deb file
DEB_FILE=$(find output -name "*.deb" -type f | head -n 1)

if [ -z "$DEB_FILE" ]; then
    echo "❌ Failed to find generated .deb file"
    exit 1
fi

# Get package size
PACKAGE_SIZE=$(du -h "${DEB_FILE}" | cut -f1)

echo ""
echo "✅ Desktop package built: ${DEB_FILE} (${PACKAGE_SIZE})"
echo ""
echo "Install with:"
echo "  sudo dpkg -i ${DEB_FILE}"
echo "  sudo apt-get install -f  # if dependencies missing"