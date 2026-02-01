import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import type { SetupBlock, SetupPlan } from '@/utils/setupPlan'
import { slotToBlocks } from '@/utils/setupPlan'
import { RenderSetupBlock } from './blocks'
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

export interface ExecutionScreenProps {
  /** Plan with slots (already using overrides from Screen 1). */
  plan: SetupPlan
  methods: ZeroingMethod[]
  context: BlockRunContext
  onComplete: () => void
  onClose: () => void
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
}: ExecutionScreenProps) {
  const { t } = useTranslation()
  const [slotIndex, setSlotIndex] = useState(0)
  const [blockIndex, setBlockIndex] = useState(0)
  /** When current slot is "ask", we resolve to blocks after user picks. This holds the chosen value until we expand. */
  const [resolvedAskValue, setResolvedAskValue] = useState<string[] | null>(null)

  const slots = plan.slots
  const currentSlot = slots[slotIndex]

  const blocksForCurrentSlot = useMemo((): SetupBlock[] => {
    if (!currentSlot) return []
    if (currentSlot.ask && resolvedAskValue === null) return []
    const methodIds = currentSlot.ask ? resolvedAskValue! : currentSlot.methodIds
    const slotWithIds = { ...currentSlot, ask: false, methodIds }
    return slotToBlocks(slotWithIds, methods)
  }, [currentSlot, resolvedAskValue, methods])

  const currentBlock = blocksForCurrentSlot[blockIndex]
  const isAskSlot = currentSlot?.ask && resolvedAskValue === null
  const hasBlocks = blocksForCurrentSlot.length > 0
  const allDone = slotIndex >= slots.length

  const handleBlockComplete = useCallback(() => {
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
  }, [blockIndex, blocksForCurrentSlot.length, slotIndex, slots.length, onComplete])

  const workXYOptions = getWorkXYZeroOptions(methods, t)
  const workZOptions = getWorkZZeroOptions(methods, t)

  if (allDone) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
          <Check className="w-5 h-5" />
          <h2 className="text-lg font-semibold">{t('Ready to run')}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('Setup is complete. You can close this and start the job.')}
        </p>
        <div className="flex justify-end">
          <Button onClick={onClose}>{t('Close')}</Button>
        </div>
      </div>
    )
  }

  if (isAskSlot) {
    const isWorkXY = currentSlot?.kind === 'work_xy'
    const options = isWorkXY ? workXYOptions : workZOptions
    const handleSelect = (value: string) => {
      const arr = parseWorkZeroValue(value)
      setResolvedAskValue(arr)
    }
    const serialized = resolvedAskValue ? serializeWorkZeroValue(resolvedAskValue) : ''

    return (
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
  }

  if (!hasBlocks || !currentBlock) {
    const handleSkipSlot = () => {
      setResolvedAskValue(null)
      setBlockIndex(0)
      setSlotIndex((i) => i + 1)
      if (slotIndex >= slots.length - 1) onComplete()
    }
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('No steps for this slot.')}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSkipSlot}>
            {t('Continue')}
          </Button>
          <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        {currentSlot?.kind === 'work_xy' && t('Set XY zero')}
        {currentSlot?.kind === 'work_z' && t('Set Z zero')}
        {currentSlot?.kind === 'bitsetter' && t('Establish tool reference')}
      </h2>
      <div>
        {RenderSetupBlock(currentBlock, {
          context,
          onComplete: handleBlockComplete,
          onError: (msg) => console.error(msg),
        })}
      </div>
      <div className="flex justify-end">
        <Button variant="outline" onClick={onClose}>{t('Cancel')}</Button>
      </div>
    </div>
  )
}
