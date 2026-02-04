/**
 * Tool-change blocks: separate copies of BitSetter, Touchplate Z, Manual Z, and Custom Z
 * for the mid-job Tool Change tab. Changes here do not affect the Job Setup Wizard blocks.
 */
import type { ReactNode } from 'react'
import type { SetupBlock as SetupBlockType } from '@/utils/setupPlan'
import type { SetupBlockProps } from '@/components/JobSetupWizard/blocks/types'
import { BitSetterToolChangeBlock } from './BitSetterToolChangeBlock'
import { TouchplateZToolChangeBlock } from './TouchplateZToolChangeBlock'
import { ManualZToolChangeBlock } from './ManualZToolChangeBlock'
import { CustomZToolChangeBlock } from './CustomZToolChangeBlock'

export { BitSetterToolChangeBlock } from './BitSetterToolChangeBlock'
export { TouchplateZToolChangeBlock } from './TouchplateZToolChangeBlock'
export { ManualZToolChangeBlock } from './ManualZToolChangeBlock'
export { CustomZToolChangeBlock } from './CustomZToolChangeBlock'

type RenderBlockProps = Omit<SetupBlockProps, 'methods'>

/**
 * Renders the appropriate tool-change block for the given block config.
 * Only handles kinds used by the Tool Change tab: bitsetter, touchplate_z, manual_z, custom_z.
 */
export function RenderToolChangeBlock(
  block: SetupBlockType,
  props: RenderBlockProps
): ReactNode {
  const blockProps: SetupBlockProps = { ...props, methods: block.methods, blockKind: block.kind }
  switch (block.kind) {
    case 'bitsetter':
      return <BitSetterToolChangeBlock {...blockProps} />
    case 'touchplate_z':
      return <TouchplateZToolChangeBlock {...blockProps} />
    case 'manual_z':
      return <ManualZToolChangeBlock {...blockProps} />
    case 'custom_z':
      return <CustomZToolChangeBlock {...blockProps} />
    default:
      return null
  }
}
