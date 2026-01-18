# .deb Packaging Pipeline Modernization

## Current Structure Analysis

**Workspace Status:** Root is a Yarn workspace (`.`) but not a multi-workspace monorepo
**Server Package:** `src/package.json` → copied to `dist/axiocnc/package.json` during build
**Frontend:** `src/app/` → built separately with Vite, output goes to `dist/axiocnc/app/`

## Current Problems

1. **Yarn 3 Deprecation:** `yarn install --production` exits with code 1 (deprecation warning)
   - Script has `set -e`, so build fails
   - Staging directory (`${PACKAGE_ROOT}/opt/axiocnc/`) is not a workspace root
   - `yarn workspaces focus` cannot run in staging

2. **Asset Copy Paths:** `build-prod.sh` line 33 tries to copy `src/server/{i18n,views}` but path resolution may fail

3. **Dependency Management:** Running Yarn commands in partial staging folder doesn't work well with Yarn 3

## Solution Design

### Approach: Prune at Build Root, Then Copy

Since the staging directory isn't a workspace, we'll handle dependency pruning differently:

1. **Build Phase** (at root) - unchanged
   - Run full install with all deps for building
   - Build React app → `dist/axiocnc/app/`
   - Build Node server → `dist/axiocnc/server/`

2. **Production Prune Phase** (at root, before staging)
   - Create temporary production install location
   - Copy `dist/axiocnc/package.json` to temp location
   - Use Yarn 3-compatible method to install only production deps
   - Copy pruned `node_modules` from temp to staging

3. **Staging Phase** (copy artifacts)
   - Copy built server runtime
   - Copy pruned `node_modules`
   - Copy React static files
   - Copy assets (i18n, views, configs)

4. **Packaging Phase** (build .deb)
   - Create Debian package structure
   - Build .deb using dpkg-deb

### Yarn 3 Production Install Strategy

For a non-workspace standalone package (what we have in staging), options are:

**Option A (Recommended):** Use `yarn install --production` with error suppression
```bash
yarn install --production || {
  # Check if failure was just deprecation warning
  if yarn list --depth=0 --production 2>/dev/null | grep -q "@"; then
    # Dependencies were installed despite warning
    true
  else
    exit 1
  fi
}
```

**Option B:** Use `NODE_ENV=production yarn install` (Yarn 3 may still resolve devDeps)

**Option C:** Create temp workspace structure for pruning, then copy

We'll use **Option A** with a simpler check - just suppress the exit code if dependencies were actually installed.

## Implementation Plan

### Changes to `build-server-deb.sh`

1. After `yarn build-prod`, before copying to staging:
   - Create temp directory: `output/server-deb-build/.prod-install`
   - Copy `dist/axiocnc/package.json` there
   - Run production install with error handling
   - Verify `node_modules` was created

2. When copying to staging:
   - Copy built artifacts from `dist/axiocnc/*`
   - Copy pruned `node_modules` from `.prod-install/node_modules`

3. Remove dependency installation step from inside staging

### Changes to `build-prod.sh`

1. Fix path resolution for i18n/views copy:
   - Ensure working directory is project root
   - Use absolute paths or verify relative paths work

### Changes to `build-server-deb-debug.sh`

1. Same dependency handling approach
2. Note: Debug build may want all deps, but we'll still use production deps for consistency

## Files to Modify

- `scripts/build-server-deb.sh` - Main production package script
- `scripts/build-server-deb-debug.sh` - Debug package script  
- `scripts/build-prod.sh` - Fix asset copy paths (if needed)

## Testing Strategy

1. Test x64 build: `yarn build:server-deb-x64`
2. Verify .deb package contents: `dpkg-deb -c output/*.deb | head -20`
3. Check node_modules size: Should exclude devDependencies
4. Test installation: `sudo dpkg -i output/*.deb` on test system
5. Verify server runs: `/usr/bin/axiocnc --version`
