#!/bin/bash
# Start Grbl simulator with logging

set -e

# Default paths
GRBL_SIM_DIR="${GRBL_SIM_DIR:-examples/grbl-sim-build/grbl/grbl-sim}"
FAKETTY="${FAKETTY:-/dev/ttyFAKE}"
LOGDIR="${GRBL_SIM_DIR}/logs"
RESPONSE_LOG="${LOGDIR}/grbl-console.log"

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# Make GRBL_SIM_DIR absolute if it's relative
if [[ "$GRBL_SIM_DIR" != /* ]]; then
    GRBL_SIM_DIR="${PROJECT_ROOT}/${GRBL_SIM_DIR}"
fi
LOGDIR="${GRBL_SIM_DIR}/logs"
RESPONSE_LOG="${LOGDIR}/grbl-console.log"

# Check if grbl_sim.exe exists
GRBLSIM="${GRBL_SIM_DIR}/grbl_sim.exe"
if [ ! -e "$GRBLSIM" ]; then
    echo "❌ Error: $GRBLSIM not found"
    echo ""
    echo "Build it first:"
    echo "  cd ${GRBL_SIM_DIR}"
    echo "  make"
    exit 1
fi

# Create logs directory and ensure it's writable
mkdir -p "$LOGDIR"
chmod 755 "$LOGDIR" 2>/dev/null || sudo chmod 755 "$LOGDIR"

# Cleanup function
cleanup() {
    echo ""
    echo "Terminating grbl-sim..."
    sudo pkill -f "socat.*ttyFAKE" 2>/dev/null || true
    sudo pkill -f "grbl_sim.exe" 2>/dev/null || true
    exit 0
}
trap cleanup INT TERM

# Remove stale link if it exists
if [ -L "$FAKETTY" ]; then
    echo "Removing stale $FAKETTY link..."
    sudo rm -f "$FAKETTY"
fi

# Kill any existing socat processes
if pgrep -f "socat.*ttyFAKE" > /dev/null; then
    echo "Killing existing socat process..."
    sudo pkill -f "socat.*ttyFAKE"
    sleep 1
fi

# Clear old log
> "$RESPONSE_LOG"
sudo chmod a+rw "$RESPONSE_LOG" 2>/dev/null || true

echo "🚀 Starting Grbl simulator with logging..."
echo "📁 Log file: $RESPONSE_LOG"
echo "🔌 Fake serial port: $FAKETTY"
echo ""

# Start socat with grbl-sim using -g option for logging
# Run from the grbl-sim directory, use relative path for log file
cd "$GRBL_SIM_DIR"

# Ensure logs directory exists in the grbl-sim directory
mkdir -p "./logs"
chmod 755 "./logs" 2>/dev/null || sudo chmod 755 "./logs"

# Start socat - run from the grbl-sim directory
# Use bash -c to ensure we're in the right directory when sudo runs
sudo bash -c "cd '${GRBL_SIM_DIR}' && exec socat PTY,raw,link='${FAKETTY}',echo=0 'EXEC:./grbl_sim.exe -n -g ./logs/grbl-console.log -s step.out -b block.out',pty,raw,echo=0" &
SOCAT_PID=$!

# Wait for setup
sleep 2

# Check if link was created
if [ ! -L "$FAKETTY" ]; then
    echo "❌ ERROR: $FAKETTY was not created!"
    sudo pkill -f "socat.*ttyFAKE"
    exit 1
fi

# Fix permissions
sudo chmod a+rw "$FAKETTY"
sudo chmod a+rw "$(readlink -f "$FAKETTY")" 2>/dev/null || true
sudo chmod a+rw "$RESPONSE_LOG" 2>/dev/null || true

echo "✅ Grbl simulator running on $FAKETTY"
echo ""
echo "📊 Monitoring console log (Press CTRL+C to stop):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Monitor the log file
tail -f "$RESPONSE_LOG"
