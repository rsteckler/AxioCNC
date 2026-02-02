import { useTranslation } from 'react-i18next'
import { ClipboardList } from 'lucide-react'
import { MachineActionButton } from '@/components/MachineActionButton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ActionRequirements } from '@/utils/machineState'
import type { PanelProps } from '../types'

export interface JobSetupPanelProps extends PanelProps {
  onSetUpJob?: () => void
}

/**
 * Job setup panel: primary entry point for pre-job setup.
 * "Set up job" opens JobSetupWizard (plan summary + execution blocks).
 */
export function JobSetupPanel({
  isConnected,
  connectedPort,
  machineStatus,
  onFlashStatus,
  onSetUpJob,
}: JobSetupPanelProps) {
  const { t } = useTranslation()

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        {t('Run XY zeroing, then establish tool reference if needed.')}
      </p>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block w-full">
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={onSetUpJob ?? (() => {})}
                requirements={ActionRequirements.standard}
                variant="default"
                size="sm"
                className="w-full"
              >
                <ClipboardList className="w-4 h-4 mr-2" />
                {t('Set up job')}
              </MachineActionButton>
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            {t('Opens the setup wizard to set work XY zero, work Z zero, and optionally establish tool reference.')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
