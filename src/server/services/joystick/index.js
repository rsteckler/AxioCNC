/**
 * Joystick Orchestration Service (Backend)
 *
 * Main service that orchestrates all joystick inputs:
 * - Server gamepad (direct access via gamepad service)
 * - Client gamepad (via Socket.IO events from clients)
 * - Client jog controls (via Socket.IO events from clients)
 *
 * Reads inputs from all sources, maps them using JoystickMapper,
 * and routes mapped actions to handlers (jog loop, button handlers, etc.)
 */

const events = require('events');
const logger = require('../../lib/logger').default;
const JoystickMapper = require('./mapper');

const log = logger('service:joystick');

class JoystickService extends events.EventEmitter {
  constructor() {
    super();
    this.config = null;
    this.mapper = null;
    this.io = null;
    this.gamepadService = null;

    // State tracking
    this.enabled = false;
    this.clientGamepadInputs = new Map(); // socketId -> { axes, buttons, timestamp }
    this.clientJogControlInputs = new Map(); // socketId -> { x, y, z, timestamp }

    // Server gamepad listener
    this.serverGamepadListener = null;
  }

  /**
   * Initialize the service
   */
  initialize(io, gamepadService, config) {
    this.io = io;
    this.gamepadService = gamepadService;

    // Get initial config from settings
    if (config) {
      const joystickConfig = config.get('settings.joystick', {});
      this.updateConfig(joystickConfig);

      // Listen for config changes
      config.on('change', () => {
        const updatedConfig = config.get('settings.joystick', {});
        this.updateConfig(updatedConfig);
      });
    }

    // Listen to server gamepad state changes
    if (this.gamepadService) {
      this.serverGamepadListener = (state) => {
        if (!this.enabled || !this.config || !this.mapper) {
          return;
        }

        // Only process if connectionLocation is 'server'
        if (this.config.connectionLocation !== 'server') {
          return;
        }

        // Only process if this is the selected gamepad
        if (this.gamepadService.getSelected() !== this.config.selectedGamepad) {
          return;
        }

        // Log input from server gamepad
        const pressedButtons = state.buttons.map((b, i) => (b ? i : null)).filter(i => i !== null);
        log.debug(`[server-gamepad] axes: [${state.axes.map(a => a.toFixed(3)).join(', ')}], buttons: [${pressedButtons.join(', ')}]`);

        // Map to actions
        const actions = this.mapper.mapGamepad(state.axes, state.buttons);

        // Route to handlers (emit event for translation layer)
        if (actions.length > 0) {
          // Log actions that will be dispatched
          const actionStrings = actions.map(action => {
            if (action.type === 'analog') {
              return `analog(x=${action.x.toFixed(3)}, y=${action.y.toFixed(3)}, z=${action.z.toFixed(3)})`;
            } else if (action.type === 'button') {
              return `button(${action.buttonId}=${action.action}, pressed=${action.pressed})`;
            }
            return JSON.stringify(action);
          });
          log.debug(`[server-gamepad] mapped to ${actions.length} action(s): ${actionStrings.join(', ')}`);
          this.emit('actions', actions, 'server-gamepad');
        }
      };

      this.gamepadService.on('state', this.serverGamepadListener);
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = config || {};

    if (!this.mapper && this.config && Object.keys(this.config).length > 0) {
      this.mapper = new JoystickMapper(this.config);
    } else if (this.mapper && this.config && Object.keys(this.config).length > 0) {
      this.mapper.updateConfig(this.config);
    }

    this.enabled = this.config?.enabled ?? false;

    // If disabled, clear all inputs
    if (!this.enabled) {
      this.clientGamepadInputs.clear();
      this.clientJogControlInputs.clear();
    }
  }

  /**
   * Handle client gamepad input
   * Called from Socket.IO event handler
   */
  handleClientGamepadInput(socketId, axes, buttons, timestamp) {
    if (!this.enabled || !this.config || !this.mapper) {
      return;
    }

    // Only process if connectionLocation is 'client'
    if (this.config.connectionLocation !== 'client') {
      return;
    }

    // Store input from this client
    this.clientGamepadInputs.set(socketId, {
      axes: axes || [],
      buttons: buttons || [],
      timestamp: timestamp || Date.now(),
    });

    // Map to actions (use latest input from this client)
    const actions = this.mapper.mapGamepad(axes || [], buttons || []);

    // Route to handlers
    if (actions.length > 0) {
      log.debug(`[client-gamepad:${socketId}] mapped to ${actions.length} action(s)`);
      this.emit('actions', actions, `client-gamepad-${socketId}`);
    }
  }

  /**
   * Handle client jog control input
   * Called from Socket.IO event handler
   */
  handleClientJogControlInput(socketId, x, y, z, timestamp) {
    if (!this.enabled || !this.config || !this.mapper) {
      return;
    }

    // Jog controls work for both server and client gamepads (browser controls)
    // They're always from the client (mouse/touch)

    // Log input from client jog controls
    log.debug(`[client-jog:${socketId}] x: ${(x || 0).toFixed(3)}, y: ${(y || 0).toFixed(3)}, z: ${(z || 0).toFixed(3)}`);

    // Store input from this client
    this.clientJogControlInputs.set(socketId, {
      x: x || 0,
      y: y || 0,
      z: z || 0,
      timestamp: timestamp || Date.now(),
    });

    // Map to actions
    const action = this.mapper.mapJogControl(x || 0, y || 0, z || 0);

    // Route to handlers
    if (action) {
      log.debug(`[client-jog:${socketId}] mapped to action: analog(x=${action.x.toFixed(3)}, y=${action.y.toFixed(3)}, z=${action.z.toFixed(3)})`);
      this.emit('actions', [action], `client-jog-${socketId}`);
    }
  }

  /**
   * Remove client inputs when client disconnects
   */
  removeClient(socketId) {
    this.clientGamepadInputs.delete(socketId);
    this.clientJogControlInputs.delete(socketId);
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.gamepadService && this.serverGamepadListener) {
      this.gamepadService.off('state', this.serverGamepadListener);
      this.serverGamepadListener = null;
    }

    this.config = null;
    this.mapper = null;
    this.io = null;
    this.gamepadService = null;
    this.enabled = false;
    this.clientGamepadInputs.clear();
    this.clientJogControlInputs.clear();
  }
}

// Singleton instance
const joystickService = new JoystickService();

module.exports = joystickService;
