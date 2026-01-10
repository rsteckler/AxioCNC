import type { ZeroingMethod } from '../../../../shared/schemas/settings'

export interface PanelProps {
  isConnected: boolean
  connectedPort: string | null
  machineStatus: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running' | 'hold' | 'error'
  onFlashStatus: () => void
  machinePosition?: { x: number; y: number; z: number }
  workPosition?: { x: number; y: number; z: number }
  currentWCS?: string
  isJobRunning?: boolean
  spindleState?: 'M3' | 'M4' | 'M5'
  spindleSpeed?: number
}

export interface ProbePanelProps extends PanelProps {
  onStartWizard?: (method: ZeroingMethod) => void
}
