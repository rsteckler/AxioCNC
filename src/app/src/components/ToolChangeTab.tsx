import { ZeroingWizardTab } from './ZeroingWizardTab'
import { useToolChange } from '@/contexts/ToolChangeContext'

interface ToolChangeTabProps {
  isConnected: boolean
  connectedPort: string | null
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  currentWCS?: string
}

/**
 * Tool Change tab component
 * Displays the zeroing wizard for the configured tool change method
 */
export function ToolChangeTab({
  isConnected,
  connectedPort,
  machinePosition,
  workPosition,
  probeContact = false,
  currentWCS = 'G54',
}: ToolChangeTabProps) {
  const { toolChangeMethod, completeToolChange } = useToolChange()

  // If method is 'ask', show method selection (TODO: implement method picker)
  if (toolChangeMethod === 'ask') {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground text-center py-8">
          Please select a zeroing method (method picker coming soon)
        </div>
      </div>
    )
  }

  // If method is 'skip' or null, shouldn't reach here, but handle gracefully
  if (!toolChangeMethod || toolChangeMethod === 'skip') {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground text-center py-8">
          No tool change method configured
        </div>
      </div>
    )
  }

  // Render the zeroing wizard with the configured method
  // Mark as tool change so bitsetter uses the tool change wizard (skips "Install First Tool" step)
  return (
    <ZeroingWizardTab
      method={toolChangeMethod}
      onClose={completeToolChange}
      isConnected={isConnected}
      connectedPort={connectedPort}
      machinePosition={machinePosition}
      workPosition={workPosition}
      probeContact={probeContact}
      currentWCS={currentWCS}
      isToolChange={true}
    />
  )
}
