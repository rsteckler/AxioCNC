/**
 * Joystick Orchestration Service
 * 
 * Main service that orchestrates all joystick inputs:
 * - Browser gamepad (Gamepad API)
 * - Server gamepad (Socket.IO events)
 * - Browser jog controls (mouse/touch)
 * 
 * Reads inputs from all sources, maps them using JoystickMapper,
 * and routes mapped actions to handlers.
 */

import { socketService } from '@/services/socket'
import { JoystickMapper } from './mapper'
import type {
  MappingConfig,
  BrowserGamepadState,
  ServerGamepadState,
  BrowserJogControlInput,
  MappedAction,
} from './types'

/**
 * Callback type for mapped actions
 */
export type ActionCallback = (actions: MappedAction[]) => void

/**
 * Joystick Orchestration Service
 * 
 * Manages all joystick input sources and routes mapped actions to handlers
 */
export class JoystickService {
  private config: MappingConfig | null = null
  private mapper: JoystickMapper | null = null
  private actionCallback: ActionCallback | null = null
  
  // Polling state
  private browserPollingActive = false
  private browserPollingRef: number | null = null
  private lastBrowserGamepadIndex: number | null = null
  private selectedGamepadId: string | null = null
  private lastButtonStates: boolean[] = [] // Track previous button states for change detection
  private frameCounter = 0 // For throttling debug logs
  
  // Server gamepad listener state
  private serverListenerActive = false
  private serverGamepadHandler: ((state: ServerGamepadState) => void) | null = null

