import { useEffect, useRef, useCallback } from 'react'
import { useGetSettingsQuery, useGetExtensionsQuery } from '@/services/api'
import { useToolChange } from '@/contexts/ToolChangeContext'
import { JOB_TOOL_CHANGE_POLICY_KEY } from '@/contexts/ToolChangeContext'
import { useWorkflowState } from '@/store/hooks'
import { socketService } from '@/services/socket'
import type { ZeroingMethod } from '../../../shared/src/schemas/settings'

/**
 * Hook to detect M6 tool change pauses and trigger tool change flow
 * Should be used in JobStatusBar or similar components that handle job state
 */
export function useToolChangeDetection(connectedPort: string | null) {
  const { triggerToolChange, isToolChangePending } = useToolChange()
  const workflowState = useWorkflowState()
  const { data: settings } = useGetSettingsQuery()
  const { data: jobPolicyData } = useGetExtensionsQuery({ key: JOB_TOOL_CHANGE_POLICY_KEY })

  // Track holdReason from sender:status events
  const holdReasonRef = useRef<{ data?: string; msg?: string } | null>(null)
  const hasTriggeredRef = useRef(false) // Prevent multiple triggers

  // Keep refs to latest values so socket callbacks always use current data (avoids stale closure)
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  const jobPolicyRef = useRef(jobPolicyData)
  jobPolicyRef.current = jobPolicyData

  // All tool changes during the job are treated as subsequent. Initial tool reference is
  // established in job setup (Set up job wizard BitSetter block), so the first M6 in the
  // job is already a "subsequent" flow (navigate to BitSetter, probe, adjust Z).
  const isFirstToolChange = false

  // Helper function to check and trigger tool change.
  // Reads policy from settingsRef so we always use the latest saved tool change method.
  const checkAndTriggerToolChange = useCallback((holdReason: { data?: string; msg?: string } | null) => {
    if (!connectedPort || workflowState !== 'paused' || isToolChangePending || hasTriggeredRef.current) {
      return
    }

    if (holdReason?.data === 'M6') {
      hasTriggeredRef.current = true
      const currentSettings = settingsRef.current
      const jobPolicy = jobPolicyRef.current
      const jobMethodId =
        jobPolicy && typeof jobPolicy === 'object' && 'methodId' in jobPolicy && typeof (jobPolicy as { methodId?: string }).methodId === 'string'
          ? (jobPolicy as { methodId: string }).methodId
          : null
      // Job setup choice overrides global default; fall back to zeroing defaults if no job policy
      const policy = jobMethodId ?? currentSettings?.zeroingStrategies?.toolChangePolicy ?? 'ask'
      const allMethods = currentSettings?.zeroingMethods?.methods ?? []
      const availableMethods = allMethods.filter((m: ZeroingMethod) => m.enabled)
      const method = policy !== 'ask'
        ? availableMethods.find((m: ZeroingMethod) => m.id === policy)
        : null

      if (policy === 'ask') {
        triggerToolChange('ask', isFirstToolChange)
      } else if (method) {
        triggerToolChange(method, isFirstToolChange)
      } else {
        console.warn(`Tool change method with ID "${policy}" not found or disabled. Falling back to "ask".`)
        triggerToolChange('ask', isFirstToolChange)
      }
    }
  }, [connectedPort, workflowState, isToolChangePending, triggerToolChange, isFirstToolChange])

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
  }, [connectedPort, workflowState, triggerToolChange, isToolChangePending, checkAndTriggerToolChange])

  // Detect M6 tool change when workflow pauses (check existing holdReason)
  useEffect(() => {
    if (!connectedPort || workflowState !== 'paused') {
      hasTriggeredRef.current = false // Reset when not paused
      return
    }

    // Check if we already have a holdReason
    checkAndTriggerToolChange(holdReasonRef.current)
  }, [workflowState, connectedPort, triggerToolChange, isToolChangePending, checkAndTriggerToolChange])

  // Reset trigger flag and clear stale hold when workflow resumes or job starts.
  // This avoids triggering on a stale M6 from a previous run (e.g. after Skip -> navigate to Monitor -> gcode:start).
  useEffect(() => {
    if (workflowState === 'running' || workflowState === 'idle') {
      hasTriggeredRef.current = false
      holdReasonRef.current = null
    }
  }, [workflowState])
}
