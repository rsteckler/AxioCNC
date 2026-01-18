#!/bin/bash
# Start Grbl simulator with logging (wrapper for restart-with-logs.sh)

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Path to the working script
GRBL_SIM_DIR="${GRBL_SIM_DIR:-examples/grbl-sim-build/grbl/grbl-sim}"

# Make path absolute if relative
if [[ "$GRBL_SIM_DIR" != /* ]]; then
    GRBL_SIM_DIR="${PROJECT_ROOT}/${GRBL_SIM_DIR}"
fi

RESTART_SCRIPT="${GRBL_SIM_DIR}/restart-with-logs.sh"

# Check if script exists
if [ ! -f "$RESTART_SCRIPT" ]; then
    echo "❌ Error: $RESTART_SCRIPT not found"
    echo ""
    echo "Make sure the grbl-sim directory exists and restart-with-logs.sh is present"
    exit 1
fi

# Run the working script
exec bash "$RESTART_SCRIPT"
