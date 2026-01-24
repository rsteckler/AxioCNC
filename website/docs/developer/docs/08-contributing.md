---
id: 08-contributing
sidebar_position: 8
title: Contributing
---

# Contributing

How to pick up work, create PRs, and meet code review expectations.

## How to Pick Up Work

1. **Browse [Issues](https://github.com/rsteckler/AxioCNC/issues)** — Find bugs or features labeled for contribution
2. **Comment on the issue** — Say you're working on it to avoid duplicate effort
3. **Create a branch** — Branch from `main`
4. **Implement** — Follow [Code Standards](./05-code-standards.md) and [Day-1 Workflow](./03-day-1-workflow.md)
5. **Open a PR** — Link to the issue, follow the [PR checklist](#pr-checklist)

## "Good First Issue" Guidance

**Look for:**
- Issues labeled `good first issue` or `help wanted`
- Documentation improvements
- Frontend UI tweaks (non–safety-critical)
- API endpoint additions (following existing patterns)
- Test coverage improvements (especially [non-protected](./07-making-changes-safely.md#safe-boundaries-ok-to-modify) areas)

**Avoid for first PRs:**
- Protected code (controllers, Sender, Feeder, etc.)
- G-code streaming or serial communication logic
- Authentication/security changes

## Design Discussions / RFCs

For significant design changes:
1. Open a [Discussion](https://github.com/rsteckler/AxioCNC/discussions)
2. Describe the problem and proposed solution
3. Get feedback before implementing
4. Reference the discussion in your PR

## Branching & Commit Conventions

### Branch Strategy

- **`main`** — Stable, release-ready code
- **Feature branches** — Branch from `main`, e.g. `feat/settings-api`, `fix/joystick-calibration`
- **No long-lived dev branches** — Keep branches short-lived, merge to `main` via PR

### Commit Message Format

**Use [Conventional Commits](https://www.conventionalcommits.org/):**

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
| Type | Use For |
|------|---------|
| `feat` | New features |
| `fix` | Bug fixes |
| `refactor` | Code restructuring (no behavior change) |
| `style` | Formatting, whitespace, CSS |
| `docs` | Documentation only |
| `chore` | Build, config, dependencies |
| `test` | Adding or updating tests |

**Scopes:** `frontend`, `backend`, `api`, `settings`, `ui`, `schema`, `docs`, etc.

**Examples:**
```
feat(api): add validated /api/settings endpoint with Zod schema
fix(frontend): correct prop name in AppearanceSection
refactor(settings): migrate from state API to settings/extensions split
docs(api): update API.md with new settings and extensions endpoints
chore(deps): add zod to frontend and backend packages
```

### When to Squash / Rebase

- **Squash:** Optional for PRs with many small commits (e.g. "fix typo", "lint") — maintainers may squash on merge
- **Rebase:** Rebase your branch on `main` before opening PR and when addressing review feedback to keep history linear
- **Don't rebase** shared branches or after PR review has started (unless agreed)

## PR Checklist

Before submitting your PR, ensure:

- [ ] **Tests updated** — New code has tests; existing tests pass (`pnpm test:test`)
- [ ] **Lint passes** — `pnpm test:lint` and `pnpm test:typecheck` (if applicable)
- [ ] **Docs updated** — Dev docs and/or user docs if behavior or setup changes
- [ ] **Changelog entry added** — Add a bullet under "Unreleased" in `CHANGELOG.md`

## Submitting the PR

1. **Push your branch** to your fork
2. **Open a PR** against `rsteckler/AxioCNC` `main`
3. **Fill out the template** (if present) — link issue, describe changes, note testing
4. **Trigger CI** — Ensure required checks run and pass
5. **Address review feedback** — Update branch (rebase or new commits as preferred by maintainers)

## Code Review Expectations

### What Maintainers Look For

- **Correctness** — Does it do what it claims? Edge cases handled?
- **Safety** — No regressions in G-code sending, serial handling, or protected code (unless explicitly approved)
- **Tests** — Adequate coverage for new/changed behavior
- **Style** — Matches [Code Standards](./05-code-standards.md), consistent with existing code
- **Docs** — User/dev docs updated if needed
- **Simplicity** — Minimal change set; no unnecessary refactors or deps

### Response Time

- Maintainers review when they can; no guaranteed SLA
- Ping gently if there's no response after a week (e.g. "Friendly bump when you have time")

## Next Steps

- **[Release Process](./09-release-process.md)** — How maintainers cut releases
- **[CI/CD](./10-ci-cd.md)** — What runs on PRs and tags
