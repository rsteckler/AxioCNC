#!/bin/bash
# Package server build into .deb file
# Uses new workspace structure: apps/server/dist/

set -e

ARCH_INPUT=${1:-amd64}  # amd64, arm64, or armhf (x64 will be mapped to amd64)
# Map x64 to amd64 for Debian package architecture
# Map armhf to armv7l for Node.js downloads (armhf is Debian name, armv7l is Node.js name)
if [ "$ARCH_INPUT" = "x64" ]; then
    ARCH="amd64"
elif [ "$ARCH_INPUT" = "armhf" ]; then
    ARCH="armhf"  # Use armhf for Debian package
else
    ARCH="$ARCH_INPUT"
fi

PACKAGE_NAME="axiocnc-server"
INSTALL_DIR="/opt/axiocnc"
BUILD_DIR="apps/server/output"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NODE_VERSION="20.18.0"  # Node.js LTS version to bundle

cd "${PROJECT_ROOT}"

echo "📦 Packaging AxioCNC server for ${ARCH}..."

# Get current version from server package.json
VERSION=$(node -e "console.log(require('./apps/server/package.json').version)")

echo "Version: ${VERSION}"

# Ensure server, shared, and web packages are built
if [ ! -d "apps/server/dist" ] || [ -z "$(ls -A apps/server/dist 2>/dev/null)" ]; then
    echo "Building server first..."
    yarn workspace @axiocnc/server build
fi
if [ ! -d "packages/shared/dist" ] || [ -z "$(ls -A packages/shared/dist 2>/dev/null)" ]; then
    echo "Building shared package..."
    yarn workspace @axiocnc/shared build
fi
if [ ! -d "apps/web/dist" ] || [ -z "$(ls -A apps/web/dist 2>/dev/null)" ]; then
    echo "Building web app..."
    yarn workspace @axiocnc/web build
fi

# Clean previous package build
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Create package structure
PACKAGE_ROOT="${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}_${ARCH}"
mkdir -p "${PACKAGE_ROOT}${INSTALL_DIR}"
mkdir -p "${PACKAGE_ROOT}/usr/bin"
mkdir -p "${PACKAGE_ROOT}/etc/systemd/system"
mkdir -p "${PACKAGE_ROOT}/DEBIAN"

# Download and extract Node.js binary
echo "📥 Downloading Node.js ${NODE_VERSION} for ${ARCH}..."
NODE_DOWNLOAD_DIR="${BUILD_DIR}/.node-download"
rm -rf "${NODE_DOWNLOAD_DIR}"
mkdir -p "${NODE_DOWNLOAD_DIR}"

# Map architecture for Node.js downloads
case "${ARCH}" in
    amd64)
        NODE_ARCH="x64"
        ;;
    arm64)
        NODE_ARCH="arm64"
        ;;
    armhf)
        NODE_ARCH="armv7l"  # Node.js uses armv7l, Debian uses armhf
        ;;
    *)
        echo "❌ Unsupported architecture: ${ARCH}"
        exit 1
        ;;
esac

NODE_TARBALL="node-v${NODE_VERSION}-linux-${NODE_ARCH}.tar.xz"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}"

cd "${NODE_DOWNLOAD_DIR}"
if ! curl -fsSL "${NODE_URL}" -o "${NODE_TARBALL}"; then
    echo "❌ Failed to download Node.js from ${NODE_URL}"
    exit 1
fi

echo "📦 Extracting Node.js..."
tar -xf "${NODE_TARBALL}"

cd "${PROJECT_ROOT}"

# Copy Node.js binary to package
echo "📋 Bundling Node.js..."
NODE_DIR="${NODE_DOWNLOAD_DIR}/node-v${NODE_VERSION}-linux-${NODE_ARCH}"
mkdir -p "${PACKAGE_ROOT}${INSTALL_DIR}/nodejs"
cp -r "${NODE_DIR}/bin" "${PACKAGE_ROOT}${INSTALL_DIR}/nodejs/"
cp -r "${NODE_DIR}/lib" "${PACKAGE_ROOT}${INSTALL_DIR}/nodejs/" 2>/dev/null || true
cp -r "${NODE_DIR}/include" "${PACKAGE_ROOT}${INSTALL_DIR}/nodejs/" 2>/dev/null || true
cp -r "${NODE_DIR}/share" "${PACKAGE_ROOT}${INSTALL_DIR}/nodejs/" 2>/dev/null || true

# Production dependency pruning
echo "Installing production dependencies..."
PROD_INSTALL_DIR="${BUILD_DIR}/.prod-install"
rm -rf "${PROD_INSTALL_DIR}"
mkdir -p "${PROD_INSTALL_DIR}"

# Copy package.json to temp location for production install
cp apps/server/dist/package.json "${PROD_INSTALL_DIR}/"

