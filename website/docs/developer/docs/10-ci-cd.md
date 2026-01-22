---
id: 10-ci-cd
sidebar_position: 10
title: CI/CD and Automation
---

# CI/CD and Automation

What runs where, required checks, and secrets management.

## CI Pipeline Overview

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| **packages** | Push to `main`, PRs, `workflow_dispatch` | Build and package desktop + server |
| **release** | Push to `v*` tags | Build, package, and publish GitHub Release |
| **website** | Push to `main` (typically) | Build and deploy docs site |

**Location:** `.github/workflows/`

### What Runs Where

**On push to `main` or PR:**
- **packages** workflow:
  - **desktop** — Build + package Electron app (Linux, Windows, macOS x64, macOS arm64)
  - **server-deb** — Build + package server .deb (amd64, arm64, armhf)
  - **release** (only on tags) — Download artifacts, create GitHub Release

**On push to `v*` tag:**
- **release** workflow:
  - Same desktop + server-deb matrix as packages
  - **publish** job — Create GitHub Release, attach all artifacts

**Website:**
- **website** workflow (`Deploy Website`) — Triggers on push to `main` when `website/**` or `.github/workflows/website.yml` change; also `workflow_dispatch`. Builds user docs (Docusaurus) and dev docs (Docusaurus), copies output to `_site/docs` and `_site/devdocs`, then deploys `_site` to GitHub Pages.

## Required Checks

**Before merge, PRs typically need:**
- **packages** — All matrix jobs passing (desktop + server-deb)
- **Lint** — Run locally via `yarn test:lint`; CI may run it too if configured

**Release workflow:** No separate "required checks" for tag push — it runs automatically. Failures in desktop or server-deb will prevent the publish job from running.

## Caching / Build Artifacts

**Node:**
- **setup-node** uses `cache: 'yarn'` for Yarn cache
- Reduces install time across jobs

**Build artifacts:**
- Desktop and server jobs produce artifacts (installers, .deb files)
- **release** workflow downloads these via `download-artifact` and attaches them to the GitHub Release
- No long-term caching of build outputs beyond the release artifacts

## Secrets Management

**GitHub Actions secrets:** Used for deployment and publishing. Never commit secrets.

**Typical uses:**
- **Tokens** — e.g. GitHub token for creating releases (usually provided by `GITHUB_TOKEN`)
- **Deploy keys** — If deploying elsewhere (e.g. external hosting)
- **Signing keys** — If code signing is added for desktop apps

**Repository:** Secrets are stored in **Settings → Secrets and variables → Actions**. Only maintainers should add or rotate them.

**Local development:** No CI secrets on your machine. Use `~/.axiocnc/config.json` and env vars for local config.

## Next Steps

- **[Release Process](./09-release-process.md)** — How releases are cut and published
- **[Troubleshooting](./11-troubleshooting.md)** — Common CI failures and fixes
