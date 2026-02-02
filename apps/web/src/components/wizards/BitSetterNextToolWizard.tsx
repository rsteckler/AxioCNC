import { useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Target, AlertCircle, HelpCircle, Navigation, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useGetToolsQuery } from '@/services/api'
import { useJobState } from '@/store/hooks'
import { mmToInches } from '@/utils/units'
import type { ZeroingMethod } from '../../../../shared/src/schemas/settings'

interface BitSetterNextToolWizardProps {
  method: Extract<ZeroingMethod, { type: 'bitsetter' }>
  currentStep: number
  machinePosition: { x: number; y: number; z: number }
  probeContact?: boolean
  probeStatus?: 'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'
  probeError?: string | null
  bitsetterNavigated?: boolean
  currentWCS?: string
  isConnected: boolean
  connectedPort: string | null
  onNavigate: () => void
  onProbe: () => void
  isJobPaused?: boolean
}

/**
 * BitSetter next tool wizard - renders steps for bitsetter subsequent tool changes
 * This is used for tool changes after the first tool during a job
 */
export function BitSetterNextToolWizard({
  method,
  currentStep,
  machinePosition,
  probeContact = false,
  probeStatus = 'idle',
  probeError = null,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  bitsetterNavigated: _bitsetterNavigated = false,
  currentWCS = 'G54',
  isConnected,
  connectedPort,
  onNavigate,
  onProbe,
  isJobPaused = false,
}: BitSetterNextToolWizardProps) {
  const { t } = useTranslation()
  // Map step numbers based on requireCheck setting
  // If requireCheck is false, skip step 1 (verification), so step 1->navigate, step 2->probe
  // Note: This wizard skips "Install First Tool" since the tool has already been changed
  const skipVerification = method.requireCheck === false
  const actualStep = skipVerification ? currentStep + 1 : currentStep

  // Get tools from tool library
  const { data: toolsData } = useGetToolsQuery()
  const jobState = useJobState()
  
  // Store the last valid nextM6ToolNumber in a ref (before it becomes -1)
  // This persists across re-renders but resets if component unmounts
  const lastValidToolNumberRef = useRef<number | undefined>(undefined)
  
  // Get the next tool number from job state
  const nextToolNumber = jobState?.nextM6ToolNumber
  
  // Update ref when we have a valid tool number (>= 0)
  useEffect(() => {
    if (nextToolNumber !== undefined && nextToolNumber >= 0) {
      lastValidToolNumberRef.current = nextToolNumber
    }
  }, [nextToolNumber])
  
  // Derive tool number from m6ToolNumbers array if nextM6ToolNumber is -1
  // Find the tool that comes after the current tool in the job
  const deriveToolFromM6Array = (): number | undefined => {
    const m6ToolNumbers = jobState?.m6ToolNumbers
    const currentTool = jobState?.stats?.currentTool
    
    if (!m6ToolNumbers || m6ToolNumbers.length === 0) {
      return undefined
    }
    
    // Find the index of the current tool in the array
    const currentToolIndex = currentTool !== undefined 
      ? m6ToolNumbers.findIndex(tn => tn === currentTool)
      : -1
    
    // If we found the current tool, the next one is the tool we're changing to
    if (currentToolIndex >= 0 && currentToolIndex < m6ToolNumbers.length - 1) {
      const nextTool = m6ToolNumbers[currentToolIndex + 1]
      if (nextTool > 0) {
        return nextTool
      }
    }
    
    return undefined
  }
  
  // Use the current nextM6ToolNumber if valid, otherwise use the last valid one we captured
  // Fallback to deriving from m6ToolNumbers array, then stats.currentTool
  const toolNumberToShow = 
    (nextToolNumber !== undefined && nextToolNumber >= 0) 
      ? nextToolNumber 
      : lastValidToolNumberRef.current ?? deriveToolFromM6Array() ?? jobState?.stats?.currentTool
  
  // Find tool data from tool library
  const toolData = toolNumberToShow !== undefined && toolNumberToShow >= 0
    ? toolsData?.records?.find(t => t.toolId === toolNumberToShow)
    : null

  switch (actualStep) {
    case 1:
      // Step 1: Verify BitSetter Circuit (only shown if requireCheck is true)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step 1: Verify BitSetter Circuit')}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Verify that the BitSetter circuit is working by manually pressing the sensor down. The BitSetter should trigger when the sensor is pressed.')}
              </p>
              <p>
                {t('This ensures the probe circuit is functioning correctly before measuring the tool length.')}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t('Press the BitSetter sensor down. If the probe triggers correctly, you\'re ready to proceed. If not, check your wiring and probe settings.')}
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
        </div>
      )
    case 2:
      // Step 2: Navigate to BitSetter (shown as step 1 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step {{step}}: Navigate to BitSetter', { step: skipVerification ? 1 : 2 })}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('The machine will automatically navigate to the BitSetter location configured in settings. This will move the machine to the BitSetter position safely so we can measure the new tool length.')}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>{t('Warning')}:</strong> {t('Make sure there is a clear path to the BitSetter location and that no obstacles will interfere with the tool movement.')}
            </p>
          </div>
          <div className="flex items-center justify-center py-4">
            <Button
              onClick={onNavigate}
              variant="default"
              size="lg"
              className="gap-2"
              disabled={!isConnected || !connectedPort}
            >
              <Navigation className="w-5 h-5" />
              {t('Navigate to BitSetter')}
            </Button>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">{t('BitSetter Location')}:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{method.position.x.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{method.position.y.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Z: </span>
                  <span className="font-mono">{method.position.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-medium">{t('Machine Position')}:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{machinePosition.x.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{machinePosition.y.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Z: </span>
                  <span className="font-mono">{machinePosition.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    case 3:
      // Step 3: Install Next Tool (shown as step 2 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step {{step}}: Install Next Tool', { step: skipVerification ? 2 : 3 })}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Install the next tool before probing. We will measure the length of this tool so the Z offset can be adjusted automatically for the remainder of the job.')}
              </p>
            </div>
          </div>
          {/* Tool Information Panel */}
          {toolNumberToShow !== undefined && toolNumberToShow >= 0 ? (
            <div className="p-3 rounded border bg-primary/10 border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" className="text-xs">
                  T{toolNumberToShow}
                </Badge>
                {toolData ? (
                  <span className="text-sm font-medium">{toolData.name}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">{t('Tool T{{toolId}}', { toolId: toolNumberToShow })}</span>
                )}
              </div>
              {toolData && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  {toolData.diameter != null ? (
                    <div>
                      {t('Diameter')}: Ø{toolData.diameter.toFixed(3)}{toolData.diameterUnit || t('mm')}
                      {toolData.diameterUnit === 'in' && (
                        <> • {(toolData.diameter * 25.4).toFixed(3)}mm</>
                      )}
                      {(!toolData.diameterUnit || toolData.diameterUnit === 'mm') && mmToInches(toolData.diameter) && (
                        <> • {mmToInches(toolData.diameter)}in</>
                      )}
                    </div>
                  ) : null}
                  {toolData.type && (
                    <div>{t('Type')}: {toolData.type}</div>
                  )}
                  {toolData.description && (
                    <div className="mt-1 pt-1 border-t border-primary/20">
                      {toolData.description}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null}
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('Once the next tool is installed, press Next to proceed to the probing step.')}
            </p>
          </div>
        </div>
      )
    case 4: {
      // Step 4: Run Probe (shown as step 3 if requireCheck is false)
      const isProbing = probeStatus === 'probing' || probeStatus === 'capturing' || probeStatus === 'storing'
      const isProbeComplete = probeStatus === 'complete'
      const isProbeError = probeStatus === 'error'
      
      // Check if machine is at bitsetter position (with 1mm tolerance)
      const positionTolerance = 1.0
      const isAtBitsetterPosition = 
        Math.abs(machinePosition.x - method.position.x) < positionTolerance &&
        Math.abs(machinePosition.y - method.position.y) < positionTolerance &&
        Math.abs(machinePosition.z - method.position.z) < positionTolerance
      
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step {{step}}: Measure Tool Length', { step: skipVerification ? 3 : 4 })}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Press the probe button below to start the automatic BitSetter probe sequence. The tool will perform a multi-stage probe sequence to accurately measure the tool length.')}
              </p>
              <p>
                {t('After probing, the tool reference will be stored and Z zero will be adjusted automatically. The tool will automatically retract to a safe height above the BitSetter.')}
              </p>
            </div>
          </div>
          
          {/* Probe Status */}
          {isProbing && (
            <div className={`p-4 rounded-lg border ${
              probeStatus === 'probing' ? 'bg-blue-500/10 border-blue-500/30' :
              probeStatus === 'capturing' ? 'bg-amber-500/10 border-amber-500/30' :
              'bg-purple-500/10 border-purple-500/30'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full animate-pulse ${
                  probeStatus === 'probing' ? 'bg-blue-500' :
                  probeStatus === 'capturing' ? 'bg-amber-500' :
                  'bg-purple-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {probeStatus === 'probing' && t('Running probe sequence...')}
                    {probeStatus === 'capturing' && t('Capturing position...')}
                    {probeStatus === 'storing' && t('Storing tool reference...')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {probeStatus === 'probing' && t('The tool is probing down to contact the BitSetter sensor.')}
                    {probeStatus === 'capturing' && t('Reading work position after probe contact...')}
                    {probeStatus === 'storing' && t('Saving tool reference to Extensions API...')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {isProbeComplete && (
            <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
              <div className="flex items-center gap-3">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">
                    {t('Tool length measured! Reference stored.')}
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    {t('The tool reference has been saved for {{wcs}}. Z zero has been adjusted and you can resume the job.', { wcs: currentWCS })}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {isProbeError && (
            <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/30">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-900 dark:text-red-100">
                    {t('Probe error')}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    {probeError || t('An error occurred during the probe sequence. Please try again.')}
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {!isProbing && !isProbeComplete && !isAtBitsetterPosition && (
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
          
          {!isProbing && !isProbeComplete && isAtBitsetterPosition && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>{t('Warning')}:</strong> {t('Make sure the new tool is installed and positioned above the BitSetter with enough clearance for the probe distance ({{distance}}mm) before starting.', { distance: method.probeDistance })}
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-center py-4">
            <Button
              onClick={onProbe}
              variant="default"
              size="lg"
              className="gap-2"
              disabled={!isConnected || !connectedPort || isProbing || !isAtBitsetterPosition}
            >
              {isProbing ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {probeStatus === 'probing' && t('Probing...')}
                  {probeStatus === 'capturing' && t('Capturing...')}
                  {probeStatus === 'storing' && t('Storing...')}
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  {isProbeComplete ? t('Measurement Complete') : t('Measure Tool Length')}
                </>
              )}
            </Button>
          </div>
          
          {isProbeComplete && (
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                <p className="font-medium">{t('Tool reference stored')}</p>
                <p>
                  {t('The tool reference for {{wcs}} has been saved and Z zero has been adjusted. You can now resume the job with the new tool.', { wcs: currentWCS })}
                </p>
              </div>
            </div>
          )}
        </div>
      )
    }
    case 5: {
      // Step 5: Complete Tool Change (only shown if requireCheck is true AND job is paused, shown as step 4 if requireCheck is false AND job is paused)
      if (!isJobPaused) {
        return null
      }
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step {{step}}: Complete Tool Change', { step: skipVerification ? 4 : 5 })}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('The tool change wizard is complete! The tool length has been measured and stored, and the Z zero has been adjusted automatically.')}
              </p>
              <p className="font-medium text-foreground mt-3">
                {t('Next steps')}:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>{t('Press the Complete button below to close this wizard')}</li>
                <li>{t('Press Resume on the job status indicator to continue the job with the new tool')}</li>
              </ol>
            </div>
          </div>
          <div className="flex items-start gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
              <p className="font-medium">{t('Tool change complete')}</p>
              <p>
                {t('The tool reference for {{wcs}} has been saved and Z zero has been adjusted. You can now resume the job.', { wcs: currentWCS })}
              </p>
            </div>
          </div>
        </div>
      )
    }
    default:
      return null
  }
}
