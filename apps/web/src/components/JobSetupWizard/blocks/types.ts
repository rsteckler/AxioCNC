/**
 * Shared props for setup blocks. Blocks are single-purpose steps (Manual XY, Touchplate Z, etc.).
 */
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'
import type { SetupBlockKind } from '@/utils/setupPlan'

export interface BlockRunContext {
  connectedPort: string | null
  currentWCS: string
  sendGcode: (gcode: string) => boolean
  clearBitsetterReference: (wcs: string) => Promise<void>
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  /** Store first-tool reference (Z at bitsetter contact). Used by BitSetter block. */
  storeBitsetterReference?: (wcs: string, value: number) => Promise<void>
  /** Probe contact from controller pinState ('P'). Used on verify step to show Contact Detected / No Contact. */
  probeContact?: boolean
}

export interface SetupBlockProps {
  /** Method config(s) for this block. One for most blocks; two for "Touchplate X then Y". */
  methods: ZeroingMethod[]
  /** Block kind (touchplate_x, touchplate_y, touchplate_z) so TouchplateBlock knows which axis when method.axes is xyz. */
  blockKind?: SetupBlockKind
  context: BlockRunContext
  onComplete: () => void
  onError: (message: string) => void
  /** Debug: when true, block shows "Next (debug)" to advance without completing the step. Used in tool change tab. */
  debugAllowNext?: boolean
  /** Optional slot for parent to inject e.g. Back (to plan) on the left of the block footer. */
  footerLeftExtra?: React.ReactNode
  /** Optional slot for parent to inject e.g. Cancel on the right of the block footer. */
  footerRightExtra?: React.ReactNode
}
