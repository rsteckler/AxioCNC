# NextCNC Deployment Guide

Practical guide for building and deploying installers for Linux, Raspberry Pi, and Windows.

---

## Quick Start: Building Installers

Your Electron setup is **already configured**! Here's how to build installers:

### Prerequisites

```bash
# Install dependencies
yarn install

# Install Electron Builder globally (optional, already in devDependencies)
# yarn global add electron-builder
```

### Build Steps

#### 1. Build the Application

```bash
# Build backend + frontend for production
yarn build-prod
```

This creates `dist/cncjs/` with:
- Compiled server code
- Vite-built frontend (`dist/cncjs/app/`)
- Electron main process
- Dependencies (node_modules)

#### 2. Build Platform-Specific Installers

**Linux (x64):**
```bash
yarn build:linux-x64
# Creates: output/nextcnc-1.0.0-x86_64.AppImage
#          output/nextcnc_1.0.0_amd64.deb
#          output/nextcnc-1.0.0.x86_64.rpm
```

**Raspberry Pi (ARM32):**
```bash
yarn build:linux-armv7l
# Creates: output/nextcnc-1.0.0-armv7l.AppImage
#          output/nextcnc_1.0.0_armv7l.deb
```

**Raspberry Pi 5 (ARM64):**
```bash
yarn build:linux-arm64
# Creates: output/nextcnc-1.0.0-arm64.AppImage
#          output/nextcnc_1.0.0_arm64.deb
```

**Windows (x64):**
```bash
yarn build:windows-x64
# Creates: output/nextcnc Setup 1.0.0.exe  (NSIS installer)
```

**All Linux variants:**
```bash
yarn build:linux
# Creates installers for x64, armv7l, arm64
```

---

## Testing Installers

### Linux/Raspberry Pi

#### Using .deb Package (Recommended)

```bash
# Install
sudo dpkg -i output/nextcnc_1.0.0_amd64.deb

# If dependencies missing:
sudo apt-get install -f

# Run
nextcnc
# or
/usr/bin/nextcnc
```

#### Using AppImage (No Install Required)

```bash
# Make executable
chmod +x output/nextcnc-1.0.0-x86_64.AppImage

# Run directly
./nextcnc-1.0.0-x86_64.AppImage
```

### Windows

1. Download `nextcnc Setup 1.0.0.exe`
2. Double-click installer
3. Follow setup wizard
4. Launch from Start Menu or desktop shortcut

---

## Verifying Installation

After installation, verify:

### 1. Application Starts
```bash
# Linux/RPi
nextcnc

# Windows
# Launch from Start Menu
```

Should open browser window at `http://localhost:8000` (or configured port).

### 2. Serial Port Access

**Linux/RPi:**
```bash
# Check if user is in dialout group
groups $USER

# If not, add user (one-time setup):
sudo usermod -a -G dialout $USER
# Log out and back in for changes to take effect

# Check available serial ports
ls -l /dev/ttyUSB* /dev/ttyACM*
```

**Windows:**
- Serial ports typically accessible without special permissions
- Check Device Manager for COM ports

### 3. Watch Folders Work

Default watch folder location:
- **Linux/RPi**: `~/.cncjs/watch/`
- **Windows**: `%USERPROFILE%\.cncjs\watch\`

Create test file, should appear in UI.

---

## Configuration Files

After first run, configuration stored at:

- **Linux/RPi**: `~/.config/nextcnc/` or `~/.nextcnc/`
- **Windows**: `%APPDATA%\nextcnc\`

Key files:
- `cnc.json` - Main configuration
- `watch/` - Watch folder (by default)

---

## Troubleshooting

### Serial Port Not Accessible (Linux/RPi)

**Problem:** Cannot see or connect to serial devices.

**Solution:**
```bash
# Add user to dialout group
sudo usermod -a -G dialout $USER

# Log out and back in, then verify:
groups $USER
# Should show "dialout" in list

# Verify device exists and permissions:
ls -l /dev/ttyUSB0
# Should show: crw-rw---- 1 root dialout ... /dev/ttyUSB0
```

### Native Module Build Fails

**Problem:** `serialport` module fails to build during installer creation.

**Solution:**
```bash
# Install build tools (Linux/RPi)
sudo apt-get install build-essential python3

