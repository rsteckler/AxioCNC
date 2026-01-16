import { MachineStatusBar } from './MachineStatusBar'
import { JobStatusBar } from './JobStatusBar'

interface PageStatusBarProps {
  // MachineStatusBar props
  onError?: (title: string, message: string) => void
  
  // JobStatusBar props
  workflowState?: 'idle' | 'running' | 'paused' | null
  isJobRunning?: boolean
  onStart?: () => void
  onStop?: () => void
  onPause?: () => void
  onResume?: () => void
  disabled?: boolean
}

export function PageStatusBar({
  onError,
  workflowState,
  isJobRunning,
  onStart,
  onStop,
  onPause,
  onResume,
  disabled,
}: PageStatusBarProps) {
  return (
    <div className="h-12 border-b border-border bg-muted/30 flex items-center px-4 gap-2">
      <MachineStatusBar onError={onError} />
      
      <JobStatusBar
        workflowState={workflowState}
        isJobRunning={isJobRunning}
        onStart={onStart}
        onStop={onStop}
        onPause={onPause}
        onResume={onResume}
        disabled={disabled}
      />
    </div>
  )
}
