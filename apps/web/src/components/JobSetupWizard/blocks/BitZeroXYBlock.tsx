import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildSetZeroCommand } from '@/utils/gcode'
import { socketService } from '@/services/socket'
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
 * BitZero XY block: probe X and Y, set XY work zero. Does not touch Z.
 */
export function BitZeroXYBlock({ methods, context, onComplete, onError }: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as BitZeroConfig | undefined
  const { currentWCS, sendGcode, connectedPort } = context

  const [status, setStatus] = useState<'idle' | 'probing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probingRef = useRef(false)

  const runProbe = useCallback(() => {
    if (!method || method.type !== 'bitzero' || method.axes !== 'xy' || !connectedPort) return

    const probeDistance = method.probeDistance ?? 25
    const probeFeedrateA = method.probeFeedrate ?? 150
    const probeFeedrateB = 50
    const probeMajorRetract = 2
    const setXZeroCommand = buildSetZeroCommand(currentWCS, 'x')
    const setYZeroCommand = buildSetZeroCommand(currentWCS, 'y')

    const macroLines = [
      'G91',
      'G21',
      '',
      '; X-Axis Probing',
      `G38.2 X${probeDistance} F${probeFeedrateA}`,
      'G0 X-2',
      `G38.2 X5 F${probeFeedrateB}`,
      'G90',
      '%X_RIGHT=posx',
      'G91',
      `G0 X-${probeMajorRetract}`,
      '',
      `G38.2 X-${probeDistance} F${probeFeedrateA}`,
      'G0 X2',
      `G38.2 X-5 F${probeFeedrateB}`,
      'G90',
      '%X_LEFT=posx',
      '',
      '%X_CHORD=X_RIGHT-X_LEFT',
      '%X_OFFSET=X_CHORD/2',
      'G91',
      'G0 X[X_OFFSET]',
      'G4 P1',
      setXZeroCommand,
      '',
      '; Y-Axis Probing',
      'G91',
      `G38.2 Y${probeDistance} F${probeFeedrateA}`,
      'G0 Y-2',
      `G38.2 Y5 F${probeFeedrateB}`,
      'G90',
      '%Y_TOP=posy',
      'G91',
      `G0 Y-${probeMajorRetract}`,
      '',
      `G38.2 Y-${probeDistance} F${probeFeedrateA}`,
      'G0 Y2',
      `G38.2 Y-5 F${probeFeedrateB}`,
      'G90',
      '%Y_BTM=posy',
      '',
      '%Y_CHORD=Y_TOP-Y_BTM',
      '%Y_OFFSET=Y_CHORD/2',
      'G91',
      'G0 Y[Y_OFFSET]',
      'G4 P1',
      setYZeroCommand,
      '',
      'G90',
      'G0 X0 Y0',
      'G4 P1',
    ]
    const macroString = processMacro(macroLines.join('\n'))

    setStatus('probing')
    setErrorMessage(null)
    probingRef.current = true
    sendGcode(macroString)
  }, [method, connectedPort, currentWCS, sendGcode])

  useEffect(() => {
    const handleFeederStatus = (...args: unknown[]) => {
      if (!probingRef.current) return
      const data = args[0] as { queue?: number; pending?: boolean; hold?: boolean }
      if (data.queue === 0 && !data.pending && !data.hold) {
        probingRef.current = false
        setStatus('complete')
        onComplete()
      }
    }
    socketService.on('feeder:status', handleFeederStatus)
    return () => socketService.off('feeder:status', handleFeederStatus)
  }, [onComplete])

  useEffect(() => {
    if (status !== 'probing') return
    const handleRead = (...args: unknown[]) => {
      const msg = String(args[0] ?? '')
      if (msg.includes('error') || msg.includes('alarm') || msg.includes('Error')) {
        probingRef.current = false
        setStatus('error')
        setErrorMessage(msg.trim() || t('Probe error'))
        onError(msg.trim() || t('Probe error'))
      }
    }
    socketService.on('serialport:read', handleRead)
    return () => socketService.off('serialport:read', handleRead)
  }, [status, t, onError])

  if (!method || method.type !== 'bitzero' || method.axes !== 'xy') {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('BitZero XY: position the probe, then run the XY probe.')}
      </p>
      {status === 'idle' && (
        <Button onClick={runProbe}>
          {t('Run XY probe')}
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
    </div>
  )
}
