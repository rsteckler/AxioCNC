import { store } from '@/store'
import {
  setConnecting,
  setBackendStatus,
  setMaxSpindleSpeed,
} from '@/store/machineSlice'
import { setJobState, clearJobState } from '@/store/jobSlice'
import { socketService } from './socket'
// useLazyGetMachineStatusQuery not currently used but may be needed in future
// import { useLazyGetMachineStatusQuery } from '@/services/api'
import type { MachineStatus as ApiMachineStatus } from '@/services/api'

/**
 * Machine State Sync Service
 * 
 * Singleton service that listens to Socket.IO events and updates the Redux store
 * with machine and job state. This ensures all pages have access to the same state.
 */
class MachineStateSyncService {
  private initialized = false
  private handleSerialPortOpenBound?: (...args: unknown[]) => void
  private handleSerialPortCloseBound?: (...args: unknown[]) => void
  private handleMachineStatusBound?: (...args: unknown[]) => void
  private handleWorkflowStateBound?: (...args: unknown[]) => void
  private handleSenderStatusBound?: (...args: unknown[]) => void

  /**
   * Initialize the service - set up Socket.IO listeners
   */
  init() {
    if (this.initialized) {
      console.log('[machineStateSync] Already initialized, skipping')
      return
    }

    // Store bound handlers so we can remove them in cleanup
    this.handleSerialPortOpenBound = this.handleSerialPortOpen.bind(this)
    this.handleSerialPortCloseBound = this.handleSerialPortClose.bind(this)
    this.handleMachineStatusBound = this.handleMachineStatus.bind(this)
    this.handleWorkflowStateBound = this.handleWorkflowState.bind(this)
    this.handleSenderStatusBound = this.handleSenderStatus.bind(this)

    // Listen to connection events
    socketService.on('serialport:open', this.handleSerialPortOpenBound)
    socketService.on('serialport:close', this.handleSerialPortCloseBound)

    // Listen to machine status updates (now includes full controller state including parserstate)
    socketService.on('machine:status', this.handleMachineStatusBound)

    // Listen to workflow state updates
    socketService.on('workflow:state', this.handleWorkflowStateBound)

    // Listen to sender status updates (job progress)
    socketService.on('sender:status', this.handleSenderStatusBound)

    
    // NOTE: We don't listen to gcode:load/unload here because:
    // 1. Components (FilePanel, VisualizerPanel) need to handle these events directly
    // 2. Listening here with .bind(this) can interfere with component listeners
    // 3. Job state is managed via sender:status events, not gcode:load/unload

    this.initialized = true
    }

  /**
   * Cleanup - remove all listeners
   */
  cleanup() {
    if (!this.initialized) {
      return
    }


    if (this.handleSerialPortOpenBound) {
      socketService.off('serialport:open', this.handleSerialPortOpenBound)
    }
    if (this.handleSerialPortCloseBound) {
      socketService.off('serialport:close', this.handleSerialPortCloseBound)
    }
    if (this.handleMachineStatusBound) {
      socketService.off('machine:status', this.handleMachineStatusBound)
    }
    if (this.handleWorkflowStateBound) {
      socketService.off('workflow:state', this.handleWorkflowStateBound)
    }
    if (this.handleSenderStatusBound) {
      socketService.off('sender:status', this.handleSenderStatusBound)
    }
    // NOTE: We don't listen to gcode:load/unload, so no cleanup needed

    this.initialized = false
  }

  /**
   * Restore state from API (for page refresh/navigation)
   * This should be called from components that need to restore state on mount
   */
  async restoreStateFromAPI(port: string | null) {
    if (!port) {
      return
    }

    try {
      // Import API dynamically to avoid circular dependency
      const { api } = await import('@/services/api')
      const result = await store.dispatch(
        api.endpoints.getMachineStatus.initiate({ port })
      ).unwrap()

      if (result?.status) {
        this.handleMachineStatus(port, result.status)
      }
      
      // Also restore G-code file state from API
      await this.restoreGcodeStateFromAPI(port)
    } catch (error) {
      console.error('Failed to restore state from API:', error)
    }
  }

  /**
   * Restore G-code file state from API
   * This is only needed on page load if we're already connected (sender:status may not arrive immediately)
   * During normal operation, sender:status events keep job state up to date
   */
  async restoreGcodeStateFromAPI(port: string | null) {
    if (!port) {
      return
    }

    try {
      // Import API dynamically to avoid circular dependency
      const { api } = await import('@/services/api')
      const result = await store.dispatch(
        api.endpoints.getGcode.initiate(port)
      ).unwrap()

      // Type-safe access to result properties
      const resultData = result as Record<string, unknown>
      console.log('[machineStateSync] restoreGcodeStateFromAPI result:', { 
        hasResult: !!result, 
        name: typeof resultData?.name === 'string' ? resultData.name : undefined,
        size: typeof resultData?.size === 'number' ? resultData.size : undefined,
        total: typeof resultData?.total === 'number' ? resultData.total : undefined
      })

      if (result) {
        // The API returns sender.toJSON() which includes name, size, total, sent, received, etc.
        // TypeScript type may be incomplete, so we safely access properties
        const gcodeData = resultData as Record<string, unknown>
        
        // Update job state with file information
        // This ensures components have job state immediately on page load
        // During normal operation, sender:status events will keep it updated
        store.dispatch(setJobState({
          name: gcodeData.name,
          size: gcodeData.size,
          total: gcodeData.total,
          sent: gcodeData.sent,
          received: gcodeData.received,
          elapsedTime: gcodeData.elapsedTime,
          remainingTime: gcodeData.remainingTime,
          nextM6ToolNumber: gcodeData.nextM6ToolNumber,
          remainingTimeToNextM6: gcodeData.remainingTimeToNextM6,
        }))
      }
    } catch (error) {
      console.error('[machineStateSync] Failed to restore G-code state from API:', error)
    }
  }

