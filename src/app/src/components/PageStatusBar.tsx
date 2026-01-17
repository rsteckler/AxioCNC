import { MachineStatusBar } from './MachineStatusBar'
import { JobStatusBar } from './JobStatusBar'

interface PageStatusBarProps {
  // MachineStatusBar props
  onError?: (title: string, message: string) => void
  
  // JobStatusBar props
  workflowState?: 'idle' | 'running' | 'paused' | null
  isJobRunning?: boolean
  connectedPort?: string | null
  isConnected?: boolean
  machineStatus?: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running' | 'hold' | 'error'
  onFlashStatus?: () => void
  disabled?: boolean
  hasFile?: boolean
}

export function PageStatusBar({
  onError,
  workflowState,
  isJobRunning,
  connectedPort,
  isConnected,
  machineStatus,
  onFlashStatus,
  disabled,
  hasFile,
}: PageStatusBarProps) {
  return (
    <div className="h-12 border-b border-border bg-muted/30 flex items-center px-4 gap-2">
      <MachineStatusBar onError={onError} />
      
      <JobStatusBar
        workflowState={workflowState}
        isJobRunning={isJobRunning}
        connectedPort={connectedPort}
        isConnected={isConnected}
        machineStatus={machineStatus}
        onFlashStatus={onFlashStatus}
        disabled={disabled}
        hasFile={hasFile}
      />
    </div>
  )
}
