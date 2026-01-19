#!/bin/bash

# Start both user docs and developer docs simultaneously
# User docs: http://localhost:3000/docs/
# Dev docs: http://localhost:3001/devdocs/

echo "🚀 Starting AxioCNC Documentation Servers..."
echo "📖 User Docs: http://localhost:3000/docs/"
echo "🛠️  Dev Docs: http://localhost:3001/devdocs/"
echo ""

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null; then
        echo "❌ Port $1 is already in use. Please stop the conflicting service first."
        exit 1
    fi
}

# Check if ports are available
check_port 3000
check_port 3001

# Start both servers in background
echo "📦 Starting user documentation server..."
cd website/docs/user && npm start -- --port 3000 &
USER_DOCS_PID=$!

echo "🔧 Starting developer documentation server..."
cd website/docs/developer && npm start -- --port 3001 &
DEV_DOCS_PID=$!

echo ""
echo "✅ Both servers starting... This may take a minute."
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for both processes
wait $USER_DOCS_PID $DEV_DOCS_PID