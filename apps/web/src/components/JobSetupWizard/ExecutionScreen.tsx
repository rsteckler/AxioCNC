import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import type { SetupBlock, SetupPlan, SetupBlockKind } from '@/utils/setupPlan'
import { slotToBlocks } from '@/utils/setupPlan'
import { RenderSetupBlock, SetupBlockBackButton } from './blocks'
import type { BlockRunContext } from './blocks'
import {
  getWorkXYZeroOptions,
  getWorkZZeroOptions,
  serializeWorkZeroValue,
  parseWorkZeroValue,
} from '@/utils/zeroingStrategyOptions'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'

export interface ExecutionStepInfo {
  slotIndex: number
  slotKind: 'work_xy' | 'work_z' | 'work_xyz' | 'bitsetter' | undefined
  /** Current block kind when executing a slot (e.g. bitzero_z, touchplate_z). */
  blockKind?: SetupBlockKind
  isAskSlot: boolean
  allDone: boolean
}

export interface ExecutionScreenProps {
  /** Plan with slots (already using overrides from Screen 1). */
  plan: SetupPlan
  methods: ZeroingMethod[]
  context: BlockRunContext
  onComplete: () => void
  onClose: () => void
  /** Go back to plan summary (dialog only). */
  onBack?: () => void
  /** Notify parent of current step for header title/progress. */
  onStepChange?: (info: ExecutionStepInfo) => void
  /** Called when a block that sets work zero (X, Y, or Z) completes. Use e.g. to place the model in the visualizer. */
  onPlaceModel?: () => void
  /** Current step index (1-based) for block progress bar. */
  stepIndex?: number
  /** Total steps for block progress bar. */
  totalSteps?: number
  /** When true, rendered inside tab (no dialog footer layout). */
  embedded?: boolean
}

/**
 * Screen 2+: Execute plan slots. For "ask" slots, show picker then run chosen blocks.
 */
