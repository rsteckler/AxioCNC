/**
 * Setup blocks: single-purpose steps for the Job Setup Wizard.
 * Each block runs one zeroing action (Manual XY, Touchplate Z, BitZero XY, etc.).
 *
 * Use SetupBlockLayout for consistent layout: optional step progress bar,
 * scrollable content, and anchored footer (Back left, actions right).
 * See SetupBlockLayout.tsx JSDoc and ai/docs/setup-block-layout.md for usage.
 */
import type { ReactNode } from 'react'
import type { SetupBlock as SetupBlockType } from '@/utils/setupPlan'
import type { SetupBlockProps } from './types'
import { ManualXYBlock } from './ManualXYBlock'
import { ManualZBlock } from './ManualZBlock'
import { TouchplateBlock } from './TouchplateBlock'
import { BitZeroXYBlock } from './BitZeroXYBlock'
import { BitZeroZBlock } from './BitZeroZBlock'
import { BitZeroXYZBlock } from './BitZeroXYZBlock'
import { BitSetterBlock } from './BitSetterBlock'

export type { SetupBlockProps, BlockRunContext } from './types'
export { SetupBlockLayout, SetupBlockBackButton } from './SetupBlockLayout'
export type { SetupBlockLayoutProps, SetupBlockNextButtonConfig } from './SetupBlockLayout'
export { ManualXYBlock, ManualZBlock, TouchplateBlock, BitZeroXYBlock, BitZeroZBlock, BitZeroXYZBlock, BitSetterBlock }

type RenderBlockProps = Omit<SetupBlockProps, 'methods'>

export function RenderSetupBlock(
  block: SetupBlockType,
  props: RenderBlockProps
): ReactNode {
  const blockProps: SetupBlockProps = { ...props, methods: block.methods, blockKind: block.kind }
  switch (block.kind) {
    case 'manual_xy':
      return <ManualXYBlock {...blockProps} />
    case 'manual_z':
      return <ManualZBlock {...blockProps} />
    case 'touchplate_x':
    case 'touchplate_y':
    case 'touchplate_xy':
    case 'touchplate_z':
      return <TouchplateBlock {...blockProps} />
    case 'bitzero_xy':
      return <BitZeroXYBlock {...blockProps} />
    case 'bitzero_z':
      return <BitZeroZBlock {...blockProps} />
    case 'bitzero_xyz':
      return <BitZeroXYZBlock {...blockProps} />
    case 'bitsetter':
      return <BitSetterBlock {...blockProps} />
    default:
      return null
  }
}
