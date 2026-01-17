import { useEffect, useRef } from 'react'
import { useGetSettingsQuery } from '@/services/api'
import { useToolChange } from '@/contexts/ToolChangeContext'
import { useWorkflowState } from '@/store/hooks'
import { socketService } from '@/services/socket'
import { useGcodeCommand } from './useGcodeCommand'
import type { ZeroingMethod } from '../../../shared/schemas/settings'

/**
 * Hook to detect M6 tool change pauses and trigger tool change flow
 * Should be used in JobStatusBar or similar components that handle job state
 */
export function useToolChangeDetection(connectedPort: string | null) {
  const { triggerToolChange, isToolChangePending } = useToolChange()
  const { sendCommand } = useGcodeCommand(connectedPort)
  const workflowState = useWorkflowState()
  const { data: settings } = useGetSettingsQuery()
  
  // Track holdReason from sender:status events
  const holdReasonRef = useRef<{ data?: string; msg?: string } | null>(null)
  const hasTriggeredRef = useRef(false) // Prevent multiple triggers

  // Helper function to check and trigger tool change
  const checkAndTriggerToolChange = (holdReason: { data?: string; msg?: string } | null) => {
    if (!connectedPort || workflowState !== 'paused' || isToolChangePending || hasTriggeredRef.current) {
      return
    }

    if (holdReason?.data === 'M6') {
      // This is an M6 tool change pause
      hasTriggeredRef.current = true
      const strategy = settings?.zeroingStrategies?.toolChange ?? 'ask'
      
      if (strategy === 'skip') {
        // Auto-resume - no zeroing needed
        sendCommand('gcode:resume')
        hasTriggeredRef.current = false // Reset after resume
      } else if (strategy === 'ask') {
        // User will choose method - trigger with 'ask'
        triggerToolChange('ask')
      } else {
        // Strategy is a method ID - look up the method
        const availableMethods = settings?.zeroingMethods?.methods || []
        const method = availableMethods.find((m: ZeroingMethod) => m.id === strategy)
        
        if (method) {
          // Found the method - trigger with method object
          triggerToolChange(method)
        } else {
          // Method not found - fall back to 'ask'
          console.warn(`Tool change method with ID "${strategy}" not found. Falling back to "ask".`)
          triggerToolChange('ask')
        }
      }
    }
  }

  useEffect(() => {
    if (!connectedPort) {
      return
    }

    const handleSenderStatus = (...args: unknown[]) => {
      const senderData = args[0] as {
        hold?: boolean
        holdReason?: { data?: string; msg?: string; err?: boolean }
      }
      
      if (senderData?.hold && senderData?.holdReason) {
        holdReasonRef.current = senderData.holdReason
        // Check immediately when we receive holdReason
        checkAndTriggerToolChange(senderData.holdReason)
      } else if (!senderData?.hold) {
        holdReasonRef.current = null
        hasTriggeredRef.current = false // Reset when hold is cleared
      }
    }

    const handleFeederStatus = (...args: unknown[]) => {
      const feederData = args[0] as {
        hold?: boolean
        holdReason?: { data?: string; msg?: string; err?: boolean }
      }
      
      // M6 tool changes set hold on the feeder, not the sender
      if (feederData?.hold && feederData?.holdReason) {
        holdReasonRef.current = feederData.holdReason
        // Check immediately when we receive holdReason
        checkAndTriggerToolChange(feederData.holdReason)
      } else if (!feederData?.hold) {
        // Only clear if sender doesn't have a hold reason
        if (!holdReasonRef.current || holdReasonRef.current.data !== 'M6') {
          holdReasonRef.current = null
          hasTriggeredRef.current = false // Reset when hold is cleared
        }
      }
    }

    socketService.on('sender:status', handleSenderStatus)
    socketService.on('feeder:status', handleFeederStatus)

    return () => {
      socketService.off('sender:status', handleSenderStatus)
      socketService.off('feeder:status', handleFeederStatus)
    }
  }, [connectedPort, workflowState, settings, triggerToolChange, sendCommand, isToolChangePending, checkAndTriggerToolChange])

  // Detect M6 tool change when workflow pauses (check existing holdReason)
  useEffect(() => {
    if (!connectedPort || workflowState !== 'paused') {
      hasTriggeredRef.current = false // Reset when not paused
      return
    }

    // Check if we already have a holdReason
    checkAndTriggerToolChange(holdReasonRef.current)
  }, [workflowState, connectedPort, settings, triggerToolChange, sendCommand, isToolChangePending, checkAndTriggerToolChange])

  // Reset trigger flag when workflow resumes
  useEffect(() => {
    if (workflowState === 'running' || workflowState === 'idle') {
      hasTriggeredRef.current = false
    }
  }, [workflowState])
}