export function ExecutionScreen({
  plan,
  methods,
  context,
  onComplete,
  onClose,
  onBack,
  onStepChange,
  onPlaceModel,
  stepIndex = 1,
  totalSteps = 1,
  embedded = false,
}: ExecutionScreenProps) {
  const { t } = useTranslation()
  const [slotIndex, setSlotIndex] = useState(0)
  const [blockIndex, setBlockIndex] = useState(0)
  /** When current slot is "ask", we resolve to blocks after user picks. This holds the chosen value until we expand. */
  const [resolvedAskValue, setResolvedAskValue] = useState<string[] | null>(null)

  // Debug: allow advancing setup job flow without completing the step (from DebugPanel toggle)
  const [debugAllowNext, setDebugAllowNext] = useState(() => localStorage.getItem('debug.allowNextToolchangeScreen') === 'true')
  useEffect(() => {
    const handle = () => setDebugAllowNext(localStorage.getItem('debug.allowNextToolchangeScreen') === 'true')
    window.addEventListener('debug.allowNextToolchangeScreen.changed', handle)
    return () => window.removeEventListener('debug.allowNextToolchangeScreen.changed', handle)
  }, [])

  const slots = plan.slots
  const currentSlot = slots[slotIndex]
  const isAskSlot = currentSlot?.ask && resolvedAskValue === null
  const allDone = slotIndex >= slots.length

  const blocksForCurrentSlot = useMemo((): SetupBlock[] => {
    if (!currentSlot) return []
    if (currentSlot.ask && resolvedAskValue === null) return []
    const methodIds = currentSlot.ask ? resolvedAskValue! : currentSlot.methodIds
    const slotWithIds = { ...currentSlot, ask: false, methodIds }
    return slotToBlocks(slotWithIds, methods)
  }, [currentSlot, resolvedAskValue, methods])

  const currentBlock = blocksForCurrentSlot[blockIndex]
  const hasBlocks = blocksForCurrentSlot.length > 0

  useEffect(() => {
    onStepChange?.({
      slotIndex,
      slotKind: currentSlot?.kind,
      blockKind: currentBlock?.kind,
      isAskSlot,
      allDone,
    })
  }, [slotIndex, currentSlot?.kind, currentBlock?.kind, isAskSlot, allDone, onStepChange])

  const handleBlockComplete = useCallback(() => {
    // Place model whenever user completes a zeroing block (X, Y, or Z). Short delay so work position can update.
    if (onPlaceModel) {
      setTimeout(onPlaceModel, 150)
    }
    if (blockIndex < blocksForCurrentSlot.length - 1) {
      setBlockIndex((i) => i + 1)
    } else {
      setBlockIndex(0)
      setResolvedAskValue(null)
      setSlotIndex((i) => i + 1)
      if (slotIndex + 1 >= slots.length) {
        onComplete()
      }
    }
  }, [blockIndex, blocksForCurrentSlot.length, slotIndex, slots.length, onComplete, onPlaceModel])

  const workXYOptions = getWorkXYZeroOptions(methods, t)
  const workZOptions = getWorkZZeroOptions(methods, t)

  /** Dialog: scrollable content + anchored footer with Back (left) and actions (right). */
  const withDialogLayout = (content: React.ReactNode, footerContent: React.ReactNode) => {
    if (embedded) {
      return (
        <>
          {content}
          <div className="flex justify-end gap-2 pt-4">{footerContent}</div>
        </>
      )
    }
    return (
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto py-2 px-2">
          {content}
        </div>
        <div className="flex shrink-0 items-center justify-between gap-2 pt-4 border-t">
          <div>
            {onBack ? (
              <SetupBlockBackButton onClick={onBack} />
            ) : null}
          </div>
          <div className="flex gap-2">{footerContent}</div>
        </div>
      </div>
    )
  }

  if (allDone) {
    const content = (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check className="w-5 h-5" />
          <h2 className="text-lg font-semibold">{t('Ready to run')}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('Setup is complete. You can close this and start the job.')}
        </p>
      </div>
    )
    return withDialogLayout(content, <Button onClick={onClose}>{t('Close')}</Button>)
  }

  if (isAskSlot) {
    const isWorkXY = currentSlot?.kind === 'work_xy'
    const options = isWorkXY ? workXYOptions : workZOptions
    const handleSelect = (value: string) => {
      const arr = parseWorkZeroValue(value)
      setResolvedAskValue(arr)
    }
    const serialized = resolvedAskValue ? serializeWorkZeroValue(resolvedAskValue) : ''

    const content = (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          {isWorkXY ? t('Choose how to set XY zero') : t('Choose how to set Z zero')}
        </h2>
        <Select value={serialized || undefined} onValueChange={handleSelect}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder={t('Select…')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => {
              const val = serializeWorkZeroValue(opt.value)
              return (
                <SelectItem key={val} value={val}>
                  {opt.label}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {t('This choice applies to this job only.')}
        </p>
      </div>
    )
    return withDialogLayout(content, null)
  }

  if (!hasBlocks || !currentBlock) {
    const handleSkipSlot = () => {
      setResolvedAskValue(null)
      setBlockIndex(0)
      setSlotIndex((i) => i + 1)
      if (slotIndex >= slots.length - 1) onComplete()
    }
    const content = (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('No steps for this slot.')}</p>
      </div>
    )
    const footer = (
      <>
        <Button variant="outline" onClick={handleSkipSlot}>
          {t('Continue')}
        </Button>
      </>
    )
    return withDialogLayout(content, footer)
  }

  const blockProgress = (
    <div className="flex w-full items-center gap-0 py-2 px-2 mb-2" role="progressbar" aria-valuenow={stepIndex} aria-valuemin={1} aria-valuemax={totalSteps}>
      {Array.from({ length: totalSteps * 2 + 1 }, (_, i) => {
        if (i % 2 === 0) {
          const lineIndex = i / 2
          const segmentComplete = stepIndex > lineIndex
          const isFirstLine = i === 0
          const isLastLine = i === totalSteps * 2
          const lineFlex = isFirstLine || isLastLine ? 'flex-none w-0' : 'min-w-0 flex-1'
          return (
            <div
              key={`line-${i}`}
              className={`h-0.5 ${lineFlex} ${segmentComplete ? 'bg-primary/60' : 'bg-muted-foreground/30'}`}
              aria-hidden
            />
          )
        }
        const stepNum = (i + 1) / 2
        const isActive = stepNum === stepIndex
        const isComplete = stepNum < stepIndex
        return (
          <div key={stepNum} className="flex shrink-0 items-center">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : isComplete
                    ? 'bg-primary/80 text-primary-foreground'
                    : 'border-2 border-muted-foreground/40 bg-background text-muted-foreground'
              }`}
            >
              {isComplete ? (
                <span className="text-xs" aria-hidden>✓</span>
              ) : (
                stepNum
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const blockFooterLeft = onBack ? (
    <SetupBlockBackButton onClick={onBack} />
  ) : null

  const isBlockWithMergedFooter = currentBlock.kind === 'bitzero_xy' || currentBlock.kind === 'bitzero_z' || currentBlock.kind === 'bitzero_xyz' || currentBlock.kind === 'bitsetter' || currentBlock.kind === 'touchplate_x' || currentBlock.kind === 'touchplate_y' || currentBlock.kind === 'touchplate_xy' || currentBlock.kind === 'touchplate_z'
  /** Blocks that render their own step progress or are single-step (manual); hide slot progress. */
  const blockHasInternalProgress = currentBlock.kind === 'bitzero_xy' || currentBlock.kind === 'bitzero_z' || currentBlock.kind === 'bitzero_xyz' || currentBlock.kind === 'bitsetter' || currentBlock.kind === 'manual_xy' || currentBlock.kind === 'manual_z' || currentBlock.kind === 'touchplate_x' || currentBlock.kind === 'touchplate_y' || currentBlock.kind === 'touchplate_xy' || currentBlock.kind === 'touchplate_z'

  const content = (
    <div className="flex w-full min-h-0 flex-1 flex-col gap-6">
      {!blockHasInternalProgress && blockProgress}
      <div
        className="flex min-h-0 flex-1 flex-col"
        key={`block-${slotIndex}-${blockIndex}-${currentBlock?.kind ?? ''}`}
      >
        {RenderSetupBlock(currentBlock, {
          context,
          onComplete: handleBlockComplete,
          onError: (msg) => console.error(msg),
          debugAllowNext,
          ...(isBlockWithMergedFooter && {
            footerLeftExtra: blockFooterLeft,
          }),
        })}
      </div>
    </div>
  )

  if (isBlockWithMergedFooter) {
    if (embedded) {
      return <>{content}</>
    }
    return (
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto py-2 px-2">
          {content}
        </div>
      </div>
    )
  }

  return withDialogLayout(content, null)
}
