import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, HelpCircle, Loader2, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildSetZeroWithOffsetCommand } from '@/utils/gcode'
import { runGcodeBatch } from '@/utils/runGcodeBatch'
import { SetupBlockLayout } from './SetupBlockLayout'
import type { SetupBlockProps } from './types'
import type { TouchPlateConfig } from '@/routes/Settings/sections/ZeroingMethodsSection'

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

/** Axis for this block when method.axes is xyz: derived from block kind. */
function getTouchplateAxis(method: TouchPlateConfig, blockKind?: string): 'x' | 'y' | 'z' {
  if (method.axes === 'xyz' && blockKind) {
    if (blockKind === 'touchplate_x') return 'x'
    if (blockKind === 'touchplate_y') return 'y'
    if (blockKind === 'touchplate_xy') return 'x' // 5-step flow overrides per step
    if (blockKind === 'touchplate_z') return 'z'
  }
  // Default to 'z' for touchplate_z so Z flow is used even if blockKind was not passed
  if (blockKind === 'touchplate_z') return 'z'
  return method.axes as 'x' | 'y' | 'z'
}

/**
 * Touchplate block: XY (verify → place → jog → probe L/R) or Z (verify → place → position → probe).
 * XY: two probe buttons (Probe left / Probe right); fast probe, slow probe, set zero, return to pre-probe.
 * Z: like BitZero Z but with touchplate content and plate thickness.
 */
