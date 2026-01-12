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

const events = require('events')
const logger = require('../../lib/logger').default
const store = require('../../store').default

const log = logger('service:joystick:jogloop')

// Configuration constants
const PLANNER_BLOCKS = 15          // Grbl planner buffer size
const TARGET_QUEUE_DEPTH = 4       // Target commands in queue
const MIN_DT_MS = 25               // Minimum time interval (ms)
const MAX_DT_MS = 200              // Maximum time interval (ms)
const DEFAULT_ACCELERATION = 500   // Default acceleration (mm/sec²) if not available from controller
const CANCEL_TIMEOUT_MS = 1000     // Timeout waiting for cancel confirmation
const INPUT_NEUTRAL_THRESHOLD = 0.01  // Threshold for considering input as neutral

// Jog loop states
const STATE_IDLE = 'idle'
const STATE_JOGGING = 'jogging'
const STATE_CANCELLING = 'cancelling'

class JogLoop extends events.EventEmitter {
  constructor() {
    super()
    
    // State
    this.state = STATE_IDLE
    this.enabled = false
    
    // Configuration
    this.config = {
      analogJogSpeedXY: 3000,  // mm/min
      analogJogSpeedZ: 1000,   // mm/min
      acceleration: DEFAULT_ACCELERATION,  // mm/sec²
    }
    
    // Current input values (normalized -1 to 1)
    this.currentInput = { x: 0, y: 0, z: 0 }
    
    // Command queue tracking
    this.commandsInQueue = 0
    this.lastCommandTime = 0
    
    // Controller reference
    this.controller = null
    this.controllerPort = null
    
    // Response listeners
    this.okListener = null
    this.errorListener = null
    
    // Timers
    this.jogTimer = null
    this.cancelTimer = null
    
    // Sync state
    this.waitingForSync = false
  }

  /**
   * Initialize the jog loop with configuration
   */
  initialize(config) {
    if (config) {
      this.updateConfig(config)
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    if (config.analogJogSpeedXY !== undefined && Number.isFinite(config.analogJogSpeedXY)) {
      this.config.analogJogSpeedXY = config.analogJogSpeedXY
    }
    if (config.analogJogSpeedZ !== undefined && Number.isFinite(config.analogJogSpeedZ)) {
      this.config.analogJogSpeedZ = config.analogJogSpeedZ
    }
    
    this.enabled = config.enabled ?? this.enabled
    
    log.debug(`Config updated: enabled=${this.enabled}, speedXY=${this.config.analogJogSpeedXY}, speedZ=${this.config.analogJogSpeedZ}`)
    
    // If disabled, stop any active jogging
    if (!this.enabled && this.state !== STATE_IDLE) {
      this.cancelJog()
    }
  }

  /**
   * Get the first connected controller
   */
  getController() {
    const controllers = store.get('controllers', {})
    const ports = Object.keys(controllers)
    
    for (const port of ports) {
      const controller = store.get(`controllers["${port}"]`)
      if (controller && controller.isOpen && controller.isOpen()) {
        return { controller, port }
      }
    }
    
    return null
  }

  /**
   * Check if controller is in a valid state for jogging
   * Valid states: Idle, Jog
   */
  canJog() {
    if (!this.controller) {
      return false
    }
    
    const activeState = this.controller.state?.status?.activeState || ''
    return activeState === 'Idle' || activeState === 'Jog'
  }

  /**
   * Get acceleration from controller settings or use default
   */
  getAcceleration() {
    if (!this.controller?.runner?.settings?.settings) {
      return DEFAULT_ACCELERATION
    }
    
    const settings = this.controller.runner.settings.settings
    // Use minimum of X, Y, Z accelerations for safety
    const accX = parseFloat(settings['$120']) || DEFAULT_ACCELERATION
    const accY = parseFloat(settings['$121']) || DEFAULT_ACCELERATION
    const accZ = parseFloat(settings['$122']) || DEFAULT_ACCELERATION
    
    return Math.min(accX, accY, accZ)
  }

  /**
   * Calculate optimal time interval (dt) for given velocity
   * Formula: dt > v² / (2 * a * (N-1))
   * 
   * @param {number} velocity - Current velocity in mm/sec
   * @returns {number} Time interval in milliseconds
   */
  calculateDt(velocity) {
    const a = this.getAcceleration()
    const N = PLANNER_BLOCKS
    
    // dt > v² / (2 * a * (N-1))
    const dtMin = (velocity * velocity) / (2 * a * (N - 1))
    const dtMs = dtMin * 1000
    
    // Clamp to reasonable bounds
    return Math.max(MIN_DT_MS, Math.min(MAX_DT_MS, dtMs))
  }

  /**
   * Calculate jog command parameters from input
   * 
   * @param {object} input - Normalized input { x, y, z } from -1 to 1
   * @returns {object} Command parameters { dx, dy, dz, feedrate, dt }
   */
  calculateJogParams(input) {
    // Validate input values
    const x = Number.isFinite(input.x) ? input.x : 0
    const y = Number.isFinite(input.y) ? input.y : 0
    const z = Number.isFinite(input.z) ? input.z : 0
    
    // Calculate target velocities (mm/sec)
    const vx = (x * this.config.analogJogSpeedXY) / 60
    const vy = (y * this.config.analogJogSpeedXY) / 60
    const vz = (z * this.config.analogJogSpeedZ) / 60
    
    // Calculate combined XY velocity for feedrate
    const vxy = Math.sqrt(vx * vx + vy * vy)
    const vTotal = Math.sqrt(vxy * vxy + vz * vz)
    
    if (vTotal < 0.001) {
      return null  // No movement
    }
    
    // Calculate dt based on maximum velocity component
    const maxV = Math.max(Math.abs(vx), Math.abs(vy), Math.abs(vz))
    const dt = this.calculateDt(maxV)
    const dtSec = dt / 1000
    
    // Calculate incremental distances
    const dx = vx * dtSec
    const dy = vy * dtSec
    const dz = vz * dtSec
    
    // Calculate feedrate (mm/min)
    // For multi-axis, use the combined vector speed
    const feedrate = vTotal * 60
    
    // Validate all calculated values
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(dz) || !Number.isFinite(feedrate)) {
      log.warn(`Invalid jog params calculated: dx=${dx}, dy=${dy}, dz=${dz}, F=${feedrate}`)
      return null
    }
    
    return { dx, dy, dz, feedrate, dt }
  }

