import { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Bug } from 'lucide-react'
import type { PanelProps } from '../types'
import { 
  useMachineState,
  useIsConnected,
  useConnectedPort,
  useIsHomed,
  useIsJobRunning,
  useWorkflowState,
  useMachinePosition,
  useWorkPosition,
  useSpindleState,
  useSpindleSpeed,
  useFeedrate,
  useRxBufferSize,
  useCurrentTool,
  usePlannerQueue,
} from '@/store/hooks'

export function DebugPanel({
  isConnected,
  connectedPort,
  machineStatus,
}: PanelProps) {
  const machineState = useMachineState()
  const isConnectedComputed = useIsConnected()
  const connectedPortComputed = useConnectedPort()
  const isHomed = useIsHomed()
  const isJobRunning = useIsJobRunning()
  const workflowState = useWorkflowState()
  const machinePosition = useMachinePosition()
  const workPosition = useWorkPosition()
  const spindleState = useSpindleState()
  const spindleSpeed = useSpindleSpeed()
  const feedrate = useFeedrate()
  const rxBufferSize = useRxBufferSize()
  const currentTool = useCurrentTool()
  const plannerQueue = usePlannerQueue()

  // Get pin state and accessory state from backend status
  const pinState = machineState.backendStatus?.controllerState?.pinState || ''
  const accessoryState = machineState.backendStatus?.controllerState?.accessoryState || ''

  // Pin state indicators (XYZPDHRS)
  const pinLabels: Record<string, string> = {
    X: 'X-Limit',
    Y: 'Y-Limit',
    Z: 'Z-Limit',
    P: 'Probe',
    D: 'Door',
    H: 'Hold',
    R: 'Soft-Reset',
    S: 'Cycle-Start',
  }

  // Accessory state designators (SCFM)
  const accessoryLabels: Record<string, string> = {
    S: 'Spindle CW',
    C: 'Spindle CCW',
    F: 'Flood Coolant',
    M: 'Mist Coolant',
  }

  const handleLogMachineStatus = useCallback(() => {
    // Get the full machine state from Redux
    const fullMachineStatus = {
      // Connection state (computed from backendStatus)
      isConnected: isConnectedComputed,
      connectedPort: connectedPortComputed,
      isConnecting: machineState.isConnecting,
      
      // Machine status
      machineStatus: machineState.machineStatus,
      isHomed,
      isJobRunning,
      workflowState,
      homingInProgress: machineState.backendStatus?.homingInProgress ?? false,
      
      // Positions (computed from backendStatus)
      machinePosition,
      workPosition,
      
      // Spindle (computed from backendStatus)
      spindleState,
      spindleSpeed,
      
      // Job state (computed from backendStatus)
      feedrate,
      rxBufferSize,
      currentTool,
      plannerQueue,
      
      // Full backend status (single source of truth)
      backendStatus: machineState.backendStatus,
      
      // UI state
      isFlashing: machineState.isFlashing,
      maxSpindleSpeed: machineState.maxSpindleSpeed,
    }
    
    console.log('=== Machine Status (Debug) ===')
    console.log(JSON.stringify(fullMachineStatus, null, 2))
    console.log('=== End Machine Status ===')
  }, [
    machineState,
    isConnectedComputed,
    connectedPortComputed,
    isHomed,
    isJobRunning,
    workflowState,
    machinePosition,
    workPosition,
    spindleState,
    spindleSpeed,
    feedrate,
    rxBufferSize,
    currentTool,
    plannerQueue,
  ])

  return (
    <div className="p-3">
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Bug className="w-4 h-4" />
            Debug Tools
          </h3>
          <p className="text-xs text-muted-foreground">
            Development tools for debugging machine state and behavior.
          </p>
        </div>

        <div className="space-y-2">
          <Button
            onClick={handleLogMachineStatus}
            variant="outline"
            className="w-full"
            size="sm"
          >
            Log Machine Status
          </Button>
          <p className="text-xs text-muted-foreground">
            Outputs the current machine status object to the browser console in JSON format.
          </p>
        </div>

        {/* Pin State Indicators */}
        <div className="space-y-2 pt-2 border-t">
          <h4 className="text-xs font-semibold">Pin State (XYZPDHRS)</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(pinLabels).map(([pin, label]) => {
              const isActive = pinState.includes(pin)
              return (
                <div
                  key={pin}
                  className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
                    isActive
                      ? 'bg-primary/20 text-primary font-medium'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <span className="font-mono">{pin}</span>
                  <span className="text-[10px]">{label}</span>
                </div>
              )
            })}
          </div>
          {pinState ? (
            <p className="text-xs text-muted-foreground font-mono">
              Active: {pinState.split('').join(', ')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No pins active</p>
          )}
        </div>

        {/* Accessory State Designators */}
        <div className="space-y-2 pt-2 border-t">
          <h4 className="text-xs font-semibold">Accessories (A:SCFM)</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(accessoryLabels).map(([acc, label]) => {
              const isActive = accessoryState.includes(acc)
              return (
                <div
                  key={acc}
                  className={`flex items-center justify-between px-2 py-1 rounded text-xs ${
                    isActive
                      ? 'bg-primary/20 text-primary font-medium'
                      : 'bg-muted/50 text-muted-foreground'
                  }`}
                >
                  <span className="font-mono">{acc}</span>
                  <span className="text-[10px]">{label}</span>
                </div>
              )
            })}
          </div>
          {accessoryState ? (
            <p className="text-xs text-muted-foreground font-mono">
              Active: {accessoryState.split('').join(', ')}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">No accessories active</p>
          )}
        </div>
      </div>
    </div>
  )
}
