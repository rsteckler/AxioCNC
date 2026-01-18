/**
 * useJoystickInput Hook
 * 
 * Sends joystick inputs from the client to the server via Socket.IO.
 * Handles browser gamepad polling and sends state to server.
 */

import { useEffect, useRef, useCallback } from 'react'
import { socketService } from '@/services/socket'

interface UseJoystickInputOptions {
  enabled: boolean
  connectionLocation: 'server' | 'client'
  selectedGamepadId: string | null
}

/**
 * Hook to send browser gamepad inputs to server
 * 
 * Polls browser Gamepad API when enabled and connectionLocation is 'client',
 * and sends state to server via Socket.IO.
 */
export function useJoystickInput({
  enabled,
  connectionLocation,
  selectedGamepadId,
}: UseJoystickInputOptions) {
  const pollingRef = useRef<number | null>(null)
  const lastGamepadIndexRef = useRef<number | null>(null)

  /**
   * Find the selected browser gamepad
   */
  const findGamepad = useCallback((): Gamepad | null => {
    if (!selectedGamepadId) {
      return null
    }

    const gamepads = navigator.getGamepads?.() || []
    for (const gp of gamepads) {
      if (gp && gp.id === selectedGamepadId) {
        lastGamepadIndexRef.current = gp.index
        return gp
      }
    }

    // Fallback to last known index
    if (lastGamepadIndexRef.current !== null) {
      return gamepads[lastGamepadIndexRef.current] || null
    }

    return null
  }, [selectedGamepadId])

  /**
   * Poll browser gamepad and send to server
   */
  const pollAndSend = useCallback(() => {
    if (!enabled || connectionLocation !== 'client' || !selectedGamepadId) {
      return
    }

    const gamepad = findGamepad()

    if (gamepad) {
        const axes = Array.from(gamepad.axes)
        const buttons = gamepad.buttons.map(b => b.pressed)
        const timestamp = gamepad.timestamp

        // Send to server using socketService
        socketService.joystickGamepad(axes, buttons, timestamp)
    }

    // Continue polling
    if (enabled && connectionLocation === 'client' && selectedGamepadId) {
      pollingRef.current = requestAnimationFrame(pollAndSend)
    }
  }, [enabled, connectionLocation, selectedGamepadId, findGamepad])

  // Start/stop polling
  useEffect(() => {
    if (enabled && connectionLocation === 'client' && selectedGamepadId) {
      // Start polling
      console.log(`[useJoystickInput] Starting client-side gamepad polling for: ${selectedGamepadId}`)
      pollingRef.current = requestAnimationFrame(pollAndSend)
    } else {
      // Stop polling
      if (pollingRef.current !== null) {
        console.log(`[useJoystickInput] Stopping client-side gamepad polling`)
        cancelAnimationFrame(pollingRef.current)
        pollingRef.current = null
      }
    }

    return () => {
      if (pollingRef.current !== null) {
        cancelAnimationFrame(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [enabled, connectionLocation, selectedGamepadId, pollAndSend])
}

/**
 * Send jog control input to server
 * 
 * Call this function with normalized x, y, z values (-1 to +1)
 * from browser jog controls (mouse/touch).
 */
export function sendJogControlInput(x: number, y: number, z: number): void {
  socketService.joystickJog(x, y, z, Date.now())
}
