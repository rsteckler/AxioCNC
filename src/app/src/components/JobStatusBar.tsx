import React from 'react'
import { Play, Square, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export type JobStatus = 'not_started' | 'running' | 'paused' | 'complete'

interface JobStatusBarProps {
  status?: JobStatus
  workflowState?: 'idle' | 'running' | 'paused' | null
  isJobRunning?: boolean
  onStart?: () => void
  onStop?: () => void
  onPause?: () => void
  onResume?: () => void
  disabled?: boolean
}

export function JobStatusBar({
  status,
  workflowState,
  isJobRunning = false,
  onStart,
  onStop,
  onPause,
  onResume,
  disabled = false,
}: JobStatusBarProps) {
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
      <div className="flex-1" />
      
      <div className="w-px h-6 bg-border mx-2" />
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Job:</span>
        {getStatusBadge()}
        
        <div className="flex items-center gap-1 ml-2">
          {/* Play button - enabled when not started or paused */}
          <Button
            variant="outline"
            size="sm"
            onClick={jobStatus === 'paused' && onResume ? onResume : onStart}
            disabled={disabled || (jobStatus === 'running') || !(onStart || onResume)}
            className="h-7"
          >
            <Play className="w-4 h-4 mr-1" /> Play
          </Button>
          
          {/* Pause button - enabled when running */}
          <Button
            variant="outline"
            size="sm"
            onClick={onPause}
            disabled={disabled || (jobStatus !== 'running') || !onPause}
            className="h-7"
          >
            <Pause className="w-4 h-4 mr-1" /> Pause
          </Button>
          
          {/* Stop button - enabled when running or paused */}
          <Button
            variant="outline"
            size="sm"
            onClick={onStop}
            disabled={disabled || (jobStatus !== 'running' && jobStatus !== 'paused') || !onStop}
            className="h-7"
          >
            <Square className="w-4 h-4 mr-1" /> Stop
          </Button>
        </div>
      </div>
    </>
  )
}
