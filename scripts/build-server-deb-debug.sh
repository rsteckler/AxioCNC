#!/bin/bash
# Build server-only .deb package for Raspberry Pi (DEBUG version with source maps)

set -e

ARCH=${1:-arm64}  # arm64 or armv7l
PACKAGE_NAME="axiocnc-server"
INSTALL_DIR="/opt/axiocnc"
BUILD_DIR="output/server-deb-build"

echo "Building DEBUG server-only .deb package for ${ARCH}..."

# Bump version before building (must bump both root and src package.json)
echo "Bumping version..."
CURRENT_VERSION=$(node -e "console.log(require('./package.json').version)")

# Calculate new version
NEW_VERSION=$(node -e "
  const v = require('./package.json').version.split('.');
  v[2] = parseInt(v[2]) + 1;
  console.log(v.join('.'));
")

echo "Version: ${CURRENT_VERSION} -> ${NEW_VERSION}"

# Update version in both root and src package.json
node -e "
  const fs = require('fs');
  const rootPkg = require('./package.json');
  const srcPkg = require('./src/package.json');
  rootPkg.version = '${NEW_VERSION}';
  srcPkg.version = '${NEW_VERSION}';
  fs.writeFileSync('./package.json', JSON.stringify(rootPkg, null, 2) + '\n');
  fs.writeFileSync('./src/package.json', JSON.stringify(srcPkg, null, 2) + '\n');
"

# Get the new version
VERSION="${NEW_VERSION}"

# Clean previous build
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"

# Build development version (includes source maps)
echo "Building DEBUG application (with source maps)..."
yarn build-dev

# Create package structure
PACKAGE_ROOT="${BUILD_DIR}/${PACKAGE_NAME}_${VERSION}-debug_${ARCH}"
mkdir -p "${PACKAGE_ROOT}${INSTALL_DIR}"
mkdir -p "${PACKAGE_ROOT}/usr/bin"
mkdir -p "${PACKAGE_ROOT}/etc/systemd/system"
mkdir -p "${PACKAGE_ROOT}/DEBIAN"

# Copy built application (from output/ instead of dist/)
echo "Copying application files..."
cp -r output/axiocnc/* "${PACKAGE_ROOT}${INSTALL_DIR}/"

# Install ALL dependencies (including dev dependencies for debugging)
echo "Installing dependencies (including dev dependencies)..."
cd "${PACKAGE_ROOT}${INSTALL_DIR}"
yarn install
# Ensure zod is installed (required by shared/schemas)
yarn add zod@^4.3.5 || echo "Warning: Could not install zod"
cd - > /dev/null

# Create launcher script (with NODE_ENV=development)
echo "Creating launcher script..."
cat > "${PACKAGE_ROOT}/usr/bin/cncjs" << 'EOF'
#!/usr/bin/env node
// AxioCNC Server Launcher (DEBUG)
process.env.NODE_ENV = 'development';
process.chdir('/opt/axiocnc');
// Ensure --host 0.0.0.0 and --allow-remote-access are set
const args = process.argv.slice(2);
if (!args.includes('--host')) {
  args.push('--host', '0.0.0.0');
}
if (!args.includes('--allow-remote-access')) {
  args.push('--allow-remote-access');
}
// Reconstruct argv properly for commander
process.argv = ['node', '/opt/axiocnc/server-cli.js', ...args];
const launchServer = require('/opt/axiocnc/server-cli');
launchServer().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
EOF
chmod +x "${PACKAGE_ROOT}/usr/bin/cncjs"

# Create systemd service file (with NODE_ENV=development)
echo "Creating systemd service..."
cat > "${PACKAGE_ROOT}/etc/systemd/system/axiocnc.service" << EOF
[Unit]
Description=AxioCNC CNC Controller Server (DEBUG)
After=network.target

[Service]
Type=simple
User=root
Environment=NODE_ENV=development
WorkingDirectory=${INSTALL_DIR}
ExecStart=/usr/bin/node ${INSTALL_DIR}/server-cli.js --port 8000 --host 0.0.0.0 --allow-remote-access
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
Version: ${VERSION}-debug
Architecture: ${ARCH}
Maintainer: AxioCNC Team
Description: AxioCNC - Web-based CNC controller interface (Server DEBUG)
 AxioCNC is a web-based interface for CNC controllers running Grbl,
 Marlin, Smoothieware, or TinyG. This package provides the server
 component for headless deployment on Raspberry Pi (DEBUG version with source maps).
Depends: nodejs (>= 18), udev
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

echo ""
echo "AxioCNC server (DEBUG) installed successfully!"
echo ""
echo "To start the server:"
echo "  cncjs --port 8000 --host 0.0.0.0"
echo ""
echo "Or enable as a service:"
echo "  sudo systemctl enable axiocnc"
echo "  sudo systemctl start axiocnc"
echo ""
echo "Note: You may need to log out and back in for serial port access."
echo "Note: This is a DEBUG build with source maps enabled."
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

# Build .deb package
echo "Building .deb package..."
dpkg-deb --build "${PACKAGE_ROOT}" "output/${PACKAGE_NAME}_${VERSION}-debug_${ARCH}.deb"

echo ""
echo "✅ DEBUG server package built: output/${PACKAGE_NAME}_${VERSION}-debug_${ARCH}.deb"
echo ""
echo "Install with:"
echo "  sudo dpkg -i output/${PACKAGE_NAME}_${VERSION}-debug_${ARCH}.deb"
echo "  sudo apt-get install -f  # if dependencies missing"
