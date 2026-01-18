/**
 * Joystick Input Mapper
 * 
 * Maps raw joystick inputs from various sources (browser gamepad, server gamepad, browser controls)
 * to normalized, mapped actions using joystick configuration.
 * 
 * This is the mapping layer that applies button mappings, analog mappings, and settings
 * (deadzone, sensitivity, inversion) before sending to the translation layer.
 */

import type {
  BrowserGamepadState,
  ServerGamepadState,
  BrowserJogControlInput,
  MappedAnalogAction,
  MappedAction,
  MappingConfig,
  CncAction,
} from './types'

/**
 * Apply deadzone to a single axis value
 */
function applyDeadzone(value: number, deadzone: number): number {
  const absValue = Math.abs(value)
  if (absValue < deadzone) {
    return 0
  }
  // Scale the value to compensate for deadzone
  // Maps [deadzone, 1] to [0, 1]
  const sign = value >= 0 ? 1 : -1
  const scaled = (absValue - deadzone) / (1 - deadzone)
  return sign * Math.min(1, scaled)
}

/**
 * Apply sensitivity curve to a value
 */
function applySensitivity(value: number, sensitivity: number): number {
  if (sensitivity === 1.0) {
    return value // Linear (no curve)
  }
  // For now, linear sensitivity only
  // Future: support exponential, quadratic, etc.
  return value * sensitivity
}

/**
 * Apply axis inversion
 */
function applyInversion(value: number, invert: boolean): number {
  return invert ? -value : value
}

/**
 * Joystick Input Mapper class
 * 
 * Maps raw inputs to normalized, mapped actions
 */
export class JoystickMapper {
  private config: MappingConfig

  constructor(config: MappingConfig) {
    this.config = config
  }

  /**
   * Update configuration
   */
  updateConfig(config: MappingConfig): void {
    this.config = config
  }

  /**
   * Map browser gamepad state to mapped actions
   */
  mapBrowserGamepad(state: BrowserGamepadState): MappedAction[] {
    const actions: MappedAction[] = []

    // Map button presses
    state.buttons.forEach((pressed, buttonId) => {
      if (pressed) {
        const action = this.config.buttonMappings[buttonId]
        if (action && action !== 'none') {
          actions.push({
            type: 'button',
            action: action as CncAction,
            buttonId,
            pressed: true,
          })
        }
      }
    })

    // Map D-pad buttons (axes 6 and 7)
    // D-pad Up (button 12) = axis 7 < -0.5
    if (state.axes[7] < -0.5) {
      const action = this.config.buttonMappings[12]
      if (action && action !== 'none') {
        actions.push({
          type: 'button',
          action: action as CncAction,
          buttonId: 12,
          pressed: true,
        })
      }
    }
    // D-pad Down (button 16) = axis 7 > 0.5
    if (state.axes[7] > 0.5) {
      const action = this.config.buttonMappings[16]
      if (action && action !== 'none') {
        actions.push({
          type: 'button',
          action: action as CncAction,
          buttonId: 16,
          pressed: true,
        })
      }
    }
    // D-pad Left (button 17) = axis 6 < -0.5
    if (state.axes[6] < -0.5) {
      const action = this.config.buttonMappings[17]
      if (action && action !== 'none') {
        actions.push({
          type: 'button',
          action: action as CncAction,
          buttonId: 17,
          pressed: true,
        })
      }
    }
    // D-pad Right (button 15) = axis 6 > 0.5
    if (state.axes[6] > 0.5) {
      const action = this.config.buttonMappings[15]
      if (action && action !== 'none') {
        actions.push({
          type: 'button',
          action: action as CncAction,
          buttonId: 15,
          pressed: true,
        })
      }
    }

    // Map analog axes
    const analogAction = this.mapAnalogAxes(state.axes)
    if (analogAction) {
      actions.push(analogAction)
    }

    return actions
  }

  /**
   * Map server gamepad state to mapped actions
   * Same as browser gamepad, but uses ServerGamepadState structure
   */
  mapServerGamepad(state: ServerGamepadState): MappedAction[] {
    // Convert to browser format and use same mapping logic
    const browserState: BrowserGamepadState = {
      axes: state.axes,
      buttons: state.buttons,
      timestamp: state.timestamp,
    }
    return this.mapBrowserGamepad(browserState)
  }

