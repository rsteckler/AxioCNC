#!/bin/bash
# Restore entire src/server/ folder from v1.10.5 tag
# This will backup your current server folder, restore from v1.10.5,
# then you can manually reapply your changes

set -e  # Exit on error

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="/tmp/server-backup-${TIMESTAMP}"
BACKUP_BRANCH="backup-before-restore-${TIMESTAMP}"

echo "═══════════════════════════════════════════════════════════════"
echo "  Restore Server Folder from v1.10.5"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  WARNING: You have uncommitted changes!"
    echo ""
    git status --short
    echo ""
    read -p "Stash them before proceeding? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash push -m "WIP before restoring server folder from v1.10.5"
        STASHED=1
        echo "✅ Stashed uncommitted changes"
    else
        echo "❌ Aborting. Please commit or stash your changes first."
        exit 1
    fi
else
    STASHED=0
    echo "✅ Working directory is clean"
fi

echo ""
echo "📦 Step 1: Creating backup branch..."
if git show-ref --verify --quiet refs/heads/"${BACKUP_BRANCH}"; then
    echo "   Branch ${BACKUP_BRANCH} already exists, using it"
else
    git branch "${BACKUP_BRANCH}"
    echo "   ✅ Created backup branch: ${BACKUP_BRANCH}"
fi

echo ""
echo "💾 Step 2: Backing up current src/server/ folder..."
if [ ! -d "src/server" ]; then
    echo "❌ Error: src/server/ directory not found!"
    exit 1
fi

mkdir -p "${BACKUP_DIR}"
cp -r src/server "${BACKUP_DIR}/"
echo "   ✅ Backed up to: ${BACKUP_DIR}/server"

# Also create a list of modified files for reference
echo ""
echo "📋 Step 3: Analyzing your changes..."
if git rev-parse --verify upstream/master >/dev/null 2>&1; then
    git diff --name-only upstream/master..HEAD -- src/server/ > "${BACKUP_DIR}/modified-files.txt" 2>/dev/null || true
    MODIFIED_COUNT=$(wc -l < "${BACKUP_DIR}/modified-files.txt" | tr -d ' ')
    echo "   Found ${MODIFIED_COUNT} modified files (saved to ${BACKUP_DIR}/modified-files.txt)"
    if [ -s "${BACKUP_DIR}/modified-files.txt" ]; then
        echo "   Modified files:"
        head -15 "${BACKUP_DIR}/modified-files.txt" | sed 's/^/      - /'
        if [ "${MODIFIED_COUNT}" -gt 15 ]; then
            echo "      ... and $((MODIFIED_COUNT - 15)) more"
        fi
    fi
else
    echo "   ⚠️  Could not compare with upstream/master (remote may not exist)"
    echo "   Saving list of all server files instead..."
    find src/server -type f > "${BACKUP_DIR}/all-files.txt" 2>/dev/null || true
fi

echo ""
echo "🔄 Step 4: Fetching v1.10.5 tag from upstream..."
if ! git fetch upstream --tags 2>/dev/null; then
    echo "   ⚠️  Upstream remote not found, trying origin..."
    if ! git fetch origin --tags 2>/dev/null; then
        echo "   ⚠️  Trying to fetch from https://github.com/cncjs/cncjs.git..."
        git fetch https://github.com/cncjs/cncjs.git refs/tags/v1.10.5:refs/tags/v1.10.5 2>/dev/null || {
            echo "   ❌ Could not fetch v1.10.5 tag!"
            echo "   Please add upstream remote:"
            echo "   git remote add upstream https://github.com/cncjs/cncjs.git"
            exit 1
        }
    fi
fi

# Find the tag
TAG_REF=$(git show-ref --tags | grep "v1.10.5$" | head -1 | cut -d' ' -f2)
if [ -z "$TAG_REF" ]; then
    echo "   ❌ Could not find v1.10.5 tag!"
    echo "   Available v1.10.x tags:"
    git tag | grep "^v1.10" | tail -5
    exit 1
fi

echo "   ✅ Found tag: $(git describe --tags ${TAG_REF})"

echo ""
echo "📥 Step 5: Restoring src/server/ from v1.10.5..."
echo "   This will REPLACE the entire src/server/ folder!"

# Show what will be checked out
echo ""
read -p "   Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted by user"
    exit 1
fi

# Remove current server folder and restore from tag
rm -rf src/server
git checkout "${TAG_REF}" -- src/server/

echo "   ✅ Restored src/server/ from v1.10.5"

echo ""
echo "🔍 Step 6: Verifying restoration..."
if grep -q "originalLine.split" src/server/controllers/Grbl/GrblController.js 2>/dev/null; then
    echo "   ✅ GrblController.js has the split() code!"
    grep -n "originalLine.split" src/server/controllers/Grbl/GrblController.js | head -2 | sed 's/^/      /'
else
    echo "   ⚠️  WARNING: split() code not found in GrblController.js"
fi

echo ""
echo "📊 Step 7: Summary of changes..."
CHANGED_FILES=$(git status --short src/server/ 2>/dev/null | wc -l | tr -d ' ')
echo "   ${CHANGED_FILES} files changed (compared to your previous version)"
echo ""
echo "   Files changed:"
git status --short src/server/ | head -20 | sed 's/^/      /'
if [ "${CHANGED_FILES}" -gt 20 ]; then
    echo "      ... and $((CHANGED_FILES - 20)) more (run 'git status src/server/' to see all)"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "  ✅ Restoration Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "📁 Backup location: ${BACKUP_DIR}/"
echo "🌿 Backup branch: ${BACKUP_BRANCH}"
echo ""
if [ $STASHED -eq 1 ]; then
    echo "📝 Note: Your uncommitted changes were stashed."
    echo "   To restore them later: git stash pop"
    echo ""
fi

echo "📋 Next Steps:"
echo ""
echo "   1. Review what changed:"
echo "      git status src/server/"
echo "      git diff --stat HEAD src/server/"
echo ""
echo "   2. Compare specific files with your backup:"
echo "      diff -r ${BACKUP_DIR}/server/api/api.settings.js src/server/api/api.settings.js"
echo ""
echo "   3. Reapply your changes file by file (see RESTORE_SERVER_PLAN.md)"
echo ""
echo "   4. Test frequently:"
echo "      yarn install  # Update dependencies if needed"
echo "      yarn start-server-dev  # Verify server starts"
echo ""
echo "   5. When done, commit:"
echo "      git add src/server/"
echo "      git commit -m 'chore: restore server folder from v1.10.5 and reapply customizations'"
echo ""
echo "⚠️  Remember: Your backup is at ${BACKUP_DIR}/"
echo "   Keep it until you're sure everything works!"
echo ""
