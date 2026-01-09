#!/bin/bash
# Clone grbl and grbl-sim repositories

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Paths
GRBL_BUILD_DIR="examples/grbl-sim-build"
GRBL_DIR="${GRBL_BUILD_DIR}/grbl"
GRBL_SIM_DIR="${GRBL_DIR}/grbl-sim"

GRBL_REPO="https://github.com/grbl/grbl.git"
GRBL_SIM_REPO="https://github.com/grbl/grbl-sim.git"

echo "📦 Cloning grbl and grbl-sim repositories..."

# Check if already cloned
if [ -d "$GRBL_SIM_DIR" ] && [ -d "$GRBL_SIM_DIR/.git" ]; then
    echo "⚠️  grbl-sim already exists at $GRBL_SIM_DIR"
    echo "   Remove it first or use 'grblsim-clean.sh --all' to start fresh"
    exit 1
fi

# Create build directory
mkdir -p "$GRBL_BUILD_DIR"

# Clone grbl if not exists
if [ ! -d "$GRBL_DIR" ] || [ ! -d "$GRBL_DIR/.git" ]; then
    echo "📥 Cloning grbl..."
    if ! git clone "$GRBL_REPO" "$GRBL_DIR"; then
        echo "❌ Failed to clone grbl repository"
        exit 1
    fi
else
    echo "✓ grbl already cloned"
fi

# Clone grbl-sim as sibling to grbl source directory (matches working structure from old codebase)
if [ ! -d "$GRBL_SIM_DIR" ] || [ ! -d "$GRBL_SIM_DIR/.git" ]; then
    echo "📥 Cloning grbl-sim as sibling to grbl source directory..."
    cd "$GRBL_DIR"
    if ! git clone "$GRBL_SIM_REPO" "grbl-sim"; then
        echo "❌ Failed to clone grbl-sim repository"
        exit 1
    fi
    cd "$PROJECT_ROOT"
else
    echo "✓ grbl-sim already cloned"
fi

echo "✅ Repositories cloned successfully to $GRBL_SIM_DIR"
