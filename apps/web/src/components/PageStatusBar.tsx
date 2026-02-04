import { MachineStatusBar } from './MachineStatusBar'
import { JobStatusBar } from './JobStatusBar'
import type { ZeroingMethod } from '../../../shared/src/schemas/settings'

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
  onStartWizard?: (method: ZeroingMethod | null) => void
  /** Open Job Setup Wizard (e.g. when Run is clicked). When user completes setup, caller starts job. */
  onOpenJobSetupWizard?: (options: { pendingJobStart: boolean }) => void
  /** When false, hide the Play button (e.g. on Monitor). Default true. */
  showPlayButton?: boolean
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
  onStartWizard,
  onOpenJobSetupWizard,
  showPlayButton,
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
        onStartWizard={onStartWizard}
        onOpenJobSetupWizard={onOpenJobSetupWizard}
        showPlayButton={showPlayButton}
      />
    </div>
  )
}
