import { useEffect, useRef } from 'react'
import { useGetSettingsQuery, useGetExtensionsQuery, useDeleteExtensionsMutation } from '@/services/api'
import { useToolChange } from '@/contexts/ToolChangeContext'
import { useWorkflowState, useCurrentWCS } from '@/store/hooks'
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
  const currentWCS = useCurrentWCS()
  const { data: settings } = useGetSettingsQuery()
  const [deleteExtensions] = useDeleteExtensionsMutation()
  
  // Track previous workflow state to detect job start
  const prevWorkflowStateRef = useRef<'idle' | 'running' | 'paused' | null>(workflowState || 'idle')
  
  // Track holdReason from sender:status events
  const holdReasonRef = useRef<{ data?: string; msg?: string } | null>(null)
  const hasTriggeredRef = useRef(false) // Prevent multiple triggers
  
  // Check if tool reference exists for bitsetter (determines first vs subsequent tool change)
  const toolReferenceKey = `bitsetter.toolReference.${currentWCS}`
  const { data: toolReferenceData } = useGetExtensionsQuery(
    { key: toolReferenceKey },
    { skip: !connectedPort || !currentWCS }
  )

  // Clear tool reference when job starts (workflowState: idle -> running)
  useEffect(() => {
    const prevState = prevWorkflowStateRef.current
    const currentState = workflowState
    
    // Detect job start: idle -> running
    if (prevState === 'idle' && currentState === 'running' && connectedPort && currentWCS) {
      // Clear tool reference when job starts (indicates first tool change)
      const wcsKey = `bitsetter.toolReference.${currentWCS}`
      deleteExtensions({ key: wcsKey }).unwrap().catch((err: unknown) => {
        // 404 means key doesn't exist - this is fine, silently ignore
        const errorRecord = typeof err === 'object' && err !== null ? err as Record<string, unknown> : null
        const status = 
          (errorRecord?.status as number | string | undefined) || 
          (typeof errorRecord?.data === 'object' && errorRecord.data !== null ? (errorRecord.data as Record<string, unknown>)?.status as number | string | undefined : undefined) || 
          undefined
        
        if (status !== 404 && status !== 'FETCH_ERROR') {
          console.error('Failed to clear tool reference on job start:', err)
        }
      })
    }
    
    prevWorkflowStateRef.current = currentState || 'idle'
  }, [workflowState, connectedPort, currentWCS, deleteExtensions])

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
      } else {
        // Look up the method (if strategy is not 'ask')
        const availableMethods = settings?.zeroingMethods?.methods || []
        const method = strategy !== 'ask' 
          ? availableMethods.find((m: ZeroingMethod) => m.id === strategy)
          : null
        
        // Determine if this is first or subsequent tool change (for bitsetter only)
        // Check if tool reference exists: if no reference -> first tool change, if exists -> subsequent
        let isFirstToolChange = true
        if (method?.type === 'bitsetter') {
          // Tool reference exists if toolReferenceData has a value property
          const hasToolReference = toolReferenceData && typeof toolReferenceData === 'object' && 'value' in toolReferenceData
          isFirstToolChange = !hasToolReference
        }
        
        if (strategy === 'ask') {
          // User will choose method - trigger with 'ask'
          triggerToolChange('ask', isFirstToolChange)
        } else if (method) {
          // Found the method - trigger with method object and first/subsequent flag
          triggerToolChange(method, isFirstToolChange)
        } else {
          // Method not found - fall back to 'ask'
          console.warn(`Tool change method with ID "${strategy}" not found. Falling back to "ask".`)
          triggerToolChange('ask', isFirstToolChange)
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
  }, [connectedPort, workflowState, settings, triggerToolChange, sendCommand, isToolChangePending, checkAndTriggerToolChange, toolReferenceData])

  // Detect M6 tool change when workflow pauses (check existing holdReason)
  useEffect(() => {
    if (!connectedPort || workflowState !== 'paused') {
      hasTriggeredRef.current = false // Reset when not paused
      return
    }

    // Check if we already have a holdReason
    checkAndTriggerToolChange(holdReasonRef.current)
  }, [workflowState, connectedPort, settings, triggerToolChange, sendCommand, isToolChangePending, checkAndTriggerToolChange, toolReferenceData])

  // Reset trigger flag when workflow resumes
  useEffect(() => {
    if (workflowState === 'running' || workflowState === 'idle') {
      hasTriggeredRef.current = false
    }
  }, [workflowState])
}