export function TouchplateBlock({
  methods,
  blockKind,
  context,
  onComplete,
  onError,
  debugAllowNext,
  footerLeftExtra,
  footerRightExtra,
}: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as TouchPlateConfig | undefined
  const { currentWCS, clearBitsetterReference, connectedPort, probeContact } = context
  const axis = method ? getTouchplateAxis(method, blockKind) : 'z'
  const isZ = axis === 'z'

  const showVerifyStep = method?.requireCheck !== false
  const [step, setStep] = useState(1)
  const [status, setStatus] = useState<'idle' | 'probing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probingRef = useRef(false)

  // XY: probe in positive or negative axis direction; fast then slow, set zero, retract back.
  // For touchplate_xy, pass axisOverride ('x' | 'y'); otherwise uses block axis prop.
  const runProbeXY = useCallback(
    async (direction: 'positive' | 'negative', axisOverride?: 'x' | 'y') => {
      if (!method || method.type !== 'touchplate' || !connectedPort || isZ) return
      const effectiveAxis = axisOverride ?? axis
      const axisUpper = effectiveAxis.toUpperCase() as 'X' | 'Y'
      const probeDistance = method.probeDistance ?? 25
      const probeFeedrateA = method.probeFeedrate ?? 150
      const probeFeedrateB = 50
      const retractBack = probeDistance + 10
      // sign: used in G38.2 (e.g. X-25 = probe toward negative X). 'negative' → '-' = probe left (X) or front (Y).
      const sign = direction === 'positive' ? '+' : '-'
      // G10 L20 sets current position to this work value; zero is then at (current - value).
      // User convention: probe left/front/back → +thickness; probe right only → -thickness.
      let offset =
        (direction === 'negative')
          ? method.plateThickness
          : -method.plateThickness
      // Account for probing pin radius when configured (zero at edge of pin).
      // Same rule as offset: direction negative → add radius; direction positive → subtract radius.
      const diameter =
        method.useForXYProbing && method.probingPinDiameter != null && method.probingPinDiameter > 0
          ? method.probingPinDiameter
          : 0
      const diameterMm = diameter > 0 && method.probingPinDiameterUnit === 'in' ? diameter * 25.4 : diameter
      const radiusMm = diameterMm / 2
      if (radiusMm > 0) {
        offset = offset + (direction === 'negative' ? radiusMm : -radiusMm)
      }
      const setZeroCommand = buildSetZeroWithOffsetCommand(currentWCS, axisUpper, offset)
      console.log('[Touchplate XY]', {
        axis: effectiveAxis,
        direction,
        sign,
        offset,
        radiusMm,
        setZeroCommand,
      })  
      const macroLines = [
        'G91',
        'G21',
        '',
        `; ${axisUpper}-Axis Probing (${direction})`,
        `G38.2 ${axisUpper}${sign}${probeDistance} F${probeFeedrateA}`,
        direction === 'positive' ? `G0 ${axisUpper}-2` : `G0 ${axisUpper}2`,
        `G38.2 ${axisUpper}${sign}5 F${probeFeedrateB}`,
        'G90',
        setZeroCommand,
        'G91',
        direction === 'positive' ? `G0 ${axisUpper}-${retractBack}` : `G0 ${axisUpper}${retractBack}`,
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
    },
    [method, axis, isZ, connectedPort, currentWCS, onError, t]
  )

  const isTouchplateXY = blockKind === 'touchplate_xy'

  // Z: like BitZero Z — fast probe, retract 2, slow probe, set zero with plate thickness, retract
  const runProbeZ = useCallback(async () => {
    if (!method || method.type !== 'touchplate' || axis !== 'z' || !connectedPort) return
    await clearBitsetterReference(currentWCS)
    const probeDistance = method.probeDistance ?? 25
    const probeFeedrateA = method.probeFeedrate ?? 150
    const probeFeedrateB = 50
    const zFinal = 15
    const setZZeroCommand = buildSetZeroWithOffsetCommand(currentWCS, 'Z', method.plateThickness)
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
  }, [method, axis, connectedPort, currentWCS, clearBitsetterReference, onError, t])

  if (!method || method.type !== 'touchplate') {
    return <p className="text-sm text-muted-foreground">{t('Invalid method')}</p>
  }

  const axisLabel = axis.toUpperCase()

  if (isZ) {
    // ——— Z flow: verify (optional) → place touchplate → position tool → run Z probe → remove leads and plate ———
    const totalSteps = showVerifyStep ? 5 : 4
    const runStep = showVerifyStep ? 4 : 3
    const cleanupStep = runStep + 1
    const stepTitles: Record<number, string> = {
      1: showVerifyStep ? t('Verify Touch Plate') : t('Place Touch Plate'),
      2: showVerifyStep ? t('Place Touch Plate') : t('Position Tool Above Touch Plate'),
      3: showVerifyStep ? t('Position Tool Above Touch Plate') : t('Run Z probe'),
      4: t('Run Z probe'),
      [cleanupStep]: t('Remove leads and touch plate'),
    }
    const title = stepTitles[step]
    const canGoBack = step > 1
    const onBack =
      step >= 2 && (step < cleanupStep && (step < runStep || (step === runStep && canGoBack && status !== 'probing')))
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
    const footerRightContent = (
      <>
        {footerRightExtra}
        {step < runStep && debugAllowNext && (
          <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>{t('Next (debug)')}</Button>
        )}
        {step === runStep && debugAllowNext && status !== 'complete' && status !== 'error' && (
          <Button variant="secondary" size="sm" onClick={() => setStep(cleanupStep)}>{t('Next (debug)')}</Button>
        )}
        {step === cleanupStep && debugAllowNext && (
          <Button variant="secondary" size="sm" onClick={onComplete}>{t('Next (debug)')}</Button>
        )}
      </>
    )

    return (
      <SetupBlockLayout
        title={title}
        subtitle={t('Set Z zero using the touch plate.')}
        currentStep={step}
        totalSteps={totalSteps}
        onBack={onBack}
        footerLeft={footerLeft}
        nextButton={nextButton}
        footerRight={footerRightContent}
      >
        {step === 1 && (
          <div className="space-y-4">
            {showVerifyStep ? (
              <>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>
                    {t('Verify that the touch plate is working by manually touching it to the tool. The touch plate should trigger when contact is made.')}
                  </p>
                  <p>
                    {t('This ensures the probe circuit is functioning correctly before starting the zeroing process.')}
                  </p>
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    {t('Touch the plate to the tool manually. If the probe triggers correctly, you\'re ready to proceed. If not, check your wiring and probe settings.')}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-lg border ${
                    probeContact ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full ${probeContact ? 'bg-green-500' : 'bg-muted'}`}
                    />
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
              </>
            ) : (
              <>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    {t('Place the touch plate on the workpiece at the location where you want to set Z zero.')}
                  </p>
                  <p>
                    {t('Make sure the touch plate is flat on the workpiece surface and the tool can reach it when probing down.')}
                  </p>
                </div>
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>{t('Important')}:</strong>{' '}
                    {t('Ensure the touch plate is secure and will not move during probing.')}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {(showVerifyStep && step === 2) && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t('Place the touch plate on the workpiece at the location where you want to set Z zero.')}
              </p>
              <p>
                {t('Make sure the touch plate is flat on the workpiece surface and the tool can reach it when probing down.')}
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>{t('Important')}:</strong>{' '}
                {t('Ensure the touch plate is secure and will not move during probing.')}
              </p>
            </div>
          </div>
        )}

        {((showVerifyStep && step === 3) || (!showVerifyStep && step === 2)) && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t('Use the jog controls to position the tool above the touch plate. The tool will probe straight down, so it should be above the plate surface.')}
              </p>
              <p>
                <strong>{t('Important')}:</strong>{' '}
                {t('Leave enough clearance below the tool for the probe distance. Use small movements when approaching the probe height.')}
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                <p className="font-medium">{t('Jogging Tips')}:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>{t('Position XY over the touch plate')}</li>
                  <li>{t('Lower Z in small steps (0.1mm or less) when approaching probe height')}</li>
                  <li>{t('Leave clearance for the probe distance before starting the probe')}</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {step === runStep && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t('Press the probe button below to start the Z probe sequence. The tool will probe down until it contacts the touch plate, then set Z zero accounting for the plate thickness ({{thickness}}mm).', {
                  thickness: method.plateThickness,
                })}
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
                    <strong>{t('Warning')}:</strong>{' '}
                    {t('Make sure the tool is positioned above the touch plate with enough clearance before starting. The tool should already be in position from the previous step.')}
                  </p>
                </div>
                <div className="flex justify-center py-2">
                  <Button onClick={runProbeZ} size="lg" className="gap-2">
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

        {step === cleanupStep && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('Remove the leads from the tool and the touch plate from the work surface.')}
            </p>
          </div>
        )}
      </SetupBlockLayout>
    )
  }

  // ——— touchplate_xy: 6 steps (or 5) — verify → place left/right → probe left/right → place front/back → probe front/back → remove leads ———
  if (isTouchplateXY) {
    const totalSteps = showVerifyStep ? 6 : 5
    const probeXStep = showVerifyStep ? 3 : 2
    const probeYStep = showVerifyStep ? 5 : 4
    const cleanupStep = probeYStep + 1
    const stepTitles: Record<number, string> = {
      1: showVerifyStep ? t('Verify Touch Plate') : t('Place touch plate left or right'),
      2: showVerifyStep ? t('Place touch plate left or right') : t('Probe left or right'),
      3: showVerifyStep ? t('Probe left or right') : t('Place touch plate front or back'),
      4: showVerifyStep ? t('Place touch plate front or back') : t('Probe front or back'),
      5: t('Probe front or back'),
      [cleanupStep]: t('Remove leads and touch plate'),
    }
    const title = stepTitles[step]
    const canGoBack = step > 1
    const onBack =
      step >= 2 && (step < cleanupStep && (step < probeYStep || (step === probeYStep && canGoBack && status !== 'probing')))
        ? () => setStep(step - 1)
        : step === cleanupStep
          ? () => setStep(step - 1)
          : undefined
    const footerLeft = step === 1 ? footerLeftExtra : undefined
    const getNextButton = () => {
      if (step === probeXStep) {
        return { onClick: () => { setStatus('idle'); setStep(step + 1) }, disabled: status !== 'complete' }
      }
      if (step === probeYStep) {
        return { onClick: () => setStep(cleanupStep), disabled: status !== 'complete' }
      }
      if (step === cleanupStep) {
        return { onClick: onComplete }
      }
      return { onClick: () => setStep(step + 1) }
    }
    const nextButton = getNextButton()
    const footerRightContent = (
      <>
        {footerRightExtra}
        {step < totalSteps && debugAllowNext && step !== probeXStep && step !== probeYStep && (
          <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>{t('Next (debug)')}</Button>
        )}
        {(step === probeXStep || step === probeYStep) && debugAllowNext && status !== 'complete' && status !== 'error' && (
          <Button variant="secondary" size="sm" onClick={step === probeYStep ? () => setStep(cleanupStep) : () => { setStatus('idle'); setStep(step + 1) }}>{t('Next (debug)')}</Button>
        )}
        {step === cleanupStep && debugAllowNext && (
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
        {showVerifyStep && step === 1 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Verify that the touch plate is working by manually touching it to the tool. The touch plate should trigger when contact is made.')}
              </p>
              <p>
                {t('This ensures the probe circuit is functioning correctly before starting the zeroing process.')}
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t('Touch the plate to the tool manually. If the probe triggers correctly, you\'re ready to proceed. If not, check your wiring and probe settings.')}
              </p>
            </div>
            <div className={`p-3 rounded-lg border ${probeContact ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'}`}>
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

        {((showVerifyStep && step === 2) || (!showVerifyStep && step === 1)) && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t('Place the touch plate either to the left or right of the workpiece so that when the tool moves towards the workpiece it will make contact with the touch plate.')}
              </p>
              <p>
                {t('Jog the tool next to the touch plate with enough clearance to probe towards it. Then press Next and choose Probe left or Probe right depending on which side the plate is on.')}
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>{t('Important')}:</strong> {t('Ensure the touch plate is secure and will not move during probing.')}
              </p>
            </div>
          </div>
        )}

        {step === probeXStep && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t('Choose Probe left or Probe right depending on the orientation of the touch plate relative to the tool. The tool will probe towards the plate, set X zero accounting for the plate thickness ({{thickness}}mm), then return to the pre-probe location.', { thickness: method.plateThickness })}
              </p>
            </div>
            {status === 'idle' && (
              <>
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>{t('Warning')}:</strong> {t('Make sure the tool is positioned next to the touch plate with enough clearance for the probe distance ({{distance}}mm) before starting.', { distance: method.probeDistance ?? 25 })}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 py-2">
                  <Button onClick={() => runProbeXY('negative', 'x')} size="lg" className="gap-2">
                    <Target className="w-5 h-5" />
                    {t('Probe left')}
                  </Button>
                  <Button onClick={() => runProbeXY('positive', 'x')} size="lg" className="gap-2">
                    <Target className="w-5 h-5" />
                    {t('Probe right')}
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
                    <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">{t('Done. X zero set at the touch plate.')}</p>
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

        {((showVerifyStep && step === 4) || (!showVerifyStep && step === 3)) && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t('Place the touch plate on either the close or far edge of the workpiece so that when the tool moves towards the workpiece it will make contact with the touch plate.')}
              </p>
              <p>
                {t('Jog the tool next to the touch plate with enough clearance to probe towards it. Then press Next and choose Probe front or Probe back depending on which edge the plate is on.')}
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>{t('Important')}:</strong> {t('Ensure the touch plate is secure and will not move during probing.')}
              </p>
            </div>
          </div>
        )}

        {step === probeYStep && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                {t('Choose Probe front or Probe back depending on the orientation of the touch plate relative to the tool. The tool will probe towards the plate, set Y zero accounting for the plate thickness ({{thickness}}mm), then return to the pre-probe location.', { thickness: method.plateThickness })}
              </p>
            </div>
            {status === 'idle' && (
              <>
                <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>{t('Warning')}:</strong> {t('Make sure the tool is positioned next to the touch plate with enough clearance for the probe distance ({{distance}}mm) before starting.', { distance: method.probeDistance ?? 25 })}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3 py-2">
                  <Button onClick={() => runProbeXY('negative', 'y')} size="lg" className="gap-2">
                    <Target className="w-5 h-5" />
                    {t('Probe front')}
                  </Button>
                  <Button onClick={() => runProbeXY('positive', 'y')} size="lg" className="gap-2">
                    <Target className="w-5 h-5" />
                    {t('Probe back')}
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
                    <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">{t('Done. Y zero set at the touch plate.')}</p>
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

        {step === cleanupStep && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('Remove the leads from the tool and the touch plate from the work surface.')}
            </p>
          </div>
        )}
      </SetupBlockLayout>
    )
  }

  // ——— XY flow (touchplate_x or touchplate_y): verify (optional) → place → probe → remove leads ———
  const totalSteps = showVerifyStep ? 4 : 3
  const runStep = showVerifyStep ? 3 : 2
  const cleanupStep = runStep + 1
  const stepTitles: Record<number, string> = {
    1: showVerifyStep ? t('Verify Touch Plate') : t('Place Touch Plate'),
    2: showVerifyStep ? t('Place Touch Plate') : t('Probe {{axis}}', { axis: axisLabel }),
    3: t('Probe {{axis}}', { axis: axisLabel }),
    [cleanupStep]: t('Remove leads and touch plate'),
  }
  const title = stepTitles[step]
  const canGoBack = step > 1
  const onBack =
    step >= 2 && (step < cleanupStep && (step < runStep || (step === runStep && canGoBack && status !== 'probing')))
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
  const footerRightContent = (
    <>
      {footerRightExtra}
      {step < runStep && debugAllowNext && (
        <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>{t('Next (debug)')}</Button>
      )}
      {step === runStep && debugAllowNext && status !== 'complete' && status !== 'error' && (
        <Button variant="secondary" size="sm" onClick={() => setStep(cleanupStep)}>{t('Next (debug)')}</Button>
      )}
      {step === cleanupStep && debugAllowNext && (
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
      {showVerifyStep && step === 1 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Verify that the touch plate is working by manually touching it to the tool. The touch plate should trigger when contact is made.')}
            </p>
            <p>
              {t('This ensures the probe circuit is functioning correctly before starting the zeroing process.')}
            </p>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('Touch the plate to the tool manually. If the probe triggers correctly, you\'re ready to proceed. If not, check your wiring and probe settings.')}
            </p>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              probeContact ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'
            }`}
          >
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

      {((showVerifyStep && step === 2) || (!showVerifyStep && step === 1)) && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            {axis === 'x' ? (
              <>
                <p>
                  {t('Place the touch plate either to the left or right of the workpiece so that when the tool moves towards the workpiece it will make contact with the touch plate.')}
                </p>
                <p>
                  {t('Jog the tool next to the touch plate with enough clearance to probe towards it. Then press Next and choose Probe left or Probe right depending on which side the plate is on.')}
                </p>
              </>
            ) : (
              <>
                <p>
                  {t('Place the touch plate on either the close or far edge of the workpiece so that when the tool moves towards the workpiece it will make contact with the touch plate.')}
                </p>
                <p>
                  {t('Jog the tool next to the touch plate with enough clearance to probe towards it. Then press Next and choose Probe front or Probe back depending on which edge the plate is on.')}
                </p>
              </>
            )}
          </div>
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>{t('Important')}:</strong>{' '}
              {t('Ensure the touch plate is secure and will not move during probing.')}
            </p>
          </div>
        </div>
      )}

      {step === runStep && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              {axis === 'x'
                ? t('Choose Probe left or Probe right depending on the orientation of the touch plate relative to the tool. The tool will probe towards the plate, set {{axis}} zero accounting for the plate thickness ({{thickness}}mm), then return to the pre-probe location.', {
                    axis: axisLabel,
                    thickness: method.plateThickness,
                  })
                : t('Choose Probe front or Probe back depending on the orientation of the touch plate relative to the tool. The tool will probe towards the plate, set {{axis}} zero accounting for the plate thickness ({{thickness}}mm), then return to the pre-probe location.', {
                    axis: axisLabel,
                    thickness: method.plateThickness,
                  })}
            </p>
          </div>
          {status === 'idle' && (
            <>
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>{t('Warning')}:</strong>{' '}
                  {t('Make sure the tool is positioned next to the touch plate with enough clearance for the probe distance ({{distance}}mm) before starting.', {
                    distance: method.probeDistance ?? 25,
                  })}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3 py-2">
                {axis === 'x' ? (
                  <>
                    <Button onClick={() => runProbeXY('negative')} size="lg" className="gap-2">
                      <Target className="w-5 h-5" />
                      {t('Probe left')}
                    </Button>
                    <Button onClick={() => runProbeXY('positive')} size="lg" className="gap-2">
                      <Target className="w-5 h-5" />
                      {t('Probe right')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button onClick={() => runProbeXY('negative')} size="lg" className="gap-2">
                      <Target className="w-5 h-5" />
                      {t('Probe front')}
                    </Button>
                    <Button onClick={() => runProbeXY('positive')} size="lg" className="gap-2">
                      <Target className="w-5 h-5" />
                      {t('Probe back')}
                    </Button>
                  </>
                )}
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
                  <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                    {t('Done. {{axis}} zero set at the touch plate.', { axis: axisLabel })}
                  </p>
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

      {step === cleanupStep && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('Remove the leads from the tool and the touch plate from the work surface.')}
          </p>
        </div>
      )}
    </SetupBlockLayout>
  )
}
