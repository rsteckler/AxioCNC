# AxioCNC Monorepo Inventory Report

**Generated:** 2026-01-18  
**Purpose:** Document current state before restructure (Phase 0 of Modernization Plan)

---

## 1. Package Manager Setup

| Item | Current State |
|------|---------------|
| Package Manager | Yarn 3.3.1 |
| Node Linker | `node-modules` (not PnP) |
| Yarn Path | `.yarn/releases/yarn-3.3.1.cjs` |
| Lock File | `yarn.lock` at root |
| Cache | `.yarn/cache/` |

### Workspaces Configuration

**Root `package.json`:**
```json
"workspaces": [
  "src/app"
]
```

**Issue:** Only `src/app` is a workspace. Server and electron-app are not workspaces, leading to:
- No independent versioning
- Dependencies mixed in root `package.json`
- `src/package.json` is manually synced via `scripts/package-sync.js`

---

## 2. Version Management

| File | Version |
|------|---------|
| `package.json` (root) | 1.10.112 |
| `src/package.json` | 1.10.112 |
| `src/app/package.json` | **2.0.0** |

### Issues
- **Version drift:** Frontend is at 2.0.0 while server is at 1.10.112
- **Auto-increment:** `scripts/build-server-deb.sh` auto-bumps version on every build
- **Manual sync:** `scripts/package-sync.js` copies fields from root to `src/package.json`
- **No single source of truth:** Version must be updated in multiple places

---

## 3. Current Directory Structure

```
/home/cryptyk/code/AxioCNC/
├── src/
│   ├── app/                    # Modern Vite frontend (workspace)
│   │   ├── src/
│   │   ├── package.json        # v2.0.0, type: module
│   │   └── vite.config.ts
│   ├── app-legacy/             # Original webpack frontend (reference)
│   ├── server/                 # Express API + Socket.IO
│   │   ├── api/
│   │   ├── controllers/        # PROTECTED: CNC controllers
│   │   ├── lib/                # PROTECTED: Sender, Feeder, etc.
│   │   ├── services/
│   │   ├── config/
│   │   ├── i18n/
│   │   └── views/
│   ├── electron-app/           # Electron menu templates
│   ├── shared/                 # Shared schemas (Zod)
│   │   └── schemas/
│   ├── main.js                 # Electron entry point
│   ├── server-cli.js           # Server CLI entry point
│   └── package.json            # Runtime deps (synced from root)
├── dist/                       # Production build output
│   └── axiocnc/
│       ├── server/
│       ├── app/                # (empty until frontend built)
│       ├── electron-app/
│       ├── shared/
│       ├── main.js
│       ├── server-cli.js
│       └── package.json
├── output/                     # Development build output
│   └── axiocnc/                # Same structure as dist/
├── scripts/                    # Build and deployment scripts
├── packaging/                  # (does not exist yet)
├── electron-build/             # Electron builder resources (icons)
├── .github/workflows/          # CI/CD
├── docs/                       # Documentation
├── aidocs/                     # AI documentation
└── node_modules/               # Root dependencies
```

---

## 4. Build System

### Build Scripts

| Script | Location | Purpose | Output |
|--------|----------|---------|--------|
| `build-prod.sh` | `scripts/` | Production build | `dist/axiocnc/` |
| `build-dev.sh` | `scripts/` | Development build | `output/axiocnc/` |
| `build-server-deb.sh` | `scripts/` | Deb package | `output/*.deb` |
| `electron-builder.sh` | `scripts/` | Electron installers | `output/` |
| `package-sync.js` | `scripts/` | Sync deps to src/package.json | - |

### Build Flow (Production)

```
scripts/build-prod.sh
├── scripts/package-sync.sh (sync deps)
├── babel src/*.js → dist/axiocnc/
├── babel src/electron-app/ → dist/axiocnc/electron-app/
├── babel src/shared → dist/axiocnc/shared/
├── babel src/server → dist/axiocnc/server/
├── i18next-scanner (extract translations)
├── cd src/app && yarn build → dist/axiocnc/app/
└── cp src/server/{i18n,views} → dist/axiocnc/server/
```

### Key Files Copied (Not Transpiled)
- `src/server/i18n/` - translations
- `src/server/views/` - Hogan templates
- `src/server/config/*.json` - config files
- `index.hbs` - root template (fallback for SPA)

---

## 5. Server Analysis

### Entry Points

| Entry | Path | Purpose |
|-------|------|---------|
| CLI | `src/server-cli.js` | Command-line interface, parses args, starts server |
| Server | `src/server/index.js` | Creates HTTP server, Socket.IO |
| App | `src/server/app.js` | Express app, routes, middleware |

### Static Asset Serving

**Configuration:** `src/server/config/settings.production.js`
```javascript
assets: {
  app: {
    routes: ['/hash8chars/', '/'],
    path: path.resolve(__dirname, '..', '..', 'app'),  // dist/axiocnc/app
    maxAge: maxAge
  }
}
```

**How it works:**
1. Server looks for `dist/axiocnc/app/index.html` (Vite-built)
2. If found, serves it directly via `res.sendFile()`
3. If not found, falls back to `index.hbs` template rendering
4. SPA catch-all routes all non-API, non-static requests to index.html

### Important Templates
- `index.hbs` - Root template (used as fallback)
- `src/server/views/common/404.hogan` - Not found page
- `src/server/views/common/500.hogan` - Error page

---

## 6. Electron Analysis

### Entry Point
- **Main:** `src/main.js` (transpiled to `dist/axiocnc/main.js`)
- **Electron Version:** 22.0.3

### How Electron Embeds Server

