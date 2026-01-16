/**
 * Gamepad Service
 *
 * Provides server-side gamepad detection and input reading using the Linux
 * joystick API (/dev/input/js*). Zero native dependencies required.
 *
 * Linux Joystick Event Structure (8 bytes):
 *   - time:   uint32 (ms timestamp)
 *   - value:  int16  (-32767 to 32767 for axes, 0/1 for buttons)
 *   - type:   uint8  (0x01=button, 0x02=axis, 0x80=init flag)
 *   - number: uint8  (which button/axis)
 */

import fs from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import logger from '../../lib/logger';

const log = logger('service:gamepad');

const JS_EVENT_BUTTON = 0x01;
const JS_EVENT_AXIS = 0x02;
const JS_EVENT_INIT = 0x80;

const JOYSTICK_DEV_PATH = '/dev/input';

/**
 * Check if we're running on Linux
 */
function isLinux() {
  return process.platform === 'linux';
}

/**
 * Scan for joystick devices in /dev/input/
 */
function scanJoystickDevices() {
  if (!isLinux()) {
    return [];
  }

  try {
    // Check if /dev/input exists
    if (!fs.existsSync(JOYSTICK_DEV_PATH)) {
      return [];
    }

    let files;
    try {
      files = fs.readdirSync(JOYSTICK_DEV_PATH);
    } catch (err) {
      log.error(`Failed to read ${JOYSTICK_DEV_PATH}: ${err.message}`);
      if (err.code === 'EACCES') {
        log.error('Permission denied. Try running with sudo or add user to input group.');
      }
      return [];
    }

    const jsFiles = files.filter(f => f.startsWith('js') && f.match(/^js\d+$/));

    const joysticks = jsFiles
      .map(f => {
        const devicePath = path.join(JOYSTICK_DEV_PATH, f);
        const index = parseInt(f.replace('js', ''), 10);

        if (Number.isNaN(index)) {
          return null;
        }

        // Try to get device name from /sys
        let name = `Joystick ${index}`;
        try {
          const sysPaths = [
            `/sys/class/input/${f}/device/name`,
            `/sys/class/input/${f}/name`,
          ];

          for (const sysPath of sysPaths) {
            if (fs.existsSync(sysPath)) {
              name = fs.readFileSync(sysPath, 'utf8').trim();
              break;
            }
          }
        } catch (err) {
          // Ignore - use default name
        }

        return {
          id: devicePath,
          path: devicePath,
          index,
          name,
          axes: 4, // Default - most joysticks have 4 axes
          buttons: 16, // Default
        };
      })
      .filter(gp => gp !== null) // Filter out null entries
      .sort((a, b) => a.index - b.index);

    return joysticks;
  } catch (err) {
    log.error(`Error scanning for joysticks: ${err.message}`);
    return [];
  }
}

class GamepadService extends EventEmitter {
  constructor() {
    super();
    this.gamepads = [];
    this.selectedGamepadId = null;
    this.selectedGamepadName = null; // Store name for button mapping
    this.fd = null;
    this.readStream = null;
    this.reading = false; // Flag to stop reading loop
    this.io = null; // Socket.IO instance for emitting events
    this.state = {
      axes: [0, 0, 0, 0, 0, 0, 0, 0], // Support up to 8 axes
      buttons: Array(16).fill(false), // Raw Linux button numbers
      timestamp: 0,
    };
    this._isSupported = isLinux();

    // Listen to state changes and emit via Socket.IO
    this.on('state', (state) => {
      if (this.io && this.selectedGamepadId) {
        const payload = {
          gamepadId: this.selectedGamepadId,
          connected: !!this.fd,
          axes: state.axes.slice(0, 8), // Send first 8 axes (includes LT/RT on 4/5 and D-pad on 6/7)
          buttons: state.buttons, // Send raw button numbers (no mapping)
          timestamp: state.timestamp,
        };
        this.io.emit('gamepad:state', payload);
      }
    });
  }

  /**
   * Set Socket.IO instance for emitting events
   */
  setIO(io) {
    this.io = io;
  }

  /**
   * Check if server-side gamepad is supported on this platform
   */
  get isSupported() {
    return this._isSupported;
  }

  /**
   * Scan for connected gamepads
   */
  refresh() {
    if (!this._isSupported) {
      log.warn('Server-side gamepad not supported on this platform (Linux only)');
      this.gamepads = [];
      return this.gamepads;
    }

    try {
      this.gamepads = scanJoystickDevices();
    } catch (err) {
      log.error(`Error in refresh(): ${err.message}`);
      log.error(err.stack);
      this.gamepads = [];
    }

    // If selected gamepad is no longer connected, clear selection
    if (this.selectedGamepadId) {
      const stillConnected = this.gamepads.some(gp => gp.id === this.selectedGamepadId);
      if (!stillConnected) {
        log.warn(`Selected joystick ${this.selectedGamepadId} disconnected`);
        this.setSelected(null);
      }
    }

    return this.gamepads;
  }

  /**
   * Get list of connected gamepads
   */
  list() {
    return this.gamepads;
  }

  /**
   * Get currently selected gamepad ID
   */
  getSelected() {
    return this.selectedGamepadId;
  }

