# Restore Server Folder from v1.10.5 and Reapply Changes

## Overview

This plan will:
1. **Backup** your current `src/server/` folder with all your changes
2. **Restore** the entire `src/server/` folder from cncjs v1.10.5 tag
3. **Show you** what changed so you can selectively reapply your modifications
4. **Help you** work through conflicts incrementally

## Files You've Modified in src/server/

Based on your branch, these files have custom changes:

```
src/server/api/api.extensions.js
src/server/api/api.machine.js
src/server/api/api.macros.js
src/server/api/api.settings.js
src/server/api/api.themes.js
src/server/api/api.version.js
src/server/api/api.watchfolders.js
src/server/api/index.js
src/server/app.js
src/server/config/settings.base.js
src/server/controllers/Grbl/GrblController.js
src/server/i18n/*/resource.json (multiple languages)
```

Plus any files in:
- `src/server/services/` (MachineStatusManager, etc.)
- Other custom modifications

## The Process

### Phase 1: Backup & Restore

The script will:
1. Create a backup branch
2. Stash uncommitted changes
3. Save your entire `src/server/` folder to `/tmp/`
4. Restore `src/server/` from v1.10.5
5. Show you what changed

### Phase 2: Manual Reapplication

You'll then:
1. Compare your backup with v1.10.5 to see what you changed
2. Selectively apply changes back file by file
3. Resolve conflicts as you go
4. Test after each major change

## Execution Steps

### Step 1: Run the Restore Script

```bash
./restore-server-folder.sh
```

This will:
- ✅ Backup everything
- ✅ Restore server folder from v1.10.5
- ✅ Show you diff stats

### Step 2: Review What Changed

```bash
# See all files that differ
git status src/server/

# See what's different in a specific file (your backup vs restored)
git diff HEAD src/server/api/api.settings.js

# Compare your backup with restored version
diff -r /tmp/server-backup-YYYYMMDD/src/server/api/api.settings.js \
       src/server/api/api.settings.js
```

### Step 3: Reapply Changes File by File

For each file you modified, you have options:

**Option A: Manual merge** (recommended for complex changes)
```bash
# Use a 3-way merge tool
git merge-file src/server/api/api.settings.js \
               HEAD \
               /tmp/server-backup-YYYYMMDD/src/server/api/api.settings.js \
               upstream/v1.10.5:src/server/api/api.settings.js
```

**Option B: Copy your version** (if you want to keep all your changes)
```bash
cp /tmp/server-backup-YYYYMMDD/src/server/api/api.settings.js \
   src/server/api/api.settings.js
```

**Option C: Apply patch** (if changes are small)
```bash
# Generate patch from your changes
git diff upstream/v1.10.5 HEAD -- src/server/api/api.settings.js > /tmp/my-changes.patch

# Try to apply it
git apply /tmp/my-changes.patch
```

### Step 4: Priority Order for Reapplication

Work through files in this order to minimize cascade conflicts:

1. **Configuration files first** (least dependent)
   - `src/server/config/*`
   - `src/server/i18n/*`

2. **Core application** (medium dependency)
   - `src/server/app.js`
   - `src/server/index.js`

3. **API endpoints** (more complex)
   - `src/server/api/*.js`
   - Start with simpler ones, work up to complex ones

4. **Services** (dependent on API/controllers)
   - `src/server/services/*`

5. **Controllers last** (most complex, what you're trying to fix)
   - `src/server/controllers/Grbl/GrblController.js`
   - This should now have the `split()` code from v1.10.5

### Step 5: Test After Each Major Change

```bash
# After reapplying changes to a file or folder:
yarn install  # If dependencies changed
yarn start-server-dev  # Test that server starts
# Test the specific functionality you changed
```

## Conflict Resolution Strategy

### For API Files (api.settings.js, api.extensions.js, etc.)

These likely have:
- New endpoints you added
- Modified validation logic
- New features

**Strategy:**
1. Open both files side-by-side
2. Keep your new features/endpoints
3. Verify v1.10.5 didn't have conflicting changes (probably didn't)
4. Manually copy your additions back

### For GrblController.js

**Goal:** Get the `split()` code from v1.10.5 AND keep any critical fixes you made

**Strategy:**
1. The restored version should have `split()` ✓
2. Check if you made any safety-critical fixes
3. If so, carefully merge those back
4. Test thoroughly (this is protected code!)

### For Services (MachineStatusManager, etc.)

These are likely entirely your additions, so:
```bash
# Just copy them back
cp -r /tmp/server-backup-YYYYMMDD/src/server/services/* \
      src/server/services/
```

## Verification Checklist

After reapplying changes, verify:

- [ ] Server starts without errors: `yarn start-server-dev`
- [ ] GrblController has `split()` code: `grep "originalLine.split" src/server/controllers/Grbl/GrblController.js`
- [ ] Your API endpoints work: Test `/api/settings`, `/api/extensions`, etc.
- [ ] Your custom services load: Check MachineStatusManager, etc.
- [ ] No console errors on startup
- [ ] Frontend can connect to backend
- [ ] G-code commands work
- [ ] Protected code (controllers, Sender, Feeder) hasn't been broken

## Rollback Plan

If something goes wrong:

```bash
# Option 1: Abort and restore from backup
git checkout backup-before-restore-YYYYMMDD -- src/server/
git reset HEAD src/server/  # Unstage

# Option 2: Restore from /tmp backup
rm -rf src/server/
cp -r /tmp/server-backup-YYYYMMDD/src/server/ src/server/

# Option 3: Restore entire branch
git reset --hard backup-before-restore-YYYYMMDD
git stash pop  # Restore stashed changes
```

## Expected Timeline

- **Phase 1 (Script):** 2-5 minutes
- **Phase 2 (Review):** 10-15 minutes
- **Phase 3 (Reapplication):** 1-3 hours depending on:
  - Number of files modified
  - Complexity of changes
  - Conflicts encountered

**Total:** Plan for 2-4 hours of focused work

## Tips

1. **Commit frequently** as you restore files:
   ```bash
   git add src/server/api/api.settings.js
   git commit -m "restore: reapply api.settings.js customizations"
   ```

2. **Test incrementally** - don't wait until the end

3. **Document conflicts** - note what you changed and why

4. **Use git difftool** for visual merging:
   ```bash
   git config diff.tool vimdiff  # or meld, kdiff3, etc.
   git difftool /tmp/server-backup-YYYYMMDD/file.js src/server/file.js
   ```

5. **Keep the backup** until you're 100% sure everything works
