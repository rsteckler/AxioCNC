import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, HelpCircle, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupBlockLayout } from '@/components/JobSetupWizard/blocks/SetupBlockLayout'
import { buildSetZeroCommand } from '@/utils/gcode'
import type { SetupBlockProps } from '@/components/JobSetupWizard/blocks/types'

const ZERO_TOLERANCE = 0.01

/**
 * Manual Z tool-change block: user jogs to Z work zero, then presses Zero Z on screen.
 * Used only in the Tool Change tab. Can be modified without affecting job setup.
 */
export function ManualZToolChangeBlock({ context, onComplete, debugAllowNext, footerLeftExtra, footerRightExtra }: SetupBlockProps) {
  const { t } = useTranslation()
  const { currentWCS, workPosition, clearBitsetterReference, sendGcode, connectedPort } = context

  const isZZero = Math.abs(workPosition.z) < ZERO_TOLERANCE
  const skipNote = t('You can skip this tool change if the correct tool is already installed and calibrated to the correct Z zero.')

  const handleZeroZ = useCallback(() => {
    if (!connectedPort) return
    const cmd = buildSetZeroCommand(currentWCS, 'z')
    sendGcode(cmd)
  }, [currentWCS, sendGcode, connectedPort])

  const handleNext = useCallback(async () => {
    await clearBitsetterReference(currentWCS)
    onComplete()
  }, [currentWCS, clearBitsetterReference, onComplete])

  return (
    <SetupBlockLayout
      title={t('Manual Z tool change')}
      subtitle={t('Use the jog controls to move to the correct Z location, then press the Zero Z button on this screen.')}
      footerLeft={(
        <div className="flex flex-col gap-1 max-w-md">
          {footerLeftExtra}
          <p className="text-xs text-muted-foreground">{skipNote}</p>
        </div>
      )}
      nextButton={{ onClick: handleNext }}
      footerRight={
        <>
          <Button variant="outline" onClick={onComplete}>
            {t('Skip')}
          </Button>
          {footerRightExtra}
          {debugAllowNext && (
            <Button variant="secondary" size="sm" onClick={onComplete}>{t('Next (debug)')}</Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            {t('Use the jog controls in the left panel to move the tool to Z work zero (e.g. top of material or paper test). Then press the Zero Z button below to set the current position as work zero.')}
          </p>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {t('The Zero Z button on this screen sends a command to the controller to set the current position as Z work zero. Then press Next to continue.')}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex justify-center py-2">
            <Button
              onClick={handleZeroZ}
              size="lg"
              className="gap-2"
              disabled={!connectedPort || isZZero}
            >
              <Target className="w-5 h-5" />
              {t('Zero Z')}
            </Button>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">{t('Work zero status')}</p>
            <div className="flex flex-wrap gap-2">
              <div
                className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                  isZZero
                    ? 'border-green-500/50 bg-green-500/15 text-green-800 dark:text-green-200'
                    : 'border-muted bg-muted/50 text-muted-foreground'
                }`}
              >
                {isZZero ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />}
                Z {isZZero ? t('Zero set') : `(${workPosition.z.toFixed(3)})`}
              </div>
            </div>
            {!isZZero && (
              <p className="text-xs text-muted-foreground">
                {t('Use jog to reach Z work zero and press the Zero Z button above, or press Next to continue.')}
              </p>
            )}
          </div>
        </div>
      </div>
    </SetupBlockLayout>
  )
}
