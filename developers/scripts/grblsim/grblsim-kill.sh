#!/bin/bash
# Kill Grbl simulator processes

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

FAKETTY="${FAKETTY:-/dev/ttyFAKE}"

echo "🛑 Stopping Grbl simulator..."

# Kill socat process
if pgrep -f "socat.*ttyFAKE" > /dev/null; then
    echo "Killing socat process..."
    sudo pkill -f "socat.*ttyFAKE"
    sleep 0.5
else
    echo "No socat process found"
fi

# Kill grbl_sim process
if pgrep -f "grbl_sim.exe" > /dev/null; then
    echo "Killing grbl_sim process..."
    sudo pkill -f "grbl_sim.exe"
    sleep 0.5
else
    echo "No grbl_sim process found"
fi

# Remove stale symlink if it exists
if [ -L "$FAKETTY" ]; then
    echo "Removing stale $FAKETTY link..."
    sudo rm -f "$FAKETTY"
fi

# Verify everything is stopped
if pgrep -f "socat.*ttyFAKE" > /dev/null || pgrep -f "grbl_sim.exe" > /dev/null; then
    echo "⚠️  Warning: Some processes may still be running"
    echo "Run 'ps aux | grep -E \"socat|grbl_sim\"' to check"
else
    echo "✅ Grbl simulator stopped"
fi
