import React from 'react'
import { Target, AlertCircle, HelpCircle, Navigation, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'

interface BitSetterZeroingWizardProps {
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
}

/**
 * BitSetter zeroing wizard - renders steps for bitsetter zeroing method
 */
export function BitSetterZeroingWizard({
  method,
  currentStep,
  machinePosition,
  probeContact = false,
  probeStatus = 'idle',
  probeError = null,
  bitsetterNavigated = false,
  currentWCS = 'G54',
  isConnected,
  connectedPort,
  onNavigate,
  onProbe,
}: BitSetterZeroingWizardProps) {
  // Map step numbers based on requireCheck setting
  // If requireCheck is false, skip step 1 (verification), so step 1->navigate, step 2->tool change, step 3->probe
  const skipVerification = method.requireCheck === false
  const actualStep = skipVerification ? currentStep + 1 : currentStep

  switch (actualStep) {
    case 1:
      // Step 1: Verify BitSetter Circuit (only shown if requireCheck is true)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step 1: Verify BitSetter Circuit</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Verify that the BitSetter circuit is working by manually pressing the sensor down. The BitSetter should trigger when the sensor is pressed.
              </p>
              <p>
                This ensures the probe circuit is functioning correctly before starting the zeroing process.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Press the BitSetter sensor down manually with your finger or a tool. If the probe triggers correctly, you're ready to proceed. If not, check your wiring and probe settings.
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
                  Probe Status: {probeContact ? 'Contact Detected' : 'No Contact'}
                </span>
              </div>
              {probeContact && (
                <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                  The probe circuit is working correctly. You can proceed to the next step.
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
            <h3 className="text-base font-semibold">Step {skipVerification ? 1 : 2}: Navigate to BitSetter</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                The tool will automatically navigate to the BitSetter location configured in settings. The machine will move to the BitSetter position safely.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>Warning:</strong> Make sure there is a clear path to the BitSetter location and that no obstacles will interfere with the tool movement.
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
              Navigate to BitSetter
            </Button>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">BitSetter Location:</div>
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
              <div className="text-sm font-medium">Machine Position:</div>
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
      // Step 3: Install First Tool (shown as step 2 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step {skipVerification ? 2 : 3}: Install First Tool</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Install the first tool before probing. We will measure the length of this tool so tool changes during the job are easier and you will only need to re-measure on the bitsetter instead of setting Z again on the material.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Once the first tool is installed, press Next to proceed to the probing step.
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
            <h3 className="text-base font-semibold">Step {skipVerification ? 3 : 4}: Run Probe</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Press the probe button below to start the automatic BitSetter probe sequence. The tool will perform a multi-stage probe sequence to accurately measure the tool length.
              </p>
              <p>
                After probing, the tool reference will be stored. The tool will automatically retract to a safe height above the BitSetter.
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
                    {probeStatus === 'probing' && 'Running probe sequence...'}
                    {probeStatus === 'capturing' && 'Capturing position...'}
                    {probeStatus === 'storing' && 'Storing tool reference...'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {probeStatus === 'probing' && 'The tool is probing down to contact the BitSetter sensor.'}
                    {probeStatus === 'capturing' && 'Reading work position after probe contact...'}
                    {probeStatus === 'storing' && 'Saving tool reference to Extensions API...'}
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
                    Probe complete! Tool reference stored.
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    The tool reference has been saved for {currentWCS}. You can now use this reference for tool changes.
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
                    Probe error
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    {probeError || 'An error occurred during the probe sequence. Please try again.'}
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
                    Machine not at BitSetter location
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    The machine is not positioned at the BitSetter location. Please go back to the previous step and navigate to the BitSetter location before probing.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {!isProbing && !isProbeComplete && isAtBitsetterPosition && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Warning:</strong> Make sure the tool is positioned above the BitSetter and there is enough clearance for the probe distance ({method.probeDistance}mm) before starting. The tool should already be at the BitSetter location from the previous step.
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
                  {probeStatus === 'probing' && 'Probing...'}
                  {probeStatus === 'capturing' && 'Capturing...'}
                  {probeStatus === 'storing' && 'Storing...'}
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  {isProbeComplete ? 'Probe Complete' : 'Start BitSetter Probe'}
                </>
              )}
            </Button>
          </div>
          
          {isProbeComplete && (
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                <p className="font-medium">Tool reference stored</p>
                <p>
                  The tool reference for {currentWCS} has been saved. When you change tools during a job, you can use this reference to automatically adjust the Z offset.
                </p>
              </div>
            </div>
          )}
        </div>
      )
    }
    default:
      return null
  }
}
