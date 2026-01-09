#!/bin/bash
# Build grbl-sim executable

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Paths
GRBL_SIM_DIR="${PROJECT_ROOT}/examples/grbl-sim-build/grbl/grbl-sim"
MAKEFILE="${GRBL_SIM_DIR}/Makefile"
EXECUTABLE="${GRBL_SIM_DIR}/grbl_sim.exe"

# Check if cloned
if [ ! -d "$GRBL_SIM_DIR" ] || [ ! -d "$GRBL_SIM_DIR/.git" ]; then
    echo "❌ Error: grbl-sim not found at $GRBL_SIM_DIR"
    echo "   Run 'scripts/grblsim/grblsim-clone.sh' first"
    exit 1
fi

# Check if Makefile exists
if [ ! -f "$MAKEFILE" ]; then
    echo "❌ Error: Makefile not found at $MAKEFILE"
    exit 1
fi

echo "🔨 Building grbl-sim..."

# Detect platform
PLATFORM=""
if [[ "$OSTYPE" == "linux-gnu"* ]] || [[ "$OSTYPE" == "linux-musl"* ]] || [[ -n "${WSL_DISTRO_NAME}" ]]; then
    PLATFORM="LINUX"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    PLATFORM="MACOS"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "win32" ]]; then
    PLATFORM="WINDOWS"
else
    echo "⚠️  Warning: Unknown platform ($OSTYPE), defaulting to LINUX"
    PLATFORM="LINUX"
fi

echo "   Detected platform: $PLATFORM"

# Configure Makefile - set platform
cd "$GRBL_SIM_DIR"

# Create backup of Makefile for platform setting
cp "$MAKEFILE" "${MAKEFILE}.platform.bak"

# Comment out all PLATFORM lines
sed -i 's/^PLATFORM = /#PLATFORM = /' "$MAKEFILE"

# Uncomment the correct platform line (case-insensitive)
sed -i "s/^#PLATFORM = ${PLATFORM}/PLATFORM = ${PLATFORM}/i" "$MAKEFILE"

# Build
echo "   Running 'make new'..."
if make new; then
    # Verify executable was created
    if [ -f "$EXECUTABLE" ]; then
        echo "✅ Build successful! Executable: $EXECUTABLE"
        # Clean up platform backup on success
        [ -f "${MAKEFILE}.platform.bak" ] && rm -f "${MAKEFILE}.platform.bak"
    else
        echo "⚠️  Warning: Build completed but $EXECUTABLE not found"
        echo "   Check Makefile output for actual executable name"
        # Restore platform backup on failure
        [ -f "${MAKEFILE}.platform.bak" ] && mv "${MAKEFILE}.platform.bak" "$MAKEFILE"
        exit 1
    fi
else
    echo "❌ Build failed"
    # Restore platform backup on failure
    [ -f "${MAKEFILE}.platform.bak" ] && mv "${MAKEFILE}.platform.bak" "$MAKEFILE"
    exit 1
fi
