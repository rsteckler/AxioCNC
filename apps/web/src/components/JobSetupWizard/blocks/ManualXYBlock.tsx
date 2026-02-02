import { useTranslation } from 'react-i18next'
import { Check, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SetupBlockLayout } from './SetupBlockLayout'
import type { SetupBlockProps } from './types'

const ZERO_TOLERANCE = 0.001

/**
 * Manual XY block: one step. User jogs to desired XY, then presses XY zero in the DRO panel.
 * Axis indicators (X, Y) light up green when work position for that axis is zero.
 */
export function ManualXYBlock({ context, onComplete, debugAllowNext, footerLeftExtra, footerRightExtra }: SetupBlockProps) {
  const { t } = useTranslation()
  const { workPosition } = context

  const isXZero = Math.abs(workPosition.x) < ZERO_TOLERANCE
  const isYZero = Math.abs(workPosition.y) < ZERO_TOLERANCE
  const canComplete = isXZero && isYZero

  return (
    <SetupBlockLayout
      subtitle={t('Use jog controls and the DRO to set XY work zero.')}
      footerLeft={footerLeftExtra}
      nextButton={{
        onClick: onComplete,
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
            {t('Use the jog controls to move the tool to the XY position you want as work zero. Then press the X and Y zero buttons in the DRO panel to set work zero.')}
          </p>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-900 dark:text-blue-100">
            {t('The DRO panel shows work position. Use the zero buttons next to X and Y to set the current position as work zero.')}
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('Work zero status')}</p>
          <div className="flex flex-wrap gap-2">
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                isXZero
                  ? 'border-green-500/50 bg-green-500/15 text-green-800 dark:text-green-200'
                  : 'border-muted bg-muted/50 text-muted-foreground'
              }`}
            >
              {isXZero ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />}
              X {isXZero ? t('Zero set') : `(${workPosition.x.toFixed(3)})`}
            </div>
            <div
              className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                isYZero
                  ? 'border-green-500/50 bg-green-500/15 text-green-800 dark:text-green-200'
                  : 'border-muted bg-muted/50 text-muted-foreground'
              }`}
            >
              {isYZero ? <Check className="w-4 h-4" /> : <span className="w-4 h-4" />}
              Y {isYZero ? t('Zero set') : `(${workPosition.y.toFixed(3)})`}
            </div>
          </div>
          {!canComplete && (
            <p className="text-xs text-muted-foreground">
              {t('Set both X and Y to zero in the DRO, then Next will be enabled.')}
            </p>
          )}
        </div>
      </div>
    </SetupBlockLayout>
  )
}
