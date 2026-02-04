import { useCallback, useRef, useState, useEffect } from 'react'
import { useStore } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { AlertCircle, HelpCircle, Check, Navigation, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { runGcodeBatch } from '@/utils/runGcodeBatch'
import { SetupBlockLayout } from '@/components/JobSetupWizard/blocks/SetupBlockLayout'
import { useGetToolsQuery, useGetExtensionsQuery } from '@/services/api'
import { useJobState, selectWorkPosition } from '@/store/hooks'
import type { RootState } from '@/store'
import { mmToInches } from '@/utils/units'
import type { SetupBlockProps } from '@/components/JobSetupWizard/blocks/types'
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
 * BitSetter tool-change block for mid-job M6.
 * Steps: 0 store position (on Navigate) → 1 Verify (optional) → 2 Navigate → 3 Tool change (install next tool) → 4 Probe + return to stored position → 5 Complete.
 */
export function BitSetterToolChangeBlock({
  methods,
  context,
  onComplete,
  onError,
  debugAllowNext,
  footerLeftExtra,
  footerRightExtra,
}: SetupBlockProps) {
  const { t } = useTranslation()
  const store = useStore<RootState>()
  const method = methods[0] as BitSetterConfig | undefined
  const {
    connectedPort,
    currentWCS,
    sendGcode,
    machinePosition,
    probeContact,
  } = context

  const { data: toolsData } = useGetToolsQuery()
  const jobState = useJobState()
  const toolReferenceKey = `bitsetter.toolReference.${currentWCS}`
  const { data: toolReferenceData } = useGetExtensionsQuery({ key: toolReferenceKey })
  const initialToolReference =
    toolReferenceData && typeof toolReferenceData === 'object' && 'value' in toolReferenceData
      ? (toolReferenceData as { value?: number }).value
      : undefined

  const showVerifyStep = method?.requireCheck !== false
  const totalSteps = showVerifyStep ? 5 : 4
  const runStep = showVerifyStep ? 4 : 3 // step where we run the probe
  const completeStep = totalSteps // last step: Close / resume instructions

  const [step, setStep] = useState(1)
  const [navPhase, setNavPhase] = useState<'idle' | 'navigate'>('idle')
  const [probePhase, setProbePhase] = useState<'idle' | 'probing' | 'storing' | 'returning' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [capturedZRef, setCapturedZRef] = useState<number | null>(null)
  const probingRef = useRef(false)
  const storedMachineCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const lastValidToolNumberRef = useRef<number | undefined>(undefined)

  const nextToolNumber = jobState?.nextM6ToolNumber
  useEffect(() => {
    if (nextToolNumber !== undefined && nextToolNumber >= 0) {
      lastValidToolNumberRef.current = nextToolNumber
    }
  }, [nextToolNumber])

  const deriveToolFromM6Array = useCallback((): number | undefined => {
    const m6ToolNumbers = jobState?.m6ToolNumbers
    const currentTool = jobState?.stats?.currentTool
    if (!m6ToolNumbers || m6ToolNumbers.length === 0) return undefined
    const currentToolIndex =
      currentTool !== undefined ? m6ToolNumbers.findIndex((tn) => tn === currentTool) : -1
    if (currentToolIndex >= 0 && currentToolIndex < m6ToolNumbers.length - 1) {
      const nextTool = m6ToolNumbers[currentToolIndex + 1]
      if (nextTool > 0) return nextTool
    }
    return undefined
  }, [jobState?.m6ToolNumbers, jobState?.stats?.currentTool])

  const toolNumberToShow =
    nextToolNumber !== undefined && nextToolNumber >= 0
      ? nextToolNumber
      : lastValidToolNumberRef.current ?? deriveToolFromM6Array() ?? jobState?.stats?.currentTool

  const toolData =
    toolNumberToShow !== undefined && toolNumberToShow >= 0
      ? toolsData?.records?.find((r) => r.toolId === toolNumberToShow)
      : null

  const isAtBitsetter =
    method &&
    machinePosition &&
    Math.abs(machinePosition.x - method.position.x) < POSITION_TOLERANCE &&
    Math.abs(machinePosition.y - method.position.y) < POSITION_TOLERANCE &&
    Math.abs(machinePosition.z - method.position.z) < POSITION_TOLERANCE

  const navigate = useCallback(() => {
    if (!method || method.type !== 'bitsetter' || !connectedPort) return
    storedMachineCoordsRef.current = { x: machinePosition.x, y: machinePosition.y }
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
  }, [method, connectedPort, machinePosition.x, machinePosition.y, t, onError])

  const runProbe = useCallback(() => {
    if (!method || method.type !== 'bitsetter' || !connectedPort) return
    if (initialToolReference === undefined) {
      setErrorMessage(t('Initial tool reference not found. Run job setup with BitSetter first.'))
      setProbePhase('error')
      onError(t('Initial tool reference not found'))
      return
    }
    const stored = storedMachineCoordsRef.current
    if (!stored) {
      setErrorMessage(t('Stored position not found. Go back to Navigate and try again.'))
      setProbePhase('error')
      onError(t('Stored position not found'))
      return
    }

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
      'G90',
      '%wait',
      `G10 L20 Z${initialToolReference}`,
      '%wait',
      '',
      '[UNITS] [DISTANCE] [FEEDRATE] [SPINDLE] [MOTION]',
      '',
      '%wait',
    ]
    const macroString = processMacro(macroLines.join('\n'))

    setProbePhase('probing')
    setErrorMessage(null)
    probingRef.current = true
    runGcodeBatch({ gcode: macroString, port: connectedPort, waitForIdle: true })
      .then(() => {
        probingRef.current = false
        setProbePhase('storing')
        const zRef = selectWorkPosition(store.getState()).z
        setCapturedZRef(zRef)
        setProbePhase('returning')
        sendGcode('G90')
        setTimeout(() => {
          sendGcode('G53 G0 Z-5')
          setTimeout(() => {
            sendGcode(`G53 G0 X${stored.x} Y${stored.y}`)
            storedMachineCoordsRef.current = null
            setProbePhase('complete')
          }, 500)
        }, 200)
      })
      .catch((err) => {
        probingRef.current = false
        setProbePhase('error')
        const msg = err?.message ?? t('Probe error')
        setErrorMessage(msg)
        onError(msg)
      })
  }, [
    method,
    connectedPort,
    currentWCS,
    store,
    initialToolReference,
    sendGcode,
    onError,
    t,
  ])

  const stepTitles: Record<number, string> = {
    1: showVerifyStep ? t('Verify BitSetter Circuit') : t('Navigate to BitSetter'),
    2: showVerifyStep ? t('Navigate to BitSetter') : t('Tool change'),
    3: showVerifyStep ? t('Tool change') : t('Measure tool length'),
    4: showVerifyStep ? t('Measure tool length') : t('Complete'),
    5: t('Complete'),
  }
  const title = stepTitles[step] ?? t('BitSetter tool change')

  const canGoBack =
    step > 1 &&
    (step < runStep || (step === runStep && probePhase !== 'probing' && probePhase !== 'storing' && probePhase !== 'returning'))
  const onBack = canGoBack ? () => setStep(step - 1) : undefined
  const footerLeft = step === 1 ? footerLeftExtra : undefined

  const getNextButton = (): { onClick: () => void; disabled?: boolean; label?: string } | undefined => {
    if (step < runStep) return { onClick: () => setStep(step + 1) }
    if (step === runStep) {
      if (probePhase === 'complete') return { onClick: () => setStep(step + 1), label: t('Next') }
      return { onClick: () => {}, disabled: true }
    }
    if (step === completeStep) return { onClick: onComplete, label: t('Close') }
    return undefined
  }
  const nextButton = getNextButton()

  const footerRightContent = (
    <>
      {footerRightExtra}
      {debugAllowNext && step < runStep && (
        <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>
          {t('Next (debug)')}
        </Button>
      )}
      {debugAllowNext && step === runStep && probePhase !== 'complete' && probePhase !== 'error' && (
        <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>
          {t('Next (debug)')}
        </Button>
      )}
      {debugAllowNext && step === completeStep && (
        <Button variant="secondary" size="sm" onClick={onComplete}>
          {t('Next (debug)')}
        </Button>
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
          </div>
        </div>
      )}

      {/* Step 2 (or 1): Navigate to BitSetter */}
      {((showVerifyStep && step === 2) || (!showVerifyStep && step === 1)) && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('The machine will automatically navigate to the BitSetter location configured in settings. This will move the machine to the BitSetter position safely so we can measure the new tool length.')}
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
              className={`rounded-lg border p-2.5 text-sm min-w-0 ${isAtBitsetter ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'}`}
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
                className={`rounded-lg border p-2.5 text-sm min-w-0 ${isAtBitsetter ? 'bg-green-500/10 border-green-500/30' : 'bg-muted/50 border-border'}`}
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

      {/* Step 3 (or 2): Tool change – install next tool */}
      {((showVerifyStep && step === 3) || (!showVerifyStep && step === 2)) && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Install the next tool before probing. We will measure the length of this tool so the Z offset can be adjusted automatically for the remainder of the job.')}
            </p>
          </div>
          {toolNumberToShow !== undefined && toolNumberToShow >= 0 && (
            <div className="p-3 rounded border bg-primary/10 border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" className="text-xs">
                  T{toolNumberToShow}
                </Badge>
                {toolData ? (
                  <span className="text-sm font-medium">{toolData.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    {t('Tool T{{toolId}}', { toolId: toolNumberToShow })}
                  </span>
                )}
              </div>
              {toolData && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {toolData.diameter != null && (
                    <div>
                      {t('Diameter')}: Ø{toolData.diameter.toFixed(3)}
                      {toolData.diameterUnit || t('mm')}
                      {toolData.diameterUnit === 'in' && (
                        <> • {(toolData.diameter * 25.4).toFixed(3)}mm</>
                      )}
                      {(!toolData.diameterUnit || toolData.diameterUnit === 'mm') && mmToInches(toolData.diameter) && (
                        <> • {mmToInches(toolData.diameter)}in</>
                      )}
                    </div>
                  )}
                  {toolData.type && <div>{t('Type')}: {toolData.type}</div>}
                  {toolData.description && (
                    <div className="mt-1 pt-1 border-t border-primary/20">{toolData.description}</div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('Once the next tool is installed, press Next to proceed to the probing step.')}
            </p>
          </div>
        </div>
      )}

      {/* Step 4 (or 3): Probe, then return to stored position */}
      {step === runStep && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Press the probe button below to start the automatic BitSetter probe sequence. The tool will perform a multi-stage probe sequence to accurately measure the tool length.')}
            </p>
            <p>
              {t('After probing, Z zero will be adjusted and the machine will return to the position where you started this tool change.')}
            </p>
          </div>

          {initialToolReference === undefined && (
            <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/30">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    {t('Initial tool reference not found')}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    {t('Run job setup with BitSetter first to establish the tool reference for this WCS.')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isAtBitsetter && probePhase !== 'probing' && probePhase !== 'storing' && probePhase !== 'returning' && probePhase !== 'complete' && (
            <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/30">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    {t('Machine not at BitSetter location')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {(probePhase === 'probing' || probePhase === 'storing' || probePhase === 'returning') && (
            <div
              className={`p-4 rounded-lg border ${
                probePhase === 'probing'
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : probePhase === 'storing'
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-4 h-4 rounded-full animate-pulse ${
                    probePhase === 'probing' ? 'bg-blue-500' : probePhase === 'storing' ? 'bg-purple-500' : 'bg-amber-500'
                  }`}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {probePhase === 'probing' && t('The tool is probing down to contact the BitSetter sensor.')}
                    {probePhase === 'storing' && t('Adjusting Z zero...')}
                    {probePhase === 'returning' && t('Returning to stored position...')}
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
                      {t('Tool length measured. Z zero adjusted. Returned to position.')}
                    </p>
                  </div>
                </div>
              </div>
              {capturedZRef != null && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                  <div className="text-sm font-medium">{t('Measured Z at contact:')}</div>
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

          {probePhase === 'idle' && isAtBitsetter && initialToolReference !== undefined && (
            <div className="flex justify-center py-2">
              <Button onClick={runProbe} size="lg" className="gap-2" disabled={!connectedPort}>
                <Target className="w-5 h-5" />
                {t('Start BitSetter Probe')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Step 5 (or 4): Complete – close then resume */}
      {step === completeStep && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('The tool change is complete. Tool length has been measured and Z zero has been adjusted.')}
            </p>
            <p className="font-medium text-foreground mt-3">{t('Next steps')}:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>{t('Press Close below to close this tab')}</li>
              <li>{t('Press Resume on the job status to continue the job with the new tool')}</li>
            </ol>
          </div>
          <div className="flex items-start gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
              <p className="font-medium">{t('Tool change complete')}</p>
              <p>
                {t('You can now close this tab and resume the job.')}
              </p>
            </div>
          </div>
        </div>
      )}
    </SetupBlockLayout>
  )
}
