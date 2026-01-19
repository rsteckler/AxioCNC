# Getting Started

## What you'll learn

- Clone the AxioCNC repository and install dependencies
- Start the development servers for frontend and backend
- Configure serial port access for CNC development
- Set up debugging tools and verify your environment
- Resolve common setup issues

## When to read this

Read this when you want to contribute code changes to AxioCNC. This guide gets you from zero to running the application with debugging capabilities in one sitting.

## Prerequisites

- **[Node.js 18 or higher](https://nodejs.org/en/download/)** - Required for both frontend and backend development
- **Yarn package manager** - Install with `npm install -g yarn`
- **Git** - For version control

## Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/rsteckler/AxioCNC.git
   cd AxioCNC
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

   This installs packages for the monorepo workspaces: `apps/web`, `apps/server`, `apps/desktop`, and `packages/shared`.

3. **Start the backend server**

   ```bash
   yarn dev:start-server
   ```

   The server starts on `http://localhost:8000` and provides REST APIs and Socket.IO connections.

4. **Start the frontend development server**

   Open a new terminal and run:

   ```bash
   yarn dev:start-app
   ```

   The frontend starts on `http://localhost:5173` with hot reload enabled.

5. **Verify the setup**

   Open `http://localhost:5173` in your browser. You should see the AxioCNC interface load.

<details>
<summary><strong>Running Electron Desktop App (Advanced)</strong></summary>

The Electron desktop app bundles the server and web frontend into a native desktop application. This is useful for testing the production-like environment or developing desktop-specific features.

### Prerequisites

When developing with Electron on Linux, you may need to install system libraries that Electron depends on. If you encounter errors like:

```
error while loading shared libraries: libatk-1.0.so.0: cannot open shared object file
```

Install the required dependencies:

**For Ubuntu/Debian:**
```bash
sudo apt-get install -y \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libgtk-3-0 \
  libgbm1 \
  libasound2
```

**For Fedora/RHEL:**
```bash
sudo dnf install -y \
  atk \
  at-spi2-atk \
  cups-libs \
  libdrm \
  gtk3 \
  libgbm \
  alsa-lib
```

These libraries are required for Electron to run on Linux systems. They are typically included in desktop Linux distributions but may be missing on minimal server installations or WSL environments.

### Running Electron in Development Mode

To run the Electron app in development mode:

```bash
yarn dev:start-electron
```

This command will:
- Build Electron dev artifacts (main process, server, shared modules)
- Start Electron in development mode
- Watch for changes and automatically rebuild/restart when you modify:
  - `apps/desktop/src/**/*` (Electron main process)
  - `apps/server/src/**/*` (Server code)
  - `packages/shared/src/**/*` (Shared modules)

The Electron app will launch the server in-process (mirroring production behavior) and open a BrowserWindow pointing to the server URL. The server runs on a random port when launched from Electron.

**Note:** The Electron dev mode uses the built frontend from `output/axiocnc/app/`, not the Vite dev server. If you need to test frontend changes in Electron, you'll need to rebuild the frontend or use the production build process.

</details>

## Debugging Setup

### View Application Logs

Backend logs appear in the terminal running `yarn dev:start-server`. Look for:

- Serial connection status messages
- API request/response logs
- Error stack traces

Frontend logs appear in the browser developer console (F12).

### Debugging without connecting to a physical CNC machine

Set up and run the GRBL simulator for development testing:

```bash
yarn dev:grblsim:setup
yarn dev:grblsim:run
```

The setup command clones and builds the simulator, and enables fakeTTY mode in your configuration. The run command starts the simulator, which runs in the background and provides a virtual serial port for testing.

## Common First Errors

### Serial Port Permission Denied

**Error:** `Error: EACCES: permission denied, open '/dev/ttyUSB0'`

**Solution:** Add your user to the dialout group, then logout and log back in:

```bash
sudo usermod -a -G dialout $USER
```

After running this command, log out of your session and log back in for the changes to take effect.

### Port Already in Use

**Error:** `Error: listen EADDRINUSE: address already in use :::8000`

**Solution:** Kill the process using port 8000:

```bash
# Find process using port 8000
lsof -ti:8000 | xargs kill -9

# Or on Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Build Fails on First Run

**Error:** Various webpack or TypeScript compilation errors

**Solution:** Clear node_modules and reinstall:

```bash
rm -rf node_modules apps/*/node_modules
yarn install
```

### FakeTTY Not Appearing in Port List

**Problem:** After running the GRBL simulator setup, fakeTTY doesn't appear in the machine settings port dropdown.

**Solution:** Manually add fakeTTY to your configuration file:

```bash
yarn dev:grblsim:enable
```

This adds fakeTTY to `~/.axiocnc/config.json`. Restart the server after running this command.

### GRBL Simulator Won't Start

**Error:** Simulator exits immediately or shows build errors

**Solution:** Clean and rebuild the simulator:

```bash
yarn dev:grblsim:clean
yarn dev:grblsim:setup
```

## Next steps

Continue to [repo-layout.md](repo-layout.md) to understand where different types of code belong in the monorepo.

Read [build-and-bundle-contract.md](build-and-bundle-contract.md) to learn how changes get packaged for distribution.