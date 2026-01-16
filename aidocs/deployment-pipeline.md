# Deployment Pipeline Documentation

This document explains the complete build and deployment process for AxioCNC.

## Overview

**Deployment Command:** `yarn deploy:rpi` (or `yarn deploy:rpi-arm64` / `yarn deploy:rpi-armv7l`)

**End Result:** A `.deb` package deployed to Raspberry Pi at `/opt/axiocnc/`

---

## Pipeline Flow

```
yarn deploy:rpi
  ↓
  scripts/deploy-rpi.sh
    ↓
    yarn build:server-deb-debug-{arch}
      ↓
      scripts/build-server-deb-debug.sh
        ↓
        1. Version bump
        2. yarn build-dev (builds FE + BE)
        3. Package into .deb structure
        4. Install dependencies
        5. Build .deb file
    ↓
  scp .deb to Raspberry Pi
    ↓
  ssh: dpkg -i (install on RPi)
```

---

## Step-by-Step Breakdown

### 1. Deployment Script (`scripts/deploy-rpi.sh`)

**What it does:**
- Calls `yarn build:server-deb-debug-{arch}` to build the package
- Extracts version from build output
- Uses `scp` to copy `.deb` file to `ryan@cnc.home`
- Uses `ssh` to install the package on Raspberry Pi
- Stops any running server instance

**Key variables:**
- `RPI_HOST`: Default `ryan@cnc.home` (can override with env var)
- `ARCH`: Default `arm64` (can pass `armv7l` as argument)

**Output:** `.deb` file installed on Raspberry Pi

---

### 2. Build Script (`scripts/build-server-deb-debug.sh`)

**What it does:**

#### Step 2.1: Version Bump
- Reads current version from `package.json`
- Increments patch version (e.g., `1.10.52` → `1.10.53`)
- Updates both `package.json` and `src/package.json`

#### Step 2.2: Production Build
- Calls `yarn build-dev` (NOT `build-prod` for debug builds)
- This creates artifacts in `output/axiocnc/` (not `dist/axiocnc/`)

#### Step 2.3: Create Package Structure
- Creates directory structure:
  ```
  output/server-deb-build/
    axiocnc-server_{VERSION}-debug_{ARCH}/
      /opt/axiocnc/          # Application files
      /usr/bin/               # Launcher script
      /etc/systemd/system/    # Service file
      /DEBIAN/                # Package metadata
  ```

#### Step 2.4: Copy Application Files
- Copies **entire contents** of `output/axiocnc/*` to `/opt/axiocnc/`
- This includes:
  - Frontend build (from Vite)
  - Backend build (from Babel)
  - Server config files
  - All source files

#### Step 2.5: Install Dependencies
- Changes directory to `/opt/axiocnc/` in package
- Creates empty `yarn.lock`
- Runs `yarn install` (installs ALL dependencies including dev deps for debug)
- Ensures `zod@^4.3.5` is installed (required by shared schemas)

#### Step 2.6: Create Launcher Script
- Creates `/usr/bin/axiocnc` executable
- Sets `NODE_ENV=development`
- Forces `--host 0.0.0.0 --allow-remote-access`
- Launches `server-cli.js`

#### Step 2.7: Create Systemd Service
- Creates `/etc/systemd/system/axiocnc.service`
- Configured to run as root
- Auto-restart on failure
- Logs to journald

#### Step 2.8: Create Debian Package Metadata
- `DEBIAN/control`: Package info, dependencies, architecture
- `DEBIAN/postinst`: Adds user to `dialout` group for serial access
- `DEBIAN/prerm`: Stops/disables service on removal

#### Step 2.9: Build .deb File
- Uses `dpkg-deb --build` to create final package
- Output: `output/axiocnc-server_{VERSION}-debug_{ARCH}.deb`

---

### 3. Frontend Build (`yarn build-dev` → `scripts/build-dev.sh`)

**What it does:**

#### Step 3.1: Sync Dependencies
- Runs `yarn package-sync` (syncs dependencies to `src/package.json`)

#### Step 3.2: Build Backend (Babel)
- Transforms `src/*.js` → `output/axiocnc/*.js` (CommonJS)
- Transforms `src/server/**/*.js` → `output/axiocnc/server/**/*.js` (CommonJS)
- Transforms `src/shared/**/*.js` → `output/axiocnc/shared/**/*.js` (CommonJS)
- Runs i18n scanner for translations
- **Key:** Babel transforms ES modules to CommonJS, handles lodash imports

#### Step 3.3: Build Frontend (Vite)
- Changes to `src/app/`
- Runs `yarn build:dev` (Vite build in dev mode)
- Outputs to `output/axiocnc/app/` (from `vite.config.ts`)
- Includes source maps for debugging

#### Step 3.4: Copy Non-JS Assets
- Copies `src/server/i18n/` → `output/axiocnc/server/i18n/`
- Copies `src/server/views/` → `output/axiocnc/server/views/`
- Copies `src/server/config/*.json` → `output/axiocnc/server/config/*.json`
- (JS config files already transformed by Babel)

---

### 4. Directory Structure After Build

