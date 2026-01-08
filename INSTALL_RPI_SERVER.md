# Installing NextCNC Server on Raspberry Pi

**Simple installation for headless Raspberry Pi deployment.**

---

## Quick Install (2 Steps)

### 1. Install the package

```bash
sudo dpkg -i nextcnc-server_1.10.5_arm64.deb
sudo apt-get install -f  # if dependencies missing
```

### 2. Run the server

```bash
cncjs
```

That's it! The server is now running at `http://0.0.0.0:8000`

Access it from any device on your network:
- `http://raspberrypi.local:8000`
- `http://<pi-ip-address>:8000`

---

## What You Get

- ✅ **Command**: `cncjs` (works from any directory)
- ✅ **Server**: Runs on port 8000, accessible from network
- ✅ **Headless**: No GUI required, works without display
- ✅ **Serial Port Access**: User automatically added to `dialout` group

---

## Optional: Run as Service (Auto-start on Boot)

```bash
# Enable service
sudo systemctl enable nextcnc
sudo systemctl start nextcnc

# Check status
sudo systemctl status nextcnc

# View logs
sudo journalctl -u nextcnc -f
```

---

## Serial Port Access

After installation, you may need to **log out and back in** for serial port access to work (the installer adds you to the `dialout` group).

Verify:
```bash
groups
# Should show "dialout" in the list
```

---

## Command Options

```bash
# Default (port 8000, all interfaces)
cncjs

# Custom port
cncjs --port 9000

# Localhost only
cncjs --host 127.0.0.1

# See all options
cncjs --help
```

---

## Uninstall

```bash
sudo apt-get remove nextcnc-server
```

---

## Troubleshooting

### Command not found

If `cncjs` command isn't found:
```bash
# Check if installed
dpkg -l | grep nextcnc-server

# Try full path
/usr/bin/cncjs
```

### Port already in use

```bash
# Check what's using port 8000
sudo lsof -i :8000

# Use different port
cncjs --port 8001
```

### Serial port not accessible

```bash
# Add user to dialout group manually
sudo usermod -a -G dialout $USER
# Log out and back in
```

---

## That's It!

Simple installation, simple usage. Just `sudo dpkg -i` and `cncjs`.

