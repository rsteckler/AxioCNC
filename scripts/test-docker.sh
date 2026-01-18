#!/bin/bash

# Quick Docker test script for AxioCNC
# Usage: bash scripts/test-docker.sh

set -e

IMAGE_NAME="axiocnc:test"
CONTAINER_NAME="axiocnc-test"
PORT=8000

echo "🐳 Testing AxioCNC Docker image..."
echo ""

# Step 1: Build the image
echo "📦 Step 1: Building Docker image..."
export DOCKER_BUILDKIT=1
if docker buildx version > /dev/null 2>&1; then
    echo "   Using buildx..."
    docker buildx build --load -t "$IMAGE_NAME" .
else
    echo "   Using docker build..."
    docker build -t "$IMAGE_NAME" .
fi
echo "   ✓ Build complete"
echo ""

# Step 2: Clean up any existing container
echo "🧹 Step 2: Cleaning up existing containers..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true
echo "   ✓ Cleanup complete"
echo ""

# Step 3: Run the container
echo "🚀 Step 3: Starting container..."
docker run -d -p "${PORT}:8000" --name "$CONTAINER_NAME" "$IMAGE_NAME"
echo "   ✓ Container started"
echo ""

# Step 4: Wait for container to be healthy
echo "⏳ Step 4: Waiting for container to be ready..."
sleep 3

# Check if container is running
if ! docker ps | grep -q "$CONTAINER_NAME"; then
    echo "   ❌ Container failed to start!"
    echo "   Checking logs:"
    docker logs "$CONTAINER_NAME"
    exit 1
fi

echo "   ✓ Container is running"
echo ""

# Step 5: Test API endpoint
echo "🧪 Step 5: Testing API endpoint..."
sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:${PORT}/api" || echo "000")

if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
    echo "   ✓ API endpoint responded (HTTP $HTTP_CODE)"
else
    echo "   ⚠️  API endpoint returned HTTP $HTTP_CODE (expected 401 or 200)"
fi
echo ""

# Step 6: Display status
echo "📊 Step 6: Container status:"
docker ps | grep "$CONTAINER_NAME" || echo "   Container not found in ps output"
echo ""

echo "📋 Container logs (last 10 lines):"
docker logs --tail 10 "$CONTAINER_NAME"
echo ""

# Step 7: Display access info
echo "✅ Test complete!"
echo ""
echo "🌐 Web interface: http://localhost:${PORT}"
echo "📝 View logs: docker logs -f $CONTAINER_NAME"
echo "🛑 Stop container: docker stop $CONTAINER_NAME"
echo "🗑️  Remove container: docker rm $CONTAINER_NAME"
echo ""
