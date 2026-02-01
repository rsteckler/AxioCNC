/**
 * Shared props for setup blocks. Blocks are single-purpose steps (Manual XY, Touchplate Z, etc.).
 */
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'

export interface BlockRunContext {
  connectedPort: string | null
  currentWCS: string
  sendGcode: (gcode: string) => boolean
  clearBitsetterReference: (wcs: string) => Promise<void>
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  /** Store first-tool reference (Z at bitsetter contact). Used by BitSetter block. */
  storeBitsetterReference?: (wcs: string, value: number) => Promise<void>
}

export interface SetupBlockProps {
  /** Method config(s) for this block. One for most blocks; two for "Touchplate X then Y". */
  methods: ZeroingMethod[]
  context: BlockRunContext
  onComplete: () => void
  onError: (message: string) => void
}
