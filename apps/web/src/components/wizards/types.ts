/**
 * Shared types for zeroing wizard components
 */

import type { ZeroingMethod } from '../../../../../packages/shared/src/schemas/settings'

export type ProbeStatus = 'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'

// Type for setExtensions mutation - using the return type from RTK Query mutation hook
export type SetExtensionsMutation = [
  (extensions: Record<string, unknown>) => Promise<unknown>,
  { isLoading: boolean; error: unknown }
]

export interface ZeroingWizardSharedProps {
  method: ZeroingMethod
  currentStep: number
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  currentWCS?: string
  isConnected: boolean
  connectedPort: string | null
  sendGcode: (cmd: string) => void
  clearBitsetterReference: (wcs: string) => Promise<void>
  setExtensions: SetExtensionsMutation
  probeStatus?: ProbeStatus
  probeError?: string | null
  onProbeStatusChange?: (status: ProbeStatus) => void
  onProbeErrorChange?: (error: string | null) => void
  bitsetterNavigated?: boolean
  onBitsetterNavigatedChange?: (navigated: boolean) => void
}

export interface ZeroingWizardStepProps {
  step: number
  sharedProps: ZeroingWizardSharedProps
}
