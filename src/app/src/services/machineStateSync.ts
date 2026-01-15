import { store } from '@/store'
import {
  setConnectionState,
  setConnecting,
  setMachineStatus,
  setFlashing,
  setHomed,
  setMachinePosition,
  setWorkPosition,
  setSpindleState,
  setSpindleSpeed,
  setMaxSpindleSpeed,
  setCurrentTool,
  setPlannerQueue,
  setRxBufferSize,
  setFeedrate,
  setWorkflowState,
} from '@/store/machineSlice'
import { setJobState, clearJobState } from '@/store/jobSlice'
import { socketService } from './socket'
import { useLazyGetMachineStatusQuery } from '@/services/api'
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

      console.log('[machineStateSync] restoreGcodeStateFromAPI result:', { 
        hasResult: !!result, 
        name: (result as any)?.name,
        size: (result as any)?.size,
        total: (result as any)?.total 
      })

      if (result) {
        // The API returns sender.toJSON() which includes name, size, total, sent, received, etc.
        // TypeScript type may be incomplete, so we safely access properties
        const gcodeData = result as any
        
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
    store.dispatch(setConnectionState({ isConnected: true, connectedPort: data.port }))
    store.dispatch(setConnecting(false))
  }

  private handleSerialPortClose(..._args: unknown[]) {
    store.dispatch(setConnectionState({ isConnected: false, connectedPort: null }))
    store.dispatch(setConnecting(false))
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

    // Update connection state
    store.dispatch(setConnectionState({
      isConnected: status.connected ?? false,
      connectedPort: status.port || null,
    }))

    // Update machine status
    if (status.machineStatus) {
      const machineStatusMap: Record<string, ReturnType<typeof setMachineStatus>['payload']> = {
        'not_connected': 'not_connected',
        'connected_pre_home': 'connected_pre_home',
        'connected_post_home': 'connected_post_home',
        'alarm': 'alarm',
        'running': 'running',
        'hold': 'hold',
      }
      const mappedStatus = machineStatusMap[status.machineStatus]
      if (mappedStatus) {
        store.dispatch(setMachineStatus(mappedStatus))
      }
    }

    // Update homed state
    if (status.isHomed !== undefined) {
      store.dispatch(setHomed(status.isHomed))
    }

    // Update positions from controllerState
    if (status.controllerState?.mpos) {
      store.dispatch(setMachinePosition({
        x: parseFloat(status.controllerState.mpos.x || '0'),
        y: parseFloat(status.controllerState.mpos.y || '0'),
        z: parseFloat(status.controllerState.mpos.z || '0'),
      }))
    }
    if (status.controllerState?.wpos) {
      store.dispatch(setWorkPosition({
        x: parseFloat(status.controllerState.wpos.x || '0'),
        y: parseFloat(status.controllerState.wpos.y || '0'),
        z: parseFloat(status.controllerState.wpos.z || '0'),
      }))
    }

    // Update planner queue from status buffer
    if (status.status?.buf?.planner !== undefined) {
      const availableBlocks = status.status.buf.planner
      const maxBlocks = 15
      const usedBlocks = Math.max(0, maxBlocks - availableBlocks)
      store.dispatch(setPlannerQueue({ depth: usedBlocks, max: maxBlocks }))
    }

    // Update RX buffer
    if (status.status?.buf?.rx !== undefined) {
      store.dispatch(setRxBufferSize(status.status.buf.rx))
    }

    // Update parserstate values (spindle, tool, feedrate)
    if (status.parserstate) {
      // Spindle state from modal.spindle
      if (status.parserstate.modal?.spindle) {
        const spindle = status.parserstate.modal.spindle
        console.log('[machineStateSync] Spindle state from machine:status modal.spindle:', spindle)
        if (spindle === 'M3' || spindle === 'M4' || spindle === 'M5') {
          console.log('[machineStateSync] Dispatching setSpindleState:', spindle)
          store.dispatch(setSpindleState(spindle))
        } else {
          console.warn('[machineStateSync] Unexpected spindle state value:', spindle)
        }
      } else {
        console.log('[machineStateSync] No modal.spindle found in machine:status parserstate')
      }

      // Spindle speed
      if (status.parserstate.spindle !== undefined) {
        const speed = parseFloat(status.parserstate.spindle || '0')
        console.log('[machineStateSync] Spindle speed from machine:status parserstate.spindle:', speed)
        store.dispatch(setSpindleSpeed(speed))
      }

      // Current tool
      if (status.parserstate.tool !== undefined) {
        const tool = parseFloat(status.parserstate.tool || '0')
        store.dispatch(setCurrentTool(tool > 0 ? tool : undefined))
      }

      // Feedrate
      if (status.parserstate.feedrate !== undefined) {
        const feed = parseFloat(status.parserstate.feedrate || '0')
        store.dispatch(setFeedrate(feed))
      }
    }

    // Update workflow state
    if (status.workflowState) {
      const workflowMap: Record<string, ReturnType<typeof setWorkflowState>['payload']> = {
        'idle': 'idle',
        'running': 'running',
        'paused': 'paused',
      }
      const mappedWorkflow = workflowMap[status.workflowState]
      if (mappedWorkflow) {
        store.dispatch(setWorkflowState(mappedWorkflow))
      }
    }
  }

  private handleWorkflowState(...args: unknown[]) {
    const _port = args[0] as string
    const workflowState = args[1] as 'idle' | 'running' | 'paused'

    store.dispatch(setWorkflowState(workflowState || null))

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
