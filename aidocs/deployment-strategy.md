# NextCNC Deployment Strategy

End-user installation options for Linux, Raspberry Pi, and Windows.

---

## Requirements & Constraints

### Hardware Access Needs
- ✅ **Serial/USB ports** - Direct hardware access required
- ✅ **Watch folders** - File system access to user directories
- ✅ **System integration** - Auto-start, desktop shortcuts, system tray
- ✅ **Native modules** - `serialport` requires native compilation per platform

### Target Platforms
1. **Linux** (Debian/Ubuntu, Fedora/RHEL, Arch)
2. **Raspberry Pi** (Raspberry Pi OS - Debian-based)
3. **Windows** (10/11, x64)

### Priority: **End-customer ease of deployment**
- Minimal steps to install
- No manual Node.js setup required
- Works out-of-the-box with native hardware access

---

## Deployment Options (Ranked)

### Option 1: **Electron Desktop App** ⭐ **RECOMMENDED**

**Status:** ✅ Already configured in your `package.json`

**Pros:**
- ✅ Native serial/USB access (no Docker hassles)
- ✅ Single executable per platform
- ✅ Works on all targets (Linux, Windows, macOS)
- ✅ Built-in auto-updater support
- ✅ Desktop integration (icons, shortcuts, system tray)
- ✅ No Node.js installation needed for end users
- ✅ Electron handles native module compilation

**Cons:**
- ⚠️ Larger download size (~100-150MB per platform)
- ⚠️ Electron app + web server runs together (acceptable for this use case)

**How it works:**
- Electron app bundles Node.js runtime
- Express server runs inside Electron main process
- Frontend served from bundled assets
- Serial port access via `serialport` (pre-built for Electron)

**Installation Experience:**
- **Linux/RPi**: Download `.deb` or `.AppImage`, double-click to install
- **Windows**: Download `.exe` installer, run setup wizard

**Implementation:**
```bash
# Already in package.json:
yarn build:linux        # Creates .deb, .rpm, .AppImage
yarn build:windows      # Creates .exe installer (NSIS)
yarn build:macos        # Creates .dmg (future macOS support)
```

---

### Option 2: **Native Package Managers**

**Linux/RPi:**
- **.deb package** (Debian/Ubuntu/Raspberry Pi OS)
- **.rpm package** (Fedora/RHEL/openSUSE)
- **.AppImage** (Universal, no install required)

**Windows:**
- **.msi installer** (Windows Installer)
- **.exe installer** (NSIS/Inno Setup)

**Pros:**
- ✅ Familiar installation experience
- ✅ System integration (Start Menu, Services)
- ✅ Package manager dependencies (auto-install Node.js if needed)
- ✅ Updates via package managers

**Cons:**
- ⚠️ Requires Node.js 18+ as dependency (or bundle it)
- ⚠️ Native module (`serialport`) compilation on install
- ⚠️ More platform-specific work

**Installation Experience:**
```bash
# Linux/RPi
sudo dpkg -i nextcnc_1.0.0.deb        # or
sudo apt install ./nextcnc_1.0.0.deb

# Windows
nextcnc-setup-1.0.0.exe  # Wizard-based install
```

---

### Option 3: **Standalone Binary** (pkg/nexe)

**Tool:** `pkg` or `nexe` to bundle Node.js + app into single executable

**Pros:**
- ✅ Single file, no installation needed
- ✅ Fast startup
- ✅ No Node.js required on target system