# Make temp directory a standalone Yarn project (not part of workspace)
cat > "${PROD_INSTALL_DIR}/.yarnrc.yml" << 'EOF'
nodeLinker: node-modules
EOF

# Install production dependencies in temp location
cd "${PROD_INSTALL_DIR}"

# Remove devDependencies from package.json temporarily for production install
node -e "
  const fs = require('fs');
  const pkg = require('./package.json');
  delete pkg.devDependencies;
  fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Use npm for standalone install (avoids yarn workspace lockfile issues)
# Install dependencies (will only install production deps since devDependencies were removed)
npm install --production || {
  # Check if node_modules was created
  if [ ! -d "node_modules" ]; then
    echo "Error: Production dependencies were not installed"
    exit 1
  fi
}
# Ensure zod is installed (required by shared/schemas)
npm install zod@^4.3.5 || echo "Warning: Could not install zod"
cd - > /dev/null

# Copy built application
echo "Copying application files..."
# Copy cli.js and package.json to root, but put everything else in server/ subdirectory
cp apps/server/dist/cli.js "${PACKAGE_ROOT}${INSTALL_DIR}/"
cp apps/server/dist/package.json "${PACKAGE_ROOT}${INSTALL_DIR}/"
mkdir -p "${PACKAGE_ROOT}${INSTALL_DIR}/server"
# Copy all files and directories except cli.js and package.json to server/ subdirectory
rsync -a --exclude='cli.js' --exclude='package.json' apps/server/dist/ "${PACKAGE_ROOT}${INSTALL_DIR}/server/" || {
    # Fallback if rsync not available
    cd apps/server/dist
    cp -r . "${PACKAGE_ROOT}${INSTALL_DIR}/server/"
    rm -f "${PACKAGE_ROOT}${INSTALL_DIR}/server/cli.js"
    rm -f "${PACKAGE_ROOT}${INSTALL_DIR}/server/package.json"
    cd "${PROJECT_ROOT}"
}

# Copy pruned production node_modules from temp location
echo "Copying production node_modules..."
cp -r "${PROD_INSTALL_DIR}/node_modules" "${PACKAGE_ROOT}${INSTALL_DIR}/"

