# AxioCNC Monorepo Modernization Plan  
**Layout → Build Contract → CI/CD → Releases**

> **Last Updated:** 2026-01-18  
> **Status:** Phase 0 Complete, Phase 1 Ready  
> **Inventory Report:** [`aidocs/inventory-report.md`](./inventory-report.md)

This document is a step-by-step execution plan for an agent. Each phase contains:
- Objectives  
- Concrete tasks  
- **Recommended agent prompts** (paste verbatim)  
- **Definition of Done (DoD)** with verifiable checks

---

## Progress Tracker

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Inventory | **COMPLETE** | See `inventory-report.md` |
| Phase 1: Folder Restructure | Ready | Set up apps/ + packages/ layout |
| Phase 2: CI Fixes + PR Gate | Pending | Fix cncjs refs, add PR workflow |
| Phase 3: Bundle Contract | Pending | Single deployable artifact |
| Phase 4: Electron Integration | Pending | Decision: in-process vs child process |
| Phase 5: Version Management | Pending | Decision: unified version (1.x vs 2.x) |
| Phase 6: Release Workflow | Pending | Tag-based releases |
| Phase 7: Security | Pending | CodeQL, dependency review |
| Phase 8: Cleanup | Pending | Remove legacy paths |

---

## Key Findings from Phase 0

1. **Branch already `main`** - no rename needed
2. **CI is broken** - workflows reference `master` and `cncjs/cncjs`
3. **Version drift** - server=1.10.112, frontend=2.0.0
4. **Electron runs server in-process** - not as child process

---

## North Star Outcomes

1. **Clear product model**
   - **Server release**: Node/Express + React static → ships as **.deb** and **Docker (GHCR)**
   - **Desktop release**: Electron thick app that bundles server+web and launches local UI

2. **Single runtime contract**
   - `bundle/server-runtime/` is the authoritative filesystem for:
     - deb packaging  
     - docker images  
     - (optionally) electron embedding

3. **GitHub-native CI/CD**
   - Trunk-based `main` + tags `vX.Y.Z`
   - PR CI = quality gate  
   - Tag release = publish artifacts + GHCR

---

## Target Directory Structure

```
repo/
├── apps/
│   ├── web/                    # React SPA (from src/app)
│   │   ├── src/
│   │   ├── dist/               # (gitignored)
│   │   └── package.json
│   ├── server/                 # Express API (from src/server + src/*.js)
│   │   ├── src/
│   │   ├── dist/               # (gitignored)
│   │   └── package.json
│   └── desktop/                # Electron (from src/electron-app + src/main.js)
│       ├── src/
│       ├── dist/               # (gitignored)
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared code (from src/shared)
│       ├── src/
│       └── package.json
│
├── bundle/
│   └── server-runtime/         # (gitignored) Single deployable unit
│
├── packaging/
│   ├── deb/                    # Debian packaging scripts
│   ├── docker/                 # Dockerfile + compose
│   └── desktop/                # electron-builder config
│
├── scripts/                    # Build orchestration
├── .github/workflows/          # CI/CD
├── package.json                # Root: workspaces + orchestration scripts
└── docs/
    └── releasing.md            # Release process documentation
```

---

# Phase 0 — Preflight Inventory ✅ COMPLETE

### Objectives
- Understand current tooling and entrypoints  
- Identify existing build outputs  
- Capture risks before moving files

### Output
**Report:** [`aidocs/inventory-report.md`](./inventory-report.md)

### Key Findings
- **Package Manager:** Yarn 3.3.1 with node-modules linker
- **Workspaces:** Only `src/app` is a workspace
- **Build Outputs:** `dist/axiocnc/` (prod), `output/axiocnc/` (dev)
- **Server Entry:** `src/server-cli.js` → `src/server/index.js`
- **Electron Entry:** `src/main.js` (runs server in-process)
- **CI Issues:** Wrong branch, wrong repo, wrong registry references

### Definition of Done
- [x] Report lists: package manager, build tools, entrypoints  
- [x] Current deb/docker inputs documented  
- [x] Risks and unknowns captured  
- [x] No files changed

---

