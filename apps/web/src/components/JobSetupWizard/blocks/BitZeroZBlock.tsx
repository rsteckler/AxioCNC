import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, HelpCircle, Loader2, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildSetZeroWithOffsetCommand } from '@/utils/gcode'
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
 * BitZero Z block: optional verify, then Place on workpiece, Position above flat part, Run Z probe. Clears BitSetter reference.
 * Step flow matches Set XY zero: verify (optional) → place BitZero → position tool → run probe.
 */
export function BitZeroZBlock({ methods, context, onComplete, onError, debugAllowNext, footerLeftExtra, footerRightExtra }: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as BitZeroConfig | undefined
  const { currentWCS, clearBitsetterReference, connectedPort, probeContact } = context

  /** When true, show step 1 (verify); 4 steps total. When false, 3 steps (place, position, run). */
  const showVerifyStep = method?.requireCheck !== false
  const totalSteps = showVerifyStep ? 4 : 3
  const runStep = showVerifyStep ? 4 : 3

  const [step, setStep] = useState(1)
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

  const canGoBack = step > 1
  const stepTitles: Record<number, string> = {
    1: showVerifyStep ? t('Verify BitZero Circuit') : t('Place BitZero on Corner'),
    2: showVerifyStep ? t('Place BitZero on Corner') : t('Position Tool Above BitZero'),
    3: showVerifyStep ? t('Position Tool Above BitZero') : t('Run Z probe'),
    4: t('Run Z probe'),
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

  const footerRightContent = (
    <>
      {footerRightExtra}
      {step < runStep && debugAllowNext && (
        <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>{t('Next (debug)')}</Button>
      )}
      {step === runStep && debugAllowNext && status !== 'complete' && status !== 'error' && (
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
      footerRight={footerRightContent}
    >
      {/* Step 1 (only when requireCheck): Verify BitZero circuit — same as XY block */}
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

      {/* Step 2 (or step 1 when verify skipped): Place BitZero on workpiece — same as XY step 2 */}
      {((showVerifyStep && step === 2) || (!showVerifyStep && step === 1)) && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t('Place the BitZero probe on the corner of your workpiece, making sure it\'s secure and flat.')}
            </p>
            <p>
              {t('Make sure the probe is firmly attached and won\'t move during probing.')}
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

      {/* Step 3 (or step 2 when verify skipped): Position tool above flat part of BitZero */}
      {((showVerifyStep && step === 3) || (!showVerifyStep && step === 2)) && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t('Use the jog controls to position the tool above the flat part of the BitZero probe. The tool will probe straight down, so it should be above the flat surface where the probe will make contact.')}
            </p>
            <p>
              <strong>{t('Important')}:</strong> {t('Leave enough clearance below the tool for the probe distance. Use small movements when approaching the probe height.')}
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
              <p className="font-medium">{t('Jogging Tips')}:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>{t('Position XY over the flat area of the BitZero (e.g. center or corner)')}</li>
                <li>{t('Lower Z in small steps (0.1mm or less) when approaching probe height')}</li>
                <li>{t('Leave clearance for the probe distance before starting the probe')}</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Step 4 (or step 3 when verify skipped): Run Z probe — same pattern as XY step 4 */}
      {step === runStep && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t('Press the probe button below to start the Z probe sequence. The tool will probe down until it contacts the BitZero, then set Z zero.')}
            </p>
            <p>
              {t('After probing, Z zero will be set at the work surface.')}
            </p>
          </div>
          {status === 'idle' && (
            <>
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>{t('Warning')}:</strong> {t('Make sure the tool is positioned above the flat part of the BitZero with enough clearance before starting. The tool should already be in position from the previous step.')}
                </p>
              </div>
                <div className="flex justify-center py-2">
                  <Button onClick={runProbe} size="lg" className="gap-2">
                    <Target className="w-5 h-5" />
                    {t('Run Z probe')}
                  </Button>
                </div>
            </>
          )}
          {status === 'probing' && (
            <div className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/30">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{t('Probing')}</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">{t('Please wait while the probe runs.')}</p>
                </div>
              </div>
            </div>
          )}
          {status === 'complete' && (
            <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">{t('Probe complete.')}</p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">{t('Done. Z zero set at the work surface.')}</p>
                </div>
              </div>
            </div>
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