```javascript
// src/main.js
import launchServer from './server-cli';

const showMainWindow = async () => {
  const res = await launchServer();  // Starts server in-process
  const { address, port } = { ...res };
  mainWindow.loadURL(`http://${address}:${port}`);
};
```

**Key insight:** Electron runs the server *in the same process*, not as a child process. The server binds to `127.0.0.1:0` (random port) in Electron mode.

### Electron Builder Config

**Location:** `package.json` (root, `"build"` key)

```json
{
  "build": {
    "appId": "org.axiocnc",
    "productName": "AxioCNC",
    "directories": {
      "buildResources": "electron-build",
      "output": "output",
      "app": "dist/axiocnc"
    },
    ...
  }
}
```

**Resources:** `electron-build/` contains icons for macOS, Windows, Linux.

---

## 7. CI/CD Analysis

### Git Configuration

| Item | Value |
|------|-------|
| Current Branch | `main` (already migrated!) |
| Origin | `git@github.com:rsteckler/AxioCNC.git` |
| Upstream | `https://github.com/cncjs/cncjs.git` |

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | push to master, tags, PRs | Build all platforms |
| `ci-docker-hub.yml` | tags `v*` | Build & push Docker to Docker Hub |
| `static.yml` | unknown | Unknown purpose |

### Critical Issues in CI

1. **Wrong branch reference:** Workflows reference `master` but branch is `main`
   - `ci.yml` lines 8, 14: `branches: [master]`

2. **Wrong repo references:** Still references `cncjs/cncjs`
   - Lines 93-94, 99-100, 175-176, etc.: `--owner=cncjs --repo=cncjs`

3. **Wrong product name:** Uses `CNCjs` instead of `AxioCNC`
   - Lines 66, 167, 249, 333: `PRODUCT_NAME=CNCjs`

4. **Docker Hub, not GHCR:** `ci-docker-hub.yml` pushes to Docker Hub
   - Line 96: `DOCKER_REPO=cncjs/cncjs`

5. **PR publishing:** Current CI publishes on master push, not just tags

---

## 8. Packaging Analysis

### Debian Package (`build-server-deb.sh`)

**Process:**
1. Auto-bump version in both root and src `package.json`
2. Run `build-prod.sh`
3. Create package structure at `output/server-deb-build/`
4. Copy from `dist/axiocnc/` to package
5. Install production deps via yarn
6. Create systemd service file
7. Build .deb with `dpkg-deb`

**Output:** `output/axiocnc-server_X.Y.Z_ARCH.deb`

**Install location:** `/opt/axiocnc`

**Issue:** Build script bumps version, so every build = new version

### Docker (`Dockerfile`)

**Type:** Multi-stage build

```dockerfile
# Build stage
FROM node:18-slim as builder
# ... installs deps, runs build-prod.sh

# Runtime stage  
FROM node:18-slim
COPY --from=builder /build/dist/axiocnc ./
# ... installs production deps
```

**Issue:** Builds everything inside Docker. Should use pre-built bundle.

### Electron

**Tool:** electron-builder  
**Script:** `scripts/electron-builder.sh`

**Process:**
1. Requires `dist/axiocnc/` to exist
2. Cleans and reinstalls production deps
3. Rebuilds native modules (serialport) for Electron
4. Runs electron-builder

**Output:** `output/` (DMG, NSIS, AppImage, etc.)

---

## 9. Risks and Concerns

### High Risk

| Risk | Description | Mitigation |
|------|-------------|------------|
| CI broken on main | Workflows reference `master` | Update workflow files |
| Wrong publish targets | CI publishes to cncjs repo/Docker Hub | Update repo references |
| Version auto-bump | Deb build bumps version | Remove auto-bump, use tags |
| Import path breakage | Moving files will break imports | Comprehensive grep/sed |

### Medium Risk

| Risk | Description | Mitigation |
|------|-------------|------------|
| Version drift | Frontend at 2.0.0, server at 1.10.112 | Unify versions |
| Template fallback | index.hbs still used as fallback | Verify Vite build includes all needed files |
| Electron in-process server | Tight coupling | Document, consider child process |

### Low Risk

| Risk | Description | Mitigation |
|------|-------------|------------|
| Yarn 3 compatibility | Some scripts use `--production` | Test yarn install behavior |
| Native module rebuild | serialport needs rebuild for Electron | electron-rebuild in script |

---

## 10. Migration Checklist

### Pre-Migration (Do Before Moving Files)

- [x] Document current state (this report)
- [ ] Fix CI branch references (`master` → `main`)
- [ ] Fix CI repo references (`cncjs` → `rsteckler/AxioCNC`)
- [ ] Fix CI product name (`CNCjs` → `AxioCNC`)
- [ ] Create PR-only check workflow (no publishing)
- [ ] Unify versions (decide on 1.10.x or 2.x)

### During Migration

- [ ] Move with `git mv` to preserve history
- [ ] Update all import paths
- [ ] Update build scripts for new paths
- [ ] Update vite.config.ts output paths
- [ ] Update electron-builder config
- [ ] Test each app builds independently

### Post-Migration

- [ ] Verify `yarn install` from clean state
- [ ] Verify all build commands work
- [ ] Verify Docker build works
- [ ] Verify deb build works
- [ ] Verify Electron build works
- [ ] Update documentation

---

## 11. Summary

**Good News:**
- Branch already `main` (not `master`)
- Yarn 3 with node_modules (simpler than PnP)
- Modern frontend already in place (Vite, React 18)
- Clear separation between frontend and server

**Work Needed:**
- CI workflows need complete overhaul (wrong branch, wrong repo, wrong registry)
- Version management needs unification
- Folder structure needs reorganization
- Build scripts need simplification (bundle-first approach)
- Packaging should consume single bundle, not rebuild

**Recommendation:** Proceed with restructure, but fix CI references first to avoid broken pipelines.
