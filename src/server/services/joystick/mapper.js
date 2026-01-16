/**
 * Joystick Input Mapper (Backend)
 *
 * Maps raw joystick inputs from various sources (server gamepad, client gamepad, client controls)
 * to normalized, mapped actions using joystick configuration.
 *
 * This is the mapping layer that applies button mappings, analog mappings, and settings
 * (deadzone, sensitivity, inversion) before sending to the translation layer.
 */

/**
 * Apply deadzone to a single axis value
 */
function applyDeadzone(value, deadzone) {
  const absValue = Math.abs(value);
  if (absValue < deadzone) {
    return 0;
  }
  // Scale the value to compensate for deadzone
  // Maps [deadzone, 1] to [0, 1]
  const sign = value >= 0 ? 1 : -1;
  const scaled = (absValue - deadzone) / (1 - deadzone);
  return sign * Math.min(1, scaled);
}

/**
 * Apply sensitivity curve to a value
 */
function applySensitivity(value, sensitivity) {
  if (sensitivity === 1.0) {
    return value; // Linear (no curve)
  }
  // For now, linear sensitivity only
  // Future: support exponential, quadratic, etc.
  return value * sensitivity;
}

/**
 * Apply axis inversion
 */
function applyInversion(value, invert) {
  return invert ? -value : value;
}

/**
 * Joystick Input Mapper class
 *
 * Maps raw inputs to normalized, mapped actions
 */
class JoystickMapper {
  constructor(config) {
    this.config = config;
  }

  /**
   * Update configuration
   */
  updateConfig(config) {
    this.config = config;
  }

  /**
   * Map gamepad state to mapped actions
   * Works for both server and client gamepad states (same structure)
   */
  mapGamepad(axes, buttons) {
    const actions = [];

    // Map button presses
    buttons.forEach((pressed, buttonId) => {
      if (pressed) {
        const action = this.config.buttonMappings[buttonId];
        if (action && action !== 'none') {
          actions.push({
            type: 'button',
            action: action,
            buttonId: buttonId,
            pressed: true,
          });
        }
      }
    });

    // Map D-pad buttons (axes 6 and 7)
    // D-pad Up (button 12) = axis 7 < -0.5
    if (axes[7] < -0.5) {
      const action = this.config.buttonMappings[12];
      if (action && action !== 'none') {
        actions.push({
          type: 'button',
          action: action,
          buttonId: 12,
          pressed: true,
        });
      }
    }
    // D-pad Down (button 16) = axis 7 > 0.5
    if (axes[7] > 0.5) {
      const action = this.config.buttonMappings[16];
      if (action && action !== 'none') {
        actions.push({
          type: 'button',
          action: action,
          buttonId: 16,
          pressed: true,
        });
      }
    }
    // D-pad Left (button 17) = axis 6 < -0.5
    if (axes[6] < -0.5) {
      const action = this.config.buttonMappings[17];
      if (action && action !== 'none') {
        actions.push({
          type: 'button',
          action: action,
          buttonId: 17,
          pressed: true,
        });
      }
    }
    // D-pad Right (button 15) = axis 6 > 0.5
    if (axes[6] > 0.5) {
      const action = this.config.buttonMappings[15];
      if (action && action !== 'none') {
        actions.push({
          type: 'button',
          action: action,
          buttonId: 15,
          pressed: true,
        });
      }
    }

    // Map analog axes
    const analogAction = this.mapAnalogAxes(axes);
    if (analogAction) {
      actions.push(analogAction);
    }

    return actions;
  }

