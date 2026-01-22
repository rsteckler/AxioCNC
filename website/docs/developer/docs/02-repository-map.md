---
id: 02-repository-map
sidebar_position: 2
title: Repository Map
---

# Repository Map

Where everything lives in the AxioCNC monorepo.

## Top-Level Structure

```
AxioCNC/
├── apps/                    # Application source code
│   ├── web/                 # React SPA frontend (TypeScript + Vite)
│   ├── server/              # Express + Socket.IO backend
│   └── desktop/             # Electron desktop app
├── packages/                # Shared code
│   └── shared/             # Common schemas and validation (Zod)
├── developers/              # Development tools
│   ├── scripts/            # Build, packaging, deployment scripts
│   └── examples/           # G-code examples and test fixtures
├── website/                 # Documentation
│   ├── docs/               # Docusaurus sites (user + developer docs)
│   └── static/             # Static website assets
├── .github/workflows/       # CI/CD pipeline definitions
├── dist/                    # Build outputs (gitignored)
└── out/                     # Package artifacts (gitignored)
```

## Applications

### `apps/web/` - Frontend

**Tech:** React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Redux Toolkit

**Key directories:**
- `src/routes/` - Page components
- `src/components/` - Reusable UI components
- `src/services/` - API client (RTK Query) and Socket.IO
- `src/store/` - Redux store configuration
- `public/` - Static assets

**Build output:** `apps/web/dist/`

### `apps/server/` - Backend

**Tech:** Node.js, Express, Socket.IO, Winston

**Key directories:**
- `src/api/` - REST API endpoints
- `src/controllers/` - CNC controller implementations (Grbl, Marlin, etc.) ⚠️ **PROTECTED**
- `src/lib/` - Core libraries (Sender, Feeder, Workflow, etc.) ⚠️ **PROTECTED**
- `src/services/` - High-level services (CNCEngine, ConfigStore, etc.)
- `src/config/` - Configuration defaults
- `test/` - Test files (tap framework)
- `assets/` - Static assets served by Express

**Build output:** `apps/server/dist/`

### `apps/desktop/` - Electron App

**Tech:** Electron, bundles server + web frontend

**Key directories:**
- `src/` - Electron main process code
- `build-resources/` - Icons, installers, platform-specific assets

**Build output:** `apps/desktop/dist/`

## Shared Packages

### `packages/shared/` - Common Code

**Tech:** Zod schemas, TypeScript types

**Key directories:**
- `src/schemas/` - Validation schemas (settings, etc.)
- `src/types/` - TypeScript type definitions

Used by both frontend and backend for type safety and validation.

## Development Tools

### `developers/scripts/`

Build, packaging, and deployment automation:
- `grblsim/` - GRBL simulator setup scripts
- `desktop/` - Electron packaging scripts
- `package-server-deb.sh` - Debian package creation
- `update-version.js` - Version number management

## Runtime Data

**Location:** `~/.axiocnc/` (user home directory)

**Contents:**
- `config.json` - Server configuration
- `sessions/` - Express session files
- `logs/` - Winston log files (if file logging enabled)
- `mediamtx/` - MediaMTX configuration and logs
- `jobhistory.json` - Job execution history
- `themes/` - Custom theme files

## Supported Platforms

### Operating Systems
- **Linux:** x64, ARM64 (Raspberry Pi 5), ARMv7 (Raspberry Pi 3/4)
- **Windows:** x64
- **macOS:** x64, ARM64 (Apple Silicon)

### CPU Architectures
- **amd64/x64:** Desktop Linux, Windows, macOS Intel
- **arm64:** Raspberry Pi 5, macOS Apple Silicon
- **armv7l/armhf:** Raspberry Pi 3/4

### Constraints
- **Raspberry Pi 3:** Minimum recommended for headless server
- **Node.js 18+:** Required runtime
- **Serial port access:** Required for CNC communication (Linux: dialout group)

## Build Outputs

All build artifacts go to:
- `dist/` - Compiled source code
- `out/` - Packaged installers and archives
- `build/` - Temporary build files (dev mode)

These directories are gitignored. Don't commit build outputs.

## Next Steps

- **[Day-1 Workflow](./03-day-1-workflow.md)** - Learn the development loop
- **[Architecture](./04-architecture.md)** - Understand system design