# Phase 1 — Restructure Into apps/ + packages/

**Objective:** Move code to new layout without breaking builds. Do this BEFORE updating CI so the new paths exist.

### 1.1 Create new directory structure

**Agent Prompt**
```
Create the new monorepo structure. This is a MECHANICAL REFACTOR - preserve all functionality.

Step 1: Create directories
mkdir -p apps/web apps/server apps/desktop packages/shared

Step 2: Move code (preserve git history with git mv):

Web (do first - it's already a workspace):
- git mv src/app apps/web
- Update vite.config.ts output paths to ./dist

Server:
- git mv src/server apps/server/src
- git mv src/server-cli.js apps/server/src/cli.js
- Create apps/server/package.json from src/package.json
- Copy necessary root files: babel.config.js reference

Desktop:
- git mv src/electron-app apps/desktop/src
- git mv src/main.js apps/desktop/src/main.js
- Create apps/desktop/package.json

Shared:
- git mv src/shared packages/shared/src
- Create packages/shared/package.json

Step 3: Update root package.json workspaces:
"workspaces": [
  "apps/web",
  "apps/server", 
  "apps/desktop",
  "packages/shared"
]

Step 4: Update import paths in all moved files
- grep for '../server', '../shared', './server-cli' etc. and fix

Step 5: Keep src/app-legacy/ in place (reference only, not moved)

DO NOT delete empty src/ folders yet - keep until builds verified.
```

**DoD**
- [ ] New folder structure exists
- [ ] All code moved with git mv (preserves history)
- [ ] Root package.json lists all workspaces
- [ ] Import paths updated
- [ ] `yarn install` succeeds

---

### 1.2 Normalize build outputs to dist/

**Agent Prompt**
```
Configure each app to output to its own dist/ folder:

1. apps/web/vite.config.ts:
   - Change outDir to './dist' (relative to apps/web)
   - Remove the ../../dist/axiocnc/app path

2. apps/server:
   - Configure babel to output to apps/server/dist/
   - Update build script in package.json

3. apps/desktop:
   - Configure electron-builder output to apps/desktop/dist/

4. Update .gitignore:
   - Add: apps/*/dist/
   - Add: packages/*/dist/
   - Keep old dist/ entries until cleanup phase
```

**DoD**
- [ ] Each app writes only to its own `dist/`
- [ ] Clean build from repo root succeeds
- [ ] dist/ folders ignored by git

---

### 1.3 Root orchestration scripts

**Agent Prompt**
```
Create root package.json scripts that delegate to workspaces:

"scripts": {
  "build": "yarn build:web && yarn build:server",
  "build:web": "yarn workspace @axiocnc/web build",
  "build:server": "yarn workspace @axiocnc/server build",
  "build:desktop": "yarn workspace @axiocnc/desktop build",
  "dev": "concurrently \"yarn dev:server\" \"yarn dev:web\"",
  "dev:web": "yarn workspace @axiocnc/web dev",
  "dev:server": "nodemon --config nodemon.server.json"
}

Update nodemon.server.json to watch new paths.
```

**DoD**
- [ ] `yarn build` builds web and server
- [ ] `yarn dev` starts both dev servers
- [ ] Individual build commands work
- [ ] No duplicated logic

---

### 1.4 Verify builds work

**Agent Prompt**
```
Verify all builds work from the new structure:

1. Clean and install:
   rm -rf node_modules apps/*/node_modules packages/*/node_modules
   yarn install

2. Build each app:
   yarn build:web
   yarn build:server

3. Integration test:
   - Start server manually from apps/server/dist/
   - Verify it serves web assets from apps/web/dist/
   - Test: curl http://localhost:8000/

4. Test dev mode:
   yarn dev
   - Verify hot reload works

Fix any broken imports or paths before proceeding.
```

**DoD**
- [ ] `yarn build` produces working output
- [ ] Server serves web UI correctly
- [ ] Dev mode works with hot reload
- [ ] No import/path errors

---

# Phase 2 — Fix CI References + Add PR Quality Gate

**Objective:** Now that new paths exist, update CI to reference them and add PR workflow.

### 2.1 Fix CI Workflow References

