import { useCallback, useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Check, HelpCircle, Loader2, Navigation, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { buildSetZeroWithOffsetCommand } from '@/utils/gcode'
import { runGcodeBatch } from '@/utils/runGcodeBatch'
import { SetupBlockLayout } from '@/components/JobSetupWizard/blocks/SetupBlockLayout'
import { useGetToolsQuery, useGetSettingsQuery } from '@/services/api'
import { useJobState } from '@/store/hooks'
import { mmToInches } from '@/utils/units'
import type { SetupBlockProps } from '@/components/JobSetupWizard/blocks/types'
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

/** Same inset and position logic as RapidPanel "front-center" (lower center of table). */
function getFrontCenterPosition(limits: { xmin: number; xmax: number; ymin: number; ymax: number } | undefined) {
  const l = limits || { xmin: 0, xmax: 300, ymin: 0, ymax: 300 }
  const inset = 10
  return {
    x: (l.xmin + l.xmax) / 2,
    y: l.ymin + inset,
  }
}

/**
 * Touchplate Z tool-change block for mid-job M6.
 * Steps: 0 store position (on Navigate) → 1 Verify (optional) → 2 Navigate to front of table → 3 Tool change → 4 Move to XY0, place touchplate under tool, probe Z → 5 Return to stored position, remove plate, Close, Resume.
 */
export function TouchplateZToolChangeBlock({
  methods,
  context,
  onComplete,
  onError,
  debugAllowNext,
  footerLeftExtra,
  footerRightExtra,
}: SetupBlockProps) {
  const { t } = useTranslation()
  const method = methods[0] as TouchPlateConfig | undefined
  const { currentWCS, clearBitsetterReference, connectedPort, probeContact, machinePosition, sendGcode } = context

  const { data: settings } = useGetSettingsQuery()
  const { data: toolsData } = useGetToolsQuery()
  const jobState = useJobState()
  const limits = settings?.machine?.limits
  const frontCenter = getFrontCenterPosition(limits)

  const showVerifyStep = method?.requireCheck !== false
  const totalSteps = showVerifyStep ? 5 : 4
  const probeStep = showVerifyStep ? 4 : 3
  const completeStep = totalSteps

  const [step, setStep] = useState(1)
  const [navPhase, setNavPhase] = useState<'idle' | 'navigate'>('idle')
  const [status, setStatus] = useState<'idle' | 'probing' | 'complete' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const probingRef = useRef(false)
  const storedMachineCoordsRef = useRef<{ x: number; y: number } | null>(null)
  const step4MoveSentRef = useRef(false)
  const step5ReturnSentRef = useRef(false)
  const lastValidToolNumberRef = useRef<number | undefined>(undefined)

  // Step 4: when entering probe step, move to XY 0 (work home) so user can place touchplate under the tool
  useEffect(() => {
    if (step !== probeStep || !connectedPort || step4MoveSentRef.current) return
    step4MoveSentRef.current = true
    sendGcode('G90')
    sendGcode('G0 X0 Y0')
  }, [step, probeStep, connectedPort, sendGcode])

  // Step 5: when entering complete step, return to stored XY (position before "navigate to front")
  useEffect(() => {
    if (step !== completeStep || !connectedPort) return
    const stored = storedMachineCoordsRef.current
    if (!stored || step5ReturnSentRef.current) return
    step5ReturnSentRef.current = true
    sendGcode('G90')
    sendGcode(`G53 G0 X${stored.x.toFixed(3)} Y${stored.y.toFixed(3)}`)
    storedMachineCoordsRef.current = null
  }, [step, completeStep, connectedPort, sendGcode])

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

  const navigate = useCallback(() => {
    if (!connectedPort) return
    storedMachineCoordsRef.current = { x: machinePosition.x, y: machinePosition.y }
    setNavPhase('navigate')
    setErrorMessage(null)
    const cmd = `G90\nG53 G0 X${frontCenter.x.toFixed(3)} Y${frontCenter.y.toFixed(3)}`
    runGcodeBatch({ gcode: cmd, port: connectedPort })
      .then(() => setNavPhase('idle'))
      .catch((err) => {
        setNavPhase('idle')
        const msg = err?.message ?? t('Navigation error')
        setErrorMessage(msg)
        onError(msg)
      })
  }, [connectedPort, machinePosition.x, machinePosition.y, frontCenter.x, frontCenter.y, t, onError])

  const runProbeZ = useCallback(async () => {
    if (!method || method.type !== 'touchplate' || !connectedPort) return
    await clearBitsetterReference(currentWCS)
    // Use full Z axis extent so the probe can find the touchplate anywhere in the Z range
    const zExtent =
      limits?.zmin != null && limits?.zmax != null
        ? Math.abs(limits.zmax - limits.zmin)
        : undefined
    const probeDistance = zExtent ?? method.probeDistance ?? 25
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
  }, [method, connectedPort, currentWCS, clearBitsetterReference, limits, onError, t])

  const stepTitles: Record<number, string> = {
    1: showVerifyStep ? t('Verify probe') : t('Navigate to front of table'),
    2: showVerifyStep ? t('Navigate to front of table') : t('Tool change'),
    3: showVerifyStep ? t('Tool change') : t('Place touchplate and probe Z'),
    4: showVerifyStep ? t('Place touchplate and probe Z') : t('Complete'),
    5: t('Complete'),
  }
  const title = stepTitles[step] ?? t('Touchplate Z tool change')

  const canGoBack =
    step > 1 &&
    (step < probeStep || (step === probeStep && status !== 'probing'))
  const onBack = canGoBack ? () => setStep(step - 1) : undefined
  const footerLeft = step === 1 ? footerLeftExtra : undefined

  const getNextButton = (): { onClick: () => void; disabled?: boolean; label?: string } | undefined => {
    if (step < probeStep) return { onClick: () => setStep(step + 1) }
    if (step === probeStep) {
      if (status === 'complete') return { onClick: () => setStep(step + 1), label: t('Next') }
      return { onClick: () => {}, disabled: true }
    }
    if (step === completeStep) return { onClick: onComplete, label: t('Close') }
    return undefined
  }
  const nextButton = getNextButton()

  const footerRightContent = (
    <>
      {footerRightExtra}
      {debugAllowNext && step < probeStep && (
        <Button variant="secondary" size="sm" onClick={() => setStep(step + 1)}>
          {t('Next (debug)')}
        </Button>
      )}
      {debugAllowNext && step === probeStep && status !== 'complete' && status !== 'error' && (
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

  if (!method || method.type !== 'touchplate') {
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
      {/* Step 1 (optional): Verify probe */}
      {showVerifyStep && step === 1 && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Verify that the touch plate is working by manually touching it to the tool. The probe should trigger when contact is made.')}
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

      {/* Step 2 (or 1): Navigate to front of table */}
      {((showVerifyStep && step === 2) || (!showVerifyStep && step === 1)) && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Move the machine to the front-center of the table (same position as the Rapid panel front-center button). This gives you room to change the tool.')}
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
              {navPhase === 'navigate' ? t('Moving…') : t('Navigate to front of table')}
            </Button>
          </div>
          {errorMessage && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="rounded-lg border bg-muted/50 p-3 text-sm">
            <div className="font-medium text-muted-foreground mb-1">{t('Front center (machine)')}</div>
            <div className="font-mono text-xs">
              X {frontCenter.x.toFixed(3)}  Y {frontCenter.y.toFixed(3)}
            </div>
          </div>
        </div>
      )}

      {/* Step 3 (or 2): Tool change – install next tool */}
      {((showVerifyStep && step === 3) || (!showVerifyStep && step === 2)) && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('Install the next tool before probing. We will set Z zero on the touchplate so the new tool is ready for the rest of the job.')}
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
              {t('Once the next tool is installed, press Next to continue.')}
            </p>
          </div>
        </div>
      )}

      {/* Step 4 (or 3): Return to XY (auto), place touchplate under tool, run probe Z */}
      {step === probeStep && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('The machine has moved to XY zero (work home). Place the touchplate under the tool and press Probe Z below. The tool will probe down until it contacts the touchplate and set Z zero (accounting for plate thickness {{thickness}}mm).', {
                thickness: method.plateThickness,
              })}
            </p>
          </div>
          {status === 'idle' && (
            <div className="flex justify-center py-2">
              <Button onClick={runProbeZ} size="lg" className="gap-2" disabled={!connectedPort}>
                <Target className="w-5 h-5" />
                {t('Probe Z')}
              </Button>
            </div>
          )}
          {status === 'probing' && (
            <div className="p-4 rounded-lg border bg-blue-500/10 border-blue-500/30">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100">{t('Probing')}</p>
                </div>
              </div>
            </div>
          )}
          {status === 'complete' && (
            <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">{t('Probe complete. Z zero set.')}</p>
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

      {/* Step 5 (or 4): Complete – machine returns to stored position, remove leads and touchplate, Close, Resume */}
      {step === completeStep && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {t('The machine has returned to the XY position where you started this tool change. Remove the leads from the touchplate, remove the touchplate from the table, then close this tab and resume the job.')}
            </p>
            <p className="font-medium text-foreground mt-3">{t('Next steps')}:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
              <li>{t('Remove the leads from the touchplate')}</li>
              <li>{t('Remove the touchplate from the table')}</li>
              <li>{t('Press Close below to close this tab')}</li>
              <li>{t('Press Resume on the job status to continue the job')}</li>
            </ol>
          </div>
          <div className="flex items-start gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
              <p className="font-medium">{t('Tool change complete')}</p>
              <p>{t('You can now close this tab and resume the job.')}</p>
            </div>
          </div>
        </div>
      )}
    </SetupBlockLayout>
  )
}
