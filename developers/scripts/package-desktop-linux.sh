#!/bin/bash
# Package Electron desktop app for Linux (.deb) using electron-builder
# Usage: bash developers/scripts/package-desktop-linux.sh amd64|arm64|armv7l

set -euo pipefail

ARCH_INPUT=${1:-amd64}

case "${ARCH_INPUT}" in
  amd64|x64)
    ELECTRON_FLAG="--x64"
    DISPLAY_ARCH="amd64"
    ;;
  arm64)
    ELECTRON_FLAG="--arm64"
    DISPLAY_ARCH="arm64"
    ;;
  armv7l|armhf)
    ELECTRON_FLAG="--armv7l"
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

echo "📦 Packaging AxioCNC desktop app for Linux (${DISPLAY_ARCH})..."

VERSION="$(node -e "console.log(require('./package.json').version)")"
echo "Version: ${VERSION}"

echo "🔨 Building production artifacts (output/axiocnc/)..."
bash developers/scripts/build-electron-prod.sh

echo "📦 Running electron-builder (apps/desktop)..."
mkdir -p output

pushd apps/desktop >/dev/null
npx electron-builder --linux deb ${ELECTRON_FLAG}
popd >/dev/null

DEB_FILE="$(find output -maxdepth 1 -name "axiocnc_*_${DISPLAY_ARCH}.deb" -o -name "axiocnc_*_amd64.deb" -o -name "axiocnc_*_arm64.deb" -o -name "axiocnc_*_armv7l.deb" 2>/dev/null | head -n 1)"
if [ -z "${DEB_FILE}" ]; then
  # fallback if naming differs
  DEB_FILE="$(find output -name "*.deb" -type f | head -n 1)"
fi

if [ -z "${DEB_FILE}" ]; then
  echo "❌ Failed to find generated .deb in output/"
  exit 1
fi

PACKAGE_SIZE="$(du -h "${DEB_FILE}" | cut -f1)"

echo ""
echo "✅ Desktop package built: ${DEB_FILE} (${PACKAGE_SIZE})"
echo ""
echo "Install with:"
echo "  sudo dpkg -i ${DEB_FILE}"
echo "  sudo apt-get install -f  # if dependencies missing"
