/**
 * JogLoop Service
 *
 * Implements continuous analog jogging for Grbl using the methodology from:
 * https://github.com/gnea/grbl/wiki/Grbl-v1.1-Jogging
 *
 * Key concepts:
 * - Send short incremental distance jog commands ($J=G91 G21 X... Y... Z... F...)
 * - Keep Grbl's planner buffer partially filled (target ~3-5 commands in queue)
 * - Track 'ok' responses to know when commands complete
 * - Send jog cancel (0x85) when input returns to neutral
 * - Use G4P0 after cancel for synchronization
 *
 * State machine:
 * - idle: No jogging, waiting for input
 * - jogging: Actively sending jog commands
 * - cancelling: Sent cancel, waiting for confirmation
 */

const events = require('events');
const logger = require('../../lib/logger').default;
const store = require('../../store').default;

const log = logger('service:joystick:jogloop');

// Configuration constants
const PLANNER_BLOCKS = 15; // Grbl planner buffer size
const TARGET_QUEUE_DEPTH = 3; // Target commands in queue (3 provides smooth motion with minimal latency)
const MIN_DT_MS = 25; // Minimum time interval (ms)
const MAX_DT_MS = 60; // Maximum time interval (ms) - matches Grbl docs recommendation (0.025-0.06 sec)
const DEFAULT_ACCELERATION = 500; // Default acceleration (mm/sec²) if not available from controller
const CANCEL_TIMEOUT_MS = 1000; // Timeout waiting for cancel confirmation
const INPUT_NEUTRAL_THRESHOLD = 0.01; // Threshold for considering input as neutral

// Jog loop states
const STATE_IDLE = 'idle';
const STATE_JOGGING = 'jogging';
const STATE_CANCELLING = 'cancelling';

class JogLoop extends events.EventEmitter {
  constructor() {
    super();

    // State
    this.state = STATE_IDLE;
    this.enabled = true; // Jog loop is always enabled - accepts input from browser controls

    // Configuration
    this.config = {
      analogJogSpeedXY: 3000, // mm/min
      analogJogSpeedZ: 1000, // mm/min
      acceleration: DEFAULT_ACCELERATION, // mm/sec²
    };

    // Current input values (normalized -1 to 1)
    this.currentInput = { x: 0, y: 0, z: 0 };

    // Command queue tracking
    this.commandsInQueue = 0;
    this.lastCommandTime = 0;

    // Controller reference
    this.controller = null;
    this.controllerPort = null;

    // Response listeners
    this.okListener = null;
    this.errorListener = null;

    // Timers
    this.jogTimer = null;
    this.cancelTimer = null;

    // Sync state
    this.waitingForSync = false;
  }

  /**
   * Initialize the jog loop with configuration
   */
  initialize(config) {
    if (config) {
      this.updateConfig(config);
    }
  }

  /**
   * Update configuration
   * 
   * Note: The jog loop always accepts input from browser jog controls,
   * regardless of joystick.enabled setting. The enabled flag only controls
   * whether gamepad hardware input is processed.
   */
  updateConfig(config) {
    if (config.analogJogSpeedXY !== undefined && Number.isFinite(config.analogJogSpeedXY)) {
      this.config.analogJogSpeedXY = config.analogJogSpeedXY;
    }
    if (config.analogJogSpeedZ !== undefined && Number.isFinite(config.analogJogSpeedZ)) {
      this.config.analogJogSpeedZ = config.analogJogSpeedZ;
    }

    // Jog loop is always enabled - it processes input from browser controls
    // regardless of joystick hardware support being enabled/disabled
    this.enabled = true;

    log.debug(`Config updated: speedXY=${this.config.analogJogSpeedXY}, speedZ=${this.config.analogJogSpeedZ}`);
  }

  /**
   * Get the first connected controller
   */
  getController() {
    const controllers = store.get('controllers', {});
    const ports = Object.keys(controllers);

    for (const port of ports) {
      const controller = store.get(`controllers["${port}"]`);
      if (controller && controller.isOpen && controller.isOpen()) {
        return { controller, port };
      }
    }

    return null;
  }

  /**
   * Check if controller is in a valid state for jogging
   * Valid states: Idle, Jog
   */
  canJog() {
    if (!this.controller) {
      return false;
    }

    const activeState = this.controller.state?.status?.activeState || '';
    return activeState === 'Idle' || activeState === 'Jog';
  }

  /**
   * Get the current controller state for debugging
   */
  getControllerState() {
    if (!this.controller) {
      return 'no controller';
    }

    const activeState = this.controller.state?.status?.activeState || 'unknown';
    return activeState;
  }

