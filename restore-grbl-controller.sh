#!/bin/bash
# Restore GrblController.js from v1.10.5 while preserving all other changes

set -e  # Exit on error

echo "🔍 Checking current state..."
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  WARNING: You have uncommitted changes!"
    echo "   Stashing them..."
    git stash push -m "WIP before restoring GrblController from v1.10.5"
    STASHED=1
else
    STASHED=0
fi

echo ""
echo "📦 Creating backup branch..."
git branch backup-grbl-controller-$(date +%Y%m%d-%H%M%S) || true

echo ""
echo "🔄 Fetching v1.10.5 tag..."
git fetch upstream --tags 2>/dev/null || {
    echo "❌ Failed to fetch upstream. Make sure you have the upstream remote:"
    echo "   git remote add upstream https://github.com/cncjs/cncjs.git"
    exit 1
}

echo ""
echo "📥 Checking out GrblController.js from v1.10.5..."
git checkout upstream/v1.10.5 -- src/server/controllers/Grbl/GrblController.js

echo ""
echo "✅ Restored GrblController.js from v1.10.5"
echo ""
echo "🔍 Verifying the split() code is present..."
if grep -q "originalLine.split" src/server/controllers/Grbl/GrblController.js; then
    echo "   ✓ Found 'originalLine.split' - restoration successful!"
    grep -n "originalLine.split" src/server/controllers/Grbl/GrblController.js | head -2
else
    echo "   ⚠️  WARNING: split() code not found. Something may have gone wrong."
fi

echo ""
echo "📊 Current status:"
git status --short src/server/controllers/Grbl/GrblController.js

echo ""
if [ $STASHED -eq 1 ]; then
    echo "📝 Note: Your uncommitted changes were stashed."
    echo "   To restore them: git stash pop"
fi

echo ""
echo "✨ Done! Next steps:"
echo "   1. Review the changes: git diff src/server/controllers/Grbl/GrblController.js"
echo "   2. Test the server: yarn start-server-dev"
echo "   3. If everything works: git add src/server/controllers/Grbl/GrblController.js"
echo "   4. Commit: git commit -m 'chore: restore GrblController from v1.10.5 to get split() code'"