# Rebuild after install (inside dist/cncjs/)
npm run electron-rebuild
```

**Note:** The `electron-builder.sh` script handles this automatically, but manual rebuild may be needed if issues occur.

### Port Already in Use

**Problem:** `Error: Port 8000 already in use`

**Solution:**
- Check what's using the port:
  ```bash
  # Linux/RPi
  sudo lsof -i :8000
  # or
  sudo netstat -tlnp | grep :8000
  
  # Windows
  netstat -ano | findstr :8000
  ```
- Change port in settings or kill the process
- Or configure different port: `nextcnc --port 8001`

### Electron App Won't Start (Windows)

**Problem:** Installer runs but app doesn't launch.

**Solution:**
- Check Event Viewer for errors
- Try running from command line:
  ```cmd
  cd "C:\Program Files\nextcnc\resources\app"
  electron.exe .
  ```
- Check Windows Defender/antivirus isn't blocking

---

## Advanced Configuration

### Custom Installer Branding

Edit `package.json`:
```json
{
  "build": {
    "productName": "NextCNC",
    "appId": "org.nextcnc",
    "win": {
      "icon": "electron-build/icon.ico"
    },
    "linux": {
      "icon": "electron-build/icon.png"
    }
  }
}
```

Icons location: `electron-build/`
- `icon.ico` - Windows (256x256)
- `icon.icns` - macOS (multiple sizes)
- `icon.png` - Linux (512x512 recommended)

### Auto-Start on Boot

**Linux (systemd):**
```bash
# Create service file
sudo nano /etc/systemd/system/nextcnc.service
```

```ini
[Unit]
Description=NextCNC CNC Controller
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
ExecStart=/usr/bin/nextcnc
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable nextcnc
sudo systemctl start nextcnc
```

**Windows (Task Scheduler):**
- Use Task Scheduler to run on login
- Or add shortcut to Startup folder: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`

### Command Line Options

Run with options:
```bash
nextcnc --port 8000 --watch /path/to/watch
```

See all options:
```bash
nextcnc --help
```

---

## Distribution Strategy

### Option 1: GitHub Releases

1. Build installers:
   ```bash
   yarn build-prod
   yarn build:linux
   yarn build:windows
   ```

2. Create GitHub Release:
   - Tag version: `git tag v1.0.0`
   - Push tag: `git push origin v1.0.0`
   - Upload installers as release assets

3. Users download from Releases page

### Option 2: Direct Downloads

1. Host installers on your website
2. Provide download links:
   - Linux x64: `.deb` or `.AppImage`
   - Raspberry Pi: `.deb` (armv7l or arm64)
   - Windows: `.exe` installer

### Option 3: Package Repositories (Future)

**Linux:**
- Create `.deb` repository (APT)
- Users add repo: `sudo add-apt-repository ...`
- Install: `sudo apt install nextcnc`

**Windows:**
- Use Chocolatey or Scoop
- Create package manifests

---

## File Sizes (Approximate)

After building installers, expect:

- **Linux .deb**: ~150-200 MB
- **Linux .AppImage**: ~150-200 MB
- **Windows .exe**: ~150-200 MB
- **Raspberry Pi .deb**: ~150-200 MB

Large due to bundled Node.js + Electron runtime.

---

## Next Steps for Your Garage Setup

### Phase 1: Test Build

1. **Build production:**
   ```bash
   yarn build-prod
   ```

2. **Test on target platform:**
   - Build installer for your RPi or Windows machine
   - Install and verify it works
   - Test serial port access
   - Test watch folders

### Phase 2: Polish Installer

1. **Add icons:**
   - Place in `electron-build/`
   - Update `package.json` if paths differ

2. **Test installer experience:**
   - Fresh VM/machine install
   - Verify shortcuts created
   - Check auto-start (if desired)

### Phase 3: Automation

1. **Create build script:**
   ```bash
   # scripts/build-all.sh
   #!/bin/bash
   yarn build-prod
   yarn build:linux
   yarn build:windows
   ```

2. **CI/CD (future):**
   - GitHub Actions to build on tag
   - Auto-upload to Releases

---

## Questions to Answer

Before final deployment, verify:

- [ ] Does serial port access work out-of-the-box? (Linux needs `dialout` group)
- [ ] Are watch folders in expected locations?
- [ ] Does app auto-start on boot? (if desired)
- [ ] Are desktop shortcuts created correctly?
- [ ] Does uninstaller work properly?
- [ ] Are file permissions correct for data directories?

---

## Summary

**Your Electron setup is ready!** Just run:

```bash
yarn build-prod
yarn build:linux-armv7l    # For Raspberry Pi 3/4
# or
yarn build:windows-x64     # For Windows
```

Install the generated package and test. Electron handles:
- ✅ Native serial port access
- ✅ Bundled Node.js + dependencies
- ✅ Cross-platform installers
- ✅ Desktop integration

**Docker is not needed** for end-user deployment. Use Electron installers for simplicity.

