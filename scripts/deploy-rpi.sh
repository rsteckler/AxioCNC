#!/bin/bash
# Deploy AxioCNC debug build to Raspberry Pi

set -e

RPI_HOST="${RPI_HOST:-ryan@cnc.home}"
ARCH="${1:-arm64}"  # arm64 or armv7l

echo "🚀 Deploying AxioCNC debug build to Raspberry Pi (${ARCH})..."
echo ""

# Build the debug package (show output in real-time, also capture to temp file)
echo "📦 Building debug package..."
BUILD_LOG=$(mktemp)
trap "rm -f $BUILD_LOG" EXIT

if [ "$ARCH" = "armv7l" ]; then
    yarn build:server-deb-debug-armv7l 2>&1 | tee "$BUILD_LOG"
else
    yarn build:server-deb-debug-arm64 2>&1 | tee "$BUILD_LOG"
fi

# Extract version and filename from build output
# Look for "Version: X.Y.Z -> X.Y.Z" pattern
VERSION=$(grep "Version:" "$BUILD_LOG" | tail -1 | sed -E 's/.*Version: [0-9]+\.[0-9]+\.[0-9]+ -> ([0-9]+\.[0-9]+\.[0-9]+).*/\1/')

# Fallback: extract from the final .deb filename in output
if [ -z "$VERSION" ]; then
    DEB_FILE=$(grep -o "output/axiocnc-server_[0-9]\+\.[0-9]\+\.[0-9]\+-debug_${ARCH}\.deb" "$BUILD_LOG" | tail -1)
    if [ -n "$DEB_FILE" ] && [ -f "$DEB_FILE" ]; then
        VERSION=$(echo "$DEB_FILE" | sed -E "s/.*axiocnc-server_([0-9]+\.[0-9]+\.[0-9]+)-debug_${ARCH}\.deb/\1/")
    fi
else
    DEB_FILE="output/axiocnc-server_${VERSION}-debug_${ARCH}.deb"
fi

if [ -z "$VERSION" ] || [ ! -f "$DEB_FILE" ]; then
    echo ""
    echo "❌ Error: Could not determine version or .deb file not found"
    echo "Looking for version in build output..."
    grep -i "version\|\.deb" "$BUILD_LOG" || true
    echo ""
    echo "Available .deb files:"
    ls -la output/*.deb 2>/dev/null || echo "No .deb files found in output/"
    exit 1
fi

echo "✅ Build complete: ${DEB_FILE}"
echo ""

# Copy to Raspberry Pi
echo "📤 Copying to ${RPI_HOST}..."
scp "$DEB_FILE" "${RPI_HOST}:~/"

# Deploy on Raspberry Pi
echo "🔧 Installing on Raspberry Pi..."
ssh "${RPI_HOST}" << EOF
set -e
echo "Removing old version..."
sudo dpkg -r axiocnc-server || true
echo "Installing new version..."
sudo dpkg -i ~/axiocnc-server_${VERSION}-debug_${ARCH}.deb
echo "Stopping server..."
pkill -f 'node /usr/bin/cncjs' || pkill -f 'cncjs' || echo "Server was not running"
echo ""
echo "✅ Deployment complete!"
echo "Version ${VERSION}-debug installed"
echo ""
echo "To start the server:"
echo "  ssh ${RPI_HOST} 'cncjs'"
EOF

echo ""
echo "🎉 Deployment successful!"
echo "Server is stopped. Start it with: ssh ${RPI_HOST} 'cncjs'"
