import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupBlockLayout } from './SetupBlockLayout'
import type { SetupBlockProps } from './types'

const ZERO_TOLERANCE = 0.01

/**
 * Manual Z block: one step. User positions Z at work zero (e.g. paper test), then presses Z zero in the DRO panel.
 * Clears BitSetter reference when step is completed. Z indicator lights up green when work position Z is zero.
 */
export function ManualZBlock({ context, onComplete, debugAllowNext, footerLeftExtra, footerRightExtra }: SetupBlockProps) {
  const { t } = useTranslation()
  const { currentWCS, workPosition, clearBitsetterReference } = context

  const isZZero = Math.abs(workPosition.z) < ZERO_TOLERANCE
  const canComplete = isZZero

  const handleNext = useCallback(async () => {
    await clearBitsetterReference(currentWCS)
    onComplete()
  }, [currentWCS, clearBitsetterReference, onComplete])

  return (
    <SetupBlockLayout
      subtitle={t('Use jog controls and the DRO to set Z work zero.')}
      footerLeft={footerLeftExtra}
      nextButton={{
        onClick: handleNext,
        disabled: !canComplete,
      }}
      footerRight={
        <>
          {footerRightExtra}
          {debugAllowNext && !canComplete && (
            <Button variant="secondary" size="sm" onClick={onComplete}>{t('Next (debug)')}</Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            {t('Position the tool at Z work zero (e.g. top of material or paper test). Then press the Z zero button in the DRO panel to set work zero.')}
          </p>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {t('The DRO panel shows work position. Use the zero button next to Z to set the current position as work zero.')}
          </p>
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
          {!canComplete && (
            <p className="text-xs text-muted-foreground">
              {t('Set Z to zero in the DRO, then Next will be enabled.')}
            </p>
          )}
        </div>
      </div>
    </SetupBlockLayout>
  )
}
