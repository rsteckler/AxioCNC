import React from 'react'
import { Target, AlertCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'

interface CustomZeroingWizardProps {
  method: Extract<ZeroingMethod, { type: 'custom' }>
  currentStep: number
  probeStatus?: 'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'
  probeError?: string | null
  isConnected: boolean
  connectedPort: string | null
  onProbe: () => void
}

/**
 * Custom zeroing wizard - renders steps for custom G-code zeroing method
 */
export function CustomZeroingWizard({
  method,
  currentStep,
  probeStatus = 'idle',
  probeError = null,
  isConnected,
  connectedPort,
  onProbe,
}: CustomZeroingWizardProps) {
  const isProbing = probeStatus === 'probing'
  const isProbeComplete = probeStatus === 'complete'
  const isProbeError = probeStatus === 'error'

  switch (currentStep) {
    case 1:
      // Step 1: Run Custom G-code
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step 1: Run Custom G-code</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                Review the custom G-code below and press the button to execute it. The G-code will run sequentially until complete.
              </p>
            </div>
          </div>
          
          {/* Run Button */}
          <div className="flex items-center justify-center py-4">
            <Button
              onClick={onProbe}
              variant="default"
              size="lg"
              className="gap-2"
              disabled={!isConnected || !connectedPort || !method.gcode || isProbing || isProbeComplete}
            >
              <Target className="w-5 h-5" />
              {isProbing ? 'Running...' : isProbeComplete ? 'G-code Complete' : 'Run Custom G-code'}
            </Button>
          </div>
          
          {/* Probe Status - Executing G-code box */}
          {(isProbing || isProbeComplete || isProbeError) && (
            <div className={`p-3 rounded-lg border ${
              isProbeComplete 
                ? 'bg-green-500/10 border-green-500/30'
                : isProbeError
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-blue-500/10 border-blue-500/30'
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  isProbeComplete ? 'bg-green-500' : isProbeError ? 'bg-red-500' : 'bg-blue-500 animate-pulse'
                }`} />
                <span className="text-sm font-medium">
                  {isProbeComplete 
                    ? 'G-code Execution Complete'
                    : isProbeError
                    ? 'Error During Execution'
                    : 'Executing G-code...'}
                </span>
              </div>
              {probeError && (
                <p className="text-xs text-red-900 dark:text-red-100 mt-1 ml-5">
                  {probeError}
                </p>
              )}
              {isProbeComplete && (
                <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                  All G-code commands have been executed. Proceed to the next step to complete the zeroing process.
                </p>
              )}
            </div>
          )}
          
          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>Warning:</strong> Make sure the machine is in a safe state before running the G-code. Verify the G-code will not cause collisions or unsafe movements.
            </p>
          </div>
          
          {/* Display G-code */}
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="text-sm font-medium mb-2">Custom G-code:</div>
            <pre className="text-xs font-mono bg-background border rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
              {method.gcode || '(No G-code configured)'}
            </pre>
            {!method.gcode && (
              <p className="text-xs text-muted-foreground mt-2">
                Please configure the custom G-code in settings before running this probe method.
              </p>
            )}
          </div>
        </div>
      )
    case 2:
      // Step 2: Complete (only shown after G-code is done)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">Step 2: Complete</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                The custom G-code has been executed. Verify that the zeroing operation completed successfully before proceeding.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
              <p className="font-medium">G-code Execution Complete</p>
              <p>
                The custom G-code probe sequence has finished. If the zeroing was successful, click Complete to finish.
              </p>
            </div>
          </div>
        </div>
      )
    default:
      return null
  }
}
