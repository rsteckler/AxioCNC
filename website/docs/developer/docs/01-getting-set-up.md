---
id: 01-getting-set-up
sidebar_position: 1
title: Getting Set Up
---

# Getting Set Up

Fast path to running AxioCNC locally for development.

## Prerequisites

### Runtime Versions

- **Node.js:** 18 or higher ([download](https://nodejs.org/en/download/))
- **pnpm:** Install with `npm install -g pnpm`
- **Git:** For version control

## Fast Path: Run Locally

### 1. Clone and Install

```bash
git clone https://github.com/rsteckler/AxioCNC.git
cd AxioCNC
pnpm install
```

This installs dependencies for all workspaces: `apps/web`, `apps/server`, `apps/desktop`, `apps/shared`.

### 2. Start Development Servers

**Terminal 1 - Backend:**
```bash
pnpm dev:start-server
```

Server runs on `http://localhost:8000` with hot reload via nodemon.

**Terminal 2 - Frontend:**
```bash
pnpm dev:start-app
```

Frontend runs on `http://localhost:5173` with Vite HMR.

### 3. Verify Setup

Open `http://localhost:5173` in your browser. You should see the AxioCNC interface.

## Deep Path: Common Issues

### Serial Port Permission Denied

**Error:** `Error: EACCES: permission denied, open '/dev/ttyUSB0'`

**Solution:**
```bash
sudo usermod -a -G dialout $USER
# Log out and back in (or reboot)
```

Verify:
```bash
groups $USER  # Should show "dialout"
ls -l /dev/ttyUSB* /dev/ttyACM*  # Check available ports
```

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::8000`

**Solution:**
```bash
# Linux/macOS
lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Build Fails on First Run

**Error:** Various compilation errors

**Solution:**
```bash
rm -rf node_modules apps/*/node_modules
pnpm install
```

### Configuration

The server reads configuration from `~/.axiocnc/config.json` (created on first run). No environment variables required for basic development.

## Development Without Hardware

Use the GRBL simulator for testing without a physical CNC machine:

```bash
# One-time setup
pnpm dev:grblsim:setup

# Run simulator
pnpm dev:grblsim:run
```

The simulator creates a virtual serial port (`/dev/ttyFAKE` on Linux) that you can connect to in the AxioCNC interface.

**Adjusting Simulator Settings:**

After connecting to the simulator, you can configure it for faster development:

1. **Enable homing:** Go to the Console tab and type `$22=1` to enable homing (`$H` command)
2. **Increase movement speeds:** Set axis speeds for faster testing:
   - `$110=10000` (X-axis max rate, mm/min)
   - `$111=10000` (Y-axis max rate, mm/min)
   - `$112=10000` (Z-axis max rate, mm/min)

Setting speeds to 10000 mm/min is a good starting point for faster development cycles.

See [Day-1 Workflow](./03-day-1-workflow.md#debugging) for more debugging tips.

## Next Steps

- **[Repository Map](./02-repository-map.md)** - Understand the codebase structure
- **[Day-1 Workflow](./03-day-1-workflow.md)** - Learn the development loop
