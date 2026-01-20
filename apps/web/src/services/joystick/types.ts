/**
 * Joystick-related types and interfaces
 * 
 * Shared types for joystick input processing, mapping, and routing
 */

// Re-export types from JoystickSection for convenience
export type {
  CncAction,
} from '@/routes/Settings/sections/joystickConstants'
export type {
  AnalogAxis,
  AnalogMapping,
} from '@/routes/Settings/sections/JoystickSection'
export type { JoystickConfig } from '@/routes/Settings/sections/JoystickSection'

// Re-export JoystickConfig interface (we need the full interface, not just the type)
// JoystickConfigType not currently used but may be needed in future
// import type { JoystickConfig as JoystickConfigType } from '@/routes/Settings/sections/JoystickSection'

/**
 * Raw gamepad state from browser Gamepad API
 */
export interface BrowserGamepadState {
  axes: number[]
  buttons: boolean[]
  timestamp: number
}

/**
 * Raw gamepad state from server (Socket.IO gamepad:state event)
 */
export interface ServerGamepadState {
  gamepadId: string
  connected: boolean
  axes: number[]
  buttons: boolean[]
  timestamp: number
}

/**
 * Browser analog jog control input (from mouse/touch)
 */
export interface BrowserJogControlInput {
  x: number  // -1 to +1 (already normalized by useAnalogJog)
  y: number  // -1 to +1
  z: number  // -1 to +1 (from slider, normalized)
}

/**
 * Mapped analog action (after mapping layer processing)
 */
export interface MappedAnalogAction {
  type: 'analog'
  x: number  // -1 to +1 (normalized, settings applied)
  y: number  // -1 to +1
  z: number  // -1 to +1
}

/**
 * Mapped button action (after mapping layer processing)
 */
import type { CncAction } from '@/routes/Settings/sections/joystickConstants'

export interface MappedButtonAction {
  type: 'button'
  action: CncAction
  buttonId: number
  pressed: boolean
}

/**
 * Union type for all mapped actions
 */
export type MappedAction = MappedAnalogAction | MappedButtonAction

/**
 * Configuration for mapping layer
 * 
 * Extends JoystickConfig with all necessary mapping configuration
 */
import type { JoystickConfig } from '@/routes/Settings/sections/JoystickSection'

export type MappingConfig = JoystickConfig
