---
id: 12-reference
sidebar_position: 12
title: Reference
---

# Reference

Pointers to API, config, CLI, and license info.

## API Reference

:::caution Placeholder
**Placeholder:** OpenAPI/Swagger spec not yet published. For now:
- **REST API:** See `website/docs/developer/docs.old/reference/api.md` (or existing API docs in repo) for endpoint overview.
- **Implementation:** `apps/server/src/api/` — one module per logical API area (e.g. `api.settings.js`, `api.machines.js`).
:::

**Base URL (dev):** `http://localhost:8000`

**Auth:** JWT. Obtain token via login flow; send as `Authorization: Bearer <token>` or equivalent.

## Plugin / Extension API

:::caution Placeholder
**Placeholder:** Plugin/extension API not defined. The codebase does not currently expose a formal plugin system. Customization is via config, themes, and forks.
:::

## Configuration Reference

### Config File: `~/.axiocnc/config.json`

**Location:** User home, `.axiocnc/config.json`

**Override:** `axiocnc --config /path/to/config.json`

**Structure:** Key settings include:
- **rcfile** — Path to this config (default `~/.axiocnc/config.json`)
- **secret** — Session/JWT secret (do not commit)
- **middleware.session** — Session config (e.g. `path`: `~/.axiocnc/sessions`)
- **machines** — Machine/connection configs (port, baud, controller type, etc.)
- **general** — App-wide options

**Defaults:** See `apps/server/assets/config/.cncrc.default` and `apps/server/src/config/settings.base.js`.

:::caution Placeholder
**Placeholder:** Full config schema and all keys should be documented in a dedicated config reference (or derived from `.cncrc.default` + `settings.base.js`).
:::

## CLI Reference

### Main Entry

**Binary:** `apps/server/bin/axiocnc` (or `axiocnc` when installed)

**Common options:**
- `-c, --config <path>` — Config file (default `~/.axiocnc/config.json`)
- `-p, --port <port>` — HTTP port (default often `8000`)
- `-m, --mount <path>:<url>` — Mount widget/app (e.g. `/widget:https://...`)

**Example:**
```bash
axiocnc --port 8000 --config ~/.axiocnc/config.json
```

**Help:**
```bash
axiocnc --help
```

### pnpm Commands (Development)

| Command | Purpose |
|--------|---------|
| `pnpm dev:start-server` | Start backend dev server |
| `pnpm dev:start-app` | Start frontend dev server |
| `pnpm dev:start-electron` | Start Electron app |
| `pnpm dev:grblsim:setup` | One-time GRBL sim setup |
| `pnpm dev:grblsim:run` | Run GRBL simulator |
| `pnpm test:test` | Run server tests |
| `pnpm test:coverage` | Run tests with coverage |
| `pnpm test:lint` | Run all lint checks |
| `pnpm test:typecheck` | TypeScript check (frontend) |
| `pnpm build:all` | Build all apps |
| `pnpm build:server` | Build server |
| `pnpm build:web` | Build web app |
| `pnpm release:tag` | Create release tag |
| `pnpm release:tag:push` | Push release tag |

See [Day-1 Workflow](./03-day-1-workflow.md#pnpm-commands-cheat-sheet) for more.

## License and Contributor Policy

**License:** MIT — see [LICENSE](https://github.com/rsteckler/AxioCNC/blob/main/LICENSE) in the repo.

**Contributions:** By submitting a PR, you agree that your contributions are under the same license. There is no CLA; standard GitHub terms apply.

**Copyright:** See LICENSE file. Includes "Copyright (c) 2015–2017 Cheton Wu (cncjs foundation)" and "Copyright (c) 2024 AxioCNC Contributors".

## Next Steps

- **[Architecture](./04-architecture.md)** — System design and data flow
- **[Making Changes Safely](./07-making-changes-safely.md)** — Security and protected code
