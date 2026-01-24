import { useCallback, useState, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Play, Square, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGcodeCommand, useToolChangeDetection } from '@/hooks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmationDialog } from '@/components/ConfirmationDialog'
import { useGetSettingsQuery } from '@/services/api'
import type { MachineReadinessStatus } from '@/types/machine'
import type { ZeroingMethod } from '../../../shared/src/schemas/settings'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

export type JobStatus = 'not_started' | 'running' | 'paused' | 'complete'

interface JobStatusBarProps {
  status?: JobStatus
  workflowState?: 'idle' | 'running' | 'paused' | null
  isJobRunning?: boolean
  connectedPort?: string | null
  isConnected?: boolean
  machineStatus?: MachineReadinessStatus
  onFlashStatus?: () => void
  disabled?: boolean
  hasFile?: boolean
  onStartWizard?: (method: ZeroingMethod | 'ask' | null) => void
}

export function JobStatusBar({
  status,
  workflowState,
  isJobRunning = false,
  connectedPort = null,
  isConnected = false,
  machineStatus,
  onFlashStatus,
  disabled = false,
  hasFile = false,
  onStartWizard,
}: JobStatusBarProps) {
  const { sendCommand } = useGcodeCommand(connectedPort)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const { data: settings } = useGetSettingsQuery()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get completion state from Redux
  const completion = useSelector((state: RootState) => state.job.completion)
  
  // Detect M6 tool changes and trigger tool change flow
  useToolChangeDetection(connectedPort)
  
  // Determine status from props, workflow state, and completion
  const jobStatus: JobStatus = useMemo(() => {
    if (status) {
      return status
    }
    
    // Check if job completed successfully
    if (completion?.reason === 'completed' && completion.wasSuccessful) {
      return 'complete'
    }
    
    // Derive status from workflowState and isJobRunning
    if (workflowState === 'running' || isJobRunning) {
      return 'running'
    } else if (workflowState === 'paused') {
      return 'paused'
    } else if (workflowState === 'idle' && !isJobRunning) {
      // Check if we have completion info indicating it was stopped/error
      if (completion?.reason && completion.reason !== 'completed') {
        // Job was stopped, reset, or had an error - show as not_started for now
        // (could add 'stopped' or 'error' status types later)
        return 'not_started'
      }
      return 'not_started'
    }
    
    return 'not_started'
  }, [status, workflowState, isJobRunning, completion])
  
  // Format completion timestamp
  const completionTime = completion?.timestamp 
    ? new Date(completion.timestamp).toLocaleTimeString()
    : null

  // Check if machine is in a ready state (can start job)
  const isReadyState = machineStatus === 'connected_pre_home' || machineStatus === 'connected_post_home'
  const needsHomingConfirmation = machineStatus === 'connected_pre_home'

  // Helper to start job with optional navigation to Monitor
  const startJobWithNavigation = useCallback(() => {
    // Check if we're in Setup and setting is enabled
    const isInSetup = location.pathname === '/' || location.pathname === '/setup'
    const shouldSwitch = settings?.machine?.autoSwitchToMonitor ?? true // Default to true
    
    if (isInSetup && shouldSwitch) {
      // Navigate to Monitor first, then start job after a brief delay
      navigate('/monitor')
      // Small delay to ensure navigation completes before starting job
      setTimeout(() => {
        sendCommand('gcode:start')
      }, 100)
    } else {
      // Start job directly
      sendCommand('gcode:start')
    }
  }, [location.pathname, settings, navigate, sendCommand])

  // Internal handlers for job control buttons
  const handleStartClick = useCallback(() => {
    if (!isConnected || !connectedPort) {
      onFlashStatus?.()
      return
    }
    
    // If machine needs homing confirmation, show dialog
    if (needsHomingConfirmation) {
      setShowConfirmDialog(true)
      return
    }
    
    // Check zeroing strategy before starting
    const strategy = settings?.zeroingStrategies?.initialSetup
    const methods = settings?.zeroingMethods?.methods ?? []
    
    if (strategy === 'skip') {
      // Skip zeroing - start directly (with navigation check)
      startJobWithNavigation()
    } else if (strategy === 'ask' && onStartWizard) {
      // Show method selection dialog
      onStartWizard('ask')
    } else if (strategy && strategy !== 'ask' && strategy !== 'skip' && onStartWizard) {
      // Find method by ID and open wizard
      const method = methods.find((m: ZeroingMethod) => m.id === strategy)
      if (method && method.enabled) {
        onStartWizard(method)
      } else {
        // Method not found or disabled - start anyway (fallback, with navigation check)
        startJobWithNavigation()
      }
    } else {
      // No wizard handler or strategy not set - start directly (with navigation check)
      startJobWithNavigation()
    }
  }, [isConnected, connectedPort, needsHomingConfirmation, onFlashStatus, sendCommand, settings, onStartWizard, startJobWithNavigation])

  const handleStartConfirmed = useCallback(() => {
    if (!isConnected || !connectedPort) {
      return
    }
    
    // Check zeroing strategy before starting (same logic as handleStartClick)
    const strategy = settings?.zeroingStrategies?.initialSetup
    const methods = settings?.zeroingMethods?.methods ?? []
    
    if (strategy === 'skip') {
      // Skip zeroing - start directly (with navigation check)
      startJobWithNavigation()
    } else if (strategy === 'ask' && onStartWizard) {
      // Show method selection dialog
      onStartWizard('ask')
    } else if (strategy && strategy !== 'ask' && strategy !== 'skip' && onStartWizard) {
      // Find method by ID and open wizard
      const method = methods.find((m: ZeroingMethod) => m.id === strategy)
      if (method && method.enabled) {
        onStartWizard(method)
      } else {
        // Method not found or disabled - start anyway (fallback, with navigation check)
        startJobWithNavigation()
      }
    } else {
      // No wizard handler or strategy not set - start directly (with navigation check)
      startJobWithNavigation()
    }
  }, [isConnected, connectedPort, sendCommand, settings, onStartWizard, startJobWithNavigation])

  const handlePause = useCallback(() => {
    if (!isConnected || !connectedPort) {
      onFlashStatus?.()
      return
    }
    sendCommand('gcode:pause')
  }, [isConnected, connectedPort, onFlashStatus, sendCommand])

  const handleResume = useCallback(() => {
    if (!isConnected || !connectedPort) {
      onFlashStatus?.()
      return
    }
    sendCommand('gcode:resume')
  }, [isConnected, connectedPort, onFlashStatus, sendCommand])

  const handleStop = useCallback(() => {
    if (!isConnected || !connectedPort) {
      onFlashStatus?.()
      return
    }
    sendCommand('gcode:stop', { force: true })
  }, [isConnected, connectedPort, onFlashStatus, sendCommand])

  // Determine why play button is disabled
  const getPlayDisabledReason = (): string | null => {
    if (jobStatus === 'running') {
      return 'Job is already running'
    }
    if (!hasFile) {
      return 'No file loaded'
    }
    if (!isConnected) {
      return 'Machine not connected'
    }
    if (machineStatus === 'alarm') {
      return 'Machine is in alarm state'
    }
    if (machineStatus === 'hold') {
      return 'Machine is in hold state'
    }
    if (machineStatus === 'not_connected') {
      return 'Machine not connected'
    }
    if (!isReadyState) {
      return 'Machine is not ready'
    }
    if (disabled) {
      return 'Action disabled'
    }
    return null
  }

  const playDisabledReason = getPlayDisabledReason()
  const isPlayDisabled = !!playDisabledReason

  const getStatusBadge = () => {
    switch (jobStatus) {
      case 'running':
        return (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            Running
          </Badge>
        )
      case 'paused':
        return (
          <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700 animate-slow-pulse">
            Paused
          </Badge>
        )
      case 'complete': {
        const completionReason = completion?.reason || 'completed'
        const badgeText = completionReason === 'completed' 
          ? 'Complete' 
          : completionReason === 'stopped'
          ? 'Stopped'
          : completionReason === 'reset'
          ? 'Reset'
          : completionReason === 'error'
          ? 'Error'
          : 'Complete'
        
        const badgeColor = completionReason === 'completed'
          ? 'bg-blue-600 hover:bg-blue-700'
          : completionReason === 'stopped'
          ? 'bg-orange-600 hover:bg-orange-700'
          : completionReason === 'reset'
          ? 'bg-purple-600 hover:bg-purple-700'
          : completionReason === 'error'
          ? 'bg-red-600 hover:bg-red-700'
          : 'bg-blue-600 hover:bg-blue-700'
        
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="default" className={badgeColor}>
                  {badgeText}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-medium">{badgeText}</p>
                  {completionTime && (
                    <p className="text-xs text-muted-foreground">
                      Completed at {completionTime}
                    </p>
                  )}
                  {completion?.senderState && (
                    <p className="text-xs text-muted-foreground">
                      {completion.senderState.received} / {completion.senderState.total} lines
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }
      case 'not_started':
      default:
        return (
          <Badge variant="secondary">
            Not Started
          </Badge>
        )
    }
  }

  return (
    <>
      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title="Start Job Without Homing?"
        description={
          <>
            The machine has not been homed. Machine coordinates may not be accurate, which could cause the tool to move to unexpected positions.
            <br /><br />
            Are you sure you want to start the job?
          </>
        }
        confirmLabel="Start Anyway"
        cancelLabel="Cancel"
        onConfirm={handleStartConfirmed}
        variant="destructive"
      />
      
      <div className="flex-1" />
      
      <div className="w-px h-6 bg-border mx-2" />
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Job:</span>
        {getStatusBadge()}
        
        <TooltipProvider>
          <div className="flex items-center gap-1 ml-2">
            {/* Play button - enabled when not started or paused, file is loaded, and machine is ready */}
            {playDisabledReason ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-block">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={jobStatus === 'paused' ? handleResume : handleStartClick}
                      disabled={isPlayDisabled}
                      className="h-7"
                    >
                      <Play className="w-4 h-4 mr-1" /> Play
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{playDisabledReason}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={jobStatus === 'paused' ? handleResume : handleStartClick}
                disabled={isPlayDisabled}
                className="h-7"
              >
                <Play className="w-4 h-4 mr-1" /> Play
              </Button>
            )}
          
          {/* Pause button - enabled when running */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePause}
            disabled={disabled || jobStatus !== 'running'}
            className="h-7"
          >
            <Pause className="w-4 h-4 mr-1" /> Pause
          </Button>
          
            {/* Stop button - enabled when running or paused */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              disabled={disabled || (jobStatus !== 'running' && jobStatus !== 'paused')}
              className="h-7"
            >
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          </div>
        </TooltipProvider>
      </div>
    </>
  )
}