  /**
   * Set the selected gamepad
   */
  setSelected(gamepadId) {
    // Close existing connection
    this.closeDevice();

    this.selectedGamepadId = gamepadId;
    this.selectedGamepadName = null;

    // Reset state
    this.state = {
      axes: [0, 0, 0, 0, 0, 0, 0, 0],
      buttons: Array(16).fill(false),
      timestamp: 0,
    };

    if (!gamepadId) {
      return true;
    }

    // Find the gamepad
    const gamepad = this.gamepads.find(gp => gp.id === gamepadId);
    if (!gamepad) {
      log.error(`Joystick not found: ${gamepadId}`);
      this.selectedGamepadId = null;
      this.selectedGamepadName = null;
      return false;
    }

    // Store gamepad name for button mapping
    this.selectedGamepadName = gamepad.name;

    // Open the device using fs.open for character devices
    try {
      // Check if device exists and is readable
      fs.accessSync(gamepad.path, fs.constants.R_OK);

      // Open file descriptor for character device
      this.fd = fs.openSync(gamepad.path, 'r');

      // Set up recursive read loop
      this.readLoop();

      return true;
    } catch (err) {
      log.error(`Failed to open joystick: ${err.message}`);
      if (err.code === 'EACCES') {
        log.error('Permission denied. Add user to "input" group: sudo usermod -aG input $USER');
      }
      this.selectedGamepadId = null;
      this.selectedGamepadName = null;
      return false;
    }
  }

  /**
   * Read loop for joystick events (using async fs.read)
   * fs.read uses Node.js's thread pool, so it won't block the event loop
   */
  readLoop() {
    if (this.reading || !this.fd) {
      return;
    }

    this.reading = true;

    // Use a new buffer for each read to avoid data corruption
    const readNext = () => {
      if (!this.reading || !this.fd) {
        return;
      }

      const buffer = Buffer.alloc(8); // One joystick event = 8 bytes

      // Use async fs.read - it uses libuv's thread pool and won't block the event loop
      fs.read(this.fd, buffer, 0, 8, null, (err, bytesRead) => {
        if (!this.reading) {
          return; // Stopped reading
        }

        if (err) {
          if (err.code === 'ENODEV' || err.code === 'EBADF' || err.code === 'ENXIO') {
            log.warn('Joystick disconnected');
            this.closeDevice();
            this.selectedGamepadId = null;
            this.selectedGamepadName = null;
            return;
          }
          // For other errors, try to continue after a short delay
          setTimeout(readNext, 100);
          return;
        }

        if (bytesRead === 8) {
          this.parseEvent(buffer);
        }

        // Continue reading (async callback handles next read)
        readNext();
      });
    };

    // Start reading
    readNext();
  }

  /**
   * Close the current device
   */
  closeDevice() {
    this.reading = false;

    if (this.readStream) {
      try {
        this.readStream.destroy();
      } catch (err) {
        // Ignore
      }
      this.readStream = null;
    }

    if (this.fd !== null) {
      try {
        fs.closeSync(this.fd);
      } catch (err) {
        // Ignore
      }
      this.fd = null;
    }
  }

  /**
   * Parse a Linux joystick event
   * Event structure: time(4) + value(2) + type(1) + number(1) = 8 bytes
   */
  parseEvent(data) {
    if (data.length < 8) {
      return;
    }

    // Parse multiple events if buffer contains more than one
    for (let offset = 0; offset + 8 <= data.length; offset += 8) {
      // time is read but not used - keeping for potential future use
      // const time = data.readUInt32LE(offset);
      const value = data.readInt16LE(offset + 4);
      const type = data.readUInt8(offset + 6);
      const number = data.readUInt8(offset + 7);

      // Strip init flag
      // eslint-disable-next-line no-bitwise
      const eventType = type & ~JS_EVENT_INIT;

      if (eventType === JS_EVENT_AXIS) {
        // Normalize axis value from -32767..32767 to -1..1
        if (number < this.state.axes.length) {
          this.state.axes[number] = value / 32767;
          // Only log axis 6/7 (D-pad hat switch) and axis 4/5 (triggers) to reduce noise
          if ((number >= 4 && number <= 7) && Math.abs(value) > 5000) {
            log.info(`Axis ${number} value: ${value} (normalized: ${(value / 32767).toFixed(3)})`);
          }
        }
      } else if (eventType === JS_EVENT_BUTTON) {
        if (number < this.state.buttons.length) {
          const pressed = value === 1;
          const wasPressed = this.state.buttons[number];
          this.state.buttons[number] = pressed;
          if (pressed) {
            log.info(`Button ${number} pressed (value=${value})`);
          } else if (wasPressed) {
            log.info(`Button ${number} released (value=${value})`);
          }
        } else {
          log.warn(`Button ${number} out of range (max=${this.state.buttons.length - 1})`);
        }
      }

      this.state.timestamp = Date.now();
    }

    this.emit('state', this.state);
  }

  /**
   * Get current gamepad state
   */
  getState() {
    if (!this.selectedGamepadId) {
      return null;
    }

    return {
      gamepadId: this.selectedGamepadId,
      connected: !!this.fd,
      axes: this.state.axes.slice(0, 8), // Return first 8 axes (includes LT/RT on 4/5 and D-pad on 6/7)
      buttons: this.state.buttons, // Return raw button numbers (no mapping)
      timestamp: this.state.timestamp,
    };
  }

  /**
   * Get platform support info
   */
  getPlatformInfo() {
    return {
      supported: this._isSupported,
      platform: process.platform,
      message: this._isSupported
        ? 'Server-side gamepad supported'
        : 'Server-side gamepad requires Linux. Use browser-side gamepad instead.',
    };
  }

  /**
   * Shutdown the service
   */
  shutdown() {
    this.closeDevice();
    this.selectedGamepadId = null;
    this.selectedGamepadName = null;
    this.gamepads = [];
  }
}

// Singleton instance
const gamepadService = new GamepadService();

export default gamepadService;
