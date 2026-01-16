import React, { useCallback } from 'react'
import { Target } from 'lucide-react'
import { MachineActionButton } from '@/components/MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useGetSettingsQuery } from '@/services/api'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'
import type { ProbePanelProps } from '../types'

function getMethodDescription(method: ZeroingMethod): string {
  switch (method.type) {
    case 'bitsetter':
      return 'Automatic tool length sensor for Z-axis zeroing'
    case 'bitzero':
      return `Corner/edge/center probe for ${method.axes.toUpperCase()} zeroing`
    case 'touchplate':
      return 'Touch plate for Z-axis zeroing'
    case 'manual':
      return `Manually jog to position and set ${method.axes.toUpperCase()} zero`
    case 'custom':
      return 'Custom G-code sequence for zeroing'
    default:
      return 'Zeroing method'
  }
}

function getAxesLabel(axes: string): string {
  return axes.toUpperCase()
}

export function ProbePanel({ 
  isConnected, 
  connectedPort, 
  machineStatus, 
  onFlashStatus, 
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  workPosition: _workPosition = { x: 0, y: 0, z: 0 }, 
  onStartWizard 
}: ProbePanelProps) {
  const { data: settings, isLoading } = useGetSettingsQuery()
  
  // Get enabled zeroing methods from settings
  const methods: ZeroingMethod[] = settings?.zeroingMethods?.methods?.filter((m: ZeroingMethod) => m.enabled) ?? []
  
  const handleRun = useCallback((method: ZeroingMethod) => {
    if (onStartWizard) {
      onStartWizard(method)
    }
  }, [onStartWizard])
  
  if (isLoading) {
    return <LoadingState message="Loading zeroing methods..." />
  }
  
  if (methods.length === 0) {
    return <EmptyState message="No zeroing methods configured. Add methods in Settings." />
  }
  
  return (
    <div className="p-3 space-y-2">
      {methods.map((method) => (
        <div 
          key={method.id}
          className="flex items-center gap-3 p-2 rounded border border-border hover:bg-muted/50 transition-colors"
        >
          <Target className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{method.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {getMethodDescription(method)} • {getAxesLabel(method.axes)}
            </div>
          </div>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatus}
            onAction={() => handleRun(method)}
            requirements={ActionRequirements.jog}
            variant="secondary"
            size="sm"
            className="h-7 text-xs flex-shrink-0"
          >
            Run
          </MachineActionButton>
        </div>
      ))}
    </div>
  )
}