**Cons:**
- ❌ **Serial port native modules problematic** - requires separate `.node` files or pre-compilation
- ❌ Large file size
- ❌ Platform-specific builds (can't cross-compile easily)

**Verdict:** ⚠️ **Not recommended** - serialport makes this difficult

---

### Option 4: **Docker** (with caveats)

**Pros:**
- ✅ Consistent environment
- ✅ Easy updates (pull new image)

**Cons:**
- ❌ **Serial/USB access requires `--device` flags** (confusing for end users)
- ❌ **Watch folders need volume mounts** (extra configuration)
- ❌ Docker Desktop required on Windows (extra dependency)
- ❌ Not ideal for end-user simplicity

**Example (complex for end users):**
```bash
docker run -d \
  --device=/dev/ttyUSB0 \
  -v /path/to/watch:/watch \
  -p 8000:8000 \
  nextcnc:latest
```

**Verdict:** ❌ **Not recommended for end-user deployment** - too complex, but useful for developers/CI

---

### Option 5: **System Package Manager + Node.js**

**Install via npm/yarn globally:**
```bash
npm install -g nextcnc
# or
yarn global add nextcnc
```

**Pros:**
- ✅ Simple for developers
- ✅ Easy updates

**Cons:**
- ❌ Requires Node.js installed first (barrier for end users)
- ❌ Native module compilation on install (slow, requires build tools)
- ❌ Not ideal for non-technical users

**Verdict:** ❌ **Not recommended for end users** - requires too much setup

---

## Recommended Approach: **Electron Desktop App**

### Why Electron is Best Here

1. **Native hardware access** - No Docker device mapping needed
2. **Self-contained** - Bundles Node.js + dependencies
3. **Familiar UX** - Standard installers users expect
4. **Already configured** - Your `package.json` has electron-builder setup
5. **Cross-platform** - Same codebase, multiple platforms
6. **Auto-updater ready** - Can add update checks later

### Implementation Plan

#### Phase 1: Verify Electron Setup

Your current `package.json` has electron-builder configured. Check:
- [ ] `electron-app/` directory exists (main Electron process)
- [ ] Icons exist in `electron-build/`
- [ ] Build scripts work

#### Phase 2: Electron Main Process

The Electron main process should:
1. Start Express server on startup
2. Open browser window (or use Electron BrowserWindow)
3. Handle serial port access via Node.js in main process
4. Provide system tray icon
5. Handle auto-start (optional)

#### Phase 3: Build & Package

```bash
# Production build
yarn build-prod

# Package for Linux (creates .deb, .rpm, .AppImage)
yarn build:linux

# Package for Windows (creates .exe installer)
yarn build:windows

# Package for Raspberry Pi (ARM builds)
yarn build:linux-armv7l   # Raspberry Pi 3/4
yarn build:linux-arm64    # Raspberry Pi 5
```

#### Phase 4: Distribution

- **GitHub Releases** - Upload installers
- **Direct download** - Host installers on your site
- **Auto-updater** - Implement later (electron-updater)

---

## Installation Flow Comparison

### Electron (Recommended)
```
User: Downloads nextcnc-1.0.0-linux-x64.deb
User: Double-clicks → Install
User: Opens "NextCNC" from Applications menu
✅ Done - app starts, hardware access works
```

### Docker (Not Recommended)
```
User: Installs Docker Desktop first
User: Downloads docker-compose.yml
User: Edits file to map /dev/ttyUSB0
User: Runs docker-compose up
❌ Too many steps, requires Docker knowledge
```

### Native Package (Alternative)
```
User: Downloads nextcnc-1.0.0.deb
User: Runs: sudo dpkg -i nextcnc-1.0.0.deb
User: Installs Node.js if not present
User: Waits for native module compilation
✅ Works, but slower install
```

---

## Next Steps

### Immediate Actions

1. **Check Electron setup**
   - Review `src/electron-app/` structure
   - Verify main process starts Express server
   - Test serial port access in Electron

2. **Test builds**
   ```bash
   yarn build-prod
   yarn build:linux-x64
   # Test .deb install on clean Linux VM
   ```

3. **Create installer assets**
   - App icons (all sizes)
   - Installer graphics (Windows)
   - License file

### Future Enhancements

- **Auto-updater** - Use `electron-updater` for seamless updates
- **System service mode** - Run as background service (optional)
- **Portable mode** - USB-stick friendly install
- **Code signing** - Sign installers for Windows/macOS (requires certificates)

---

## File Structure for Electron

```
dist/cncjs/                    # After build-prod
├── app/                       # Vite-built frontend
│   ├── index.html
│   └── assets/
├── server/                    # Express backend
│   ├── server-cli.js
│   └── ...
├── electron-app/              # Electron main process
│   └── main.js
├── package.json
└── node_modules/              # Dependencies including serialport
```

Electron package includes all of this, user gets single installer.

---

## Raspberry Pi Specific Notes

### ARM Builds
- Use `yarn build:linux-armv7l` for Pi 3/4 (32-bit)
- Use `yarn build:linux-arm64` for Pi 5 (64-bit)
- `.deb` packages work natively on Raspberry Pi OS

### Serial Port Permissions
- Electron app needs `dialout` group for serial access
- Add to installer post-install script:
  ```bash
  usermod -a -G dialout $USER
  ```

### Performance
- Electron is heavier than pure Node.js, but acceptable for Pi 4/5
- Consider lighter frontend if Pi 3 performance issues

---

## Conclusion

**Use Electron Desktop App** for end-user deployment:
- ✅ Native hardware access
- ✅ Simple installation
- ✅ Cross-platform support
- ✅ Already partially configured
- ✅ Professional user experience

**Avoid Docker** for end-user deployment:
- ❌ Too complex for non-technical users
- ❌ Serial port access requires manual configuration
- ❌ Extra dependencies (Docker Desktop)

**Future:** Consider Docker for developer/CI environments, but use Electron for end users.