  /**
   * Format a number for G-code (remove trailing zeros, limit precision)
   */
  formatGcodeNumber(value, maxDecimals = 3) {
    // Round to maxDecimals, then remove trailing zeros
    const rounded = Number(value.toFixed(maxDecimals))
    // Convert to string and remove trailing zeros and decimal point if needed
    return rounded.toString().replace(/\.?0+$/, '')
  }

  /**
   * Build the $J= jog command string
   */
  buildJogCommand(params) {
    const { dx, dy, dz, feedrate } = params
    
    // Minimum thresholds to avoid bad number format errors
    const MIN_DISTANCE = 0.001  // 0.001mm minimum movement
    const MIN_FEEDRATE = 1      // 1 mm/min minimum
    
    // Format: $J=G91 G21 X... Y... Z... F...
    // G91 = incremental mode, G21 = mm units
    let cmd = '$J=G91 G21'
    let hasAxis = false
    
    // Only include axes with meaningful movement
    // Format numbers without trailing zeros
    if (Math.abs(dx) >= MIN_DISTANCE) {
      cmd += ` X${this.formatGcodeNumber(dx)}`
      hasAxis = true
    }
    if (Math.abs(dy) >= MIN_DISTANCE) {
      cmd += ` Y${this.formatGcodeNumber(dy)}`
      hasAxis = true
    }
    if (Math.abs(dz) >= MIN_DISTANCE) {
      cmd += ` Z${this.formatGcodeNumber(dz)}`
      hasAxis = true
    }
    
    // If no axis has meaningful movement, return null
    if (!hasAxis) {
      return null
    }
    
    // Ensure minimum feedrate and format as integer
    const safeFeedrate = Math.max(MIN_FEEDRATE, Math.round(feedrate))
    cmd += ` F${safeFeedrate}`
    
    return cmd
  }

  /**
   * Check if input is neutral (below threshold)
   */
  isInputNeutral(input) {
    return Math.abs(input.x) < INPUT_NEUTRAL_THRESHOLD &&
           Math.abs(input.y) < INPUT_NEUTRAL_THRESHOLD &&
           Math.abs(input.z) < INPUT_NEUTRAL_THRESHOLD
  }

  /**
   * Handle analog input update
   * Called by joystick service when analog input changes
   */
  handleAnalogInput(x, y, z) {
    if (!this.enabled) {
      return
    }
    
    // Ensure we have valid speed configuration
    if (!this.config.analogJogSpeedXY || !this.config.analogJogSpeedZ) {
      log.warn('Jog loop not properly configured - missing speed settings')
      return
    }
    
    const input = { x: x || 0, y: y || 0, z: z || 0 }
    this.currentInput = input
    
    // Get controller if we don't have one
    if (!this.controller) {
      const result = this.getController()
      if (result) {
        this.attachController(result.controller, result.port)
      }
    }
    
    // State machine logic
    switch (this.state) {
      case STATE_IDLE:
        if (!this.isInputNeutral(input)) {
          // Start jogging
          this.startJogging()
        }
        break
        
      case STATE_JOGGING:
        if (this.isInputNeutral(input)) {
          // Input returned to neutral, cancel jog
          this.cancelJog()
        }
        // Otherwise, the jog loop will use the updated input
        break
        
      case STATE_CANCELLING:
        // Waiting for cancel confirmation, ignore input updates
        break
    }
  }

