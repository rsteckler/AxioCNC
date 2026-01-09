#!/bin/bash
# Run grbl-sim with virtual serial port and logging
# Based on restart-with-logs.sh from old codebase

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Paths
GRBL_SIM_DIR="${PROJECT_ROOT}/examples/grbl-sim-build/grbl/grbl-sim"
EXECUTABLE="${GRBL_SIM_DIR}/grbl_sim.exe"
FAKETTY="${FAKETTY:-/dev/ttyFAKE}"
LOG_FILE="${GRBL_SIM_DIR}/logs/grbl-console.log"

# Check if built
if [ ! -f "$EXECUTABLE" ]; then
    echo "❌ Error: grbl_sim.exe not found at $EXECUTABLE"
    echo "   Run 'scripts/grblsim/grblsim-build.sh' first"
    exit 1
fi

# Check if socat is installed
if ! command -v socat &> /dev/null; then
    echo "❌ Error: socat is not installed"
    echo "   Install with: sudo apt-get install socat (Ubuntu/Debian)"
    echo "                 or: sudo yum install socat (RHEL/CentOS)"
    exit 1
fi

echo "Stopping existing grbl-sim..."
sudo pkill -f "socat.*ttyFAKE"
sleep 2

echo "Removing stale link..."
sudo rm -f "$FAKETTY"

echo "Clearing old logs..."
mkdir -p "${GRBL_SIM_DIR}/logs"
> "$LOG_FILE"
sudo chmod a+rw "$LOG_FILE" 2>/dev/null || true

echo ""
echo "Starting grbl-sim with logging..."
echo ""

# Change to grbl-sim directory for relative paths
cd "$GRBL_SIM_DIR"

# Use stdbuf to ensure unbuffered output, and proper tee
sudo bash -c "cd $(pwd) && socat PTY,raw,link=$FAKETTY,echo=0 \"EXEC:'stdbuf -oL -eL bash -c \\\"stdbuf -oL -eL ./grbl_sim.exe -n -s step.out -b block.out 2>&1 | stdbuf -oL tee -a $LOG_FILE\\\"',pty,raw,echo=0\"" &

sleep 2

if [ ! -L "$FAKETTY" ]; then
    echo "ERROR: $FAKETTY was not created!"
    exit 1
fi

sudo chmod a+rw "$FAKETTY"
sudo chmod a+rw "$(readlink -f "$FAKETTY")"
sudo chmod a+rw "$LOG_FILE" 2>/dev/null || true

echo "✓ grbl-sim running on $FAKETTY"
echo "✓ Log file: $LOG_FILE"
echo ""
echo "📊 Watching log file (Press CTRL+C to stop):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Example: Send a command to grbl-sim:"
echo "  echo -e '?\\n' > $FAKETTY"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Watch the log file
tail -f "$LOG_FILE"