  /**
   * Get acceleration from controller settings or use default
   */
  getAcceleration() {
    if (!this.controller?.runner?.settings?.settings) {
      return DEFAULT_ACCELERATION;
    }

    const settings = this.controller.runner.settings.settings;
    // Use minimum of X, Y, Z accelerations for safety
    const accX = parseFloat(settings.$120) || DEFAULT_ACCELERATION;
    const accY = parseFloat(settings.$121) || DEFAULT_ACCELERATION;
    const accZ = parseFloat(settings.$122) || DEFAULT_ACCELERATION;

    return Math.min(accX, accY, accZ);
  }

  /**
   * Calculate optimal time interval (dt) for given velocity
   * Formula: dt > v² / (2 * a * (N-1))
   *
   * @param {number} velocity - Current velocity in mm/sec
   * @returns {number} Time interval in milliseconds
   */
  calculateDt(velocity) {
    const a = this.getAcceleration();
    const N = PLANNER_BLOCKS;

    // dt > v² / (2 * a * (N-1))
    const dtMin = (velocity * velocity) / (2 * a * (N - 1));
    const dtMs = dtMin * 1000;

    // Clamp to reasonable bounds
    return Math.max(MIN_DT_MS, Math.min(MAX_DT_MS, dtMs));
  }

  /**
   * Calculate jog command parameters from input
   *
   * @param {object} input - Normalized input { x, y, z } from -1 to 1
   * @returns {object} Command parameters { dx, dy, dz, feedrate, dt }
   */
  calculateJogParams(input) {
    // Validate input values
    const x = Number.isFinite(input.x) ? input.x : 0;
    const y = Number.isFinite(input.y) ? input.y : 0;
    const z = Number.isFinite(input.z) ? input.z : 0;

    // Calculate target velocities (mm/sec)
    const vx = (x * this.config.analogJogSpeedXY) / 60;
    const vy = (y * this.config.analogJogSpeedXY) / 60;
    const vz = (z * this.config.analogJogSpeedZ) / 60;

    // Calculate combined XY velocity for feedrate
    const vxy = Math.sqrt(vx * vx + vy * vy);
    const vTotal = Math.sqrt(vxy * vxy + vz * vz);

    if (vTotal < 0.001) {
      return null; // No movement
    }

    // Calculate dt based on actual vector velocity (not max component)
    // This provides lower latency at slower speeds per Grbl docs
    const dt = this.calculateDt(vTotal);
    const dtSec = dt / 1000;

    // Calculate incremental distances
    const dx = vx * dtSec;
    const dy = vy * dtSec;
    const dz = vz * dtSec;

    // Calculate feedrate (mm/min)
    // For multi-axis, use the combined vector speed
    const feedrate = vTotal * 60;

    // Validate all calculated values
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz) || !Number.isFinite(feedrate)) {
      log.warn(`Invalid jog params calculated: dx=${dx}, dy=${dy}, dz=${dz}, F=${feedrate}`);
      return null;
    }

    return { dx, dy, dz, feedrate, dt };
  }

  /**
   * Format a number for G-code (remove trailing zeros, limit precision)
   */
  formatGcodeNumber(value, maxDecimals = 3) {
    // Round to maxDecimals, then remove trailing zeros
    const rounded = Number(value.toFixed(maxDecimals));
    // Convert to string and remove trailing zeros and decimal point if needed
    return rounded.toString().replace(/\.?0+$/, '');
  }

  /**
   * Build the $J= jog command string
   */
  buildJogCommand(params) {
    const { dx, dy, dz, feedrate } = params;

    // Minimum thresholds to avoid bad number format errors
    const MIN_DISTANCE = 0.001; // 0.001mm minimum movement
    const MIN_FEEDRATE = 1; // 1 mm/min minimum

    // Format: $J=G91 G21 X... Y... Z... F...
    // G91 = incremental mode, G21 = mm units
    let cmd = '$J=G91 G21';
    let hasAxis = false;

    // Only include axes with meaningful movement
    // Format numbers without trailing zeros
    if (Math.abs(dx) >= MIN_DISTANCE) {
      cmd += ` X${this.formatGcodeNumber(dx)}`;
      hasAxis = true;
    }
    if (Math.abs(dy) >= MIN_DISTANCE) {
      cmd += ` Y${this.formatGcodeNumber(dy)}`;
      hasAxis = true;
    }
    if (Math.abs(dz) >= MIN_DISTANCE) {
      cmd += ` Z${this.formatGcodeNumber(dz)}`;
      hasAxis = true;
    }

    // If no axis has meaningful movement, return null
    if (!hasAxis) {
      return null;
    }

    // Ensure minimum feedrate and format as integer
    const safeFeedrate = Math.max(MIN_FEEDRATE, Math.round(feedrate));
    cmd += ` F${safeFeedrate}`;

    return cmd;
  }

  /**
   * Check if input is neutral (below threshold)
   */
  isInputNeutral(input) {
    return Math.abs(input.x) < INPUT_NEUTRAL_THRESHOLD &&
           Math.abs(input.y) < INPUT_NEUTRAL_THRESHOLD &&
           Math.abs(input.z) < INPUT_NEUTRAL_THRESHOLD;
  }

  /**
   * Handle analog input update
   * Called by joystick service when analog input changes
   * 
   * Note: Always accepts input - works independently of joystick.enabled setting.
   * Browser jog controls and gamepad hardware are separate input sources.
   */
  handleAnalogInput(x, y, z) {
    // Ensure we have valid speed configuration
    if (!this.config.analogJogSpeedXY || !this.config.analogJogSpeedZ) {
      log.warn('Jog loop not properly configured - missing speed settings');
      return;
    }

    const input = { x: x || 0, y: y || 0, z: z || 0 };
    this.currentInput = input;

    // Get controller if we don't have one
    if (!this.controller) {
      const result = this.getController();
      if (result) {
        this.attachController(result.controller, result.port);
      }
    }

    // State machine logic
    switch (this.state) {
      case STATE_IDLE:
        if (!this.isInputNeutral(input)) {
          // Start jogging
          this.currentInput = input;
          this.startJogging();
        }
        break;

      case STATE_JOGGING:
        if (this.isInputNeutral(input)) {
          // Input returned to neutral, cancel jog
          this.cancelJog();
        } else {
          // Update input normally - jog loop will use it
          this.currentInput = input;
        }
        break;

      case STATE_CANCELLING:
        // Waiting for cancel confirmation, but store input for when we restart
        // This ensures we don't lose the new direction while cancelling
        if (!this.isInputNeutral(input)) {
          this.currentInput = input;
        }
        break;

      default:
        // Unknown state - log warning but don't crash
        log.warn(`Unknown state in jogloop: ${this.state}`);
        break;
    }
  }

  /**
   * Attach to a controller and set up response listener
   */
  attachController(controller, port) {
    // Detach from previous controller if any
    this.detachController();

    this.controller = controller;
    this.controllerPort = port;

    // Listen for ok/error responses on the runner (which is an EventEmitter)
    if (controller.runner) {
      this.okListener = (res) => {
        this.handleOkResponse();
      };
      this.errorListener = (res) => {
        this.handleErrorResponse(res);
      };

      controller.runner.on('ok', this.okListener);
      controller.runner.on('error', this.errorListener);
    }

    log.debug(`Attached to controller on port ${port}`);
  }

  /**
   * Detach from current controller
   */
  detachController() {
    if (this.controller && this.controller.runner) {
      if (this.okListener) {
        this.controller.runner.off('ok', this.okListener);
      }
      if (this.errorListener) {
        this.controller.runner.off('error', this.errorListener);
      }
    }

    this.controller = null;
    this.controllerPort = null;
    this.okListener = null;
    this.errorListener = null;
  }

  /**
   * Handle 'ok' response from runner
   * Event-driven: immediately check if we need to send another command
   */
  handleOkResponse() {
    // Command completed
    this.commandsInQueue = Math.max(0, this.commandsInQueue - 1);

    if (this.waitingForSync) {
      // G4P0 completed, sync done
      this.waitingForSync = false;
      log.debug('Jog cancel sync complete');
      return;
    }

    // Event-driven: 'ok' received means we can potentially send more
    // Schedule a check (don't call immediately) to respect dt timing intervals
    // This prevents rapid-fire sending and maintains proper buffer
    if (this.state === STATE_JOGGING && this.commandsInQueue < TARGET_QUEUE_DEPTH) {
      // Schedule a check - runJogLoop will respect dt timing
      // Only schedule if timer isn't already set (avoid duplicate timers)
      if (!this.jogTimer) {
        this.jogTimer = setTimeout(() => {
          this.jogTimer = null;
          if (this.state === STATE_JOGGING) {
            this.runJogLoop();
          }
        }, 5); // Very short delay to let timing logic in runJogLoop work properly
      }
    } 
    // Note: If state is CANCELLING, we intentionally don't send commands
    // even if 'ok' responses from pre-cancel commands are still arriving
  }

  /**
   * Handle 'error' response from runner
   */
  handleErrorResponse(res) {
    // Error response
    this.commandsInQueue = Math.max(0, this.commandsInQueue - 1);

    const errorCode = res.code || res.message || 'unknown';
    log.debug(`Jog command error: ${errorCode}`);

    // Error 15 = Travel exceeded (soft limits) - not critical, just can't move that direction
    if (errorCode !== 15 && errorCode !== '15') {
      log.warn(`Jog error: ${errorCode}`);
    }
  }

  /**
   * Start the jog loop
   */
  startJogging() {
    if (!this.controller) {
      log.debug('Cannot start jogging: controller not available');
      // Emit event to flash status on frontend
      this.emit('flashStatus');
      return;
    }

    if (!this.canJog()) {
      const currentState = this.getControllerState();
      log.debug(`Cannot start jogging: controller in invalid state "${currentState}" (must be "Idle" or "Jog")`);
      // Emit event to flash status on frontend
      this.emit('flashStatus');
      return;
    }

    log.debug('Starting jog loop');
    this.state = STATE_JOGGING;
    this.commandsInQueue = 0;
    this.lastCommandTime = 0;

    // Start the jog loop
    this.runJogLoop();
  }

  /**
   * Main jog loop - sends commands at calculated intervals
   */
  runJogLoop() {
    if (this.state !== STATE_JOGGING) {
      return;
    }

    // Check if controller is still valid
    if (!this.controller || !this.canJog()) {
      log.debug('Jog loop stopping: controller not available or state changed');
      this.transitionToIdle();
      return;
    }

    const now = Date.now();

    // Calculate jog parameters from current input
    const params = this.calculateJogParams(this.currentInput);

    if (!params) {
      // No movement needed (input is neutral)
      // This shouldn't happen as we check in handleAnalogInput, but be safe
      this.cancelJog();
      return;
    }

    // Double-check state before sending (defense against race conditions)
    if (this.state !== STATE_JOGGING) {
      return;
    }

    // Only send if queue isn't too full
    if (this.commandsInQueue < TARGET_QUEUE_DEPTH) {
      // Check if enough time has passed since last command
      // Always respect dt interval to maintain proper buffer and timing
      // Only send immediately if this is the very first command (lastCommandTime === 0)
      const timeSinceLastCmd = now - this.lastCommandTime;
      const shouldSend = (this.lastCommandTime === 0) || (timeSinceLastCmd >= params.dt);

      if (shouldSend) {
        // Build and send the jog command
        const cmd = this.buildJogCommand(params);

        // Skip if movement is too small to generate a valid command
        if (!cmd) {
          log.debug('Skipping jog command - movement too small');
        } else {
          // Final state check before sending (defense against race conditions)
          if (this.state !== STATE_JOGGING) {
            return;
          }

          // Log the command being sent with state info for debugging
          try {
            this.controller.writeln(cmd);
            this.commandsInQueue++;
            this.lastCommandTime = now;
          } catch (err) {
            log.error('Error sending jog command:', err);
            this.transitionToIdle();
            return;
          }
        }
      }
    }

    // Schedule next iteration only if we're still jogging (not cancelling)
    // Use a short polling interval as fallback for input changes
    // Primary path is event-driven via handleOkResponse()
    if (this.state !== STATE_JOGGING) {
      return; // Don't schedule timer if we're cancelling or idle
    }

    if (this.commandsInQueue >= TARGET_QUEUE_DEPTH) {
      // Queue is full, wait a bit before checking again
      this.jogTimer = setTimeout(() => {
        this.runJogLoop();
      }, MIN_DT_MS);
    } else {
      // Queue has room, poll more frequently to catch input changes
      // But don't poll too aggressively - event-driven path handles most cases
      this.jogTimer = setTimeout(() => {
        this.runJogLoop();
      }, Math.max(10, params.dt / 4)); // Poll at 1/4 of dt interval
    }
  }

  /**
   * Cancel the current jog
   */
  cancelJog() {
    if (this.state === STATE_IDLE || this.state === STATE_CANCELLING) {
      return;
    }

    // Clear the jog timer
    if (this.jogTimer) {
      clearTimeout(this.jogTimer);
      this.jogTimer = null;
    }

    // Immediately clear command queue - no more commands should be sent
    this.commandsInQueue = 0;
    this.state = STATE_CANCELLING;

    // Send jog cancel realtime command (0x85)
    if (this.controller) {
      try {
        this.controller.command('jogCancel');

        // Set timeout for cancel confirmation
        this.cancelTimer = setTimeout(() => {
          log.warn('Jog cancel timeout, forcing idle state');
          this.transitionToIdle();
        }, CANCEL_TIMEOUT_MS);

        // Send G4P0 for synchronization
        // This will return 'ok' when the cancel is complete and planner is empty
        setTimeout(() => {
          if (this.state === STATE_CANCELLING && this.controller) {
            this.waitingForSync = true;
            this.controller.writeln('G4P0');
          }
        }, 50); // Small delay after cancel command
      } catch (err) {
        log.error('Error sending jog cancel:', err);
        this.transitionToIdle();
      }
    } else {
      this.transitionToIdle();
    }

    // Watch for completion
    this.watchForCancelComplete();
  }

  /**
   * Watch for cancel/sync completion
   */
  watchForCancelComplete() {
    if (this.state !== STATE_CANCELLING) {
      return;
    }

    // Check if queue is empty and sync is complete
    if (this.commandsInQueue === 0 && !this.waitingForSync) {
      // Cancel complete
      if (this.cancelTimer) {
        clearTimeout(this.cancelTimer);
        this.cancelTimer = null;
      }
      this.transitionToIdle();
      return;
    }

    // Check again soon
    setTimeout(() => {
      this.watchForCancelComplete();
    }, 10);
  }

  /**
   * Transition to idle state
   * If there's pending input, restart jogging immediately
   */
  transitionToIdle() {
    log.debug('Transitioning to idle');

    // Clear timers
    if (this.jogTimer) {
      clearTimeout(this.jogTimer);
      this.jogTimer = null;
    }
    if (this.cancelTimer) {
      clearTimeout(this.cancelTimer);
      this.cancelTimer = null;
    }

    const pendingInput = this.currentInput;
    
    this.state = STATE_IDLE;
    this.commandsInQueue = 0;
    this.waitingForSync = false;

    // If we have pending input, restart jogging immediately
    if (!this.isInputNeutral(pendingInput)) {
      this.currentInput = pendingInput;
      this.startJogging();
    } else {
      this.currentInput = { x: 0, y: 0, z: 0 };
    }
  }

  /**
   * Handle discrete jog action (from button)
   * e.g., 'jog_x_pos', 'jog_y_neg', etc.
   *
   * For button jogs, we send a single jog command while the button is held,
   * and cancel when released.
   * 
   * Note: Always accepts input - works independently of joystick.enabled setting.
   */
  handleButtonJog(action, pressed) {

    // Parse action to get axis and direction
    const match = action.match(/^jog_([xyz])_(pos|neg)$/);
    if (!match) {
      log.warn(`Unknown button jog action: ${action}`);
      return;
    }

    const axis = match[1];
    const direction = match[2] === 'pos' ? 1 : -1;

    if (pressed) {
      // Button pressed - set input for this axis
      const input = { x: 0, y: 0, z: 0 };
      input[axis] = direction;

      // Merge with current input (allows multi-axis button combos)
      this.currentInput = {
        x: axis === 'x' ? direction : this.currentInput.x,
        y: axis === 'y' ? direction : this.currentInput.y,
        z: axis === 'z' ? direction : this.currentInput.z,
      };

      // Start jogging if not already
      if (this.state === STATE_IDLE) {
        const result = this.getController();
        if (result) {
          this.attachController(result.controller, result.port);
          this.startJogging();
        }
      }
    } else {
      // Button released - clear this axis
      this.currentInput = {
        x: axis === 'x' ? 0 : this.currentInput.x,
        y: axis === 'y' ? 0 : this.currentInput.y,
        z: axis === 'z' ? 0 : this.currentInput.z,
      };

      // If all input is neutral, cancel jog
      if (this.isInputNeutral(this.currentInput) && this.state === STATE_JOGGING) {
        this.cancelJog();
      }
    }
  }

  /**
   * Stop all jogging and cleanup
   */
  stop() {
    log.debug('Stopping jog loop service');

    if (this.state !== STATE_IDLE) {
      this.cancelJog();
    }

    this.detachController();
    this.enabled = false;
  }

  /**
   * Get current state for debugging
   */
  getState() {
    return {
      state: this.state,
      enabled: this.enabled,
      currentInput: this.currentInput,
      commandsInQueue: this.commandsInQueue,
      controllerPort: this.controllerPort,
      canJog: this.canJog(),
    };
  }
}

// Singleton instance
const jogLoop = new JogLoop();

module.exports = jogLoop;
