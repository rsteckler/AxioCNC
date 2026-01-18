/**
 * Shared types for zeroing wizard components
 */

export type ProbeStatus = 'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'

export interface ZeroingWizardSharedProps {
  method: any // ZeroingMethod - will be typed properly when imported
  currentStep: number
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  currentWCS?: string
  isConnected: boolean
  connectedPort: string | null
  sendGcode: (cmd: string) => void
  clearBitsetterReference: (wcs: string) => Promise<void>
  setExtensions: any // UseSetExtensionsMutation - typed when used
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
