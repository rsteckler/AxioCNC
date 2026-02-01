import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, HelpCircle } from 'lucide-react'
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

const TOTAL_STEPS = 3

/**
 * BitZero XY block: multi-step (Place probe → Position tool → Run probe). Calls onComplete only after probe step finishes.
 */
export function BitZeroXYBlock({ methods, context, onComplete, onError, debugAllowNext }: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as BitZeroConfig | undefined
  const { currentWCS, sendGcode, connectedPort } = context

  /** Internal step 1–3; composer sees one block, we advance with Next/Back until step 3 completes. */
  const [step, setStep] = useState(1)
  const [status, setStatus] = useState<'idle' | 'probing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probingRef = useRef(false)

  const runProbe = useCallback(() => {
    if (!method || method.type !== 'bitzero' || (method.axes !== 'xy' && method.axes !== 'xyz') || !connectedPort) return

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

  if (!method || method.type !== 'bitzero' || (method.axes !== 'xy' && method.axes !== 'xyz')) {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  const { machinePosition } = context
  const canGoBack = step > 1

  return (
    <div className="space-y-4">
      {/* Step indicator */}
      <p className="text-xs text-muted-foreground">
        {t('Step {{current}} of {{total}}', { current: step, total: TOTAL_STEPS })}
      </p>

      {/* Step 1: Place BitZero on corner */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">{t('Place BitZero on Corner')}</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t('Place the BitZero probe on the corner of your workpiece, making sure it\'s secure and flat.')}
            </p>
            <p>
              {t('The BitZero should be positioned so the conductive hole in the bottom left (-X-Y) corner is accessible for probing. Make sure the probe is firmly attached and won\'t move during probing.')}
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>{t('Important')}:</strong> {t('Ensure the BitZero is securely mounted and flat against the workpiece. The probe must not move during the zeroing sequence.')}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setStep(2)}>{t('Next')}</Button>
            {debugAllowNext && (
              <Button variant="secondary" size="sm" onClick={() => setStep(2)}>{t('Next (debug)')}</Button>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Position tool in hole */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">{t('Position Tool in Hole')}</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t('Use the jog controls to carefully position the tool into the conductive hole in the bottom left corner of the BitZero probe.')}
            </p>
            <p>
              <strong>{t('Important')}:</strong> {t('The tool should be positioned below the Z surface of the probe (inside the hole). Use small movements when you get close to avoid damaging the tool or probe.')}
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
              <p className="font-medium">{t('Jogging Tips')}:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('Use large movements to get close to the hole')}</li>
                <li>{t('Switch to small movements (0.1mm or less) when approaching the hole')}</li>
                <li>{t('Ensure the tool is positioned below the Z surface of the probe')}</li>
                <li>{t('The tool should be centered in the hole as much as possible')}</li>
              </ul>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">{t('Current Machine Position')}:</div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">X: </span>
                <span className="font-mono">{(machinePosition?.x ?? 0).toFixed(3)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Y: </span>
                <span className="font-mono">{(machinePosition?.y ?? 0).toFixed(3)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Z: </span>
                <span className="font-mono">{(machinePosition?.z ?? 0).toFixed(3)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>{t('Back')}</Button>
            <Button onClick={() => setStep(3)}>{t('Next')}</Button>
            {debugAllowNext && (
              <Button variant="secondary" size="sm" onClick={() => setStep(3)}>{t('Next (debug)')}</Button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Run XY probe */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">{t('Run XY Probe')}</h3>
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t('Press the probe button below to start the XY probe sequence. The tool will:')}
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>{t('Probe right until contact, then probe left to find X edges and calculate X center')}</li>
              <li>{t('Probe top and bottom to find Y edges and calculate Y center')}</li>
            </ol>
            <p>
              {t('After probing, XY zero will be set at the corner of your workpiece.')}
            </p>
          </div>
          {status === 'idle' && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>{t('Warning')}:</strong> {t('Make sure the tool is positioned in the hole below the Z surface before starting. The tool should already be in the hole from the previous step.')}
              </p>
            </div>
          )}
          {status === 'idle' && (
            <Button onClick={runProbe}>
              {t('Run XY probe')}
            </Button>
          )}
          {status === 'probing' && (
            <p className="text-sm text-muted-foreground">{t('Probing…')}</p>
          )}
          {status === 'complete' && (
            <p className="text-sm text-green-600 dark:text-green-400">{t('Done. XY zero set at the corner.')}</p>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage ?? t('Probe error')}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            {canGoBack && status !== 'probing' && (
              <Button variant="outline" onClick={() => setStep(2)}>{t('Back')}</Button>
            )}
            {debugAllowNext && status !== 'complete' && status !== 'error' && (
              <Button variant="secondary" size="sm" onClick={onComplete}>{t('Next (debug)')}</Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
