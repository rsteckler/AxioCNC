# Rebaseline Plan: Moving from cncjs master to v1.10.5

## Current Situation

- **Current branch:** `main` (3184 commits)
- **Base:** Started from recent cncjs master (around commit 4d1ffa07)
- **Target:** Rebaseline to cncjs v1.10.5 (commit d6d079c6)
- **Goal:** Keep all your custom changes, but base them on v1.10.5 instead of master

## Key Commits

- `v1.10.5` tag: `d6d079c6` (January 2025 - has the `split()` code you want)
- Merge-base with upstream/master: `4d1ffa07` (feat: improve rendering on high dpi screens)
- Commit that removed split() in master: `3dc3905c` (after v1.10.5, before your merge-base)

## Strategy Options

### Option 1: Interactive Rebase (Recommended for Control)

**Best if:** You want maximum control and can review each commit

**Steps:**
1. **Create a backup branch**
   ```bash
   git branch backup-main-before-rebase
   git push origin backup-main-before-rebase
   ```

2. **Identify your starting commit**
   Find the commit where you first made changes (before any upstream merges):
   ```bash
   git log --oneline --first-parent main | tail -1
   # Or find the commit where you started your work
   ```

3. **Rebase onto v1.10.5**
   ```bash
   # Rebase everything from your starting point to HEAD onto v1.10.5
   git rebase --onto upstream/v1.10.5 <your-starting-commit> main
   ```
   
   Or if you know your work started after a specific commit:
   ```bash
   # This will replay all commits after merge-base onto v1.10.5
   git rebase --onto upstream/v1.10.5 4d1ffa07 main
   ```

4. **Resolve conflicts incrementally**
   - Git will stop at each conflict
   - Resolve manually or with tools
   - `git rebase --continue` after each resolution
   - Use `git rebase --skip` to skip commits that don't apply
   - Use `git rebase --abort` if you need to start over

### Option 2: Merge Strategy (Safer, Less Clean)

**Best if:** You want to preserve exact history and don't mind merge commits

**Steps:**
1. **Create a new branch from v1.10.5**
   ```bash
   git checkout -b main-v1.10.5-baseline upstream/v1.10.5
   ```

2. **Merge your current main (with strategy)**
   ```bash
   git merge -s ours main
   # This creates a merge commit but doesn't apply changes
   ```

3. **Cherry-pick your commits selectively**
   ```bash
   # Identify your commits (not from upstream)
   git log --oneline main --not upstream/master
   # Cherry-pick them one by one or in batches
   ```

### Option 3: Three-Way Merge (For Complex Cases)

**Best if:** You have significant conflicts and want git to help

**Steps:**
1. **Create baseline branch**
   ```bash
   git checkout -b rebaseline-v1.10.5 upstream/v1.10.5
   ```

2. **Merge with strategy**
   ```bash
   git merge -X ours upstream/master  # Take v1.10.5 version for conflicts
   git merge main  # Now merge your work
   # Resolve conflicts, favoring your changes
   ```

## Recommended Approach: Option 1 (Interactive Rebase)

Since you have many commits and want a clean history, here's the detailed plan:

### Phase 1: Preparation

```bash
# 1. Ensure clean working directory
git status  # Should show clean or commit/stash changes

# 2. Create backup
git branch backup-main-$(date +%Y%m%d)
git push origin backup-main-$(date +%Y%m%d)

# 3. Stash any uncommitted work
git stash push -m "WIP before rebaseline"

# 4. Fetch latest from upstream
git fetch upstream --tags
```

### Phase 2: Identify Divergence Point

```bash
# Find where you started making your own changes
# Look for commits that are NOT in upstream/master
git log --oneline main --not upstream/master | tail -20

# Or find your first unique commit
git log --oneline --all --graph | grep -A 5 -B 5 "your-first-feature-commit"
```

**Important:** Identify the commit hash where YOUR work began (before any upstream merges)

### Phase 3: Perform Rebase

```bash
# Example: if your work started at commit abc1234
git rebase --onto upstream/v1.10.5 abc1234 main

# OR if your entire branch is custom work after merge-base:
git rebase --onto upstream/v1.10.5 4d1ffa07 main
```

### Phase 4: Resolve Conflicts

Git will stop at each conflicting commit. For each one:

```bash
# 1. Review the conflict
git status
git diff

# 2. Edit files to resolve conflicts
# Look for <<<<<<< markers

# 3. Stage resolved files
git add <resolved-files>

# 4. Continue
git rebase --continue

# OR if this commit should be skipped:
git rebase --skip

# OR if things go wrong:
git rebase --abort
```

### Phase 5: Verify and Push

```bash
# 1. Verify the result
git log --oneline --graph -20
git log --oneline upstream/v1.10.5..HEAD | wc -l  # Should match your commit count

# 2. Test the codebase
# Run your tests, start the server, verify functionality

# 3. Force push (if working alone on branch)
git push --force-with-lease origin main

# OR create a new branch first
git push origin main:main-rebased-v1.10.5
```

## Conflict Resolution Tips

1. **For protected code (GrblController, etc.):**
   - v1.10.5 has the `split()` pattern you want
   - Your changes might conflict with refactored code
   - Carefully merge your enhancements with v1.10.5 base

2. **For frontend code:**
   - Your modern React/Vite work is likely all custom
   - Should rebase cleanly
   - May need to update imports/paths

3. **For configuration:**
   - Merge your config changes
   - Keep your package.json updates

## Rollback Plan

If something goes wrong:

```bash
# Option 1: Abort in-progress rebase
git rebase --abort

# Option 2: Reset to backup
git reset --hard backup-main-YYYYMMDD

# Option 3: Restore from remote
git fetch origin
git reset --hard origin/backup-main-before-rebase
```

## Testing Checklist

After rebase, verify:
- [ ] Server starts without errors
- [ ] Frontend builds successfully
- [ ] GrblController has the `split()` code from v1.10.5
- [ ] Your custom features still work
- [ ] No regressions in protected code
- [ ] API endpoints function correctly
- [ ] Socket.IO connections work

## Estimated Time

- **Small conflict set:** 1-2 hours
- **Medium conflicts:** 2-4 hours  
- **Heavy conflicts:** 4-8 hours

Plan for a dedicated session with no interruptions.
