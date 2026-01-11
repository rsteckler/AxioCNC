import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Normalized analog input values after deadzone filtering
 */
export interface AnalogJogValues {
  x: number  // -1 to +1
  y: number  // -1 to +1
  z: number  // -1 to +1
}

/**
 * Raw input values from analog controls
 */
export interface AnalogJogInput {
  x: number   // -1 to +1 (from joystick)
  y: number   // -1 to +1 (from joystick)
  z: number   // 0 to 100 (from slider, 50 = center)
}

/**
 * Hook to poll analog jog controls and return normalized values with deadzone
 * 
 * @param input - Raw analog input values
 * @param enabled - Whether to poll (e.g., analog mode active)
 * @param deadzone - Deadzone threshold (0-1), default 0.05 (5%)
 * @param pollRate - Polling rate in Hz, default 60
 * @returns Normalized values (-1 to +1) with deadzone applied
 */
export function useAnalogJog(
  input: AnalogJogInput,
  enabled: boolean,
  deadzone: number = 0.05,
  pollRate: number = 60
): AnalogJogValues {
  const [values, setValues] = useState<AnalogJogValues>({ x: 0, y: 0, z: 0 })
  const animationRef = useRef<number | null>(null)
  const lastInputRef = useRef<AnalogJogInput>(input)

  // Update last input ref when input changes
  useEffect(() => {
    lastInputRef.current = input
  }, [input])

  /**
   * Apply deadzone to a single axis value
   */
  const applyDeadzone = useCallback((value: number, threshold: number): number => {
    const absValue = Math.abs(value)
    if (absValue < threshold) {
      return 0
    }
    // Scale the value to compensate for deadzone
    // Maps [deadzone, 1] to [0, 1]
    const sign = value >= 0 ? 1 : -1
    const scaled = (absValue - threshold) / (1 - threshold)
    return sign * Math.min(1, scaled)
  }, [])

  /**
   * Normalize Z from 0-100 range to -1 to +1 (50 = 0)
   */
  const normalizeZ = useCallback((zLevel: number): number => {
    // Convert 0-100 to -1 to +1, where 50 = 0
    const normalized = (zLevel - 50) / 50
    return Math.max(-1, Math.min(1, normalized))
  }, [])

  /**
   * Poll function that processes input and updates values
   */
  const poll = useCallback(() => {
    const currentInput = lastInputRef.current

    // Normalize Z axis (0-100 to -1 to +1)
    const zNormalized = normalizeZ(currentInput.z)

    // Apply deadzone to all axes
    const xFiltered = applyDeadzone(currentInput.x, deadzone)
    const yFiltered = applyDeadzone(currentInput.y, deadzone)
    const zFiltered = applyDeadzone(zNormalized, deadzone)

    setValues({
      x: xFiltered,
      y: yFiltered,
      z: zFiltered,
    })

    if (enabled) {
      animationRef.current = requestAnimationFrame(poll)
    }
  }, [enabled, deadzone, applyDeadzone, normalizeZ])

  // Start/stop polling based on enabled state
  useEffect(() => {
    if (enabled) {
      // Start polling immediately
      poll()
    } else {
      // Reset values when disabled
      setValues({ x: 0, y: 0, z: 0 })
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [enabled, poll])

  return values
}
