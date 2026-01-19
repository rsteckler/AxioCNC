#!/bin/bash
# Stop all documentation servers
echo "🛑 Stopping documentation servers..."

# Kill Python HTTP server
pkill -f "python3 -m http.server" 2>/dev/null && echo "✅ Static website server stopped" || echo "ℹ️  Static website server not running"

# Kill Docusaurus processes
pkill -f "docusaurus" 2>/dev/null && echo "✅ Documentation servers stopped" || echo "ℹ️  Documentation servers not running"

echo "🎯 All documentation servers stopped"