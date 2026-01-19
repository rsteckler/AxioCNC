#!/bin/bash
# Enable grbl-sim by adding ttyFAKE port to ~/.axiocnc/config.json

# Change to project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$PROJECT_ROOT"

CONFIG_DIR="$HOME/.axiocnc"
CONFIG_FILE="$CONFIG_DIR/config.json"

echo "Enabling grbl-sim in $CONFIG_FILE..."

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: Config file not found at $CONFIG_FILE"
    echo "   Please run 'yarn dev:start-server' first to create the config file."
    exit 1
fi

# Read current config
CURRENT_CONFIG=$(cat "$CONFIG_FILE")

# Check if ttyFAKE is already configured
if echo "$CURRENT_CONFIG" | grep -q "/dev/ttyFAKE"; then
    echo "✓ ttyFAKE port already configured in $CONFIG_FILE"
    exit 0
fi

# Add ttyFAKE port to the ports array
# This is a simple approach - in production you'd want more robust JSON manipulation
if echo "$CURRENT_CONFIG" | grep -q '"ports":\s*\['; then
    # Ports array exists, add to it
    sed -i 's/"ports":\s*\[/&\
    {\
      "path": "\/dev\/ttyFAKE",\
      "manufacturer": "grbl-sim"\
    },/' "$CONFIG_FILE"
else
    # No ports array, create it
    cat > "$CONFIG_FILE" << 'EOF'
{
  "ports": [
    {
      "path": "/dev/ttyFAKE",
      "manufacturer": "grbl-sim"
    }
  ]
}
EOF
fi

echo "✓ Added ttyFAKE port configuration to $CONFIG_FILE"