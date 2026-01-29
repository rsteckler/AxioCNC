import { store } from '@/store'
import {
  setConnecting,
  setBackendStatus,
  setMaxSpindleSpeed,
} from '@/store/machineSlice'
import { setJobState, clearJobState, setJobCompletion, clearJobCompletion } from '@/store/jobSlice'
import { socketService } from './socket'
import { track } from '@/services/analytics'
import i18n from '@/i18n'
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
  private handleSocketDisconnectBound?: (...args: unknown[]) => void
  private handleMachineStatusBound?: (...args: unknown[]) => void
  private handleWorkflowStateBound?: (...args: unknown[]) => void
  private handleSenderStatusBound?: (...args: unknown[]) => void
  private handleJobCompleteBound?: (...args: unknown[]) => void
  private handleGcodeLoadBound?: (...args: unknown[]) => void
  private previousWorkflowState: 'idle' | 'running' | 'paused' | null = null
  private jobStartTime: number | null = null

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
    this.handleSocketDisconnectBound = this.handleSocketDisconnect.bind(this)
    this.handleMachineStatusBound = this.handleMachineStatus.bind(this)
    this.handleWorkflowStateBound = this.handleWorkflowState.bind(this)
    this.handleSenderStatusBound = this.handleSenderStatus.bind(this)
    this.handleJobCompleteBound = this.handleJobComplete.bind(this)
    this.handleGcodeLoadBound = this.handleGcodeLoad.bind(this)

    // Listen to connection events
    socketService.on('serialport:open', this.handleSerialPortOpenBound)
    socketService.on('serialport:close', this.handleSerialPortCloseBound)
    // Listen to socket disconnect to handle server crashes, network issues, etc.
    socketService.on('disconnect', this.handleSocketDisconnectBound)

    // Listen to machine status updates (now includes full controller state including parserstate)
    socketService.on('machine:status', this.handleMachineStatusBound)

    // Listen to workflow state updates
    socketService.on('workflow:state', this.handleWorkflowStateBound)

    // Listen to sender status updates (job progress)
    socketService.on('sender:status', this.handleSenderStatusBound)

    // Listen to job completion events
    socketService.on('job:complete', this.handleJobCompleteBound)
    
    // Listen to gcode:load to clear completion state when a new file is loaded
    // This ensures job status goes back to "not_started" when loading a new file
    // Note: Components (FilePanel, VisualizerPanel) can still listen to gcode:load
    // for their own UI updates - multiple listeners are fine
    socketService.on('gcode:load', this.handleGcodeLoadBound)

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
    if (this.handleSocketDisconnectBound) {
      socketService.off('disconnect', this.handleSocketDisconnectBound)
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
    if (this.handleJobCompleteBound) {
      socketService.off('job:complete', this.handleJobCompleteBound)
    }
    if (this.handleGcodeLoadBound) {
      socketService.off('gcode:load', this.handleGcodeLoadBound)
    }

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
          name: typeof gcodeData.name === 'string' ? gcodeData.name : undefined,
          size: typeof gcodeData.size === 'number' ? gcodeData.size : undefined,
          total: typeof gcodeData.total === 'number' ? gcodeData.total : undefined,
          sent: typeof gcodeData.sent === 'number' ? gcodeData.sent : undefined,
          received: typeof gcodeData.received === 'number' ? gcodeData.received : undefined,
          elapsedTime: typeof gcodeData.elapsedTime === 'number' ? gcodeData.elapsedTime : undefined,
          remainingTime: typeof gcodeData.remainingTime === 'number' ? gcodeData.remainingTime : undefined,
          nextM6ToolNumber: typeof gcodeData.nextM6ToolNumber === 'number' ? gcodeData.nextM6ToolNumber : undefined,
          remainingTimeToNextM6: typeof gcodeData.remainingTimeToNextM6 === 'number' ? gcodeData.remainingTimeToNextM6 : undefined,
        }))
      }
    } catch (error) {
      console.error('[machineStateSync] Failed to restore G-code state from API:', error)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleSerialPortOpen(..._args: unknown[]) {
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

  /**
   * Handle socket disconnect event
   * This fires when the websocket connection is lost (server crash, network issue, etc.)
   * Note: This is different from serialport:close - the serial port may still be open
   * but we can't communicate with it if the websocket is disconnected.
   */
  private handleSocketDisconnect(...args: unknown[]) {
    const reason = args[0] as string | undefined
    const reasonStr = reason || i18n.t('Connection lost')
    
    // Check if we were connected before disconnect
    const currentStatus = store.getState().machine.backendStatus
    const wasConnected = currentStatus?.connected === true

    // Only update status and show notification if we were actually connected
    // (avoid showing notification on initial connection failures)
    if (wasConnected) {
      // Clear backend status - we can't communicate with the machine anymore
      store.dispatch(setBackendStatus(null))
      store.dispatch(setConnecting(false))
      store.dispatch(clearJobState())

      // Emit custom event for notification system to pick up
      // Components (like Setup page) can listen to this event and add notifications
      const notificationEvent = new CustomEvent('machineStateSync:notification', {
        detail: {
          type: 'error',
          title: i18n.t('Server Disconnected'),
          message: i18n.t('Connection lost: {{reason}}. The server may have crashed or restarted.', { reason: reasonStr }),
        },
      })
      window.dispatchEvent(notificationEvent)
    }
  }


  private handleMachineStatus(...args: unknown[]) {
    const status = args[1] as ApiMachineStatus

    if (!status) return

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

  private handleWorkflowState(..._args: unknown[]) {
    // port may be needed in future - keep args for now
    // const _port = _args[0] as string
    const workflowState = _args[1] as 'idle' | 'running' | 'paused'

    // Track job start time for duration calculation (analytics events are tracked on button clicks)
    const previousState = this.previousWorkflowState
    const jobState = store.getState().job
    
    // Set job start time when workflow becomes running (for duration calculation)
    // Analytics events (job_started, job_paused, job_resumed) are tracked on button clicks
    if (workflowState === 'running' && this.jobStartTime === null && jobState.name) {
      // Only set if we haven't already started tracking this job
      // and we have a job loaded (name exists)
      if (previousState === 'idle' || previousState === null) {
        this.jobStartTime = Date.now()
      }
    }
    
    this.previousWorkflowState = workflowState

    // Update backendStatus if it exists, otherwise it will be updated by next machine:status event
    const currentStatus = store.getState().machine.backendStatus
    if (currentStatus) {
      store.dispatch(setBackendStatus({
        ...currentStatus,
        workflowState: workflowState || null,
        isJobRunning: workflowState === 'running',
      }))
    }

    // Clear completion state when a new job starts
    if (workflowState === 'running') {
      store.dispatch(clearJobCompletion())
    }

    // Reset timer when workflow goes to idle (job stopped)
    // Note: Completion details are handled by job:complete event, not here
    if (workflowState === 'idle') {
      // Reset timer fields but keep other job state (name, size, total, etc.)
      store.dispatch(setJobState({
        elapsedTime: undefined,
        remainingTime: undefined,
        nextM6ToolNumber: undefined,
        remainingTimeToNextM6: undefined,
      }))
      this.jobStartTime = null
    }
  }

  private handleSenderStatus(...args: unknown[]) {
    // sender:status is emitted with just the sender state object (no port prefix)
    const senderState = args[0] as {
      name?: string
      size?: number
      total?: number
      sent?: number
      received?: number
      elapsedTime?: number
      remainingTime?: number
      m6Indices?: number[]
      m6ToolNumbers?: number[]
      nextM6ToolNumber?: number
      remainingTimeToNextM6?: number
      jobId?: string | null
      stats?: {
        totalDistance?: { x: number; y: number; z: number; total: number }
        cuttingDistance?: { x: number; y: number; z: number; total: number }
        transitionDistance?: { x: number; y: number; z: number; total: number }
        retractDistance?: { x: number; y: number; z: number; total: number }
        toolStats?: {
          [toolNumber: number]: {
            toolNumber: number
            distance: { x: number; y: number; z: number; total: number }
            time: number
          }
        }
        currentTool?: number
        toolStartTime?: number
        position?: { x: number; y: number; z: number }
        modalState?: {
          motion?: string
          spindle?: string
          distance?: string
          units?: string
        }
      }
    }

    if (senderState && typeof senderState === 'object') {
      const jobStateUpdate = {
        name: senderState.name,
        size: senderState.size,
        total: senderState.total,
        sent: senderState.sent,
        received: senderState.received,
        elapsedTime: senderState.elapsedTime,
        remainingTime: senderState.remainingTime,
        m6Indices: senderState.m6Indices,
        m6ToolNumbers: senderState.m6ToolNumbers,
        nextM6ToolNumber: senderState.nextM6ToolNumber,
        remainingTimeToNextM6: senderState.remainingTimeToNextM6,
        jobId: senderState.jobId,
        stats: senderState.stats,
      }
      store.dispatch(setJobState(jobStateUpdate))
    } else {
      console.warn('[machineStateSync] sender:status received invalid data:', args)
    }
  }

  private handleJobComplete(...args: unknown[]) {
    const completion = args[0] as {
      reason: 'completed' | 'stopped' | 'reset' | 'error' | 'unload' | 'connection_lost' | 'connection_reset' | 'unknown'
      timestamp: number
      wasSuccessful: boolean
      senderState: { received: number; total: number; finishTime: number; name: string }
    }

    if (completion && typeof completion === 'object') {
      store.dispatch(setJobCompletion({
        reason: completion.reason,
        timestamp: completion.timestamp,
        wasSuccessful: completion.wasSuccessful,
        senderState: completion.senderState,
      }))
      
      // Track job completion
      try {
        const duration = this.jobStartTime 
          ? Math.floor((Date.now() - this.jobStartTime) / 1000)
          : completion.senderState.finishTime || 0
        
        track('job_completed', {
          duration,
          success: completion.wasSuccessful,
          lines_executed: completion.senderState.received || 0,
          lines_total: completion.senderState.total || 0,
        })
      } catch (analyticsError) {
        // Don't break job completion if analytics fails
        if (import.meta.env?.DEV) {
          console.warn('[machineStateSync] Failed to track job completion:', analyticsError)
        }
      }
      
      this.jobStartTime = null
    } else {
      console.warn('[machineStateSync] job:complete received invalid data:', args)
    }
  }

  /**
   * Handle gcode:load event
   * Clear job completion state when a new file is loaded
   * This ensures job status goes back to "not_started"
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private handleGcodeLoad(..._args: unknown[]) {
    // Clear completion state when a new file is loaded
    // The workflow is already stopped by the controller (see GrblController.js line 1236)
    // but we need to clear the completion state so the UI shows "not_started"
    store.dispatch(clearJobCompletion())
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
