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
  senderState?: {
    name?: string
    size?: number
    total?: number
    sent?: number
    received?: number
    elapsedTime?: number
    remainingTime?: number
    nextM6ToolNumber?: number
    remainingTimeToNextM6?: number
  }
  feedrate?: number
  rxBufferSize?: number
  currentTool?: number
}

export interface ProbePanelProps extends PanelProps {
  onStartWizard?: (method: ZeroingMethod) => void
}
