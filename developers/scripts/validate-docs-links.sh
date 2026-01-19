#!/bin/bash
# Validate documentation links before starting dev servers
# This catches broken links early, before GitHub Actions builds

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

echo "🔍 Validating documentation links..."

# Validate developer docs
echo "Checking developer documentation..."
cd website/docs/developer
if npm run build > /tmp/devdocs-build.log 2>&1; then
  echo "✅ Developer docs: No broken links found"
else
  echo "❌ Developer docs: Broken links detected!"
  echo ""
  grep -A 10 "Broken link" /tmp/devdocs-build.log || cat /tmp/devdocs-build.log
  exit 1
fi

# Validate user docs
echo "Checking user documentation..."
cd ../user
if npm run build > /tmp/userdocs-build.log 2>&1; then
  echo "✅ User docs: No broken links found"
else
  echo "❌ User docs: Broken links detected!"
  echo ""
  grep -A 10 "Broken link" /tmp/userdocs-build.log || cat /tmp/userdocs-build.log
  exit 1
fi

cd "${PROJECT_ROOT}"
echo "✅ All documentation links validated successfully!"
