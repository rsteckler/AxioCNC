---
name: desktop-packaging
overview: Create a simple, cross-platform build+package pipeline that cleanly separates web/server builds from Electron packaging, avoiding Yarn focus and minimizing workspace manipulation, with a verifiable Linux `.deb` output.
todos:
  - id: verify-build-outputs
    content: Inspect web/server/desktop build outputs + yarn linker
    status: pending
  - id: define-staging-layout
    content: Decide staging folder layout and copy list
    status: pending
  - id: node-packaging-script
    content: Implement cross-platform staging/validation script
    status: pending
  - id: electron-builder-config
    content: Point electron-builder at staging layout
    status: pending
  - id: ci-workflow
    content: Simplify GH Actions to build + package per OS
    status: pending
  - id: deb-verify
    content: Add dpkg extraction check on Linux
    status: pending
---

# Desktop Packaging Plan

## Current State to Verify

- Read current build/electron configs to align output paths and expectations:
- Electron app entry and builder config in [`/home/cryptyk/code/AxioCNC/apps/desktop/package.json`](/home/cryptyk/code/AxioCNC/apps/desktop/package.json) and any config files it references.
- Web build output location in [`/home/cryptyk/code/AxioCNC/apps/web`](/home/cryptyk/code/AxioCNC/apps/web) (e.g., `vite.config.*` or build scripts).
- Server build output location and runtime asset needs in [`/home/cryptyk/code/AxioCNC/apps/server`](/home/cryptyk/code/AxioCNC/apps/server) (dist, views, i18n).
- Yarn linker mode and workspace behavior in [`/home/cryptyk/code/AxioCNC/.yarnrc.yml`](/home/cryptyk/code/AxioCNC/.yarnrc.yml).
- Capture what the “old” flow assumed (from `developers/scripts/old/*`) and identify the minimal subset we still need (e.g., copying runtime assets, prod-only deps).

## Proposed Architecture (Simple & Robust)

- **Separate build vs. package:**
- Build step produces **only** `apps/web` and `apps/server` outputs in their own `dist` folders.
- Packaging step creates a **staging directory** for Electron (e.g., `dist/desktop-app/`) and copies in:
 - Web build output (SPA assets)
 - Server dist + runtime assets (views/i18n/static)
 - Electron app files from `apps/desktop`
- **Use Node scripts for portability:** replace bash-heavy scripts with a short Node script (e.g., `developers/scripts/desktop/prepare-desktop-app.js`) to assemble the staging folder. This avoids platform-specific copy/rsync issues on Windows/macOS.
- **Avoid Yarn focus:** rely on a single `yarn install --immutable` at repo root and use `electron-builder` to include runtime dependencies based on the Electron app `package.json` (or a generated minimal package.json in the staging folder if needed).

## Concrete Steps

1. **Define the expected staging layout** (based on electron main’s runtime assumptions), e.g.:

- `dist/desktop-app/app/` (Electron app code)
- `dist/desktop-app/server/` (server dist + assets)
- `dist/desktop-app/web/` (web dist)

2. **Add a packaging script (Node)** to:

- Clean `dist/desktop-app`
- Copy outputs from `apps/web/dist` and `apps/server/dist`
- Copy any runtime assets required by the server (views, i18n, static, etc.)
- Copy Electron app files and/or produce a minimal runtime `package.json`

3. **Update Electron builder config** to point at the staging folder (either via `build.files`/`extraResources` or by setting `directories.app` to the staging folder).
4. **Create task scripts** in root `package.json` that reflect the separation:

- `build:web`, `build:server`, `build:desktop` (builds only)
- `package:desktop` (assemble staging + run electron-builder)

5. **GitHub Actions pipeline**

- Use a matrix for `linux`, `windows`, `macos` and run the same build/package commands.
- Prefer `node`-based packaging script; avoid bash-specific shells on Windows.
- Keep artifacts in `output/` (electron-builder default) and add a `deb` artifact on Linux.

6. **Validation (exit criteria)**

- On Linux runner, run `dpkg-deb -x output/*.deb /tmp/axiocnc` and verify:
 - web assets present
 - server dist + assets present
 - electron app main entry and dependencies present

## Gotchas & Tests to De-risk

- If Yarn uses PnP, `electron-builder` may need `nodeLinker: node-modules` or a staging package.json with bundled deps. Verify this from `.yarnrc.yml` before deciding.
- Validate server runtime path assumptions (e.g., `process.cwd()` or `__dirname`) so assets are referenced correctly in the packaged layout.
- Use a tiny “smoke script” to validate layout correctness (`node developers/scripts/desktop/validate-layout.js`) before invoking `electron-builder`.

## Notes on Windows Shell Availability

- GitHub Actions Windows runners include `bash` via Git for Windows, but to keep the workflow robust and simple, prefer Node scripts and `run` commands that work in `pwsh` as well.

## Files Likely to Change

- [`/home/cryptyk/code/AxioCNC/apps/desktop/package.json`](/home/cryptyk/code/AxioCNC/apps/desktop/package.json)
- [`/home/cryptyk/code/AxioCNC/package.json`](/home/cryptyk/code/AxioCNC/package.json)
- New packaging script(s) under [`/home/cryptyk/code/AxioCNC/developers/scripts/desktop/`](/home/cryptyk/code/AxioCNC/developers/scripts/desktop/)
- Workflow updates under [`/home/cryptyk/code/AxioCNC/.github/workflows/`](/home/cryptyk/code/AxioCNC/.github/workflows/)
