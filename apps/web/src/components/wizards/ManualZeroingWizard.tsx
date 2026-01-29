import { useTranslation } from 'react-i18next'
import { HelpCircle, RotateCcw, Check } from 'lucide-react'
import { getAxesLabel } from './utils'
import type { ZeroingMethod } from '../../../../shared/src/schemas/settings'

interface ManualZeroingWizardProps {
  method: Extract<ZeroingMethod, { type: 'manual' }>
  currentStep: number
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  isJobPaused?: boolean
}

/**
 * Manual zeroing wizard - renders steps for manual zeroing method
 */
export function ManualZeroingWizard({
  method,
  currentStep,
  machinePosition,
  workPosition,
  isJobPaused = false,
}: ManualZeroingWizardProps) {
  const { t } = useTranslation()
  const axes = method.axes

  switch (currentStep) {
    case 1:
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step 1: Position XY')}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Use the jog controls to move the tool to the XY location that matches the zero point in your CAM software.')}
              </p>
              {axes.includes('x') && axes.includes('y') && (
                <>
                  <p>
                    {t('When the endmill is directly above the desired point, press the zero buttons in the Position panel:')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span>{t('Zero button')}</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </span>
                      <span>{t('next to X')}</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span>{t('Zero button')}</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </span>
                      <span>{t('next to Y')}</span>
                    </li>
                  </ul>
                  <p>
                    {t('This sets the current position as the zero point for this job. After you have set zero for X and Y, press Next to continue.')}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">{t('Current Machine Position')}:</div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">X: </span>
                <span className="font-mono">{machinePosition.x.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Y: </span>
                <span className="font-mono">{machinePosition.y.toFixed(3)}</span>
              </div>
            </div>
          </div>
          {axes.includes('x') && axes.includes('y') && (
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                {t('Tip')}: {t('You can use the Z controls to lower the bit near the surface for better accuracy when positioning XY. We\'ll set the Z zero in the next step.')}
              </p>
            </div>
          )}
        </div>
      )
    case 2:
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step 2: Position Z (Paper Test)')}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Lower the Z-axis until the tool just touches the surface. A piece of paper should barely slide in and out with friction.')}
              </p>
              {axes.includes('z') && (
                <>
                  <p>
                    {t('When the tool is positioned correctly, press the zero button in the Position panel:')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span>{t('Zero button')}</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </span>
                      <span>{t('next to Z')}</span>
                    </li>
                  </ul>
                  <p>
                    {t('After you have set zero for Z, press Next to continue.')}
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="text-sm font-medium">{t('Current Machine Position')}:</div>
            <div className="text-sm">
              <span className="text-muted-foreground">Z: </span>
              <span className="font-mono">{machinePosition.z.toFixed(3)}</span>
            </div>
          </div>
          {axes.includes('z') && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                  <p className="font-medium">{t('Paper Test Instructions')}:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>{t('Place a piece of paper (about 0.1mm thick) on the surface')}</li>
                    <li>{t('Slowly lower the Z-axis using small jog steps')}</li>
                    <li>{t('Stop when the paper can barely slide in and out with friction')}</li>
                    <li>{t('The tool should just touch the paper, not press into it')}</li>
                  </ol>
                </div>
              </div>
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>{t('Tip')}:</strong> {t('Use very small jog distances (0.01mm) for fine adjustment when approaching the surface.')}
                </p>
              </div>
            </div>
          )}
        </div>
      )
    case 3: {
      // Check if WCS is at zero for the axes that were zeroed (2 decimal accuracy = 0.01mm tolerance)
      const isAtZero = 
        (!axes.includes('x') || Math.abs(workPosition.x) < 0.01) &&
        (!axes.includes('y') || Math.abs(workPosition.y) < 0.01) &&
        (!axes.includes('z') || Math.abs(workPosition.z) < 0.01)
      
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step 3: Confirm Zero')}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('Zero has been set for {{axes}}. Pressing XY0 in the jog controls will return to this XY position, and pressing Z0 will move Z down to this depth.', { axes: getAxesLabel(axes) })}
              </p>
            </div>
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="text-sm font-medium">{t('Work Coordinate System Position')}:</div>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {axes.includes('x') && (
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{workPosition.x.toFixed(3)}</span>
                </div>
              )}
              {axes.includes('y') && (
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{workPosition.y.toFixed(3)}</span>
                </div>
              )}
              {axes.includes('z') && (
                <div>
                  <span className="text-muted-foreground">Z: </span>
                  <span className="font-mono">{workPosition.z.toFixed(3)}</span>
                </div>
              )}
            </div>
          </div>
          {isAtZero ? (
            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div className="text-sm text-green-900 dark:text-green-100">
                <p className="font-medium">{t('Zero confirmed: The work coordinate system is set to the current position.')}</p>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="text-sm text-red-900 dark:text-red-100">
                <p className="font-medium">{t('Warning: The current position is not at the zero position. The work coordinate system shows non-zero values.')}</p>
              </div>
            </div>
          )}
        </div>
      )
    }
    case 4: {
      // Step 4: Complete (only shown if job is paused)
      if (!isJobPaused) {
        return null
      }
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-base font-semibold">{t('Step 4: Complete')}</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                {t('The zeroing wizard is complete! Zero has been set for {{axes}}.', { axes: getAxesLabel(method.axes) })}
              </p>
              <p className="font-medium text-foreground mt-3">
                {t('Next steps')}:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground ml-2">
                <li>{t('Press the Complete button below to close this wizard')}</li>
                <li>{t('Press Resume on the job status indicator to continue the job')}</li>
              </ol>
            </div>
          </div>
          <div className="flex items-start gap-2 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <Check className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
              <p className="font-medium">{t('Zeroing complete')}</p>
              <p>
                {t('Zero has been set for {{axes}}. You can now resume the job.', { axes: getAxesLabel(method.axes) })}
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
