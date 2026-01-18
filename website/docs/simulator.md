# Grbl Simulator Setup and Usage

This document describes how to set up and use the grbl-sim simulator for testing CNC functionality.

## Prerequisites

- **socat** - Required for creating virtual serial ports
  - Ubuntu/Debian: `sudo apt-get install socat`
  - RHEL/CentOS: `sudo yum install socat`
  - macOS: `brew install socat`

## Setup Steps

### 1. Clone the repositories

Clone the `grbl` and `grbl-sim` repositories into the build directory:

```bash
yarn grblsim:clone
```

This creates:
- `examples/grbl-sim-build/grbl/` - grbl source code
- `examples/grbl-sim-build/grbl/grbl-sim/` - grbl-sim simulator code

### 2. Apply build fixes

Apply necessary patches to make grbl-sim compatible with the current grbl version:

```bash
yarn grblsim:fixup
```

This script:
- Updates include paths for the nested grbl source structure
- Adds limit switch simulation for homing support
- Fixes compatibility issues with newer grbl versions
- Creates backups of modified files (`.bak` files)

The fixup script is idempotent - you can run it multiple times safely.

### 3. Build the simulator

Build the grbl-sim executable:

```bash
yarn grblsim:build
```

This will:
- Detect your platform (Linux/macOS/Windows)
- Configure the Makefile for your platform
- Compile the simulator executable (`grbl_sim.exe`)

### 4. Run the simulator

Start the simulator with a virtual serial port:

```bash
yarn grblsim:run
```

This will:
- Create a virtual serial port at `/dev/ttyFAKE`
- Start the grbl-sim executable
- Begin logging to `examples/grbl-sim-build/grbl/grbl-sim/logs/grbl-console.log`
- Tail the log file (press Ctrl+C to stop)

The simulator will be accessible via `/dev/ttyFAKE` as a serial device.

## First-Time Setup

After connecting to the simulator for the first time, you **must**:

1. **Enable homing** by sending:
   ```
   $22=1
   ```
   This enables the homing cycle feature in Grbl.

2. **Connect to the virtual serial port**:
   - Use the serial port: `/dev/ttyFAKE`
   - Or use the port name shown in your serial port list as `ttyFAKE`

## Connecting to the Simulator

The simulator creates a virtual serial port that you can connect to from:
- The AxioCNC frontend (Add machine → Serial port → `/dev/ttyFAKE`)
- Command line tools (e.g., `screen /dev/ttyFAKE`, `minicom /dev/ttyFAKE`)
- Any serial terminal application

## Common Commands

### Clean build artifacts

Remove compiled files but keep the cloned repositories:

```bash
yarn grblsim:clean
```

### Full cleanup

Remove the entire build directory (cloned repositories and all files):

```bash
yarn grblsim:clean:all
```

### Stop the simulator

Stop all running simulator processes:

```bash
yarn grblsim:kill
```

## Workflow

Typical workflow for testing:

```bash
# 1. Setup (first time only, or after clean:all)
yarn grblsim:clone
yarn grblsim:fixup
yarn grblsim:build

# 2. Run simulator
yarn grblsim:run

# 3. In another terminal or the AxioCNC UI:
#    - Connect to /dev/ttyFAKE
#    - Send: $22=1 (enable homing)
#    - Test your CNC commands

# 4. When done
yarn grblsim:kill
```

## Homing Support

The simulator includes limit switch simulation that allows the `$H` (home) command to work. The simulator:
- Simulates limit switches based on machine position during homing
- Triggers limit switches when the machine moves 0.5mm in the homing direction
- Allows grbl's normal homing cycle to complete quickly

**Important**: Make sure `$22=1` is set before attempting to home, or you'll get "error: Setting disabled".

## Troubleshooting

### Permission denied on /dev/ttyFAKE

The script should set permissions automatically, but if you get permission errors:

```bash
sudo chmod a+rw /dev/ttyFAKE
```

### Simulator won't start

- Check that `socat` is installed: `which socat`
- Check if port is already in use: `ls -l /dev/ttyFAKE`
- Stop any existing simulator: `yarn grblsim:kill`

### Build fails

- Ensure you've run `yarn grblsim:clone` first
- Try `yarn grblsim:clean:all` and start over
- Check that the fixup script ran successfully: `yarn grblsim:fixup`

### Homing doesn't work

- Verify `$22=1` is set (check settings with `$$`)
- Check the log file for errors: `tail -f examples/grbl-sim-build/grbl/grbl-sim/logs/grbl-console.log`

## Files and Directories

- **Build directory**: `examples/grbl-sim-build/`
- **Executable**: `examples/grbl-sim-build/grbl/grbl-sim/grbl_sim.exe`
- **Log file**: `examples/grbl-sim-build/grbl/grbl-sim/logs/grbl-console.log`
- **Virtual serial port**: `/dev/ttyFAKE`
- **Scripts**: `scripts/grblsim/`

## Additional Notes

- The simulator supports all standard Grbl commands
- G-code files can be loaded and executed normally
- Position updates and status reports work as expected
- The simulator does not simulate physical movement - only the command processing and state management
