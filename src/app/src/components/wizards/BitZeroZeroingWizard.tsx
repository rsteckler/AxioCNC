import React from 'react'
import { Target, AlertCircle, HelpCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'

interface BitZeroZeroingWizardProps {
  method: Extract<ZeroingMethod, { type: 'bitzero' }>
  currentStep: number
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  probeStatus?: 'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'
  probeError?: string | null
  currentWCS?: string
  isConnected: boolean
  connectedPort: string | null
  onProbe: () => void
}

/**
 * BitZero zeroing wizard - renders steps for bitzero zeroing method
 */
export function BitZeroZeroingWizard({
  method,
  currentStep,
  workPosition,
  probeContact = false,
  probeStatus = 'idle',
  probeError = null,
  currentWCS = 'G54',
  isConnected,
  connectedPort,
  onProbe,
}: BitZeroZeroingWizardProps) {
  // Map step numbers based on requireCheck setting
  // If requireCheck is false, skip step 1 (verification), so step 1->place, step 2->jog, step 3->probe, step 4->remove
  const skipVerification = method.requireCheck === false
  const actualStep = skipVerification ? currentStep + 1 : currentStep

  const isProbing = probeStatus === 'probing' || probeStatus === 'complete'
  const isProbeComplete = probeStatus === 'complete'
  const isProbeError = probeStatus === 'error'

  switch (actualStep) {
    case 1:
      // Step 1: Verify BitZero Circuit (only shown if requireCheck is true)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step 1: Verify BitZero Circuit</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Verify that the magnetic conductor is positively attached to the tool and that the circuit is functioning correctly.
              </p>
              <p>
                This ensures the probe circuit is working before starting the zeroing process.
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Attach the magnetic conductor to the tool, then lift the BitZero probe until it touches the tool. If the probe triggers correctly, the magnetic conductor is properly attached and the circuit is functioning.
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
      // Step 2: Place BitZero on Corner (shown as step 1 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step {skipVerification ? 1 : 2}: Place BitZero on Corner</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Place the BitZero probe on the corner of your workpiece, making sure it's secure and flat.
              </p>
              <p>
                The BitZero should be positioned so the conductive hole in the bottom left (-X-Y) corner is accessible for probing. Make sure the probe is firmly attached and won't move during probing.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>Important:</strong> Ensure the BitZero is securely mounted and flat against the workpiece. The probe must not move during the zeroing sequence.
            </p>
          </div>
        </div>
      )
    case 3:
      // Step 3: Jog Tool into Hole (shown as step 2 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step {skipVerification ? 2 : 3}: Jog Tool into Hole</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Use the jog controls to carefully position the tool into the conductive hole in the bottom left corner of the BitZero probe.
              </p>
              <p>
                <strong>Important:</strong> The tool should be positioned <strong>below the Z surface</strong> of the probe (inside the hole). Use small movements when you get close to avoid damaging the tool or probe.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
              <p className="font-medium">Jogging Tips:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Use large movements to get close to the hole</li>
                <li>Switch to small movements (0.1mm or less) when approaching the hole</li>
                <li>Ensure the tool is positioned below the Z surface of the probe</li>
                <li>The tool should be centered in the hole as much as possible</li>
              </ul>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">Current Work Position:</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">X: </span>
                <span className="font-mono">{workPosition.x.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Y: </span>
                <span className="font-mono">{workPosition.y.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Z: </span>
                <span className="font-mono">{workPosition.z.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </div>
      )
    case 4:
      // Step 4: Run Probe (shown as step 3 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step {skipVerification ? 3 : 4}: Run Probe</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Press the probe button below to start the automatic BitZero probe sequence. The tool will:
              </p>
              <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                <li>Probe right until contact, then probe left to find X edges and calculate X center</li>
                <li>Probe top and bottom to find Y edges and calculate Y center</li>
                <li>Move above the plate and probe Z to set Z zero</li>
              </ol>
              <p>
                After probing, XYZ zero will be set at the corner of your workpiece.
              </p>
            </div>
          </div>
          
          {!isProbing && !isProbeComplete && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Warning:</strong> Make sure the tool is positioned in the hole below the Z surface before starting. The tool should already be in the hole from the previous step.
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-center py-4">
            <Button
              onClick={onProbe}
              variant="default"
              size="lg"
              className="gap-2"
              disabled={!isConnected || !connectedPort || isProbing}
            >
              {isProbing ? (
                <>
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {probeStatus === 'probing' && 'Probing...'}
                  {probeStatus === 'complete' && 'Complete'}
                </>
              ) : (
                <>
                  <Target className="w-5 h-5" />
                  Start BitZero Probe
                </>
              )}
            </Button>
          </div>
          
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium">Probe Settings:</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Probe Feedrate: </span>
                <span className="font-mono">{method.probeFeedrate}mm/min</span>
              </div>
              <div>
                <span className="text-muted-foreground">Probe Distance: </span>
                <span className="font-mono">{method.probeDistance}mm</span>
              </div>
              <div>
                <span className="text-muted-foreground">Probe Thickness: </span>
                <span className="font-mono">{method.probeThickness}mm</span>
              </div>
              <div>
                <span className="text-muted-foreground">Work Coordinate: </span>
                <span className="font-mono">{currentWCS}</span>
              </div>
            </div>
          </div>
          
          {/* Probe Status */}
          {isProbing && (
            <div className={`p-4 rounded-lg border ${
              probeStatus === 'probing' ? 'bg-blue-500/10 border-blue-500/30' :
              probeStatus === 'complete' ? 'bg-green-500/10 border-green-500/30' :
              'bg-muted/50 border-border'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${
                  probeStatus === 'probing' ? 'bg-blue-500 animate-pulse' :
                  'bg-green-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {probeStatus === 'probing' && 'Running probe sequence...'}
                    {probeStatus === 'complete' && 'Probe complete! XYZ zero set.'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {probeStatus === 'probing' && 'The tool is probing X, Y, and Z axes to find the corner zero point.'}
                    {probeStatus === 'complete' && 'XYZ zero has been set at the corner of your workpiece.'}
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
                    Probe complete! XYZ zero set.
                  </p>
                  <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                    The corner zero point has been established. You can now remove the BitZero probe.
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
        </div>
      )
    case 5:
      // Step 5: Remove BitZero (shown as step 4 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step {skipVerification ? 4 : 5}: Remove BitZero</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Remove the BitZero probe from the workpiece. The probe sequence has completed and XYZ zero has been set at the corner of your workpiece.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
              <p className="font-medium">Zeroing Complete</p>
              <p>
                XYZ zero has been set at the corner of your workpiece ({currentWCS}). You can now remove the BitZero probe and proceed with your job.
              </p>
            </div>
          </div>
        </div>
      )
    default:
      return null
  }
}
