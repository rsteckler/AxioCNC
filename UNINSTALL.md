# Uninstalling AxioCNC Packages

## Uninstall Electron Package (cncjs-app)

If you installed the Electron-based package and want to remove it:

```bash
# Remove the package
sudo apt-get remove cncjs-app

# Or using dpkg
sudo dpkg -r cncjs-app

# Remove configuration files (optional)
rm -rf ~/.config/CNCjs
rm -rf ~/.cncjs
```

## Uninstall Server Package (axiocnc-server)

If you installed the server-only package:

```bash
# Remove the package
sudo apt-get remove axiocnc-server

# Or using dpkg
sudo dpkg -r axiocnc-server

# Remove configuration files (optional)
rm -rf ~/.config/axiocnc
rm -rf ~/.axiocnc
rm -rf /opt/axiocnc
```

## Remove Service (if enabled)

If you enabled the systemd service:

```bash
# Stop and disable service
sudo systemctl stop axiocnc
sudo systemctl disable axiocnc

# Remove service file
sudo rm /etc/systemd/system/axiocnc.service
sudo systemctl daemon-reload
```

## Complete Cleanup

To remove everything:

```bash
# Remove package
sudo apt-get remove --purge cncjs-app axiocnc-server

# Remove application files
sudo rm -rf /opt/CNCjs
sudo rm -rf /opt/axiocnc

# Remove launcher (if exists)
sudo rm -f /usr/bin/cncjs
sudo rm -f /usr/local/bin/cncjs

# Remove user config
rm -rf ~/.config/cncjs
rm -rf ~/.config/CNCjs
rm -rf ~/.cncjs

# Remove service
sudo systemctl stop axiocnc 2>/dev/null
sudo systemctl disable axiocnc 2>/dev/null
sudo rm -f /etc/systemd/system/axiocnc.service
sudo systemctl daemon-reload
```