# Copy shared package (needed by server code)
echo "Copying shared package..."
mkdir -p "${PACKAGE_ROOT}${INSTALL_DIR}/shared"
cp -r packages/shared/dist/* "${PACKAGE_ROOT}${INSTALL_DIR}/shared/"

# Copy web app (frontend files needed by server)
echo "Copying web app..."
mkdir -p "${PACKAGE_ROOT}${INSTALL_DIR}/app"
cp -r apps/web/dist/* "${PACKAGE_ROOT}${INSTALL_DIR}/app/"
# Copy index.hbs template if it exists
cp -af index.hbs "${PACKAGE_ROOT}${INSTALL_DIR}/app/" 2>/dev/null || true

# Create launcher script that uses bundled Node.js
echo "Creating launcher script..."
cat > "${PACKAGE_ROOT}/usr/bin/axiocnc" << 'EOF'
#!/bin/bash
# AxioCNC Server Launcher
# Uses bundled Node.js

AXIOCNC_DIR="/opt/axiocnc"
NODE_BIN="${AXIOCNC_DIR}/nodejs/bin/node"
CLI_FILE="${AXIOCNC_DIR}/cli.js"
LOG_DIR="${HOME}/.axiocnc/logs"
LOG_FILE="${LOG_DIR}/axiocnc.log"

# Ensure log directory exists and is writable
if ! mkdir -p "${LOG_DIR}" 2>/dev/null || [ ! -w "${LOG_DIR}" ]; then
    # Last resort: use /tmp if home directory is not accessible
    LOG_DIR="/tmp/axiocnc-${USER}/logs"
    LOG_FILE="${LOG_DIR}/axiocnc.log"
    mkdir -p "${LOG_DIR}" 2>/dev/null || true
    echo "Warning: Cannot write to ~/.axiocnc/logs, using ${LOG_FILE} instead" >&2
fi

# Function to log messages
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): $*" | tee -a "${LOG_FILE}" 2>/dev/null || echo "$(date '+%Y-%m-%d %H:%M:%S'): $*"
}

# Function to log errors
log_error() {
    echo "$(date '+%Y-%m-%d %H:%M:%S'): ERROR: $*" | tee -a "${LOG_FILE}" >&2 2>/dev/null || echo "ERROR: $*" >&2
}

# Change to installation directory
if ! cd "${AXIOCNC_DIR}"; then
    log_error "Cannot change to ${AXIOCNC_DIR}"
    exit 1
fi

# Verify Node.js exists
if [ ! -f "${NODE_BIN}" ]; then
    log_error "Node.js binary not found at ${NODE_BIN}"
    exit 1
fi

# Verify CLI file exists
if [ ! -f "${CLI_FILE}" ]; then
    log_error "CLI file not found at ${CLI_FILE}"
    exit 1
fi

# Ensure --host 0.0.0.0 and --allow-remote-access are set
ARGS=("$@")
if [[ ! " ${ARGS[@]} " =~ " --host " ]]; then
    ARGS+=("--host" "0.0.0.0")
fi
if [[ ! " ${ARGS[@]} " =~ " --allow-remote-access " ]]; then
    ARGS+=("--allow-remote-access")
fi

# Log startup
log "Starting AxioCNC server"
log "Node: ${NODE_BIN}"
log "CLI: ${CLI_FILE}"
log "Args: ${ARGS[*]}"
log "Working directory: $(pwd)"

# Run the server with bundled Node.js
# Capture both stdout and stderr to log file, but also show errors to user
"${NODE_BIN}" "${CLI_FILE}" "${ARGS[@]}" >> "${LOG_FILE}" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    log_error "Server exited with code ${EXIT_CODE}"
    log_error "Check ${LOG_FILE} for details"
    tail -20 "${LOG_FILE}" >&2
    exit $EXIT_CODE
fi
EOF
chmod +x "${PACKAGE_ROOT}/usr/bin/axiocnc"

# Create systemd service file
echo "Creating systemd service..."
cat > "${PACKAGE_ROOT}/etc/systemd/system/axiocnc.service" << EOF
[Unit]
Description=AxioCNC CNC Controller Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=${INSTALL_DIR}/nodejs/bin/node ${INSTALL_DIR}/cli.js --port 8000 --host 0.0.0.0 --allow-remote-access
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create control file
echo "Creating Debian control file..."
cat > "${PACKAGE_ROOT}/DEBIAN/control" << EOF
Package: ${PACKAGE_NAME}
Version: ${VERSION}
Architecture: ${ARCH}
Maintainer: AxioCNC Team
Description: AxioCNC - Web-based CNC controller interface (Server)
 AxioCNC is a web-based interface for CNC controllers running Grbl,
 Marlin, Smoothieware, or TinyG. This package provides the server
 component for headless deployment with bundled Node.js ${NODE_VERSION}.
Depends: udev
Section: utils
Priority: optional
EOF

# Create post-install script
echo "Creating post-install script..."
cat > "${PACKAGE_ROOT}/DEBIAN/postinst" << 'EOF'
#!/bin/bash
set -e

# Add user to dialout group for serial port access
if [ -n "$SUDO_USER" ]; then
    USER="$SUDO_USER"
elif [ -n "$USER" ]; then
    USER="$USER"
else
    USER=$(logname 2>/dev/null || echo "")
fi

if [ -n "$USER" ] && [ "$USER" != "root" ]; then
    echo "Adding user '$USER' to dialout group for serial port access..."
    usermod -a -G dialout "$USER" || true
fi

# Create log directory in user's home directory
# The launcher script will create ~/.axiocnc/logs when run by the user

# Enable systemd service (optional - user can enable manually)
# systemctl daemon-reload
# systemctl enable axiocnc || true

echo ""
echo "AxioCNC server installed successfully!"
echo "Node.js ${NODE_VERSION} is bundled with this package."
echo ""
echo "To start the server:"
echo "  axiocnc --port 8000 --host 0.0.0.0"
echo ""
echo "Or enable as a service:"
echo "  sudo systemctl enable axiocnc"
echo "  sudo systemctl start axiocnc"
echo ""
echo "Note: You may need to log out and back in for serial port access."
EOF
chmod +x "${PACKAGE_ROOT}/DEBIAN/postinst"

# Create pre-remove script
cat > "${PACKAGE_ROOT}/DEBIAN/prerm" << 'EOF'
#!/bin/bash
# Stop service if running
systemctl stop axiocnc || true
systemctl disable axiocnc || true
EOF
chmod +x "${PACKAGE_ROOT}/DEBIAN/prerm"

# Create post-remove script
cat > "${PACKAGE_ROOT}/DEBIAN/postrm" << 'EOF'
#!/bin/bash
# Log files are stored in ~/.axiocnc/logs and are preserved for user inspection
# No cleanup needed as user directories are not managed by package removal
EOF
chmod +x "${PACKAGE_ROOT}/DEBIAN/postrm"

# Ensure output directory exists
mkdir -p "${PROJECT_ROOT}/output"

# Build .deb package
echo "Building .deb package..."
dpkg-deb --build "${PACKAGE_ROOT}" "${PROJECT_ROOT}/output/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"

# Get package size
PACKAGE_SIZE=$(du -h "${PROJECT_ROOT}/output/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb" | cut -f1)

echo ""
echo "✅ Server package built: output/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb (${PACKAGE_SIZE})"
echo "   Node.js ${NODE_VERSION} is bundled - no system Node.js required!"
echo ""
echo "Install with:"
echo "  sudo dpkg -i output/${PACKAGE_NAME}_${VERSION}_${ARCH}.deb"
echo "  sudo apt-get install -f  # if dependencies missing"