  /**
   * Attach to a controller and set up response listener
   */
  attachController(controller, port) {
    // Detach from previous controller if any
    this.detachController()
    
    this.controller = controller
    this.controllerPort = port
    
    // Listen for ok/error responses on the runner (which is an EventEmitter)
    if (controller.runner) {
      this.okListener = (res) => {
        this.handleOkResponse()
      }
      this.errorListener = (res) => {
        this.handleErrorResponse(res)
      }
      
      controller.runner.on('ok', this.okListener)
      controller.runner.on('error', this.errorListener)
    }
    
    log.debug(`Attached to controller on port ${port}`)
  }

  /**
   * Detach from current controller
   */
  detachController() {
    if (this.controller && this.controller.runner) {
      if (this.okListener) {
        this.controller.runner.off('ok', this.okListener)
      }
      if (this.errorListener) {
        this.controller.runner.off('error', this.errorListener)
      }
    }
    
    this.controller = null
    this.controllerPort = null
    this.okListener = null
    this.errorListener = null
  }

  /**
   * Handle 'ok' response from runner
   */
  handleOkResponse() {
    // Command completed
    this.commandsInQueue = Math.max(0, this.commandsInQueue - 1)
    
    if (this.waitingForSync) {
      // G4P0 completed, sync done
      this.waitingForSync = false
      log.debug('Jog cancel sync complete')
    }
  }

  /**
   * Handle 'error' response from runner
   */
  handleErrorResponse(res) {
    // Error response
    this.commandsInQueue = Math.max(0, this.commandsInQueue - 1)
    
    const errorCode = res.code || res.message || 'unknown'
    log.debug(`Jog command error: ${errorCode}`)
    
    // Error 15 = Travel exceeded (soft limits) - not critical, just can't move that direction
    if (errorCode !== 15 && errorCode !== '15') {
      log.warn(`Jog error: ${errorCode}`)
    }
  }

  /**
   * Start the jog loop
   */
  startJogging() {
    if (!this.controller || !this.canJog()) {
      log.debug('Cannot start jogging: controller not available or not in valid state')
      return
    }
    
    log.debug('Starting jog loop')
    this.state = STATE_JOGGING
    this.commandsInQueue = 0
    this.lastCommandTime = 0
    
    // Start the jog loop
    this.runJogLoop()
  }

  /**
   * Main jog loop - sends commands at calculated intervals
   */
  runJogLoop() {
    if (this.state !== STATE_JOGGING) {
      return
    }
    
    // Check if controller is still valid
    if (!this.controller || !this.canJog()) {
      log.debug('Jog loop stopping: controller not available or state changed')
      this.transitionToIdle()
      return
    }
    
    const now = Date.now()
    
    // Calculate jog parameters from current input
    const params = this.calculateJogParams(this.currentInput)
    
    if (!params) {
      // No movement needed (input is neutral)
      // This shouldn't happen as we check in handleAnalogInput, but be safe
      this.cancelJog()
      return
    }
    
    // Only send if queue isn't too full
    if (this.commandsInQueue < TARGET_QUEUE_DEPTH) {
      // Check if enough time has passed since last command
      const timeSinceLastCmd = now - this.lastCommandTime
      
      if (timeSinceLastCmd >= params.dt || this.commandsInQueue === 0) {
        // Build and send the jog command
        const cmd = this.buildJogCommand(params)
        
        // Skip if movement is too small to generate a valid command
        if (!cmd) {
          log.debug('Skipping jog command - movement too small')
        } else {
          // Log the command being sent
          log.info(`Sending jog: ${cmd}`)
          
          try {
            this.controller.writeln(cmd)
            this.commandsInQueue++
            this.lastCommandTime = now
          } catch (err) {
            log.error('Error sending jog command:', err)
            this.transitionToIdle()
            return
          }
        }
      }
    }
    
    // Schedule next iteration
    // Use shorter interval when queue is low, longer when it's filling up
    const nextInterval = this.commandsInQueue < 2 ? MIN_DT_MS : params.dt
    
    this.jogTimer = setTimeout(() => {
      this.runJogLoop()
    }, Math.max(5, nextInterval / 2))  // Run at half the interval for responsiveness
  }