  /**
   * Initialize the service with configuration
   */
  initialize(config: MappingConfig, onActions: ActionCallback): void {
    this.config = config
    this.mapper = new JoystickMapper(config)
    this.actionCallback = onActions
    this.selectedGamepadId = config.selectedGamepad
    
    // Start/stop based on enabled state
    if (config.enabled) {
      this.start()
    } else {
      this.stop()
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: MappingConfig): void {
    const wasEnabled = this.config?.enabled ?? false
    const wasSelectedGamepad = this.config?.selectedGamepad ?? null
    const wasConnectionLocation = this.config?.connectionLocation ?? 'server'
    
    this.config = config
    this.mapper?.updateConfig(config)
    this.selectedGamepadId = config.selectedGamepad
    
    // If connection location or selected gamepad changed, restart polling
    if (
      wasEnabled !== config.enabled ||
      wasSelectedGamepad !== config.selectedGamepad ||
      wasConnectionLocation !== config.connectionLocation
    ) {
      if (config.enabled) {
        this.start()
      } else {
        this.stop()
      }
    }
  }

  /**
   * Start reading from input sources
   */
  private start(): void {
    if (!this.config || !this.mapper || !this.actionCallback) {
      return
    }
    
    if (this.config.connectionLocation === 'client') {
      this.startBrowserGamepadPolling()
    } else {
      this.startServerGamepadListener()
    }
  }

  /**
   * Stop reading from input sources
   */
  private stop(): void {
    this.stopBrowserGamepadPolling()
    this.stopServerGamepadListener()
  }

  /**
   * Start polling browser gamepad
   */
  private startBrowserGamepadPolling(): void {
    if (this.browserPollingActive) {
      return
    }
    
    this.browserPollingActive = true
    this.frameCounter = 0
    this.lastButtonStates = []
    console.log('[Joystick Debug] Started client-side gamepad polling')
    this.pollBrowserGamepad()
  }

  /**
   * Stop polling browser gamepad
   */
  private stopBrowserGamepadPolling(): void {
    this.browserPollingActive = false
    if (this.browserPollingRef !== null) {
      cancelAnimationFrame(this.browserPollingRef)
      this.browserPollingRef = null
    }
  }

  /**
   * Poll browser gamepad state
   */
  private pollBrowserGamepad = (): void => {
    if (!this.browserPollingActive || !this.config || !this.mapper || !this.actionCallback) {
      return
    }
    
    const gamepad = this.findBrowserGamepad()
    
    if (gamepad) {
      // Log gamepad info on first detection
      if (this.frameCounter === 0) {
        console.log(`[Joystick Debug] Gamepad detected: ${gamepad.id}`)
        console.log(`[Joystick Debug] Total buttons: ${gamepad.buttons.length}, Total axes: ${gamepad.axes.length}`)
        console.log(`[Joystick Debug] Current button mappings:`, this.config?.buttonMappings)
      }
      
      const state: BrowserGamepadState = {
        axes: Array.from(gamepad.axes),
        buttons: gamepad.buttons.map(b => b.pressed),
        timestamp: gamepad.timestamp,
      }
      
      // DEBUG: Log button state changes (press/release)
      const buttonChanges: string[] = []
      state.buttons.forEach((pressed, index) => {
        const wasPressed = this.lastButtonStates[index] || false
        if (pressed && !wasPressed) {
          // Button just pressed
          const mapping = this.config?.buttonMappings[index]
          buttonChanges.push(`PRESSED: Button ${index}${mapping ? ` → ${mapping}` : ' (unmapped)'}`)
        } else if (!pressed && wasPressed) {
          // Button just released
          buttonChanges.push(`RELEASED: Button ${index}`)
        }
      })
      
      // Update last button states
      this.lastButtonStates = [...state.buttons]
      
      // Log button changes
      if (buttonChanges.length > 0) {
        console.log(`[Joystick Debug] ${buttonChanges.join(' | ')}`)
      }
      
      // Log all currently pressed buttons (less verbose, only when buttons are held)
      const currentlyPressed = state.buttons
        .map((pressed, index) => pressed ? index : -1)
        .filter(idx => idx >= 0)
      
      // Increment frame counter for throttling
      this.frameCounter++
      
      if (currentlyPressed.length > 0 && buttonChanges.length === 0) {
        // Buttons are held but no changes (reduce spam - only log every 60 frames ~1 second at 60fps)
        if (this.frameCounter % 60 === 0) {
          const buttonInfo = currentlyPressed.map(idx => {
            const mapping = this.config?.buttonMappings[idx]
            return `B${idx}${mapping ? `→${mapping}` : ''}`
          }).join(', ')
          console.log(`[Joystick Debug] Buttons held: ${buttonInfo}`)
        }
      }
      
      // Log axes when they have significant movement (reduce spam)
      const activeAxes = state.axes
        .map((value, index) => Math.abs(value) > 0.1 ? { index, value } : null)
        .filter((a): a is { index: number; value: number } => a !== null)
      
      if (activeAxes.length > 0 && buttonChanges.length === 0) {
        // Only log axes occasionally to reduce spam (every 30 frames ~0.5 seconds at 60fps)
        if (this.frameCounter % 30 === 0) {
          const axesInfo = activeAxes.map(a => `A${a.index}:${a.value.toFixed(2)}`).join(', ')
          console.log(`[Joystick Debug] Active axes: ${axesInfo}`)
        }
      }
      
      // Map to actions
      const actions = this.mapper.mapBrowserGamepad(state)
      
      if (actions.length > 0) {
        console.log(`[Joystick Debug] Mapped actions:`, actions.map(a => 
          a.type === 'button' ? `${a.action} (button ${a.buttonId})` : `analog (x:${a.x.toFixed(2)}, y:${a.y.toFixed(2)}, z:${a.z.toFixed(2)})`
        ).join(', '))
      }
      
      // Route to callback
      if (actions.length > 0) {
        this.actionCallback(actions)
      }
    }
    
    // Continue polling
    if (this.browserPollingActive) {
      this.browserPollingRef = requestAnimationFrame(this.pollBrowserGamepad)
    }
  }

  /**
   * Find the selected browser gamepad
   */
  private findBrowserGamepad(): Gamepad | null {
    if (!this.selectedGamepadId) {
      return null
    }
    
    const gamepads = navigator.getGamepads?.() || []
    for (const gp of gamepads) {
      if (gp && gp.id === this.selectedGamepadId) {
        this.lastBrowserGamepadIndex = gp.index
        return gp
      }
    }
    
    // Fallback to last known index
    if (this.lastBrowserGamepadIndex !== null) {
      return gamepads[this.lastBrowserGamepadIndex] || null
    }
    
    return null
  }

  /**
   * Start listening to server gamepad events
   */
  private startServerGamepadListener(): void {
    if (this.serverListenerActive) {
      return
    }
    
    this.serverListenerActive = true
    
    // Create handler for gamepad:state events
    // Server emits: io.emit('gamepad:state', { gamepadId, connected, axes, buttons, timestamp })
    this.serverGamepadHandler = (stateData: {
      gamepadId?: string
      connected?: boolean
      axes?: number[]
      buttons?: boolean[]
      timestamp?: number
    }) => {
      if (!this.config || !this.mapper || !this.actionCallback) {
        return
      }
      
      if (!stateData) {
        return
      }
      
      // Only process if this is the selected gamepad
      const gamepadId = stateData.gamepadId
      if (gamepadId && gamepadId !== this.selectedGamepadId) {
        return
      }
      
      if (stateData.axes && stateData.buttons) {
        const state: ServerGamepadState = {
          gamepadId: gamepadId ?? '',
          connected: stateData.connected ?? true,
          axes: stateData.axes,
          buttons: stateData.buttons,
          timestamp: stateData.timestamp ?? Date.now(),
        }
        
        // Map to actions
        const actions = this.mapper.mapServerGamepad(state)
        
        // Route to callback
        if (actions.length > 0) {
          this.actionCallback(actions)
        }
      }
    }
    
    // Register listener
    socketService.on('gamepad:state', this.serverGamepadHandler)
  }

  /**
   * Stop listening to server gamepad events
   */
  private stopServerGamepadListener(): void {
    if (this.serverGamepadHandler) {
      socketService.off('gamepad:state', this.serverGamepadHandler)
      this.serverGamepadHandler = null
    }
    this.serverListenerActive = false
  }

  /**
   * Process browser jog control input
   * 
   * Called from JogPanel when analog mode is active
   */
  processBrowserJogControl(input: BrowserJogControlInput): void {
    if (!this.config || !this.config.enabled || !this.mapper || !this.actionCallback) {
      return
    }
    
    // Map to actions
    const action = this.mapper.mapBrowserJogControl(input)
    
    // Route to callback
    if (action) {
      this.actionCallback([action])
    }
  }

  /**
   * Cleanup - stop all polling and listeners
   */
  destroy(): void {
    this.stop()
    this.config = null
    this.mapper = null
    this.actionCallback = null
    this.selectedGamepadId = null
    this.lastBrowserGamepadIndex = null
  }
}

/**
 * Singleton instance
 */
let serviceInstance: JoystickService | null = null

/**
 * Get or create the singleton joystick service instance
 */
export function getJoystickService(): JoystickService {
  if (!serviceInstance) {
    serviceInstance = new JoystickService()
  }
  return serviceInstance
}
