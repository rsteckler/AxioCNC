# NextCNC Deployment Quick Start

**TL;DR:** Your Electron setup is ready! Build installers with:

```bash
yarn build-prod
yarn build:linux-armv7l    # Raspberry Pi 3/4
yarn build:linux-arm64     # Raspberry Pi 5
yarn build:windows-x64     # Windows
```

---

## Quick Deployment Checklist

### For Raspberry Pi (ARM32)

```bash
# 1. Build production
yarn build-prod

# 2. Build Raspberry Pi installer
yarn build:linux-armv7l

# 3. Transfer to Pi
scp output/nextcnc_1.0.0_armv7l.deb pi@raspberrypi.local:~

# 4. On Pi: Install
ssh pi@raspberrypi.local
sudo dpkg -i ~/nextcnc_1.0.0_armv7l.deb

# 5. Add user to dialout group (for serial access)
sudo usermod -a -G dialout $USER
# Log out and back in

# 6. Run
nextcnc
```

### For Windows

```bash
# 1. Build production
yarn build-prod

# 2. Build Windows installer
yarn build:windows-x64

# 3. Installer created at:
#    output/nextcnc Setup 1.0.0.exe

# 4. Double-click installer on Windows machine
# 5. Follow setup wizard
```

### For Linux (x64)

```bash
# 1. Build production
yarn build-prod

# 2. Build Linux installer
yarn build:linux-x64

# 3. Install
sudo dpkg -i output/nextcnc_1.0.0_amd64.deb

# 4. Run
nextcnc
```

---

## What Gets Built

After `yarn build-prod`, you get:
- `dist/cncjs/` - Complete application ready for packaging
  - `app/` - Vite-built frontend
  - `server/` - Express backend
  - `electron-app/` - Electron main process
  - `node_modules/` - All dependencies (including serialport)

After `yarn build:linux-*`, you get:
- `output/nextcnc_*.deb` - Debian/Ubuntu/Raspberry Pi OS installer
- `output/nextcnc_*.AppImage` - Universal Linux app (no install needed)
- `output/nextcnc_*.rpm` - Fedora/RHEL installer

After `yarn build:windows-x64`, you get:
- `output/nextcnc Setup *.exe` - Windows installer (NSIS)

---

## Common Issues

### Serial Port Not Accessible (Linux/RPi)

```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER
# Log out and back in for changes to take effect
```

### Build Fails (Native Modules)

```bash
# Install build tools first
sudo apt-get install build-essential python3

# Rebuild native modules
npm run electron-rebuild
```

---

## Configuration

Default locations after install:

- **Linux/RPi**: `~/.config/nextcnc/` or `~/.nextcnc/`
- **Windows**: `%APPDATA%\nextcnc\`

Watch folder: `~/.cncjs/watch/` (Linux) or `%USERPROFILE%\.cncjs\watch\` (Windows)

---

## Next Steps

1. **Test build on your garage machine:**
   - Build installer for your target platform
   - Install and verify it works
   - Test serial port connection
   - Test file upload/watch folders

2. **Customize branding** (optional):
   - Update `productName` in `package.json` (currently "CNCjs")
   - Update `appId` (currently "org.cncjs")
   - Replace icons in `electron-build/` if needed

3. **Set up auto-start** (optional):
   - Linux: systemd service
   - Windows: Task Scheduler or Startup folder

---

## Detailed Documentation

See `aidocs/deployment-strategy.md` for:
- All deployment options compared
- Why Electron is recommended
- Why Docker isn't ideal for end users

See `aidocs/deployment-guide.md` for:
- Complete build instructions
- Troubleshooting guide
- Advanced configuration
- Distribution strategies

---

## Summary

✅ **Electron setup is ready** - Your `main.js` already launches the server  
✅ **Build scripts configured** - Just run `yarn build:linux-*` or `yarn build:windows-*`  
✅ **Native hardware access** - Serial ports work without Docker  
✅ **Cross-platform** - Same codebase, multiple installers  

**Recommendation:** Use Electron installers for end-user deployment. Avoid Docker for non-technical users.

