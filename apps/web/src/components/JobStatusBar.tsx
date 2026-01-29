import { useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
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
import { useSelector, useDispatch } from 'react-redux'
import type { RootState } from '@/store'
import { clearJobCompletion } from '@/store/jobSlice'
import { track } from '@/services/analytics'

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
  const { t } = useTranslation()
  const { sendCommand } = useGcodeCommand(connectedPort)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const { data: settings } = useGetSettingsQuery()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  
  // Get completion state and job state from Redux
  const completion = useSelector((state: RootState) => state.job.completion)
  const jobState = useSelector((state: RootState) => state.job)
  
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
  const startJobWithNavigation = useCallback((isResume = false) => {
    // Track analytics for job start (not resume)
    if (!isResume && jobStatus !== 'paused') {
      track('job_started', {
        file_name: jobState.name || 'unknown',
        file_size: jobState.size || 0,
        line_count: jobState.total || 0,
      })
    }
    
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
  }, [location.pathname, settings, navigate, sendCommand, jobStatus, jobState])

  // Internal handlers for job control buttons
  const handleStartClick = useCallback(() => {
    if (!isConnected || !connectedPort) {
      onFlashStatus?.()
      return
    }
    
    // If job was previously complete, clear completion state to reset status to 'not_started'
    // This ensures the status immediately shows as 'not_started' before transitioning to 'running'
    if (jobStatus === 'complete') {
      dispatch(clearJobCompletion())
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
  }, [isConnected, connectedPort, needsHomingConfirmation, onFlashStatus, sendCommand, settings, onStartWizard, startJobWithNavigation, jobStatus, dispatch])

  const handleStartConfirmed = useCallback(() => {
    if (!isConnected || !connectedPort) {
      return
    }
    
    // If job was previously complete, clear completion state to reset status to 'not_started'
    // This ensures the status immediately shows as 'not_started' before transitioning to 'running'
    if (jobStatus === 'complete') {
      dispatch(clearJobCompletion())
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
  }, [isConnected, connectedPort, sendCommand, settings, onStartWizard, startJobWithNavigation, jobStatus, dispatch])

  const handlePause = useCallback(() => {
    if (!isConnected || !connectedPort) {
      onFlashStatus?.()
      return
    }
    track('job_paused', {
      reason: 'user_action',
    })
    sendCommand('gcode:pause')
  }, [isConnected, connectedPort, onFlashStatus, sendCommand])

  const handleResume = useCallback(() => {
    if (!isConnected || !connectedPort) {
      onFlashStatus?.()
      return
    }
    track('job_resumed', {
      reason: 'user_action',
    })
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
      return t('Job is already running')
    }
    if (!hasFile) {
      return t('No file loaded')
    }
    if (!isConnected) {
      return t('Machine not connected')
    }
    if (machineStatus === 'alarm') {
      return t('Machine is in alarm state')
    }
    if (machineStatus === 'hold') {
      return t('Machine is in hold state')
    }
    if (machineStatus === 'not_connected') {
      return t('Machine not connected')
    }
    if (!isReadyState) {
      return t('Machine is not ready')
    }
    if (disabled) {
      return t('Action disabled')
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
            {t('Running')}
          </Badge>
        )
      case 'paused':
        return (
          <Badge variant="default" className="bg-yellow-600 hover:bg-yellow-700 animate-slow-pulse">
            {t('Paused')}
          </Badge>
        )
      case 'complete': {
        const completionReason = completion?.reason || 'completed'
        const badgeText = completionReason === 'completed' 
          ? t('Complete')
          : completionReason === 'stopped'
          ? t('Stopped')
          : completionReason === 'reset'
          ? t('Reset')
          : completionReason === 'error'
          ? t('Error')
          : t('Complete')
        
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
                      {t('Completed at {{time}}', { time: completionTime })}
                    </p>
                  )}
                  {completion?.senderState && (
                    <p className="text-xs text-muted-foreground">
                      {completion.senderState.received} / {completion.senderState.total} {t('lines')}
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
            {t('Not Started')}
          </Badge>
        )
    }
  }

  return (
    <>
      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        title={t('Start Job Without Homing?')}
        description={
          <>
            {t('The machine has not been homed. Machine coordinates may not be accurate, which could cause the tool to move to unexpected positions.')}
            <br /><br />
            {t('Are you sure you want to start the job?')}
          </>
        }
        confirmLabel={t('Start Anyway')}
        cancelLabel={t('Cancel')}
        onConfirm={handleStartConfirmed}
        variant="destructive"
      />
      
      <div className="flex-1" />
      
      <div className="w-px h-6 bg-border mx-2" />
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">{t('Job:')}</span>
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
                      <Play className="w-4 h-4 mr-1" /> {t('Play')}
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
                <Play className="w-4 h-4 mr-1" /> {t('Play')}
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
            <Pause className="w-4 h-4 mr-1" /> {t('Pause')}
          </Button>
          
            {/* Stop button - enabled when running or paused */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              disabled={disabled || (jobStatus !== 'running' && jobStatus !== 'paused')}
              className="h-7"
            >
              <Square className="w-4 h-4 mr-1" /> {t('Stop')}
            </Button>
          </div>
        </TooltipProvider>
      </div>
    </>
  )
}
