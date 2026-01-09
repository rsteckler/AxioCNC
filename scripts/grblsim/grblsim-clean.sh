#!/bin/bash
# Clean grbl-sim build artifacts

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Paths
GRBL_BUILD_DIR="${PROJECT_ROOT}/examples/grbl-sim-build"
GRBL_SIM_DIR="${GRBL_BUILD_DIR}/grbl/grbl-sim"

# Check for --all flag
CLEAN_ALL=false
if [[ "$1" == "--all" ]] || [[ "$1" == "-a" ]]; then
    CLEAN_ALL=true
fi

if [ "$CLEAN_ALL" = true ]; then
    # Remove entire build directory
    if [ -d "$GRBL_BUILD_DIR" ]; then
        echo "🗑️  Removing entire grbl-sim build directory..."
        rm -rf "$GRBL_BUILD_DIR"
        echo "✅ Removed $GRBL_BUILD_DIR"
    else
        echo "ℹ️  Build directory not found: $GRBL_BUILD_DIR"
    fi
else
    # Clean build artifacts only
    if [ ! -d "$GRBL_SIM_DIR" ]; then
        echo "ℹ️  grbl-sim directory not found: $GRBL_SIM_DIR"
        exit 0
    fi

    echo "🧹 Cleaning build artifacts..."

    cd "$GRBL_SIM_DIR"

    # Run make clean if available
    if [ -f "Makefile" ] && grep -q "^clean:" Makefile; then
        echo "   Running 'make clean'..."
        make clean 2>/dev/null || true
    fi

    # Remove common build artifacts
    echo "   Removing executables and object files..."
    rm -f grbl_sim.exe grbl_sim *.o *.out step.out block.out

    # Remove backup files
    rm -f Makefile.bak *.bak

    echo "✅ Build artifacts cleaned"

    echo ""
    echo "ℹ️  To remove the entire cloned directory, use:"
    echo "   scripts/grblsim/grblsim-clean.sh --all"
fi
