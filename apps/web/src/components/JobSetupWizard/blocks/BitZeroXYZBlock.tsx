import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, HelpCircle, Loader2, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildSetZeroCommand, buildSetZeroWithOffsetCommand } from '@/utils/gcode'
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
 * Combined BitZero XYZ block: verify (optional) → place on workpiece → place tool in hole → run XYZ probe.
 * Used when both work_xy and work_z plans are BitZero. methods[0] = XY config, methods[1] = Z config (or same method with axes xyz).
 */
export function BitZeroXYZBlock({ methods, context, onComplete, onError, debugAllowNext, footerLeftExtra, footerRightExtra }: SetupBlockProps) {
  const { t } = useTranslation()
  const xyMethod = methods[0] as BitZeroConfig | undefined
  const zMethod = (methods[1] ?? methods[0]) as BitZeroConfig | undefined
  const { currentWCS, connectedPort, clearBitsetterReference, probeContact } = context

  const showVerifyStep = xyMethod?.requireCheck !== false
  const totalSteps = showVerifyStep ? 6 : 5
  const runStep = showVerifyStep ? 5 : 4
  const cleanupStep = runStep + 1

  const [step, setStep] = useState(1)
  const [status, setStatus] = useState<'idle' | 'probing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probingRef = useRef(false)

  const runProbe = useCallback(async () => {
    if (!xyMethod || xyMethod.type !== 'bitzero' || !zMethod || zMethod.type !== 'bitzero' || !connectedPort) return

    await clearBitsetterReference(currentWCS)

    const xyProbeDistance = xyMethod.probeDistance ?? 25
    const xyProbeFeedrateA = xyMethod.probeFeedrate ?? 150
    const probeFeedrateB = 50
    const probeMajorRetract = 2
    const zProbeRetract = 15 // Retract Z out of hole before moving to plate
    const zProbeKeepout = 10 // X/Y offset from hole center to position above plate
    const zFinal = 15
    const setXZeroCommand = buildSetZeroCommand(currentWCS, 'x')
    const setYZeroCommand = buildSetZeroCommand(currentWCS, 'y')

    const zProbeDistance = zMethod.probeDistance ?? 25
    const zProbeFeedrateA = zMethod.probeFeedrate ?? 150
    const setZZeroCommand = buildSetZeroWithOffsetCommand(currentWCS, 'Z', zMethod.probeThickness ?? 12.7)

    // Single combined macro so Y_CHORD is available for Z probe position (retract out of hole, move +X+Y above plate, then probe Z)
    const xyzMacroLines = [
      'G91',
      'G21',
      '',
      '; X-Axis Probing',
      `G38.2 X${xyProbeDistance} F${xyProbeFeedrateA}`,
      'G0 X-2',
      `G38.2 X5 F${probeFeedrateB}`,
      'G90',
      '%X_RIGHT=posx',
      'G91',
      `G0 X-${probeMajorRetract}`,
      '',
      `G38.2 X-${xyProbeDistance} F${xyProbeFeedrateA}`,
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
      `G38.2 Y${xyProbeDistance} F${xyProbeFeedrateA}`,
      'G0 Y-2',
      `G38.2 Y5 F${probeFeedrateB}`,
      'G90',
      '%Y_TOP=posy',
      'G91',
      `G0 Y-${probeMajorRetract}`,
      '',
      `G38.2 Y-${xyProbeDistance} F${xyProbeFeedrateA}`,
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
      '; Retract out of hole and move above plate for Z probe',
      '%HOLE_RADIUS=Y_CHORD/2',
      `%Z_PROBE_X=HOLE_RADIUS+${zProbeKeepout}`,
      `%Z_PROBE_Y=HOLE_RADIUS+${zProbeKeepout}`,
      '',
      `G0 Z${zProbeRetract}`,
      'G0 X[Z_PROBE_X] Y[Z_PROBE_Y]',
      '',
      '; Z-Axis Probing',
      `G38.2 Z-${zProbeDistance} F${zProbeFeedrateA}`,
      'G0 Z2',
      `G38.2 Z-5 F${probeFeedrateB}`,
      setZZeroCommand,
      `G0 Z${zFinal}`,
      '',
      '; Final: move to origin',
      'G90',
      'G0 X0 Y0',
      'G4 P1',
    ]
    const xyzMacroString = processMacro(xyzMacroLines.join('\n'))

    setStatus('probing')
    setErrorMessage(null)
    probingRef.current = true

    runGcodeBatch({ gcode: xyzMacroString, port: connectedPort })
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
  }, [xyMethod, zMethod, connectedPort, currentWCS, clearBitsetterReference, onError, t])

  if (!xyMethod || xyMethod.type !== 'bitzero' || !zMethod || zMethod.type !== 'bitzero') {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  const canGoBack = step > 1
  const stepTitles: Record<number, string> = {
    1: t('Install Probing Pin'),
    2: showVerifyStep ? t('Verify BitZero Circuit') : t('Place BitZero on Corner'),
    3: showVerifyStep ? t('Place BitZero on Corner') : t('Position Tool in Hole'),
    4: showVerifyStep ? t('Position Tool in Hole') : t('Run XYZ Probe'),
    5: t('Run XYZ Probe'),
    [cleanupStep]: t('Remove leads and probe'),
  }
  const title = stepTitles[step]

  const onBack = (step >= 2 && (step < cleanupStep && (step < runStep || (step === runStep && canGoBack && status !== 'probing'))))
    ? () => setStep(step - 1)
    : step === cleanupStep
      ? () => setStep(step - 1)
      : undefined
  const footerLeft = step === 1 ? footerLeftExtra : undefined

  const nextButton =
    step < runStep
      ? { onClick: () => setStep(step + 1) }
      : step === runStep
        ? { onClick: () => setStep(cleanupStep), disabled: status !== 'complete' }
        : step === cleanupStep
          ? { onClick: onComplete }
          : undefined

  const footerRightExtraContent = (
    <>
      {footerRightExtra}
      {debugAllowNext && step < runStep && (
        <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>{t('Next (debug)')}</Button>
      )}
      {debugAllowNext && step === runStep && status !== 'complete' && status !== 'error' && (
        <Button variant="secondary" size="sm" onClick={() => setStep(cleanupStep)}>{t('Next (debug)')}</Button>
      )}
      {debugAllowNext && step === cleanupStep && (
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
      {/* Step 1: Install probing pin */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Using a cutting tool for BitZero probing can be inaccurate. For best results, install the probing pin or dowel in the spindle before probing. The pin has a consistent diameter, which gives more repeatable XY zero.')}
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('Install the probing pin or dowel that came with your BitZero in the spindle collet. Once installed, press Next to continue.')}
            </p>
          </div>
        </div>
      )}

      {/* Step 2 (only when requireCheck): Verify BitZero circuit */}
      {showVerifyStep && step === 2 && (
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

      {/* Step 2 (when verify skipped) or Step 3: Place BitZero on corner */}
      {((showVerifyStep && step === 3) || (!showVerifyStep && step === 2)) && (
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

      {/* Step 3 (when verify skipped) or Step 4: Position tool in hole */}
      {((showVerifyStep && step === 4) || (!showVerifyStep && step === 3)) && (
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
        </div>
      )}

      {/* Step 4 (when verify skipped) or Step 5: Run XYZ probe */}
      {step === runStep && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {t('Press the probe button below to start the XYZ probe sequence. The tool will:')}
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>{t('Probe right until contact, then probe left to find X edges and calculate X center')}</li>
              <li>{t('Probe top and bottom to find Y edges and calculate Y center')}</li>
              <li>{t('Probe down to contact the BitZero and set Z zero')}</li>
            </ol>
            <p>
              {t('After probing, XYZ zero will be set at the corner of your workpiece.')}
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
              <div className="flex justify-center py-2">
                <Button onClick={runProbe} size="lg" className="gap-2">
                  <Target className="w-5 h-5" />
                  {t('Run XYZ probe')}
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
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">{t('Done. XYZ zero set at the corner.')}</p>
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

      {/* Cleanup step: remove leads and probe */}
      {step === cleanupStep && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('Remove the leads from the tool and the BitZero probe from the workpiece.')}
          </p>
        </div>
      )}
    </SetupBlockLayout>
  )
}
