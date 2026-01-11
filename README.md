# AxioCNC

<div align="center">
  <img src="website/media/fulllogo.png" alt="AxioCNC Logo" width="400"/>
  
  <sub>A fork of <a href="https://github.com/cncjs/cncjs">cncjs</a></sub>
</div>

> Stability-focused G-code sender built around real CNC workflows. Control your machine from any device on your network.

**[🌐 Visit the AxioCNC Website](https://axiocnc.com)** • [📖 Documentation](https://axiocnc.com/docs) • [💬 Discussions](https://github.com/rsteckler/AxioCNC/discussions) • [🐛 Report Issue](https://github.com/rsteckler/AxioCNC/issues/new)

---

## 🎯 What is AxioCNC?

AxioCNC is a web-based interface for CNC controllers that prioritizes **stability and predictability** during long cutting jobs. Built on the proven cncjs server foundation, it brings a modern interface and workflow improvements designed to prevent costly mistakes and crashes.

**Perfect for:**
- Hobbyists running CNC mills and routers
- Small shops needing reliable G-code execution
- Anyone who's crashed a machine by hitting the wrong button on a touchscreen

### Why AxioCNC?

- ✅ **Stability-first design** - Predictable behavior during long jobs
- ✅ **Prevents costly mistakes** - Spaced controls to avoid accidental taps
- ✅ **Network accessible** - Control from any device on your network
- ✅ **Modern, themeable UI** - Light and dark modes for comfortable sessions
- ✅ **Native joystick support** - Smooth analog jogging with any USB gamepad
- ✅ **Human-readable tool library** - See "1/4 inch flat endmill" instead of "T4"

---

## 📸 Screenshots

> **Note:** Screenshots coming soon. [Visit our website](https://axiocnc.com) to see the interface in action.

---

## ✨ Features

### Core Functionality

- **Multiple Controller Support** - Works with Grbl, Marlin, Smoothie, and TinyG/g2core
- **6-Axis Digital Readout** - Real-time position feedback for X, Y, Z, A, B, C axes
- **3D Toolpath Visualization** - See your job before you run it with interactive 3D viewer
- **G-code File Management** - Upload, load, visualize, and execute G-code files
- **Real-time Machine Status** - Monitor position, state, and workflow status
- **Console Terminal** - Direct command interface with full history

### Workflow Improvements

- **Task-Oriented Interface** - Different views optimized for setup, cutting, and review
- **Spaced Control Layout** - XY jog pad and Z controls are separated to prevent accidental clicks
- **Analog Joystick Jogging** - Continuous smooth movement with USB gamepads/joysticks
- **Tool Library** - Human-readable tool names, diameters, and descriptions
- **Probe Strategies** - Built-in support for touch plates and edge finders
- **Watch Directory** - Automatically detect new G-code files in a folder

### Modern Interface

- **Light & Dark Themes** - Choose what's comfortable for your shop environment
- **Customizable Accent Colors** - Personalize the interface (Orange, Blue, Green, Purple, Red, Zinc)
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **Auto-save Settings** - Changes save automatically with visual feedback

### Network & Access

- **Web-Based Interface** - Access from any device with a browser
- **Network Accessible** - Design on your computer, run from your tablet, monitor from your office
- **Single Server Setup** - Install once, access from anywhere on your network
- **Multiple Simultaneous Connections** - Several users can monitor the same machine

### Safety & Reliability

- **Built on Proven Foundation** - Based on cncjs server architecture known for stability
- **Error Handling** - Configurable "continue on error" behavior for production runs
- **Feed Hold & Resume** - Pause and resume jobs safely
- **Emergency Stop** - Immediate machine stop with reset capability

---

## 🚀 Quick Start

### Installation

AxioCNC is available as installers for Linux, Windows, and Raspberry Pi. **The easiest way to get started is to [download from our website](https://axiocnc.com#download).**

#### Linux (x64)

```bash
# Download the .deb package from GitHub Releases or our website
wget https://github.com/rsteckler/AxioCNC/releases/latest/download/axiocnc_*.deb

# Install
sudo dpkg -i axiocnc_*.deb
sudo apt-get install -f  # if dependencies are missing

# Run
axiocnc
```

#### Windows

1. Download the installer from [GitHub Releases](https://github.com/rsteckler/AxioCNC/releases) or [our website](https://axiocnc.com#download)
2. Double-click `axiocnc Setup *.exe`
3. Follow the installation wizard
4. Launch AxioCNC from the Start Menu

#### Raspberry Pi

```bash
# Download the appropriate package for your Pi model
# Raspberry Pi 3/4 (ARM32):
wget https://github.com/rsteckler/AxioCNC/releases/latest/download/axiocnc_*_armv7l.deb

# Raspberry Pi 5 (ARM64):
wget https://github.com/rsteckler/AxioCNC/releases/latest/download/axiocnc_*_arm64.deb

# Install
sudo dpkg -i axiocnc_*.deb
sudo apt-get install -f

# Add user to dialout group for serial access (log out/in after)
sudo usermod -a -G dialout $USER

# Run
axiocnc
```

> **💡 Tip:** For headless Raspberry Pi installations, see our [Server Installation Guide](docs/installation/rpi-server.md)

### First Run

1. **Start AxioCNC** - The application will open a browser window at `http://localhost:8000`
2. **Connect to Your Machine** - Go to the Setup screen and configure:
   - Serial port (e.g., `/dev/ttyUSB0` on Linux, `COM3` on Windows)
   - Baud rate (typically `115200` for Grbl)
   - Controller type (Grbl, Marlin, Smoothie, or TinyG)
3. **Click Connect** - Your machine status will appear when connected
4. **Upload G-code** - Use the file picker or drag-and-drop a `.nc` or `.gcode` file
5. **Visualize & Run** - Review the toolpath in the 3D viewer, then start your job

### Serial Port Access (Linux/Raspberry Pi)

After installation, you may need to add your user to the `dialout` group:

```bash
sudo usermod -a -G dialout $USER
```

**Important:** Log out and back in (or reboot) for this change to take effect.

Verify access:
```bash
groups $USER  # Should show "dialout" in the list
ls -l /dev/ttyUSB* /dev/ttyACM*  # Check available serial ports
```

---

## 📖 Usage

### Basic Workflow

1. **Design** - Create G-code with your CAM software (Fusion 360, Carbide Create, etc.)
2. **Upload** - Drag and drop your G-code file into AxioCNC or use the file picker
3. **Visualize** - Review the toolpath in the 3D viewer to verify it looks correct
4. **Setup** - Use jog controls to position your workpiece, then set your work zero
5. **Run** - Start the job and monitor progress in real-time
6. **Monitor** - Watch the machine status, position updates, and progress from any device

### Key Controls

- **Jog Controls** - Move machine in X, Y, Z with discrete steps or analog joystick
- **Home All** - Return machine to home position (if supported by firmware)
- **Feed Hold** - Pause job execution (press Resume to continue)
- **Stop** - Abort current job (with confirmation)
- **Set Zero** - Set current position as work coordinate origin
- **Go to Zero** - Rapid move to work coordinate zero position

### Joystick Support

Plug in any USB gamepad or joystick:
1. Go to **Settings** → **Joystick**
2. Configure button mappings and analog stick sensitivity
3. Use the joystick for smooth, continuous jogging in the Setup screen

### Tool Library

Manage your tools with human-readable names:
1. Go to **Settings** → **Machine** (tool library coming in future release)
2. Add tools with names like "1/4 inch flat endmill" instead of just "T4"
3. See tool diameter, type, and description at a glance

---

## 🆘 Getting Help

### Having Issues?

- **🐛 Found a Bug?** - [Open an issue on GitHub](https://github.com/rsteckler/AxioCNC/issues/new/choose)
  - Include: Your operating system, AxioCNC version, controller type, and steps to reproduce
  - Check [existing issues](https://github.com/rsteckler/AxioCNC/issues) first to see if it's already reported

- **💬 Have a Question?** - [Start a discussion](https://github.com/rsteckler/AxioCNC/discussions/new)
  - Use the **Q&A** category for usage questions
  - Use **Ideas** for feature suggestions
  - Use **General** for other topics

- **📚 Need Documentation?** - [Visit our documentation site](https://axiocnc.com/docs)
  - Installation guides
  - API reference
  - Troubleshooting tips

- **🌐 Prefer the Website?** - [axiocnc.com](https://axiocnc.com) has the same information in a more polished format

### Common Questions

**Q: Will this work with my CNC controller?**  
A: AxioCNC supports Grbl, Marlin, Smoothie, and TinyG/g2core. If your controller runs one of these firmwares, it will work.

**Q: Can I use this on a Raspberry Pi?**  
A: Yes! We provide ARM32 and ARM64 installers specifically for Raspberry Pi. See the [Raspberry Pi Installation Guide](docs/installation/rpi.md).

**Q: Does it work without an internet connection?**  
A: Yes, once installed, AxioCNC runs entirely on your local network. No internet connection required for normal operation.

**Q: Can multiple people access the same machine?**  
A: Yes, multiple devices can connect to the same AxioCNC server simultaneously. All devices see the same machine status.

**Q: Is my G-code file compatible?**  
A: AxioCNC accepts standard G-code files (`.nc`, `.gcode`, `.cnc`). It works with output from Fusion 360, Carbide Create, VCarve, and most other CAM software.

---

## 🔗 Additional Resources

- **[🌐 Official Website](https://axiocnc.com)** - Best starting point for new users
- **[📖 Documentation](https://axiocnc.com/docs)** - Complete guides and API reference
- **[💬 GitHub Discussions](https://github.com/rsteckler/AxioCNC/discussions)** - Community Q&A and ideas
- **[🐛 Issue Tracker](https://github.com/rsteckler/AxioCNC/issues)** - Report bugs and request features
- **[📋 Changelog](CHANGELOG.md)** - Version history and release notes

---

**Ready to get started?** [Download AxioCNC](https://axiocnc.com#download) or [visit our website](https://axiocnc.com) for more information.

---

## 🏗️ For Developers & Contributors

> **Note:** The sections below are for developers and contributors. End users can find everything they need above.

### Build Status

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub Release](https://img.shields.io/badge/Release-v1.10.15-blue)](https://github.com/rsteckler/AxioCNC/releases)

Build status and test coverage information will be added here as CI/CD is configured.

### Contributing

We welcome contributions! Before you get started:

1. **Read our [Contributing Guide](devdocs/contributing.md)** - Learn about our workflow, code style, and protected code areas
2. **See [Development Setup](devdocs/development.md)** - How to set up a local development environment
3. **Check [Protected Code](devdocs/protected-code.md)** - Some areas require explicit permission before modification
4. **Review [Development Preferences](devdocs/dev_prefs.md)** - UI patterns and architectural decisions
5. **See [Testing Guide](devdocs/testing.md)** - How we test and maintain code quality

**Quick Development Setup:**

```bash
# Clone the repository
git clone https://github.com/rsteckler/AxioCNC.git
cd AxioCNC

# Install dependencies
yarn install

# Start development servers (requires two terminals)
# Terminal 1: Backend
yarn start-server-dev

# Terminal 2: Frontend
cd src/app && yarn dev
```

For more details, see [Development Guide](devdocs/development.md), [Contributing Guide](devdocs/contributing.md), and the [Developer Documentation](../aidocs/overview.md).

---

## 🙏 Acknowledgments

AxioCNC is built on the solid foundation of [cncjs](https://github.com/cncjs/cncjs). We're grateful to everyone who contributed to that project and helped make reliable CNC control software available to the community.

**Special thanks to:**
- The cncjs project and its contributors
- The CNC community for feedback and testing
- Everyone who reports issues and suggests improvements

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

Copyright (c) 2015-2017 Cheton Wu (cncjs foundation)  
Copyright (c) 2024 AxioCNC Contributors
