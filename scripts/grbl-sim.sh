#!/bin/bash
# Start Grbl simulator with logging

set -e

# Default paths
GRBL_SIM_DIR="${GRBL_SIM_DIR:-examples/grbl-sim-build/grbl/grbl-sim}"
FAKETTY="${FAKETTY:-/dev/ttyFAKE}"
LOGDIR="${GRBL_SIM_DIR}/logs"
RESPONSE_LOG="${LOGDIR}/grbl-console.log"

# Change to project root
cd "$(dirname "$0")/.."

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

# Create logs directory
mkdir -p "$LOGDIR"

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
cd "$GRBL_SIM_DIR"
sudo socat PTY,raw,link="$FAKETTY",echo=0 "EXEC:'./grbl_sim.exe -n -g $RESPONSE_LOG -s step.out -b block.out',pty,raw,echo=0" &
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