```
output/axiocnc/
├── app/                    # Frontend build (Vite)
│   ├── assets/             # Bundled JS/CSS
│   ├── index.html
│   └── ...                 # Vite build output
├── server/                 # Backend build (Babel)
│   ├── *.js                # Transformed to CommonJS
│   ├── config/
│   │   ├── settings.js     # Transformed from ES modules
│   │   └── *.json          # Copied as-is
│   ├── controllers/
│   ├── api/
│   ├── i18n/               # Copied from source
│   └── views/              # Copied from source
├── shared/                 # Shared modules (Babel)
├── server-cli.js           # Entry point
├── package.json            # Copied from src/package.json
└── ...
```

---

### 5. What Gets Packaged into .deb

The `.deb` package contains:

```
/opt/axiocnc/               # Everything from output/axiocnc/
  ├── app/                  # Frontend (Vite build)
  ├── server/               # Backend (Babel build)
  ├── shared/               # Shared modules
  ├── node_modules/         # Production dependencies (installed on target)
  ├── package.json
  ├── server-cli.js
  └── ...

/usr/bin/
  └── axiocnc               # Launcher script

/etc/systemd/system/
  └── axiocnc.service       # Systemd service file

/DEBIAN/
  ├── control               # Package metadata
  ├── postinst              # Post-install script
  └── prerm                 # Pre-remove script
```

---

## Key Build Artifacts

### Frontend (Vite)
- **Source:** `src/app/`
- **Build Tool:** Vite
- **Config:** `src/app/vite.config.ts`
- **Output:** `output/axiocnc/app/` (dev) or `dist/axiocnc/app/` (prod)
- **What's built:**
  - React components → bundled JS
  - TypeScript → JavaScript
  - CSS → bundled CSS
  - Assets → optimized/copied

### Backend (Babel)
- **Source:** `src/server/`
- **Build Tool:** Babel
- **Config:** `babel.config.js`
- **Output:** `output/axiocnc/server/` (dev) or `dist/axiocnc/server/` (prod)
- **Transformations:**
  - ES modules (`import`/`export`) → CommonJS (`require`/`module.exports`)
  - Lodash sub-path imports → Full imports (via `babel-plugin-lodash`)
  - React JSX → JS (for server-side rendering)
  - Modern JS → Node.js compatible JS

---

## Differences: Debug vs Production

| Aspect | Debug (`build-dev`) | Production (`build-prod`) |
|--------|---------------------|---------------------------|
| **Output Directory** | `output/axiocnc/` | `dist/axiocnc/` |
| **Source Maps** | ✅ Yes | ❌ No |
| **Dependencies** | All (including dev) | Production only |
| **Node Environment** | `development` | `production` |
| **Package Name** | `axiocnc-server_X.X.X-debug_arch.deb` | `axiocnc-server_X.X.X_arch.deb` |

---

## Version Management

- **Version Location:** `package.json` and `src/package.json`
- **Auto-bump:** Patch version incremented automatically on each build
- **Format:** Semantic versioning (e.g., `1.10.53`)
- **Where set:**
  - Root `package.json` → synced to `src/package.json` during `package-sync`
  - Both updated in `build-server-deb-debug.sh` before build

---

## Installation on Raspberry Pi

After deployment, the package is installed with:

```bash
sudo dpkg -i ~/axiocnc-server_{VERSION}-debug_{ARCH}.deb
```

**What happens:**
1. Package extracted to `/opt/axiocnc/`
2. Launcher installed to `/usr/bin/axiocnc`
3. Systemd service installed (but not enabled by default)
4. Post-install script runs (adds user to dialout group)

**To run:**
```bash
axiocnc  # Runs server
# OR
sudo systemctl enable axiocnc
sudo systemctl start axiocnc
```

---

## Troubleshooting

### Common Issues

1. **Module not found errors:**
   - Check if `yarn install` ran successfully in package
   - Ensure `zod` is installed (check step 2.5)

2. **ES module errors:**
   - Verify Babel is transforming server code (check `babel.config.js`)
   - Ensure `config/` files are transformed (not overwritten by copy)

3. **Frontend not loading:**
   - Check Vite build output in `output/axiocnc/app/`
   - Verify Express is serving static files from `/app/`

4. **Serial port access denied:**
   - User needs to be in `dialout` group (handled by postinst)
   - May need to log out/in after installation

---

## File Copy Operations

### What Gets Copied vs Transformed

| Item | Source | Destination | Transform? |
|------|--------|-------------|------------|
| Server JS files | `src/server/**/*.js` | `output/axiocnc/server/` | ✅ Babel |
| Config JS files | `src/server/config/*.js` | (in server/) | ✅ Babel |
| Config JSON files | `src/server/config/*.json` | `output/axiocnc/server/config/` | ❌ Copy only |
| i18n files | `src/server/i18n/` | `output/axiocnc/server/i18n/` | ❌ Copy only |
| Views | `src/server/views/` | `output/axiocnc/server/views/` | ❌ Copy only |
| Frontend | `src/app/` | `output/axiocnc/app/` | ✅ Vite |
| Package.json | `src/package.json` | `output/axiocnc/package.json` | ❌ Copy only |

**⚠️ Important:** The build script copies `config/*.json` separately to avoid overwriting transformed JS files.
