# Simple Rebaseline: Restore v1.10.5 Server Folder

## Your Situation

- **Goal:** Get the `split()` code back from v1.10.5 in `GrblController.js`
- **Your custom work:** Frontend (src/app/), some server services (MachineStatusManager, etc.)
- **Key insight:** Most of your work is in `src/app/` and `src/server/services/`, not in `src/server/controllers/`

## Option 1: Replace Only Controllers Folder (RECOMMENDED)

**Safest approach** - Only replace the controllers that you haven't modified:

```bash
# 1. Backup current state
git branch backup-before-rebaseline
git stash  # Save any uncommitted changes

# 2. Fetch v1.10.5 tag
git fetch upstream --tags

# 3. Create a temporary branch from v1.10.5
git checkout -b temp-v1.10.5 upstream/v1.10.5

# 4. Copy controllers folder
cp -r src/server/controllers /tmp/controllers-v1.10.5

# 5. Go back to your main branch
git checkout main

# 6. Backup your current controllers (just in case)
cp -r src/server/controllers /tmp/controllers-backup

# 7. Replace controllers folder
rm -rf src/server/controllers
cp -r /tmp/controllers-v1.10.5 src/server/controllers

# 8. Verify you have the split() code
grep -n "originalLine.split" src/server/controllers/Grbl/GrblController.js

# 9. Restore any custom changes you need
# (You might need to manually merge specific changes back)
```

## Option 2: Selective File Restore (More Precise)

Only restore `GrblController.js` from v1.10.5:

```bash
# 1. Backup
git branch backup-before-rebaseline
git stash

# 2. Fetch v1.10.5
git fetch upstream --tags

# 3. Checkout just that file from v1.10.5
git checkout upstream/v1.10.5 -- src/server/controllers/Grbl/GrblController.js

# 4. Verify
grep -n "originalLine.split" src/server/controllers/Grbl/GrblController.js

# 5. Manually merge any custom changes you made to GrblController.js
# (Check your backup branch for what you changed)
```

## Option 3: Full Server Folder Replace (Simple but Risky)

**Warning:** This will lose any custom changes in `src/server/services/`, `src/server/api/`, etc.

```bash
# 1. CRITICAL: Backup everything first!
git branch backup-before-rebaseline
git stash

# 2. Check what you'd lose
git diff --name-only HEAD -- src/server/

# 3. Save your custom server files
mkdir -p /tmp/my-server-customizations
cp -r src/server/services /tmp/my-server-customizations/
cp -r src/server/api /tmp/my-server-customizations/
# Copy any other custom files

# 4. Replace entire server folder
git fetch upstream --tags
git checkout upstream/v1.10.5 -- src/server/

# 5. Restore your customizations
cp -r /tmp/my-server-customizations/services/* src/server/services/
cp -r /tmp/my-server-customizations/api/* src/server/api/
# Restore other custom files

# 6. Resolve conflicts as needed
git status
```

## Recommended: Option 1 or 2

Since you mentioned "replace the server folder", I assume you want Option 1 (controllers only) or Option 3 (full server).

**Quick Decision:**
- If you only modified `GrblController.js` → Use **Option 2**
- If you modified multiple controller files → Use **Option 1** 
- If you're confident you can restore your custom services/api changes → Use **Option 3**

## After Restoration

1. **Test immediately:**
   ```bash
   # Verify the split() code is there
   grep -A 3 "originalLine.split" src/server/controllers/Grbl/GrblController.js
   
   # Test build
   yarn install  # Update deps if needed
   yarn start-server-dev  # Make sure it starts
   ```

2. **Commit the change:**
   ```bash
   git add src/server/controllers/
   git commit -m "chore: restore controllers from v1.10.5 to get split() code"
   ```

3. **Restore any customizations** you need (manually merge back features from backup branch)

## What You'll Get

✅ `GrblController.js` with the `split(/;(.*)/s)` code  
✅ All other controllers from v1.10.5  
✅ Your custom frontend work (src/app/) untouched  
✅ Your custom services (if you use Option 1 or manually restore)

## What You Might Need to Re-merge

- Any custom changes to GrblController.js (from your backup branch)
- Configuration changes that affect controllers
- Any controller-related API changes
