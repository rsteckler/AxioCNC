# Development Setup

This guide covers setting up a local development environment for AxioCNC.

## Prerequisites

- **Node.js 18+** - Required for both frontend and backend
- **Yarn** - Package manager (install via `npm install -g yarn`)
- **Git** - Version control

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/rsteckler/AxioCNC.git
cd AxioCNC
```

### 2. Install Dependencies

```bash
yarn install
```

This installs dependencies for:
- Root package (scripts, electron)
- Backend server (`src/server/`)
- Frontend app (`src/app/`)

## Running Development Servers

AxioCNC requires **two separate processes** to run in development:

### Terminal 1: Backend Server

```bash
yarn dev:start-server
```

The backend server will start on `http://localhost:8000` and serve:
- REST API endpoints (`/api/*`)
- Socket.IO connections (`/socket.io`)
- Static frontend files (after build)

### Terminal 2: Frontend Development Server

```bash
cd src/app
npm run dev
```

The frontend dev server (Vite) will start on `http://localhost:5173` and:
- Hot reload on file changes
- Proxy API/Socket.IO requests to backend on port 8000
- Provide fast HMR (Hot Module Replacement)

### Accessing the Application

Open `http://localhost:5173` in your browser. The Vite dev server will:
- Serve the frontend with hot reload
- Proxy `/api` and `/socket.io` requests to `http://localhost:8000`

## Building for Production

### Development Build

Creates an unminified build for testing:

```bash
cd src/app
npm run build:dev
```

Output: `output/cncjs/app/`

### Production Build

Creates an optimized production build:

```bash
cd src/app
npm run build
```

Output: `dist/cncjs/app/`

### Full Application Build

Builds both backend and frontend:

```bash
yarn build-prod
```

This creates `dist/axiocnc/` with:
- Compiled server code
- Production frontend build
- Electron main process
- Dependencies

## Building Desktop Apps (Electron)

After building the application (`yarn build-prod`), create platform-specific installers:

### Linux (x64)
```bash
yarn build:linux-x64
```

### Raspberry Pi (ARM32)
```bash
yarn build:linux-armv7l
```

### Raspberry Pi 5 (ARM64)
```bash
yarn build:linux-arm64
```

### Windows (x64)
```bash
yarn build:windows-x64
```

### macOS (x64)
```bash
yarn build:macos-x64
```

### macOS (ARM64)
```bash
yarn build:macos-arm64
```

Outputs are created in `output/` directory.

For more details, see [Deployment Guide](deployment.md).

## Project Structure

```
AxioCNC/
├── src/
│   ├── app/              # Modern React frontend (TypeScript, Vite)
│   │   └── src/
│   │       ├── components/  # UI components
│   │       ├── routes/      # Page components
│   │       ├── services/    # API & Socket.IO
│   │       └── store/       # Redux store
│   ├── app-legacy/       # Original frontend (reference only)
│   └── server/           # Express backend (Node.js)
│       ├── api/          # REST API endpoints
│       ├── controllers/  # CNC controller implementations
│       └── services/     # Backend services
├── devdocs/              # Developer documentation
├── docs/                 # User-facing documentation
├── aidocs/               # Agent/code documentation
└── website/              # Marketing website
```

## Development Workflow

1. **Start backend** (`yarn dev:start-server`)
2. **Start frontend** (`cd src/app && npm run dev`)
3. **Make changes** - Both servers auto-reload on file changes
4. **Test** - Open `http://localhost:5173` in browser
5. **See [Contributing Guide](contributing.md)** for git workflow and PR process

## Code Style

- **Frontend**: TypeScript, React 18, Tailwind CSS
- **Backend**: JavaScript (ES6+), Express
- **Linting**: ESLint (see `.eslintrc`)
- **Formatting**: Follow existing patterns in codebase

For detailed coding guidelines, see:
- [Development Preferences](../aidocs/dev_prefs.md) - UI patterns and architectural decisions
- [Protected Code](protected-code.md) - Safety-critical code boundaries

## Troubleshooting

### Port Already in Use

If port 8000 or 5173 is already in use:

```bash
# Backend: Use different port (edit nodemon.server.json or set PORT env var)
yarn dev:start-server

# Frontend: Edit vite.config.ts to change dev server port
```

### Native Module Build Failures

If `serialport` or other native modules fail to build:

```bash
# Install build tools
sudo apt-get install build-essential python3  # Linux
# or
xcode-select --install  # macOS

# Rebuild native modules
npm rebuild
```

### Frontend Not Connecting to Backend

Check that:
1. Backend is running on port 8000
2. Frontend dev server is running on port 5173
3. Vite proxy is configured correctly (check `src/app/vite.config.ts`)

## Additional Resources

- [Contributing Guide](contributing.md) - Git workflow and PR process
- [Testing Guide](testing.md) - How to write and run tests
- [API Documentation](api.md) - REST API reference
- [Protected Code](protected-code.md) - Safety-critical code guidelines
- [Deployment Guide](deployment.md) - Building and deploying installers
