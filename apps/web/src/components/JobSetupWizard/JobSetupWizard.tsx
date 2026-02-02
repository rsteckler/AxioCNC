import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useGetSettingsQuery } from '@/services/api'
import { useGcodeCommand, useBitsetterReference } from '@/hooks'
import { useMachinePosition, useWorkPosition } from '@/store/hooks'
import { deriveSetupPlan } from '@/utils/setupPlan'
import { useSetExtensionsMutation } from '@/services/api'
import { PlanSummaryScreen } from './PlanSummaryScreen'
import { ExecutionScreen } from './ExecutionScreen'
import type { BlockRunContext } from './blocks'

export interface JobSetupWizardProps {
  open: boolean
  onClose: () => void
  /** Called when user completes all setup steps (last block done). Use e.g. to close and start job when opened from Run. */
  onSetupComplete?: () => void
  /** When true, render as tab content (no Dialog). When false, render inside a Dialog. */
  embedded?: boolean
  /** Probe contact from controller pinState ('P'). Shown on verify step (BitZero/Touchplate/BitSetter) to confirm circuit. */
  probeContact?: boolean
}

const DEFAULT_STRATEGIES = {
  workXYZero: ['ask'] as string[],
  workZZero: ['ask'] as string[],
  toolChangePolicy: 'ask',
}

/**
 * Job Setup Wizard (Phase 4): Plan summary + execution with composable blocks.
 * Entry point is not wired here — Phase 5 adds the "Set up job" button and optional Run flow.
 */
