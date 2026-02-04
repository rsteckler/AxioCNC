import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { runGcodeBatch } from '@/utils/runGcodeBatch'
import { SetupBlockLayout } from '@/components/JobSetupWizard/blocks/SetupBlockLayout'
import type { SetupBlockProps } from '@/components/JobSetupWizard/blocks/types'
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'

type CustomConfig = Extract<ZeroingMethod, { type: 'custom' }>

/**
 * Custom Z tool-change block: run the method's custom G-code, then complete.
 * Used only in the Tool Change tab. Can be modified without affecting job setup.
 */
export function CustomZToolChangeBlock({
  methods,
  context,
  onComplete,
  onError,
  debugAllowNext,
  footerRightExtra,
}: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as CustomConfig | undefined
  const { connectedPort, currentWCS, clearBitsetterReference } = context

  const [status, setStatus] = useState<'idle' | 'probing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probeStartedRef = useRef(false)

  const runCustomGcode = useCallback(async () => {
    if (!connectedPort || !method || method.type !== 'custom') return

    if (method.axes?.includes?.('z')) {
      await clearBitsetterReference(currentWCS)
    }

    const gcodeString = (method as CustomConfig).gcode?.trim() ?? ''
    if (!gcodeString) {
      setErrorMessage(t('No G-code found. Please configure the custom G-code in settings.'))
      setStatus('error')
      onError(t('No G-code configured'))
      return
    }

    const processedGcode = gcodeString
      .split(/\r?\n/)
      .map((line: string) => {
        const trimmed = line.trim()
        if (trimmed.startsWith('%') && !trimmed.match(/^%msg\b/i) && !trimmed.match(/^%wait\b/i)) {
          return trimmed.replace(/;.*$/, '').trim()
        }
        return line
      })
      .join('\n')

    setStatus('probing')
    setErrorMessage(null)
    probeStartedRef.current = true

    runGcodeBatch({ gcode: processedGcode, port: connectedPort })
      .then(() => {
        probeStartedRef.current = false
        setStatus('complete')
      })
      .catch((err) => {
        probeStartedRef.current = false
        setErrorMessage(err?.message ?? t('Error sending G-code'))
        setStatus('error')
        onError(err?.message ?? t('Error sending G-code'))
      })
  }, [connectedPort, method, currentWCS, clearBitsetterReference, onError, t])

  if (!method || method.type !== 'custom') {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  const customMethod = method as CustomConfig
  const canComplete = status === 'complete'

  return (
    <SetupBlockLayout
      subtitle={t('Run your custom G-code to set Z (or axes) for the new tool.')}
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
            {t('Review the custom G-code below and press the button to execute it. The G-code will run sequentially until complete.')}
          </p>
        </div>

        {status === 'idle' && (
          <div className="flex justify-center py-4">
            <Button
              onClick={runCustomGcode}
              variant="default"
              size="lg"
              className="gap-2"
              disabled={!connectedPort || !customMethod.gcode}
            >
              <Target className="w-5 h-5" />
              {t('Run Custom G-code')}
            </Button>
          </div>
        )}

        {(status === 'probing' || status === 'complete' || status === 'error') && (
          <div
            className={`p-3 rounded-lg border ${
              status === 'complete'
                ? 'bg-green-500/10 border-green-500/30'
                : status === 'error'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
            }`}
          >
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  status === 'complete' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'
                }`}
              />
              <span className="text-sm font-medium">
                {status === 'complete' && t('G-code Execution Complete')}
                {status === 'error' && t('Error During Execution')}
                {status === 'probing' && t('Executing G-code...')}
              </span>
            </div>
            {errorMessage && (
              <p className="text-xs text-red-900 dark:text-red-100 mt-1 ml-5">{errorMessage}</p>
            )}
          </div>
        )}

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-sm font-medium mb-2">{t('Custom G-code')}:</div>
          <pre className="text-xs font-mono bg-background border rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
            {customMethod.gcode || t('(No G-code configured)')}
          </pre>
        </div>

        <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-900 dark:text-yellow-100">
            <strong>{t('Warning')}:</strong>{' '}
            {t('Make sure the machine is in a safe state before running the G-code.')}
          </p>
        </div>
      </div>
    </SetupBlockLayout>
  )
}