  /**
   * Map browser jog control input to mapped actions
   *
   * Browser controls are already normalized (useAnalogJog handles this on client)
   * We just need to apply settings (sensitivity, inversion) and format
   * 
   * IMPORTANT: Always returns an action, even for neutral input (0, 0, 0).
   * The jog loop needs to receive neutral input to know when to cancel jogging.
   */
  mapJogControl(x, y, z) {
    // Apply settings (deadzone already applied by client, but apply sensitivity and inversion)
    let xValue = applySensitivity(x, this.config.sensitivity);
    let yValue = applySensitivity(y, this.config.sensitivity);
    let zValue = applySensitivity(z, this.config.sensitivity);

    // Apply inversion
    xValue = applyInversion(xValue, this.config.invertX);
    yValue = applyInversion(yValue, this.config.invertY);
    zValue = applyInversion(zValue, this.config.invertZ);

    // Always return an action - jog loop needs neutral input to trigger cancel
    return {
      type: 'analog',
      x: xValue,
      y: yValue,
      z: zValue,
    };
  }

  /**
   * Map analog axes from gamepad state
   * Applies mappings, settings (deadzone, sensitivity, inversion), and converts to normalized format
   */
  mapAnalogAxes(axes) {
    // Get raw axis values
    const axisValues = {
      left_x: axes[0] || 0,
      left_y: axes[1] || 0,
      right_x: axes[2] || 0,
      right_y: axes[3] || 0,
    };

    // Map to jog axes based on analogMappings
    let jogX = 0;
    let jogY = 0;
    let jogZ = 0;

    // Left stick
    const leftXMapping = this.config.analogMappings.left_x;
    const leftYMapping = this.config.analogMappings.left_y;
    if (leftXMapping === 'jog_x') {
      jogX += axisValues.left_x;
    } else if (leftXMapping === 'jog_y') {
      jogY += axisValues.left_x;
    } else if (leftXMapping === 'jog_z') {
      jogZ += axisValues.left_x;
    }
    if (leftYMapping === 'jog_x') {
      jogX += axisValues.left_y;
    } else if (leftYMapping === 'jog_y') {
      jogY += axisValues.left_y;
    } else if (leftYMapping === 'jog_z') {
      jogZ += axisValues.left_y;
    }

    // Right stick
    const rightXMapping = this.config.analogMappings.right_x;
    const rightYMapping = this.config.analogMappings.right_y;
    if (rightXMapping === 'jog_x') {
      jogX += axisValues.right_x;
    } else if (rightXMapping === 'jog_y') {
      jogY += axisValues.right_x;
    } else if (rightXMapping === 'jog_z') {
      jogZ += axisValues.right_x;
    }
    if (rightYMapping === 'jog_x') {
      jogX += axisValues.right_y;
    } else if (rightYMapping === 'jog_y') {
      jogY += axisValues.right_y;
    } else if (rightYMapping === 'jog_z') {
      jogZ += axisValues.right_y;
    }

    // Clamp combined values to [-1, 1]
    jogX = Math.max(-1, Math.min(1, jogX));
    jogY = Math.max(-1, Math.min(1, jogY));
    jogZ = Math.max(-1, Math.min(1, jogZ));

    // Apply settings: deadzone, sensitivity, inversion
    jogX = applyDeadzone(jogX, this.config.deadzone);
    jogY = applyDeadzone(jogY, this.config.deadzone);
    jogZ = applyDeadzone(jogZ, this.config.deadzone);

    jogX = applySensitivity(jogX, this.config.sensitivity);
    jogY = applySensitivity(jogY, this.config.sensitivity);
    jogZ = applySensitivity(jogZ, this.config.sensitivity);

    jogX = applyInversion(jogX, this.config.invertX);
    jogY = applyInversion(jogY, this.config.invertY);
    jogZ = applyInversion(jogZ, this.config.invertZ);

    // Check if any axis has meaningful input (after settings)
    const hasInput = Math.abs(jogX) > 0.001 || Math.abs(jogY) > 0.001 || Math.abs(jogZ) > 0.001;

    if (!hasInput) {
      return null;
    }

    return {
      type: 'analog',
      x: jogX,
      y: jogY,
      z: jogZ,
    };
  }
}

module.exports = JoystickMapper;