  private handleSerialPortOpen(...args: unknown[]) {
    const data = args[0] as { port: string }
    // Connection state is now part of backendStatus, which will be updated by machine:status events
    // Just clear the connecting flag
    store.dispatch(setConnecting(false))
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleSerialPortClose(..._args: unknown[]) {
    // Clear backend status on disconnect - this resets all machine state
    store.dispatch(setBackendStatus(null))
    store.dispatch(setConnecting(false))
    store.dispatch(clearJobState())
  }


  private handleMachineStatus(...args: unknown[]) {
    const port = args[0] as string
    const status = args[1] as ApiMachineStatus

    if (!status) return

    console.log('[machineStateSync] machine:status received:', {
      port,
      machineStatus: status.machineStatus,
      activeState: status.controllerState?.activeState,
      parserstate: status.parserstate,
      status: status.status,
    })

    // Store the full backend status - single source of truth
    store.dispatch(setBackendStatus(status))

    // Update max spindle speed if current speed is higher
    if (status.parserstate?.spindle) {
      const speed = parseFloat(status.parserstate.spindle || '0')
      if (speed > 0) {
        const currentMax = store.getState().machine.maxSpindleSpeed
        const newMax = Math.max(currentMax, speed, 3000)
        if (newMax !== currentMax) {
          store.dispatch(setMaxSpindleSpeed(newMax))
        }
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleWorkflowState(..._args: unknown[]) {
    // port may be needed in future - keep args for now
    // const _port = _args[0] as string
    const workflowState = _args[1] as 'idle' | 'running' | 'paused'

    // Update backendStatus if it exists, otherwise it will be updated by next machine:status event
    const currentStatus = store.getState().machine.backendStatus
    if (currentStatus) {
      store.dispatch(setBackendStatus({
        ...currentStatus,
        workflowState: workflowState || null,
        isJobRunning: workflowState === 'running',
      }))
    }

    // Reset timer when workflow goes to idle (job stopped)
    if (workflowState === 'idle') {
      // Reset timer fields but keep other job state (name, size, total, etc.)
      store.dispatch(setJobState({
        elapsedTime: undefined,
        remainingTime: undefined,
        nextM6ToolNumber: undefined,
        remainingTimeToNextM6: undefined,
      }))
    }
  }

  private handleSenderStatus(...args: unknown[]) {
    console.log('[machineStateSync] handleSenderStatus called with args:', args)
    // sender:status is emitted with just the sender state object (no port prefix)
    const senderState = args[0] as {
      name?: string
      size?: number
      total?: number
      sent?: number
      received?: number
      elapsedTime?: number
      remainingTime?: number
      nextM6ToolNumber?: number
      remainingTimeToNextM6?: number
    }

    console.log('[machineStateSync] Parsed senderState:', senderState)

    if (senderState && typeof senderState === 'object') {
      // Debug log to verify data is being received
      console.log('[machineStateSync] sender:status received:', {
        name: senderState.name,
        size: senderState.size,
        total: senderState.total,
        sent: senderState.sent,
        received: senderState.received,
        elapsedTime: senderState.elapsedTime,
        remainingTime: senderState.remainingTime,
      })
      
      const jobStateUpdate = {
        name: senderState.name,
        size: senderState.size,
        total: senderState.total,
        sent: senderState.sent,
        received: senderState.received,
        elapsedTime: senderState.elapsedTime,
        remainingTime: senderState.remainingTime,
        nextM6ToolNumber: senderState.nextM6ToolNumber,
        remainingTimeToNextM6: senderState.remainingTimeToNextM6,
      }
      console.log('[machineStateSync] Dispatching setJobState with:', jobStateUpdate)
      store.dispatch(setJobState(jobStateUpdate))
      
      // Log current Redux state after dispatch
      const currentState = store.getState()
      console.log('[machineStateSync] Redux jobState after dispatch:', currentState.job)
    } else {
      console.warn('[machineStateSync] sender:status received invalid data:', args)
    }
  }

  /**
   * Invalidate RTK Query cache for G-code
   * This can be called from components when needed
   */
  async invalidateGcodeCache() {
    try {
      const { api } = await import('@/services/api')
      store.dispatch(api.util.invalidateTags(['GCode']))
    } catch (error) {
      console.error('Failed to invalidate G-code cache:', error)
    }
  }
}

// Export singleton instance
export const machineStateSync = new MachineStateSyncService()
