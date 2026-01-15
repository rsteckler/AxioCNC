import { useCallback } from 'react'
import { socketService } from '@/services/socket'

/**
 * Hook for sending G-code commands via socket
 * 
 * Provides a convenient way to send G-code commands with automatic connection validation
 */
export function useGcodeCommand(connectedPort: string | null) {
  /**
   * Send a G-code command to the controller
   * Returns true if command was sent, false if connection is invalid
   */
  const sendGcode = useCallback((gcode: string): boolean => {
    if (!connectedPort) {
      return false
    }
    socketService.command(connectedPort, 'gcode', gcode)
    return true
  }, [connectedPort])

  /**
   * Send a raw command to the controller (not G-code)
   * Returns true if command was sent, false if connection is invalid
   */
  const sendCommand = useCallback((
    command: string,
    ...args: unknown[]
  ): boolean => {
    if (!connectedPort) {
      return false
    }
    socketService.command(connectedPort, command, ...args)
    return true
  }, [connectedPort])

  return {
    sendGcode,
    sendCommand,
  }
}
