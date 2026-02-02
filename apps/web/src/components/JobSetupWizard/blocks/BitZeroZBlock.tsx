import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildSetZeroWithOffsetCommand } from '@/utils/gcode'
import { runGcodeBatch } from '@/utils/runGcodeBatch'
import type { SetupBlockProps } from './types'
import type { BitZeroConfig } from '@/routes/Settings/sections/ZeroingMethodsSection'

function processMacro(macro: string): string {
  return macro
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed.startsWith('%') && !trimmed.match(/^%msg\b/i) && !trimmed.match(/^%wait\b/i)) {
        return trimmed.replace(/;.*$/, '').trim()
      }
      return trimmed
    })
    .filter((line) => line.length > 0)
    .join('\n')
}

/**
 * BitZero Z block: probe Z and set Z work zero. Clears BitSetter reference.
 */
export function BitZeroZBlock({ methods, context, onComplete, onError, debugAllowNext }: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as BitZeroConfig | undefined
  const { currentWCS, clearBitsetterReference, connectedPort } = context

  const [status, setStatus] = useState<'idle' | 'probing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probingRef = useRef(false)

  const runProbe = useCallback(async () => {
    if (!method || method.type !== 'bitzero' || (method.axes !== 'z' && method.axes !== 'xyz') || !connectedPort) return

    await clearBitsetterReference(currentWCS)

    const probeDistance = method.probeDistance ?? 25
    const probeFeedrateA = method.probeFeedrate ?? 150
    const probeFeedrateB = 50
    const zFinal = 15
    const setZZeroCommand = buildSetZeroWithOffsetCommand(currentWCS, 'Z', method.probeThickness ?? 12.7)

    const macroLines = [
      'G91',
      'G21',
      '',
      '; Z-Axis Probing',
      `G38.2 Z-${probeDistance} F${probeFeedrateA}`,
      'G0 Z2',
      `G38.2 Z-5 F${probeFeedrateB}`,
      setZZeroCommand,
      `G0 Z${zFinal}`,
      '',
      'G90',
    ]
    const macroString = processMacro(macroLines.join('\n'))

    setStatus('probing')
    setErrorMessage(null)
    probingRef.current = true
    runGcodeBatch({ gcode: macroString, port: connectedPort })
      .then(() => {
        probingRef.current = false
        setStatus('complete')
        onComplete()
      })
      .catch((err) => {
        probingRef.current = false
        setStatus('error')
        const msg = err?.message ?? t('Probe error')
        setErrorMessage(msg)
        onError(msg)
      })
  }, [method, connectedPort, currentWCS, clearBitsetterReference, onComplete, onError, t])

  if (!method || method.type !== 'bitzero' || (method.axes !== 'z' && method.axes !== 'xyz')) {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('BitZero Z: position the probe at XY, then run the Z probe.')}
      </p>
      {status === 'idle' && (
        <Button onClick={runProbe}>
          {t('Run Z probe')}
        </Button>
      )}
      {status === 'probing' && (
        <p className="text-sm text-muted-foreground">{t('Probing…')}</p>
      )}
      {status === 'complete' && (
        <p className="text-sm text-green-600 dark:text-green-400">{t('Done.')}</p>
      )}
      {status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage ?? t('Probe error')}</span>
        </div>
      )}
      {debugAllowNext && status !== 'complete' && status !== 'error' && (
        <Button variant="secondary" size="sm" onClick={onComplete}>{t('Next (debug)')}</Button>
      )}
    </div>
  )
}
