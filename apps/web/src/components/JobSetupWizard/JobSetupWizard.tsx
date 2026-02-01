import { useState, useMemo, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
export function JobSetupWizard({ open, onClose, onSetupComplete }: JobSetupWizardProps) {
  const { t } = useTranslation()
  const [screen, setScreen] = useState<1 | 2>(1)
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !open })
  const methods = useMemo(
    () => settings?.zeroingMethods?.methods ?? [],
    [settings?.zeroingMethods?.methods]
  )
  const strategiesFromSettings = settings?.zeroingStrategies ?? DEFAULT_STRATEGIES

  const [overrides, setOverrides] = useState(DEFAULT_STRATEGIES)

  useEffect(() => {
    if (open) {
      setScreen(1)
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
    }),
    [
      connectedPort,
      sendGcode,
      clearBitsetterReference,
      machinePosition,
      workPosition,
      storeBitsetterReference,
    ]
  )

  const handleOverrideChange = useCallback(
    (next: Partial<typeof overrides>) => {
      setOverrides((prev) => ({ ...prev, ...next }))
    },
    []
  )

  const handleContinue = useCallback(() => {
    setScreen(2)
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

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Set up job')}</DialogTitle>
        </DialogHeader>
        {screen === 1 ? (
          <PlanSummaryScreen
            summary={plan.summary}
            overrides={overrides}
            methods={methods}
            onOverrideChange={handleOverrideChange}
            onContinue={handleContinue}
            onClose={onClose}
          />
        ) : (
          <ExecutionScreen
            plan={plan}
            methods={methods}
            context={context}
            onComplete={() => onSetupComplete?.()}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
