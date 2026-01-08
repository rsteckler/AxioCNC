# Server-Only Package for Raspberry Pi

## Problem

The Electron-based installer creates a GUI application that requires X server/display, which doesn't work for headless Raspberry Pi deployments.

## Solution

A server-only `.deb` package that:
- ✅ Installs Node.js server (no Electron)
- ✅ Creates `/usr/bin/cncjs` command
- ✅ Works headless out of the box
- ✅ Optional systemd service
- ✅ Simple installation: `sudo dpkg -i` then `cncjs`

---

## Building the Server Package

### Prerequisites

```bash
# Install dpkg-dev if not present
sudo apt-get install dpkg-dev
```

### Build Commands

```bash
# Build for ARM64 (Raspberry Pi 5)
yarn build:server-deb-arm64

# Build for ARM32 (Raspberry Pi 3/4)
yarn build:server-deb-armv7l

# Or build for current architecture
yarn build:server-deb
```

This creates: `output/nextcnc-server_1.10.5_arm64.deb`

---

## Installation (End User Experience)

### Step 1: Transfer to Pi

```bash
scp output/nextcnc-server_1.10.5_arm64.deb pi@raspberrypi.local:~/
```

### Step 2: Install

```bash
sudo dpkg -i nextcnc-server_1.10.5_arm64.deb
sudo apt-get install -f  # if dependencies missing
```

### Step 3: Run

```bash
cncjs
```

That's it! The server starts on `http://0.0.0.0:8000`

---

## What Gets Installed

- **Application**: `/opt/nextcnc/` (server files + node_modules)
- **Launcher**: `/usr/bin/cncjs` (command-line launcher)
- **Service**: `/etc/systemd/system/nextcnc.service` (optional systemd service)

---

## Optional: Run as Service

```bash
# Enable auto-start on boot
sudo systemctl enable nextcnc
sudo systemctl start nextcnc

# Check status
sudo systemctl status nextcnc

# View logs
sudo journalctl -u nextcnc -f
```

---

## Access from Network

Once running, access from any device:

```
http://raspberrypi.local:8000
# or
http://<pi-ip-address>:8000
```

---

## Package Details

- **Package Name**: `nextcnc-server`
- **Install Location**: `/opt/nextcnc`
- **Command**: `cncjs` (in PATH)
- **Default Port**: 8000
- **Default Host**: 0.0.0.0 (all interfaces)

---

## Post-Install Notes

The installer automatically:
- Adds current user to `dialout` group (for serial port access)
- Log out/in required for group change to take effect

Manual service setup is optional - users can run `cncjs` directly or enable the service.

