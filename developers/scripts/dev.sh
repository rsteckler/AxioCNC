#!/bin/bash
# Start development environment with optional grbl-sim

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Path to grbl-sim executable
GRBL_SIM_EXECUTABLE="${PROJECT_ROOT}/examples/grbl-sim-build/grbl/grbl-sim/grbl_sim.exe"

# Check if grbl-sim is installed
if [ ! -f "$GRBL_SIM_EXECUTABLE" ]; then
    echo ""
    echo -e "\033[31m⚠️  Warning: grbl-sim is not installed\033[0m"
    echo "   Development can continue without it, but you won't have a simulator"
    echo ""
    echo -e "   📖 See dev docs: \033[31m\033[4mhttps://github.com/rsteckler/axiocnc/blob/master/devdocs/development.md\033[0m"
    echo ""
    echo "   To install grbl-sim, run:"
    echo "     yarn dev:grblsim:clone"
    echo "     yarn dev:grblsim:fixup"
    echo "     yarn dev:grblsim:build"
    echo ""
    GRBL_SIM_AVAILABLE=false
else
    GRBL_SIM_AVAILABLE=true
fi

# Build dev environment first
echo "🔨 Building development environment..."
bash developers/scripts/build-dev.sh

# Start services concurrently
echo "🚀 Starting development services..."
if [ "$GRBL_SIM_AVAILABLE" = true ]; then
    echo "   - grbl-sim (simulator)"
    echo "   - dev server (backend)"
    echo "   - dev app (frontend)"
    concurrently \
        --names "grblsim,dev:server,dev:app" \
        --kill-others-on-fail \
        "bash developers/scripts/grblsim/grblsim-run.sh" \
        "yarn run dev:start-server" \
        "yarn run dev:start-app"
else
    echo "   - dev server (backend)"
    echo "   - dev app (frontend)"
    concurrently \
        --names "dev:server,dev:app" \
        --kill-others-on-fail \
        "yarn run dev:start-server" \
        "yarn run dev:start-app"
fi
