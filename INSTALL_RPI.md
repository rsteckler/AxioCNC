# Installing NextCNC on Raspberry Pi

## Built Installers

Your Raspberry Pi installer has been built! The following files are in the `output/` directory:

- **`.deb` package** (recommended): `output/cncjs-app_1.10.5_armv7l.deb`
- **`.AppImage`** (no install needed): `output/CNCjs-1.10.5-armv7l.AppImage`

The `.deb` package is recommended for normal installation. The `.AppImage` can run directly without installation.

---

## Installation Steps

### Option 1: Install .deb Package (Recommended)

1. **Transfer the installer to your Raspberry Pi:**

   From your development machine:
   ```bash
   scp output/cncjs-app_1.10.5_armv7l.deb pi@raspberrypi.local:~/
   ```
   
   Or use a USB drive, SCP, or any other transfer method.

2. **On the Raspberry Pi, install the package:**
   ```bash
   cd ~
   sudo dpkg -i cncjs-app_1.10.5_armv7l.deb
   ```

3. **If dependencies are missing, install them:**
   ```bash
   sudo apt-get install -f
   ```

4. **Add your user to the `dialout` group** (required for serial port access):
   ```bash
   sudo usermod -a -G dialout $USER
   ```
   
   **Important:** Log out and back in (or reboot) for this change to take effect!

5. **Verify serial port access:**
   ```bash
   # Log out and back in, then check:
   groups $USER
   # Should show "dialout" in the list
   
   # Check available serial ports:
   ls -l /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
   ```

6. **Run the application:**
   ```bash
   cncjs
   # or
   /usr/bin/cncjs
   ```
   
   The application should start and open a browser window at `http://localhost:8000`.

---

### Option 2: Run AppImage (No Installation)

1. **Transfer the AppImage to your Raspberry Pi:**
   ```bash
   scp output/CNCjs-1.10.5-armv7l.AppImage pi@raspberrypi.local:~/
   ```

2. **On the Raspberry Pi, make it executable:**
   ```bash
   chmod +x CNCjs-1.10.5-armv7l.AppImage
   ```

3. **Add user to dialout group** (still required for serial access):
   ```bash
   sudo usermod -a -G dialout $USER
   # Log out and back in
   ```

4. **Run the AppImage:**
   ```bash
   ./CNCjs-1.10.5-armv7l.AppImage
   ```

---

## First Run Setup

1. **Start the application** (see above)

2. **Open browser:** The app should automatically open a browser, or navigate to:
   ```
   http://localhost:8000
   ```

3. **Configure connection:**
   - Go to **Settings** → **Machine**
   - Configure your serial port (e.g., `/dev/ttyUSB0` or `/dev/ttyACM0`)
   - Set baud rate (typically `115200` for Grbl)
   - Select controller type (Grbl, Marlin, etc.)

4. **Connect to your machine:**
   - Click **Connect** in the main interface
   - You should see connection status change

---

## Troubleshooting

### Serial Port Not Found

**Problem:** Cannot see or connect to serial devices.

**Solution:**
```bash
# Check if user is in dialout group
groups $USER

# If not, add:
sudo usermod -a -G dialout $USER
# Log out and back in

# Verify device exists:
ls -l /dev/ttyUSB* /dev/ttyACM*

# Check permissions:
ls -l /dev/ttyUSB0
# Should show: crw-rw---- 1 root dialout ... /dev/ttyUSB0
```

### Application Won't Start

**Check logs:**
```bash
# Run from command line to see errors:
cncjs
```

**Check if port is in use:**
```bash
sudo lsof -i :8000
# or
sudo netstat -tlnp | grep :8000
```

**Change port:**
```bash
cncjs --port 8001
```

### Permission Denied on Serial Port

**Make sure:**
1. User is in `dialout` group
2. Logged out and back in (or rebooted)
3. Device permissions are correct:
   ```bash
   sudo chmod 666 /dev/ttyUSB0  # Temporary fix (resets on reboot)
   ```

---

## Uninstalling

To remove the installed package:

```bash
sudo apt-get remove cncjs-app
# or
sudo dpkg -r cncjs-app
```

To remove configuration files:
```bash
rm -rf ~/.config/cncjs
# or
rm -rf ~/.cncjs
```

---

## Auto-Start on Boot (Optional)

To run NextCNC automatically when the Pi boots:

1. **Create systemd service:**
   ```bash
   sudo nano /etc/systemd/system/nextcnc.service
   ```

2. **Add this content:**
   ```ini
   [Unit]
   Description=NextCNC CNC Controller
   After=network.target

   [Service]
   Type=simple
   User=pi
   ExecStart=/usr/bin/cncjs
   Restart=always
   Environment="DISPLAY=:0"

   [Install]
   WantedBy=multi-user.target
   ```
   
   (Replace `pi` with your username if different)

3. **Enable and start:**
   ```bash
   sudo systemctl enable nextcnc
   sudo systemctl start nextcnc
   ```

4. **Check status:**
   ```bash
   sudo systemctl status nextcnc
   ```

---

## Next Steps

After installation:
1. ✅ Verify serial port access works
2. ✅ Configure your machine settings
3. ✅ Test connection to your CNC controller
4. ✅ Upload a test G-code file
5. ✅ Test jog controls

Enjoy your CNC controller!

