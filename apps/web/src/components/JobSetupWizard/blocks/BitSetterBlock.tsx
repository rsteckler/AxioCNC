import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { socketService } from '@/services/socket'
import type { SetupBlockProps } from './types'
import type { BitSetterConfig } from '@/routes/Settings/sections/ZeroingMethodsSection'

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
 * BitSetter block (pre-job): navigate to bitsetter, probe first tool, capture Z and store as reference.
 * Single-purpose step for "establish tool reference" after Z zero is set.
 */
export function BitSetterBlock({ methods, context, onComplete, onError }: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as BitSetterConfig | undefined
  const {
    connectedPort,
    currentWCS,
    sendGcode,
    workPosition,
    storeBitsetterReference,
  } = context

  const [phase, setPhase] = useState<'idle' | 'navigate' | 'probing' | 'storing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probingRef = useRef(false)

  const navigate = useCallback(() => {
    if (!method || method.type !== 'bitsetter' || !connectedPort) return
    setPhase('navigate')
    const safeHeight = -5
    const commands = [
      'G90',
      `G53 G0 Z${safeHeight}`,
      `G53 G0 X${method.position.x} Y${method.position.y}`,
      `G53 G0 Z${method.position.z}`,
    ]
    commands.forEach((cmd, index) => {
      setTimeout(() => sendGcode(cmd), index * 300)
    })
    setTimeout(() => setPhase('idle'), commands.length * 300 + 500)
  }, [method, connectedPort, sendGcode])

  const runProbe = useCallback(() => {
    if (!method || method.type !== 'bitsetter' || !connectedPort) return

    const probeDistance = method.probeDistance ?? 50
    const probeRapidFeedrate = method.probeFeedrate ?? 200

    const macroLines = [
      '%wait',
      '',
      '%UNITS = modal.units',
      '%DISTANCE = modal.distance',
      '%FEEDRATE = modal.feedrate',
      '%SPINDLE = modal.spindle',
      '%MOTION = modal.motion',
      '',
      'G21',
      'M5',
      '',
      'G91',
      `G38.2 Z-${probeDistance} F${probeRapidFeedrate}`,
      'G0 z2',
      'G38.2 z-5 F40',
      'G4 P.25',
      'G38.4 z10 F20',
      'G4 P.25',
      'G38.2 z-2 F10',
      'G4 P.25',
      'G38.4 z10 F5',
      'G4 P.25',
      '',
      '[UNITS] [DISTANCE] [FEEDRATE] [SPINDLE] [MOTION]',
      '',
      '%wait',
    ]
    const macroString = processMacro(macroLines.join('\n'))

    setPhase('probing')
    setErrorMessage(null)
    probingRef.current = true
    sendGcode(macroString)
  }, [method, connectedPort, sendGcode])

  useEffect(() => {
    const handleFeederStatus = (...args: unknown[]) => {
      if (!probingRef.current || phase !== 'probing') return
      const data = args[0] as { queue?: number; pending?: boolean; hold?: boolean }
      if (data.queue === 0 && !data.pending && !data.hold) {
        probingRef.current = false
        setPhase('storing')
        const zRef = workPosition.z
        if (storeBitsetterReference) {
          storeBitsetterReference(currentWCS, zRef)
            .then(() => {
              sendGcode('G90')
              setTimeout(() => {
                sendGcode('G53 G0 Z-5')
                setTimeout(() => sendGcode('G0 X0 Y0'), 500)
              }, 200)
              setPhase('complete')
              onComplete()
            })
            .catch((err) => {
              setPhase('error')
              setErrorMessage(err?.message ?? t('Failed to store tool reference'))
              onError(err?.message ?? t('Failed to store tool reference'))
            })
        } else {
          sendGcode('G90')
          setTimeout(() => {
            sendGcode('G53 G0 Z-5')
            setTimeout(() => sendGcode('G0 X0 Y0'), 500)
          }, 200)
          setPhase('complete')
          onComplete()
        }
      }
    }
    socketService.on('feeder:status', handleFeederStatus)
    return () => socketService.off('feeder:status', handleFeederStatus)
  }, [phase, currentWCS, workPosition.z, storeBitsetterReference, sendGcode, onComplete, onError, t])

  useEffect(() => {
    if (phase !== 'probing') return
    const handleRead = (...args: unknown[]) => {
      const msg = String(args[0] ?? '')
      if (msg.includes('error') || msg.includes('alarm') || msg.includes('Error')) {
        probingRef.current = false
        setPhase('error')
        setErrorMessage(msg.trim() || t('Probe error'))
        onError(msg.trim() || t('Probe error'))
      }
    }
    socketService.on('serialport:read', handleRead)
    return () => socketService.off('serialport:read', handleRead)
  }, [phase, t, onError])

  if (!method || method.type !== 'bitsetter') {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('We need a reference measurement for the tool currently in the spindle. Navigate to the BitSetter, then run the probe.')}
      </p>
      {phase === 'idle' && (
        <div className="flex flex-col gap-2">
          <Button onClick={navigate}>
            {t('Navigate to BitSetter')}
          </Button>
          <Button variant="outline" onClick={runProbe}>
            {t('Run probe')}
          </Button>
        </div>
      )}
      {(phase === 'navigate' || phase === 'probing' || phase === 'storing') && (
        <p className="text-sm text-muted-foreground">
          {phase === 'navigate' && t('Moving to BitSetter…')}
          {phase === 'probing' && t('Probing…')}
          {phase === 'storing' && t('Storing reference…')}
        </p>
      )}
      {phase === 'complete' && (
        <p className="text-sm text-green-600 dark:text-green-400">{t('Done.')}</p>
      )}
      {phase === 'error' && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage ?? t('Error')}</span>
        </div>
      )}
    </div>
  )
}
