import { useCallback, useState } from 'react'
import { Play, Square, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGcodeCommand, useToolChangeDetection } from '@/hooks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ConfirmationDialog } from '@/components/ConfirmationDialog'
import type { MachineReadinessStatus } from '@/types/machine'

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
}: JobStatusBarProps) {
  const { sendCommand } = useGcodeCommand(connectedPort)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  
  // Detect M6 tool changes and trigger tool change flow
  useToolChangeDetection(connectedPort)
  // Determine status from props
  let jobStatus: JobStatus = status || 'not_started'
  
  if (!status) {
    // Derive status from workflowState and isJobRunning
    if (workflowState === 'running' || isJobRunning) {
      jobStatus = 'running'
    } else if (workflowState === 'paused') {
      jobStatus = 'paused'
    } else if (workflowState === 'idle' && !isJobRunning) {
      // If we were running before and now idle, consider it complete
      // Otherwise, it's not started
      jobStatus = 'not_started'
    }
  }

  // Check if machine is in a ready state (can start job)
  const isReadyState = machineStatus === 'connected_pre_home' || machineStatus === 'connected_post_home'
  const needsHomingConfirmation = machineStatus === 'connected_pre_home'

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
    
    // Otherwise start directly
    sendCommand('gcode:start')
  }, [isConnected, connectedPort, needsHomingConfirmation, onFlashStatus, sendCommand])

  const handleStartConfirmed = useCallback(() => {
    if (!isConnected || !connectedPort) {
      return
    }
    sendCommand('gcode:start')
  }, [isConnected, connectedPort, sendCommand])

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
          <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700">
            Paused
          </Badge>
        )
      case 'complete':
        return (
          <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">
            Complete
          </Badge>
        )
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
