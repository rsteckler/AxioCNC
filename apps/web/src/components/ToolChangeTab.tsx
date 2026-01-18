import { ZeroingWizardTab } from './ZeroingWizardTab'
import { ZeroingMethodSelectDialog } from './ZeroingMethodSelectDialog'
import { useToolChange } from '@/contexts/ToolChangeContext'
import { useGetSettingsQuery } from '@/services/api'
import type { ZeroingMethod } from '../../../../packages/shared/src/schemas/settings'

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
  const { toolChangeMethod, completeToolChange, triggerToolChange, isFirstToolChange } = useToolChange()
  const { data: settings } = useGetSettingsQuery()

  // Get available methods from settings
  const availableMethods: ZeroingMethod[] = settings?.zeroingMethods?.methods?.filter((m: ZeroingMethod) => m.enabled) ?? []

  // When method is 'ask', show dialog (automatically open when toolChangeMethod === 'ask')
  const showDialog = toolChangeMethod === 'ask'

  // Handle method selection from dialog
  const handleMethodSelect = (method: ZeroingMethod) => {
    // Update the tool change method in context to the selected method
    // Preserve isFirstToolChange state when switching to the selected method
    triggerToolChange(method, isFirstToolChange)
  }

  // If method is 'ask', show method selection dialog
  if (toolChangeMethod === 'ask') {
    return (
      <>
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="text-sm text-muted-foreground text-center py-8">
            Please select a zeroing method
          </div>
        </div>
        <ZeroingMethodSelectDialog
          open={showDialog}
          onOpenChange={() => {}} // Prevent closing - user must select a method
          methods={availableMethods}
          title="Select Zeroing Method"
          description="Choose a zeroing method to use for this tool change:"
          onSelect={handleMethodSelect}
        />
      </>
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