**Agent Prompt**
```
Fix all incorrect references in CI workflows:

1. Update .github/workflows/ci.yml:
   - Lines 8, 14: Change 'master' to 'main'
   - Lines 66, 167, 249, 333: Change PRODUCT_NAME from 'CNCjs' to 'AxioCNC'
   - Lines 93-94, 99-100, etc.: Change --owner=cncjs --repo=cncjs to --owner=rsteckler --repo=AxioCNC
   - Update build commands to use new paths (yarn build instead of scripts/build-prod.sh)

2. Update .github/workflows/ci-docker-hub.yml:
   - Line 56: Change 'cncjs' directory reference to 'axiocnc'
   - Line 96: Change DOCKER_REPO from 'cncjs/cncjs' to 'ghcr.io/rsteckler/axiocnc'
   - Update Docker Hub login to GHCR login

3. Update .github/ISSUE_TEMPLATE.md:
   - Change CNCjs references to AxioCNC

4. Update .github/FUNDING.yml:
   - Change open_collective from 'cncjs' to appropriate value or remove

Verify: grep -r "cncjs\|CNCjs\|master" .github/ should return minimal/expected results.
```

**DoD**
- [ ] All workflows reference `main` branch
- [ ] All workflows reference `rsteckler/AxioCNC`
- [ ] Docker workflow uses GHCR
- [ ] No stale `cncjs` references in .github/

---

### 2.2 Add PR Quality Gate Workflow

**Agent Prompt**
```
Create .github/workflows/pr-check.yml for pull request validation:

Triggers:
- pull_request to main

Jobs:
1. lint-and-test:
   - Checkout, setup Node 18
   - yarn install
   - yarn test:lint
   - yarn test

2. build-check:
   - yarn build:web
   - yarn build:server
   - Do NOT publish or create artifacts

Requirements:
- Must complete in <10 minutes
- Block merge on failure
- No secrets required (read-only)
```

**DoD**
- [ ] PR workflow created
- [ ] Runs lint and tests
- [ ] Builds but doesn't publish
- [ ] No secrets required

---

# Phase 3 — Bundle Contract: bundle/server-runtime

**Objective:** Create single deployable artifact for deb/docker/electron.

### 3.1 Create bundle script

**Agent Prompt**
```
Create scripts/bundle-server-runtime.sh:

Purpose: Assemble everything needed to run the server into bundle/server-runtime/

Contents of bundle/server-runtime/:
├── server/           # Compiled server code
├── app/              # Built web assets  
├── node_modules/     # Production dependencies only
├── package.json      # Minimal, production-only
├── cli.js            # Entry point
└── VERSION           # Version from git tag or package.json

Script logic:
1. Clean bundle/server-runtime/
2. yarn build (builds web + server)
3. Copy apps/server/dist/ -> bundle/server-runtime/server/
4. Copy apps/web/dist/ -> bundle/server-runtime/app/
5. Copy necessary assets (i18n, views)
6. Create minimal package.json with production deps only
7. Install production deps in bundle
8. Write VERSION file
9. Test: node cli.js starts and health check passes

Also create scripts/verify-bundle.sh to validate bundle integrity.
```

**DoD**
- [ ] `scripts/bundle-server-runtime.sh` creates complete bundle
- [ ] Bundle starts with `node cli.js`
- [ ] Health check passes: `curl http://localhost:8000/api` returns 401
- [ ] Bundle is reproducible

---

### 3.2 Refactor packaging to use bundle

**Agent Prompt**
```
Update packaging to consume bundle/server-runtime/ only:

1. Move Dockerfile to packaging/docker/Dockerfile:
   - Simplify to COPY bundle/server-runtime /opt/axiocnc
   - Remove build steps (bundle is pre-built)

2. Move scripts/build-server-deb.sh to packaging/deb/build.sh:
   - Copy from bundle/server-runtime/ instead of dist/axiocnc/
   - Remove internal build steps
   - Remove version auto-bump (version comes from tag)

3. Update root package.json scripts:
   - bundle:server-runtime -> scripts/bundle-server-runtime.sh
   - package:deb -> packaging/deb/build.sh
   - package:docker -> docker build -f packaging/docker/Dockerfile

Key principle: NO packaging script should build server/web independently.
```

