---
id: 09-release-process
sidebar_position: 9
title: Release Process
---

# Release Process

For **maintainers**: how we version, cut releases, and publish artifacts.

## Versioning Scheme

**SemVer:** `MAJOR.MINOR.PATCH` (e.g. `1.10.112`)

- **MAJOR** — Breaking changes (API, config, behavior)
- **MINOR** — New features, backwards-compatible
- **PATCH** — Bug fixes, backwards-compatible

**Pre-releases:** Use hyphen, e.g. `1.11.0-alpha.1`, `1.11.0-beta.2`. CI marks these as prerelease on GitHub Releases.

## How to Cut a Release

### 1. Tagging

```bash
# Create tag, update version in package.json
pnpm release:tag

# Push tag to remote (triggers release workflow)
pnpm release:tag:push
```

**Tag format:** `v` + SemVer (e.g. `v1.10.113`).

### 2. Building Artifacts (CI)

On push to a `v*` tag, the **release** workflow runs (see [CI/CD](./10-ci-cd.md)):

- **Desktop:** Linux (amd64), Windows (x64), macOS (x64, arm64)
- **Server:** Debian packages (amd64, arm64, armhf)

**Steps (CI):**
1. Checkout code
2. Extract version from tag
3. (Optional) Run `update-version.js` to stamp version
4. `pnpm install --frozen-lockfile`
5. `pnpm build:all`
6. Package desktop app (per platform)
7. Package server .deb (per arch)
8. Upload artifacts

### 3. Publishing (CI)

After desktop and server-deb jobs succeed:

- **Publish job** downloads all artifacts and creates a **GitHub Release**
- Release name: `Release <version>`
- Release body lists platforms (Desktop + Server)
- All built artifacts are attached to the release
- Prerelease versions (`*-*`) are marked as prerelease

**No manual publish step** — tagging and pushing triggers the full pipeline.

## Hotfix Process (Rare)

For critical fixes on a released version:

1. **Branch from `main`**
2. **Apply minimal fix** — Only the hotfix, no other changes
3. **Test** — Run full test suite and sanity-check locally
4. **Tag** — Bump PATCH (e.g. `1.10.112` → `1.10.113`), tag, push
5. **Merge back to `main`** — Ensure the fix is in `main` so future releases include it

**Use sparingly.** Prefer normal PR → `main` → release when possible.

## Next Steps

- **[CI/CD](./10-ci-cd.md)** — Pipeline details, required checks, caching
- **[Contributing](./08-contributing.md)** — PR process for non-maintainers