  /**
   * Map browser jog control input to mapped actions
   * 
   * Browser controls are already normalized (useAnalogJog handles this)
   * We just need to apply settings (deadzone, sensitivity, inversion) and format
   */
  mapBrowserJogControl(input: BrowserJogControlInput): MappedAnalogAction | null {
    // Apply settings (deadzone already applied by useAnalogJog, but apply sensitivity and inversion)
    let x = applySensitivity(input.x, this.config.sensitivity)
    let y = applySensitivity(input.y, this.config.sensitivity)
    let z = applySensitivity(input.z, this.config.sensitivity)

    // Apply inversion
    x = applyInversion(x, this.config.invertX)
    y = applyInversion(y, this.config.invertY)
    z = applyInversion(z, this.config.invertZ)

    // Check if any axis has meaningful input (after settings)
    const hasInput = Math.abs(x) > 0.001 || Math.abs(y) > 0.001 || Math.abs(z) > 0.001

    if (!hasInput) {
      return null
    }

    return {
      type: 'analog',
      x,
      y,
      z,
    }
  }

  /**
   * Map analog axes from gamepad state
   * Applies mappings, settings (deadzone, sensitivity, inversion), and converts to normalized format
   */
  private mapAnalogAxes(axes: number[]): MappedAnalogAction | null {
    // Get raw axis values based on analog mappings
    const axisValues = {
      left_x: axes[0] || 0,
      left_y: axes[1] || 0,
      right_x: axes[2] || 0,
      right_y: axes[3] || 0,
    }

    // Map to jog axes based on analogMappings
    let jogX = 0
    let jogY = 0
    let jogZ = 0

    // Left stick
    const leftXMapping = this.config.analogMappings.left_x
    const leftYMapping = this.config.analogMappings.left_y
    if (leftXMapping === 'jog_x') {
      jogX += axisValues.left_x
    } else if (leftXMapping === 'jog_y') {
      jogY += axisValues.left_x
    } else if (leftXMapping === 'jog_z') {
      jogZ += axisValues.left_x
    }
    if (leftYMapping === 'jog_x') {
      jogX += axisValues.left_y
    } else if (leftYMapping === 'jog_y') {
      jogY += axisValues.left_y
    } else if (leftYMapping === 'jog_z') {
      jogZ += axisValues.left_y
    }

    // Right stick
    const rightXMapping = this.config.analogMappings.right_x
    const rightYMapping = this.config.analogMappings.right_y
    if (rightXMapping === 'jog_x') {
      jogX += axisValues.right_x
    } else if (rightXMapping === 'jog_y') {
      jogY += axisValues.right_x
    } else if (rightXMapping === 'jog_z') {
      jogZ += axisValues.right_x
    }
    if (rightYMapping === 'jog_x') {
      jogX += axisValues.right_y
    } else if (rightYMapping === 'jog_y') {
      jogY += axisValues.right_y
    } else if (rightYMapping === 'jog_z') {
      jogZ += axisValues.right_y
    }

    // Clamp combined values to [-1, 1]
    jogX = Math.max(-1, Math.min(1, jogX))
    jogY = Math.max(-1, Math.min(1, jogY))
    jogZ = Math.max(-1, Math.min(1, jogZ))

    // Apply settings: deadzone, sensitivity, inversion
    jogX = applyDeadzone(jogX, this.config.deadzone)
    jogY = applyDeadzone(jogY, this.config.deadzone)
    jogZ = applyDeadzone(jogZ, this.config.deadzone)

    jogX = applySensitivity(jogX, this.config.sensitivity)
    jogY = applySensitivity(jogY, this.config.sensitivity)
    jogZ = applySensitivity(jogZ, this.config.sensitivity)

    jogX = applyInversion(jogX, this.config.invertX)
    jogY = applyInversion(jogY, this.config.invertY)
    jogZ = applyInversion(jogZ, this.config.invertZ)

    // Check if any axis has meaningful input (after settings)
    const hasInput = Math.abs(jogX) > 0.001 || Math.abs(jogY) > 0.001 || Math.abs(jogZ) > 0.001

    if (!hasInput) {
      return null
    }

    return {
      type: 'analog',
      x: jogX,
      y: jogY,
      z: jogZ,
    }
  }
}
