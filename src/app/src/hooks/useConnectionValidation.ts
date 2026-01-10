import { useMemo } from 'react'
import { socketService } from '@/services/socket'
import type { MachineStatus } from '@/utils/machineState'

/**
 * Hook for validating connection state
 * 
 * Provides a convenient way to check if socket connection is valid
 * before attempting to send commands
 */
export function useConnectionValidation(
  isConnected: boolean,
  connectedPort: string | null,
  machineStatus?: MachineStatus
) {
  const validation = useMemo(() => {
    const socket = socketService.getSocket()
    const hasSocket = !!socket
    const hasPort = !!connectedPort
    const isValid = isConnected && hasPort && hasSocket
    
    return {
      isConnected,
      hasSocket,
      hasPort,
      isValid,
      socket,
      port: connectedPort,
      machineStatus,
    }
  }, [isConnected, connectedPort, machineStatus])

  /**
   * Check if connection is valid
   */
  const isValid = useMemo(() => {
    return validation.isValid
  }, [validation.isValid])

  /**
   * Get the socket if connection is valid, otherwise null
   */
  const getSocket = useMemo(() => {
    return validation.isValid ? validation.socket : null
  }, [validation.isValid, validation.socket])

  return {
    ...validation,
    isValid,
    getSocket,
  }
}
