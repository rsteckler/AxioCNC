import { useTranslation } from 'react-i18next'
import { Target, AlertCircle, HelpCircle, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ZeroingMethod } from '../../../../shared/src/schemas/settings'

interface TouchPlateZeroingWizardProps {
  method: Extract<ZeroingMethod, { type: 'touchplate' }>
  currentStep: number
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  probeStatus?: 'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'
  isConnected: boolean
  connectedPort: string | null
  onProbe: () => void
}

/**
 * Touch Plate zeroing wizard - renders steps for touch plate zeroing method
 */
export function TouchPlateZeroingWizard({
  method,
  currentStep,
  workPosition,
  probeContact = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  probeStatus: _probeStatus = 'idle',
  isConnected,
  connectedPort,
  onProbe,
}: TouchPlateZeroingWizardProps) {
  const { t } = useTranslation()
  // Map step numbers based on requireCheck setting
  // If requireCheck is false, skip step 1 (verification), so step 1->position, step 2->probe
  const skipVerification = method.requireCheck === false
  const actualStep = skipVerification ? currentStep + 1 : currentStep

  switch (actualStep) {
    case 1:
      // Step 1: Verify Touch Plate (only shown if requireCheck is true)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step 1: Verify Touch Plate')}</h3>
            <div className="text-sm text-muted-foreground">
              <p>
                {t('Verify that the touch plate is working by manually touching it to the tool. The touch plate should trigger when contact is made. This ensures the probe circuit is functioning correctly before starting the zeroing process.')}
              </p>
            </div>
          </div>
          <div className="space-y-3">
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
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t('Touch the plate to the tool manually. If the probe triggers correctly, you\'re ready to proceed. If not, check your wiring and probe settings.')}
              </p>
            </div>
          </div>
        </div>
      )
    case 2:
      // Step 2: Position Touch Plate (shown as step 1 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step {{step}}: Position Touch Plate', { step: skipVerification ? 1 : 2 })}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Place the touch plate on the workpiece at the location where you want to set Z zero.')}
              </p>
              <p>
                {t('Use the jog controls to position the tool above the touch plate location. The tool should be positioned so it can probe down onto the plate.')}
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">{t('Work Coordinate System Position')}:</div>
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
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {t('Make sure the touch plate is flat on the workpiece surface and the tool can reach it when probing down.')}
            </p>
          </div>
        </div>
      )
    case 3:
      // Step 3: Run Probe (shown as step 2 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step {{step}}: Run Probe', { step: skipVerification ? 2 : 3 })}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Press the probe button below to start the automatic Z-probe sequence. The tool will probe down until it contacts the touch plate, then set Z zero accounting for the plate thickness ({{thickness}}mm).', { thickness: method.plateThickness })}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-yellow-900 dark:text-yellow-100">
              <strong>{t('Warning')}:</strong> {t('Make sure the tool is positioned above the touch plate and there is enough clearance for the probe distance ({{distance}}mm) before starting.', { distance: method.probeDistance })}
            </p>
          </div>
          <div className="flex items-center justify-center py-4">
            <Button
              onClick={onProbe}
              variant="default"
              size="lg"
              className="gap-2"
              disabled={!isConnected || !connectedPort}
            >
              <Target className="w-5 h-5" />
              {t('Start Z-Probe')}
            </Button>
          </div>
        </div>
      )
    case 4:
      // Step 4: Remove Touch Plate (shown as step 3 if requireCheck is false)
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step {{step}}: Remove Touch Plate', { step: skipVerification ? 3 : 4 })}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Remove the touch plate from the workpiece. The probe sequence has completed and Z zero has been set accounting for the plate thickness ({{thickness}}mm).', { thickness: method.plateThickness })}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
              <p className="font-medium">{t('Zeroing Complete')}</p>
              <p>
                {t('Z zero has been set at the touch plate location accounting for the plate thickness. You can now remove the touch plate and proceed with your job.')}
              </p>
            </div>
          </div>
        </div>
      )
    default:
      return null
  }
}
