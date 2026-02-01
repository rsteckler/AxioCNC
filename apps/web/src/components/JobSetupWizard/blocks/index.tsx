/**
 * Setup blocks: single-purpose steps for the Job Setup Wizard.
 * Each block runs one zeroing action (Manual XY, Touchplate Z, BitZero XY, etc.).
 */
import type { ReactNode } from 'react'
import type { SetupBlock as SetupBlockType } from '@/utils/setupPlan'
import type { SetupBlockProps } from './types'
import { ManualXYBlock } from './ManualXYBlock'
import { ManualZBlock } from './ManualZBlock'
import { TouchplateBlock } from './TouchplateBlock'
import { BitZeroXYBlock } from './BitZeroXYBlock'
import { BitZeroZBlock } from './BitZeroZBlock'
import { BitSetterBlock } from './BitSetterBlock'

export type { SetupBlockProps, BlockRunContext } from './types'
export { ManualXYBlock, ManualZBlock, TouchplateBlock, BitZeroXYBlock, BitZeroZBlock, BitSetterBlock }

type RenderBlockProps = Omit<SetupBlockProps, 'methods'>

export function RenderSetupBlock(
  block: SetupBlockType,
  props: RenderBlockProps
): ReactNode {
  const blockProps: SetupBlockProps = { ...props, methods: block.methods }
  switch (block.kind) {
    case 'manual_xy':
      return <ManualXYBlock {...blockProps} />
    case 'manual_z':
      return <ManualZBlock {...blockProps} />
    case 'touchplate_x':
    case 'touchplate_y':
    case 'touchplate_z':
      return <TouchplateBlock {...blockProps} />
    case 'bitzero_xy':
      return <BitZeroXYBlock {...blockProps} />
    case 'bitzero_z':
      return <BitZeroZBlock {...blockProps} />
    case 'bitsetter':
      return <BitSetterBlock {...blockProps} />
    default:
      return null
  }
}
