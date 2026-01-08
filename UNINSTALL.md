# Uninstalling NextCNC Packages

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

## Uninstall Server Package (nextcnc-server)

If you installed the server-only package:

```bash
# Remove the package
sudo apt-get remove nextcnc-server

# Or using dpkg
sudo dpkg -r nextcnc-server

# Remove configuration files (optional)
rm -rf ~/.config/cncjs
rm -rf ~/.cncjs
rm -rf /opt/nextcnc
```

## Remove Service (if enabled)

If you enabled the systemd service:

```bash
# Stop and disable service
sudo systemctl stop nextcnc
sudo systemctl disable nextcnc

# Remove service file
sudo rm /etc/systemd/system/nextcnc.service
sudo systemctl daemon-reload
```

## Complete Cleanup

To remove everything:

```bash
# Remove package
sudo apt-get remove --purge cncjs-app nextcnc-server

# Remove application files
sudo rm -rf /opt/CNCjs
sudo rm -rf /opt/nextcnc

# Remove launcher (if exists)
sudo rm -f /usr/bin/cncjs
sudo rm -f /usr/local/bin/cncjs

# Remove user config
rm -rf ~/.config/cncjs
rm -rf ~/.config/CNCjs
rm -rf ~/.cncjs

# Remove service
sudo systemctl stop nextcnc 2>/dev/null
sudo systemctl disable nextcnc 2>/dev/null
sudo rm -f /etc/systemd/system/nextcnc.service
sudo systemctl daemon-reload
```

