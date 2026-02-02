import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildSetZeroCommand } from '@/utils/gcode'
import { runGcodeBatch } from '@/utils/runGcodeBatch'
import { SetupBlockLayout } from './SetupBlockLayout'
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
 * BitZero XY block: multi-step (optional verify probe → Place probe → Position tool → Run probe). Calls onComplete only after probe step finishes.
 * Step 1 (verify probe) only shows when method.requireCheck is true (same as old wizard).
 */
export function BitZeroXYBlock({ methods, context, onComplete, onError, debugAllowNext, footerLeftExtra, footerRightExtra }: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as BitZeroConfig | undefined
  const { currentWCS, connectedPort } = context

  /** When false, skip step 1 (verify); 3 steps total (Place, Position, Run). When true, 4 steps (Verify, Place, Position, Run). */
  const showVerifyStep = method?.requireCheck !== false
  const totalSteps = showVerifyStep ? 4 : 3
  /** Step index for Run probe (last step). */
  const runStep = showVerifyStep ? 4 : 3

  /** Internal step 1–totalSteps; we advance with Next/Back until run step completes. */
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
    runGcodeBatch({ gcode: macroString, port: connectedPort })
      .then(() => {
        probingRef.current = false
        setStatus('complete')
      })
      .catch((err) => {
        probingRef.current = false
        setStatus('error')
        const msg = err?.message ?? t('Probe error')
        setErrorMessage(msg)
        onError(msg)
      })
  }, [method, connectedPort, currentWCS, onComplete, onError, t])

  if (!method || method.type !== 'bitzero' || (method.axes !== 'xy' && method.axes !== 'xyz')) {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  const { machinePosition, probeContact } = context
  const canGoBack = step > 1

  const stepTitles: Record<number, string> = {
    1: showVerifyStep ? t('Verify BitZero Circuit') : t('Place BitZero on Corner'),
    2: showVerifyStep ? t('Place BitZero on Corner') : t('Position Tool in Hole'),
    3: showVerifyStep ? t('Position Tool in Hole') : t('Run XY Probe'),
    4: t('Run XY Probe'),
  }
  const title = stepTitles[step]

  const onBack = (step >= 2 && (step < runStep || (step === runStep && canGoBack && status !== 'probing')))
    ? () => setStep(step - 1)
    : undefined
  const footerLeft = step === 1 ? footerLeftExtra : undefined

  const nextButton = step < runStep
    ? { onClick: () => setStep(step + 1) }
    : step === runStep
      ? { onClick: onComplete, disabled: status !== 'complete' }
      : undefined

  const footerRightExtraContent = (
    <>
      {footerRightExtra}
      {debugAllowNext && step < runStep && (
        <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>{t('Next (debug)')}</Button>
      )}
      {debugAllowNext && step === runStep && status !== 'complete' && status !== 'error' && (
        <Button variant="secondary" size="sm" onClick={onComplete}>{t('Next (debug)')}</Button>
      )}
    </>
  )

  return (
    <SetupBlockLayout
      title={title}
      currentStep={step}
      totalSteps={totalSteps}
      onBack={onBack}
      footerLeft={footerLeft}
      nextButton={nextButton}
      footerRight={footerRightExtraContent}
    >
      {/* Step 1 (only when requireCheck): Verify BitZero circuit — connect lead, touch probe to tool */}
      {showVerifyStep && step === 1 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Verify that the magnetic conductor is positively attached to the tool and that the circuit is functioning correctly.')}
            </p>
            <p>
              {t('This ensures the probe circuit is working before starting the zeroing process.')}
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('Attach the magnetic conductor to the tool, then lift the BitZero probe until it touches the tool. If the probe triggers correctly, the magnetic conductor is properly attached and the circuit is functioning.')}
            </p>
          </div>
          <div className={`p-3 rounded-lg border ${
            probeContact
              ? 'bg-green-500/10 border-green-500/30'
              : 'bg-muted/50 border-border'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                probeContact ? 'bg-green-500' : 'bg-muted'
              }`} />
              <span className="text-sm font-medium">
                {t('Probe Status')}: {probeContact ? t('Contact Detected') : t('No Contact')}
              </span>
            </div>
            {probeContact && (
              <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                {t('The probe circuit is working correctly. You can proceed to the next step.')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step 2 (or step 1 when verify skipped): Place BitZero on corner */}
      {((showVerifyStep && step === 2) || (!showVerifyStep && step === 1)) && (
        <div className="space-y-4">
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
        </div>
      )}

      {/* Step 3 (or step 2 when verify skipped): Position tool in hole */}
      {((showVerifyStep && step === 3) || (!showVerifyStep && step === 2)) && (
        <div className="space-y-4">
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
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 mb-4">
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
        </div>
      )}

      {/* Step 4 (or step 3 when verify skipped): Run XY probe */}
      {step === runStep && (
          <div className="space-y-4">
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
              <>
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>{t('Warning')}:</strong> {t('Make sure the tool is positioned in the hole below the Z surface before starting. The tool should already be in the hole from the previous step.')}
                  </p>
                </div>
                <Button onClick={runProbe} size="lg" className="w-full sm:w-auto">
                  {t('Run XY probe')}
                </Button>
              </>
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
          </div>
        )}
    </SetupBlockLayout>
  )
}
