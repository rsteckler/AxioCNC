import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, HelpCircle, Check, Navigation, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { runGcodeBatch } from '@/utils/runGcodeBatch'
import { SetupBlockLayout } from './SetupBlockLayout'
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

const POSITION_TOLERANCE = 1.0

/**
 * BitSetter block (pre-job): optional verify circuit → navigate to BitSetter → probe down and show offset.
 * Multi-step flow; onComplete only after probe step finishes and user clicks Next.
 */
export function BitSetterBlock({ methods, context, onComplete, onError, debugAllowNext, footerLeftExtra, footerRightExtra }: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as BitSetterConfig | undefined
  const {
    connectedPort,
    currentWCS,
    sendGcode,
    workPosition,
    machinePosition,
    storeBitsetterReference,
    probeContact,
  } = context

  const showVerifyStep = method?.requireCheck !== false
  const totalSteps = showVerifyStep ? 3 : 2
  const runStep = showVerifyStep ? 3 : 2

  const [step, setStep] = useState(1)
  const [navPhase, setNavPhase] = useState<'idle' | 'navigate'>('idle')
  const [probePhase, setProbePhase] = useState<'idle' | 'probing' | 'storing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [capturedZRef, setCapturedZRef] = useState<number | null>(null)
  const probingRef = useRef(false)

  const isAtBitsetter =
    method &&
    machinePosition &&
    Math.abs(machinePosition.x - method.position.x) < POSITION_TOLERANCE &&
    Math.abs(machinePosition.y - method.position.y) < POSITION_TOLERANCE &&
    Math.abs(machinePosition.z - method.position.z) < POSITION_TOLERANCE

  const navigate = useCallback(() => {
    if (!method || method.type !== 'bitsetter' || !connectedPort) return
    setNavPhase('navigate')
    setErrorMessage(null)
    const safeHeight = -5
    const commands = [
      'G90',
      `G53 G0 Z${safeHeight}`,
      `G53 G0 X${method.position.x} Y${method.position.y}`,
      `G53 G0 Z${method.position.z}`,
    ]
    runGcodeBatch({ gcode: commands.join('\n'), port: connectedPort })
      .then(() => setNavPhase('idle'))
      .catch((err) => {
        setNavPhase('idle')
        setErrorMessage(err?.message ?? t('Navigation error'))
        onError(err?.message ?? t('Navigation error'))
      })
  }, [method, connectedPort, t, onError])

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

    setProbePhase('probing')
    setErrorMessage(null)
    probingRef.current = true
    runGcodeBatch({ gcode: macroString, port: connectedPort })
      .then(() => {
        probingRef.current = false
        setProbePhase('storing')
        const zRef = workPosition.z
        setCapturedZRef(zRef)
        if (storeBitsetterReference) {
          storeBitsetterReference(currentWCS, zRef)
            .then(() => {
              sendGcode('G90')
              setTimeout(() => {
                sendGcode('G53 G0 Z-5')
                setTimeout(() => sendGcode('G0 X0 Y0'), 500)
              }, 200)
              setProbePhase('complete')
            })
            .catch((err) => {
              setProbePhase('error')
              const msg = err?.message ?? t('Failed to store tool reference')
              setErrorMessage(msg)
              onError(msg)
            })
        } else {
          sendGcode('G90')
          setTimeout(() => {
            sendGcode('G53 G0 Z-5')
            setTimeout(() => sendGcode('G0 X0 Y0'), 500)
          }, 200)
          setProbePhase('complete')
        }
      })
      .catch((err) => {
        probingRef.current = false
        setProbePhase('error')
        const msg = err?.message ?? t('Probe error')
        setErrorMessage(msg)
        onError(msg)
      })
  }, [method, connectedPort, currentWCS, workPosition.z, storeBitsetterReference, sendGcode, onError, t])

  const canGoBack = step > 1
  const stepTitles: Record<number, string> = {
    1: showVerifyStep ? t('Verify BitSetter Circuit') : t('Navigate to BitSetter'),
    2: showVerifyStep ? t('Navigate to BitSetter') : t('Run BitSetter Probe'),
    3: t('Run BitSetter Probe'),
  }
  const title = stepTitles[step] ?? t('Run BitSetter Probe')

  const onBack =
    step >= 2 && (step < runStep || (step === runStep && canGoBack && probePhase !== 'probing' && probePhase !== 'storing'))
      ? () => setStep(step - 1)
      : undefined
  const footerLeft = step === 1 ? footerLeftExtra : undefined

  const nextButton =
    step < runStep
      ? { onClick: () => setStep(step + 1) }
      : step === runStep
        ? { onClick: onComplete, disabled: probePhase !== 'complete' }
        : undefined

  const footerRightContent = (
    <>
      {footerRightExtra}
      {debugAllowNext && step < runStep && (
        <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>{t('Next (debug)')}</Button>
      )}
      {debugAllowNext && step === runStep && probePhase !== 'complete' && probePhase !== 'error' && (
        <Button variant="secondary" size="sm" onClick={onComplete}>{t('Next (debug)')}</Button>
      )}
    </>
  )

  if (!method || method.type !== 'bitsetter') {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

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
      {/* Step 1 (optional): Verify BitSetter circuit */}
      {showVerifyStep && step === 1 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Verify that the BitSetter circuit is working by manually pressing the sensor down. The BitSetter should trigger when the sensor is pressed.')}
            </p>
            <p>
              {t('This ensures the probe circuit is functioning correctly before starting the zeroing process.')}
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('Press the BitSetter sensor down. If the probe triggers correctly, you\'re ready to proceed. If not, check your wiring and probe settings.')}
            </p>
          </div>
          <div className={`p-3 rounded-lg border ${
            probeContact ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'
          }`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${probeContact ? 'bg-green-500' : 'bg-muted'}`} />
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

      {/* Step 2 (or step 1 when verify skipped): Navigate to BitSetter */}
      {((showVerifyStep && step === 2) || (!showVerifyStep && step === 1)) && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('The machine will automatically navigate to the BitSetter location configured in settings. This will move the machine to the BitSetter position safely so we can measure the new tool length.')}
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>{t('Warning')}:</strong>{' '}
              {t('Make sure there is a clear path to the BitSetter location and that no obstacles will interfere with the tool movement.')}
            </p>
          </div>
          <div className="flex items-center justify-center py-2">
            <Button
              onClick={navigate}
              variant="default"
              size="lg"
              className="gap-2"
              disabled={!connectedPort || navPhase === 'navigate'}
            >
              <Navigation className="w-5 h-5" />
              {navPhase === 'navigate' ? t('Moving…') : t('Navigate to BitSetter')}
            </Button>
          </div>
          {errorMessage && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <div
              className={`rounded-lg border p-2.5 text-sm min-w-0 ${
                isAtBitsetter ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'
              }`}
            >
              <div className="text-xs font-medium text-muted-foreground mb-1">{t('BitSetter')}</div>
              <div className="font-mono text-xs space-x-3">
                <span>X {method.position.x.toFixed(3)}</span>
                <span>Y {method.position.y.toFixed(3)}</span>
                <span>Z {method.position.z.toFixed(3)}</span>
              </div>
            </div>
            {machinePosition && (
              <div
                className={`rounded-lg border p-2.5 text-sm min-w-0 ${
                  isAtBitsetter ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'
                }`}
              >
                <div className="text-xs font-medium text-muted-foreground mb-1">{t('Machine')}</div>
                <div className="font-mono text-xs space-x-3">
                  <span>X {machinePosition.x.toFixed(3)}</span>
                  <span>Y {machinePosition.y.toFixed(3)}</span>
                  <span>Z {machinePosition.z.toFixed(3)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3 (or step 2 when verify skipped): Probe down and show offset */}
      {step === runStep && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Press the probe button below to start the automatic BitSetter probe sequence. The tool will perform a multi-stage probe sequence to accurately measure the tool length.')}
            </p>
            <p>
              {t('After probing, the tool reference will be stored. The tool will automatically retract to a safe height above the BitSetter.')}
            </p>
          </div>

          {!isAtBitsetter && probePhase !== 'probing' && probePhase !== 'storing' && probePhase !== 'complete' && (
            <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/30">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    {t('Machine not at BitSetter location')}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    {t('The machine is not positioned at the BitSetter location. Please go back to the previous step and navigate to the BitSetter location before probing.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(probePhase === 'probing' || probePhase === 'storing') && (
            <div className={`p-4 rounded-lg border ${
              probePhase === 'probing' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-purple-500/10 border-purple-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full animate-pulse ${
                  probePhase === 'probing' ? 'bg-blue-500' : 'bg-purple-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {probePhase === 'probing' && t('The tool is probing down to contact the BitSetter sensor.')}
                    {probePhase === 'storing' && t('Storing tool reference...')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {probePhase === 'complete' && (
            <>
              <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      {t('Probe complete! Tool reference stored.')}
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      {t('The reference is the Z work position when the tool touched the BitSetter. During the job, when you change tools and probe again on the BitSetter, the controller will use this value to adjust Z so the new tool matches the first tool\'s length.')}
                    </p>
                  </div>
                </div>
              </div>
              {capturedZRef != null && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="text-sm font-medium">{t('Tool reference (Z):')}</div>
                  <div className="font-mono text-sm">{capturedZRef.toFixed(3)} mm</div>
                </div>
              )}
            </>
          )}

          {probePhase === 'error' && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage ?? t('Probe error')}</span>
            </div>
          )}

          {probePhase === 'idle' && isAtBitsetter && (
            <>
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>{t('Warning')}:</strong>{' '}
                  {t('Make sure the tool is positioned above the BitSetter and there is enough clearance for the probe distance ({{distance}}mm) before starting. The tool should already be at the BitSetter location from the previous step.', { distance: method.probeDistance ?? 50 })}
                </p>
              </div>
              <div className="flex justify-center py-2">
                <Button onClick={runProbe} size="lg" className="gap-2" disabled={!connectedPort}>
                  <Target className="w-5 h-5" />
                  {t('Start BitSetter Probe')}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </SetupBlockLayout>
  )
}