**DoD**
- [ ] Dockerfile uses only bundle/server-runtime/
- [ ] Deb build uses only bundle/server-runtime/
- [ ] No duplicate build logic in packaging

---

# Phase 4 — Electron Desktop Integration

**Objective:** Electron app embeds and launches the bundled server.

**Current state:** Server runs in-process via `await launchServer()`. Keep this for simplicity.

**Agent Prompt**
```
Update Electron to use the bundled server:

1. apps/desktop/src/main.js modifications:
   - Update import paths for new structure
   - Determine bundle location (in app resources when packaged, local in dev)
   - Keep in-process launchServer() pattern
   - Health check before window load

2. packaging/desktop/electron-builder.yml:
   - Configure extraResources to include bundle/server-runtime/
   - Ensure serialport native modules are rebuilt for electron

3. Test:
   - yarn bundle:server-runtime
   - yarn start:desktop (development)
   - yarn package:desktop (creates installer)
```

**DoD**
- [ ] Desktop app starts embedded server
- [ ] UI loads after server ready
- [ ] Clean exit stops server
- [ ] Packaged app runs standalone

---

# Phase 5 — Version Management

**Objective:** Single version source used everywhere.

**Decision needed:** Unified version - recommend `2.0.0` (major modernization).

**Agent Prompt**
```
Implement unified version management:

1. Create scripts/get-version.sh:
   - If GITHUB_REF_TYPE=tag: extract from tag (v2.0.0 -> 2.0.0)
   - Else: read from root package.json + "-dev"

2. Sync all package.json versions to chosen version

3. Update build scripts to use get-version:
   - bundle-server-runtime.sh: write VERSION file
   - packaging/deb/build.sh: use in DEBIAN/control
   - packaging/docker/Dockerfile: use in OCI labels

4. Remove version auto-bump from build-server-deb.sh

5. Document in docs/releasing.md
```

**DoD**
- [ ] All artifacts show same version
- [ ] Version comes from tag in CI
- [ ] No auto-version-bump

---

# Phase 6 — Release Workflow

**Agent Prompt**
```
Create .github/workflows/release.yml triggered on tag v*:

Jobs:
1. build-bundle: yarn build && yarn bundle:server-runtime
2. build-deb: packaging/deb/build.sh (multi-arch)
3. build-docker: push to GHCR with :vX.Y.Z and :latest
4. build-desktop: matrix [linux, macos, windows]
5. create-release: GitHub Release with all artifacts

Also create .github/workflows/edge.yml:
- On push to main (not PRs)
- Build and push Docker :edge to GHCR
```

**DoD**
- [ ] Tag triggers release workflow
- [ ] All artifacts attached to release
- [ ] Docker pushed to GHCR
- [ ] Edge builds on main push

---

# Phase 7 — Security Baseline

**Agent Prompt**
```
Add security workflows:

1. .github/workflows/codeql.yml - CodeQL analysis
2. .github/workflows/dependency-review.yml - Block vulnerable deps
3. .github/CODEOWNERS - Protect critical paths
4. Update Dockerfile with OCI labels
```

**DoD**
- [ ] CodeQL enabled
- [ ] Dependency review on PRs
- [ ] CODEOWNERS protects critical code

---

# Phase 8 — Cleanup

**Agent Prompt**
```
Final cleanup:

1. Remove legacy paths:
   - Delete empty src/ folders
   - Remove old scripts that are replaced

2. Update documentation:
   - README.md with new structure
   - aidocs/overview.md
   - .cursorrules protected paths

3. Verify clean build:
   git clean -fdx && yarn install && yarn build
```

**DoD**
- [ ] No legacy src/ folder
- [ ] Clean clone builds successfully
- [ ] All docs updated

---

## Success Criteria (Global)

- [ ] One bundle feeds all releases
- [ ] Tag = single version truth
- [ ] PRs never publish
- [ ] Docker & deb identical runtime
- [ ] Desktop embeds same runtime
- [ ] CI fully GitHub-native