  /**
   * Cancel the current jog
   */
  cancelJog() {
    if (this.state === STATE_IDLE || this.state === STATE_CANCELLING) {
      return
    }
    
    log.debug('Cancelling jog')
    
    // Clear the jog timer
    if (this.jogTimer) {
      clearTimeout(this.jogTimer)
      this.jogTimer = null
    }
    
    this.state = STATE_CANCELLING
    
    // Send jog cancel realtime command (0x85)
    if (this.controller) {
      try {
        this.controller.command('jogCancel')
        
        // Set timeout for cancel confirmation
        this.cancelTimer = setTimeout(() => {
          log.warn('Jog cancel timeout, forcing idle state')
          this.transitionToIdle()
        }, CANCEL_TIMEOUT_MS)
        
        // Send G4P0 for synchronization
        // This will return 'ok' when the cancel is complete and planner is empty
        setTimeout(() => {
          if (this.state === STATE_CANCELLING && this.controller) {
            this.waitingForSync = true
            this.controller.writeln('G4P0')
          }
        }, 50)  // Small delay after cancel command
        
      } catch (err) {
        log.error('Error sending jog cancel:', err)
        this.transitionToIdle()
      }
    } else {
      this.transitionToIdle()
    }
    
    // Watch for completion
    this.watchForCancelComplete()
  }

  /**
   * Watch for cancel/sync completion
   */
  watchForCancelComplete() {
    if (this.state !== STATE_CANCELLING) {
      return
    }
    
    // Check if queue is empty and sync is complete
    if (this.commandsInQueue === 0 && !this.waitingForSync) {
      // Cancel complete
      if (this.cancelTimer) {
        clearTimeout(this.cancelTimer)
        this.cancelTimer = null
      }
      this.transitionToIdle()
      return
    }
    
    // Check again soon
    setTimeout(() => {
      this.watchForCancelComplete()
    }, 10)
  }

  /**
   * Transition to idle state
   */
  transitionToIdle() {
    log.debug('Transitioning to idle')
    
    // Clear timers
    if (this.jogTimer) {
      clearTimeout(this.jogTimer)
      this.jogTimer = null
    }
    if (this.cancelTimer) {
      clearTimeout(this.cancelTimer)
      this.cancelTimer = null
    }
    
    this.state = STATE_IDLE
    this.commandsInQueue = 0
    this.waitingForSync = false
    this.currentInput = { x: 0, y: 0, z: 0 }
  }

  /**
   * Handle discrete jog action (from button)
   * e.g., 'jog_x_pos', 'jog_y_neg', etc.
   * 
   * For button jogs, we send a single jog command while the button is held,
   * and cancel when released.
   */
  handleButtonJog(action, pressed) {
    if (!this.enabled) {
      return
    }
    
    // Parse action to get axis and direction
    const match = action.match(/^jog_([xyz])_(pos|neg)$/)
    if (!match) {
      log.warn(`Unknown button jog action: ${action}`)
      return
    }
    
    const axis = match[1]
    const direction = match[2] === 'pos' ? 1 : -1
    
    if (pressed) {
      // Button pressed - set input for this axis
      const input = { x: 0, y: 0, z: 0 }
      input[axis] = direction
      
      // Merge with current input (allows multi-axis button combos)
      this.currentInput = {
        x: axis === 'x' ? direction : this.currentInput.x,
        y: axis === 'y' ? direction : this.currentInput.y,
        z: axis === 'z' ? direction : this.currentInput.z,
      }
      
      // Start jogging if not already
      if (this.state === STATE_IDLE) {
        const result = this.getController()
        if (result) {
          this.attachController(result.controller, result.port)
          this.startJogging()
        }
      }
    } else {
      // Button released - clear this axis
      this.currentInput = {
        x: axis === 'x' ? 0 : this.currentInput.x,
        y: axis === 'y' ? 0 : this.currentInput.y,
        z: axis === 'z' ? 0 : this.currentInput.z,
      }
      
      // If all input is neutral, cancel jog
      if (this.isInputNeutral(this.currentInput) && this.state === STATE_JOGGING) {
        this.cancelJog()
      }
    }
  }

  /**
   * Stop all jogging and cleanup
   */
  stop() {
    log.debug('Stopping jog loop service')
    
    if (this.state !== STATE_IDLE) {
      this.cancelJog()
    }
    
    this.detachController()
    this.enabled = false
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
    }
  }
}

// Singleton instance
const jogLoop = new JogLoop()

module.exports = jogLoop
