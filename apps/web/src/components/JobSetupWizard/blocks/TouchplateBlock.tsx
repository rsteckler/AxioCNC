import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { buildSetZeroWithOffsetCommand } from '@/utils/gcode'
import { socketService } from '@/services/socket'
import type { SetupBlockProps } from './types'
import type { TouchPlateConfig } from '@/routes/Settings/sections/ZeroingMethodsSection'

/**
 * Touchplate block: single-axis probe (X, Y, or Z). Sends probe + set zero + retract; completes on feeder idle.
 */
export function TouchplateBlock({ methods, context, onComplete, onError }: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as TouchPlateConfig | undefined
  const { currentWCS, sendGcode, clearBitsetterReference, connectedPort } = context

  const [status, setStatus] = useState<'idle' | 'probing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probingRef = useRef(false)

  const runProbe = useCallback(async () => {
    if (!method || method.type !== 'touchplate' || !connectedPort) return

    if (method.axes === 'z') {
      await clearBitsetterReference(currentWCS)
    }

    const axis = method.axes.toUpperCase() as 'X' | 'Y' | 'Z'
    const setZeroCommand = buildSetZeroWithOffsetCommand(currentWCS, axis, method.plateThickness)
    const probeCmd = `G38.2 ${axis}-${method.probeDistance} F${method.probeFeedrate}`
    const retractCmd = `G0 ${axis}10`
    const commands = [
      'G21',
      'M5',
      'G90',
      'G91',
      probeCmd,
      'G90',
      setZeroCommand,
      'G91',
      retractCmd,
      'G90',
    ]

    setStatus('probing')
    setErrorMessage(null)
    probingRef.current = true

    commands.forEach((cmd, index) => {
      setTimeout(() => sendGcode(cmd), index * 100)
    })
  }, [method, connectedPort, currentWCS, clearBitsetterReference, sendGcode])

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

  if (!method || method.type !== 'touchplate') {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  const axisLabel = method.axes.toUpperCase()

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('Touch plate ({{axis}}): place the plate and run the probe.', { axis: axisLabel })}
      </p>
      {status === 'idle' && (
        <Button onClick={runProbe}>
          {t('Run {{axis}} probe', { axis: axisLabel })}
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
