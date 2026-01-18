#!/bin/bash
# Wrapper for package-sync.js to avoid yarn dependency

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
node "${SCRIPT_DIR}/package-sync.js"
