import { useTranslation } from 'react-i18next'
import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { MachineReadinessStatus } from '@/types/machine'

interface MachineStatusBadgeProps {
  machineStatus: MachineReadinessStatus
  isFlashing?: boolean
}

export function MachineStatusBadge({ machineStatus, isFlashing = false }: MachineStatusBadgeProps) {
  const { t } = useTranslation()
  
  const getStatusLabel = (status: MachineReadinessStatus): string => {
    switch (status) {
      case 'not_connected':
        return t('Not connected')
      case 'connected_pre_home':
        return t('Ready (Run Home)')
      case 'connected_post_home':
        return t('Ready')
      case 'alarm':
        return t('Alarm')
      case 'running':
        return t('Busy')
      case 'hold':
        return t('Hold')
      case 'error':
        return t('Error')
      default:
        return t('Unknown')
    }
  }

  const getStatusTooltip = (status: MachineReadinessStatus): string => {
    switch (status) {
      case 'not_connected':
        return t('AxioCNC is not connected to your machine.')
      case 'connected_pre_home':
        return t('Your machine is connected, but AxioCNC can\'t verify that the displayed position matches the physical machine. Home your machine to establish truth of position.')
      case 'connected_post_home':
        return t('Your machine is connected and ready.')
      case 'hold':
        return t('Your machine is paused and motion is disabled for safety. This can happen during a tool change, or because a job was paused. Click Resume to enable machine motion.')
      case 'alarm':
        return t('The machine is in an error state and motion has been disabled. Hit Reset to clear the alarm. If the machine is still in alarm state after a reset, it may need to be unlocked to complete the reset. In all cases, the machine should be rehomed after clearing the alarm to establish truth of position. AxioCNC can\'t verify that the displayed position matches the physical machine until it is rehomed.')
      case 'running':
        return t('Your machine is running a job.')
      case 'error':
        return t('An error has occurred.')
      default:
        return t('Unknown machine status.')
    }
  }

  const getStatusStyles = (status: MachineReadinessStatus) => {
    if (status === 'connected_post_home' || status === 'running') {
      return {
        container: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400',
        dot: 'bg-green-500'
      }
    }
    if (status === 'connected_pre_home') {
      return {
        container: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400',
        dot: 'bg-yellow-500'
      }
    }
    if (status === 'hold') {
      return {
        container: 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400',
        dot: 'bg-orange-500'
      }
    }
    if (status === 'alarm' || status === 'error') {
      return {
        container: 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400',
        dot: 'bg-red-500'
      }
    }
    return {
      container: 'bg-muted border-border text-muted-foreground',
      dot: 'bg-zinc-500'
    }
  }

  const styles = getStatusStyles(machineStatus)

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div 
            className={`
              relative px-3 py-1.5 rounded border flex items-center gap-2 min-w-[140px] justify-center
              transition-all duration-200
              ${styles.container}
            `}
            style={isFlashing ? {
              animation: 'flash-bright 450ms ease-in-out'
            } : {}}
          >
            <div className={`w-2 h-2 rounded-full ${styles.dot}`} />
            <span className="text-xs font-medium pr-3">
              {getStatusLabel(machineStatus)}
            </span>
            <HelpCircle className="absolute top-0.5 right-0.5 w-3 h-3 text-white cursor-help" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">
            {getStatusTooltip(machineStatus)}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