export function JobSetupWizard({ open, onClose, onSetupComplete, embedded = false, probeContact = false }: JobSetupWizardProps) {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<1 | 2>(1)
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !open })
  const methods = useMemo(
    () => settings?.zeroingMethods?.methods ?? [],
    [settings?.zeroingMethods?.methods]
  )
  const strategiesFromSettings = settings?.zeroingStrategies ?? DEFAULT_STRATEGIES

  const [overrides, setOverrides] = useState(DEFAULT_STRATEGIES)

  const [executionStepInfo, setExecutionStepInfo] = useState<{
    slotIndex: number
    slotKind: 'work_xy' | 'work_z' | 'work_xyz' | 'bitsetter' | undefined
    isAskSlot: boolean
    allDone: boolean
  } | null>(null)

  useEffect(() => {
    if (open) {
      setScreen(1)
      setExecutionStepInfo(null)
      if (settings?.zeroingStrategies) {
        const s = settings.zeroingStrategies
        setOverrides({
          workXYZero: s.workXYZero ?? DEFAULT_STRATEGIES.workXYZero,
          workZZero: s.workZZero ?? DEFAULT_STRATEGIES.workZZero,
          toolChangePolicy: s.toolChangePolicy ?? DEFAULT_STRATEGIES.toolChangePolicy,
        })
      }
    }
  }, [open, settings?.zeroingStrategies])

  const strategies = useMemo(
    () => ({
      workXYZero: overrides.workXYZero,
      workZZero: overrides.workZZero,
      toolChangePolicy: overrides.toolChangePolicy,
    }),
    [overrides]
  )

  const plan = useMemo(
    () => deriveSetupPlan(strategies, methods, t),
    [strategies, methods, t]
  )

  const connectedPort = settings?.connection?.port ?? null
  const { sendGcode } = useGcodeCommand(connectedPort)
  const { clearBitsetterReference } = useBitsetterReference()
  const machinePosition = useMachinePosition()
  const workPosition = useWorkPosition()
  const [setExtensions] = useSetExtensionsMutation()
  const currentWCS = 'G54'

  const storeBitsetterReference = useCallback(
    async (wcs: string, value: number) => {
      const key = `bitsetter.toolReference.${wcs}`
      await setExtensions({
        key,
        data: { value, wcs, timestamp: new Date().toISOString() },
      }).unwrap()
    },
    [setExtensions]
  )

  const context: BlockRunContext = useMemo(
    () => ({
      connectedPort,
      currentWCS,
      sendGcode,
      clearBitsetterReference,
      machinePosition: machinePosition ?? { x: 0, y: 0, z: 0 },
      workPosition: workPosition ?? { x: 0, y: 0, z: 0 },
      storeBitsetterReference,
      probeContact,
    }),
    [
      connectedPort,
      sendGcode,
      clearBitsetterReference,
      machinePosition,
      workPosition,
      storeBitsetterReference,
      probeContact,
    ]
  )

  const handleOverrideChange = useCallback(
    (next: Partial<typeof overrides>) => {
      setOverrides((prev) => ({ ...prev, ...next }))
    },
    []
  )

  const totalSteps = 1 + plan.slots.length

  const handleExecutionStepChange = useCallback(
    (info: { slotIndex: number; slotKind: 'work_xy' | 'work_z' | 'work_xyz' | 'bitsetter' | undefined; isAskSlot: boolean; allDone: boolean }) => {
      setExecutionStepInfo(info)
    },
    []
  )

  const { stepTitle, stepSubtitle, stepIndex } = useMemo(() => {
    if (screen === 1) {
      return {
        stepIndex: 1,
        stepTitle: t('Set Up Job'),
        stepSubtitle: t('Confirm the settings for each part of this job.'),
      }
    }
    if (!executionStepInfo) {
      return {
        stepIndex: 2,
        stepTitle: t('Set XY Zero'),
        stepSubtitle: t('Set the work XY zero using the method you chose.'),
      }
    }
    const { slotIndex, slotKind, isAskSlot, allDone } = executionStepInfo
    const stepIndex = allDone ? totalSteps : slotIndex + 2
    if (allDone) {
      return {
        stepIndex,
        stepTitle: t('Ready to Run'),
        stepSubtitle: t('Setup is complete. You can close and start the job.'),
      }
    }
    if (isAskSlot) {
      const isWorkXY = slotKind === 'work_xy'
      return {
        stepIndex,
        stepTitle: isWorkXY ? t('Choose how to set XY zero') : t('Choose how to set Z zero'),
        stepSubtitle: t('This choice applies to this job only.'),
      }
    }
    switch (slotKind) {
      case 'work_xy':
        return { stepIndex, stepTitle: t('Set XY Zero'), stepSubtitle: t('Set the work XY zero using the method you chose.') }
      case 'work_z':
        return { stepIndex, stepTitle: t('Set Z Zero'), stepSubtitle: t('Set the work Z zero using the method you chose.') }
      case 'work_xyz':
        return { stepIndex, stepTitle: t('Set XY and Z Zero'), stepSubtitle: t('Set XY and Z zero at the corner using BitZero (combined probe).') }
      case 'bitsetter':
        return {
          stepIndex,
          stepTitle: t('Establish Tool Reference'),
          stepSubtitle: t('Probe the current tool on the BitSetter to establish the job tool reference.'),
        }
      default:
        return { stepIndex, stepTitle: t('Set Up Job'), stepSubtitle: '' }
    }
  }, [screen, executionStepInfo, totalSteps, t])

  const handleContinue = useCallback(() => {
    setScreen(2)
    setExecutionStepInfo(null)
  }, [])

  const handleDialogOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        onClose()
        setScreen(1)
        setOverrides(strategiesFromSettings?.workXYZero ? strategiesFromSettings : DEFAULT_STRATEGIES)
      }
    },
    [onClose, strategiesFromSettings]
  )

  const cancelLink = (
    <button
      type="button"
      onClick={onClose}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
    >
      <X className="h-4 w-4" />
      {t('Cancel')}
    </button>
  )

  const headerContent = (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {stepTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {stepSubtitle}
          </DialogDescription>
        </div>
        <div className="shrink-0">{cancelLink}</div>
      </div>
    </>
  )

  const content = (
    <>
      {!embedded && (
        <DialogHeader className="relative -m-6 mb-4 flex flex-col space-y-3 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 px-6 py-5 text-foreground">
          {headerContent}
        </DialogHeader>
      )}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {screen === 1 ? (
          <PlanSummaryScreen
            summary={plan.summary}
            overrides={overrides}
            methods={methods}
            onOverrideChange={handleOverrideChange}
            onContinue={handleContinue}
            onClose={onClose}
            embedded={embedded}
          />
        ) : (
          <ExecutionScreen
            plan={plan}
            methods={methods}
            context={context}
            onComplete={() => onSetupComplete?.()}
            onClose={onClose}
            onBack={() => setScreen(1)}
            onStepChange={handleExecutionStepChange}
            stepIndex={stepIndex}
            totalSteps={totalSteps}
            embedded={embedded}
          />
        )}
      </div>
    </>
  )

  if (embedded) {
    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-auto">
        <div className="w-full min-w-0 flex flex-col flex-1 min-h-0">
          <header className="flex items-start justify-between gap-4 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 px-4 py-4 text-foreground shrink-0">
            <div className="min-w-0 space-y-1.5">
              <h2 className="text-xl font-semibold tracking-tight">{stepTitle}</h2>
              <p className="text-sm text-muted-foreground">{stepSubtitle}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded"
            >
              <X className="h-4 w-4" />
              {t('Cancel')}
            </button>
          </header>
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
            {content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col min-h-[50vh] gap-0 p-6">
        {content}
      </DialogContent>
    </Dialog>
  )
}
