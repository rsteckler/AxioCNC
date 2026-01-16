import { useState, useEffect, useCallback } from 'react'
import { RotateCw, RotateCcw, Circle } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { MachineActionButton } from '@/components/MachineActionButton'
import { MachineActionWrapper } from '@/components/MachineActionWrapper'
import { ActionRequirements } from '@/utils/machineState'
import { useGcodeCommand } from '@/hooks'
import type { PanelProps } from '../types'

export function SpindlePanel({ 
  isConnected, 
  connectedPort, 
  machineStatus, 
  onFlashStatus, 
  isJobRunning = false, 
  spindleState = 'M5', 
  spindleSpeed = 0 
}: PanelProps) {
  const speeds = [0, 500, 1000, 1500, 2000, 2500, 3000]
  
  // G-code command hook
  const { sendGcode } = useGcodeCommand(connectedPort)
  
  // Derive state from backend
  const isOn = spindleState === 'M3' || spindleState === 'M4'
  const backendDirection = spindleState === 'M4' ? 'ccw' : 'cw'
  
  // Local state for direction (can be changed when spindle is off)
  const [localDirection, setLocalDirection] = useState<'cw' | 'ccw'>('cw')
  
  // Use backend direction when spindle is on, local direction when off
  const direction = isOn ? backendDirection : localDirection
  
  // Sync local direction with backend when spindle turns off
  useEffect(() => {
    if (!isOn) {
      setLocalDirection(backendDirection)
    }
  }, [isOn, backendDirection])
  
  // Find closest speed index from backend speed, or default to 1000 RPM
  const getSpeedIndex = (speed: number | undefined): number => {
    if (speed === undefined) return 2 // Default to 1000 RPM
    // Find closest speed in speeds array
    let closestIndex = 2
    let minDiff = Math.abs(speed - speeds[2])
    speeds.forEach((s, i) => {
      const diff = Math.abs(speed - s)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = i
      }
    })
    return closestIndex
  }
  
  const [speedIndex, setSpeedIndex] = useState(() => getSpeedIndex(spindleSpeed))
  
  // Update speed index when backend speed changes (only if spindle is off)
  useEffect(() => {
    if (!isOn && spindleSpeed !== undefined) {
      setSpeedIndex(getSpeedIndex(spindleSpeed))
    }
  }, [spindleSpeed, isOn])
  
  const speed = speeds[speedIndex]
  
  // Check if controls should be disabled
  // Spindle stop should be allowed during hold, but other controls should be disabled
  const isDisabled = !isConnected || machineStatus === 'alarm' || machineStatus === 'not_connected' || 
    (isJobRunning && machineStatus !== 'hold') // Allow during hold, disable during other running states
  const canControl = !isDisabled
  
  // Handle start/stop spindle
  const handleToggleSpindle = useCallback(() => {
    if (isOn) {
      // Stop spindle
      sendGcode('M5')
    } else {
      // Start spindle with current speed and direction
      const command = direction === 'cw' ? `M3 S${speed}` : `M4 S${speed}`
      sendGcode(command)
    }
  }, [isOn, direction, speed, sendGcode])
  
  // Handle direction change (only when stopped)
  const handleDirectionChange = useCallback((newDirection: 'cw' | 'ccw') => {
    if (isOn) return // Can't change direction while running
    
    // Update local state - will be applied when starting
    setLocalDirection(newDirection)
  }, [isOn])
  
  // Handle speed change (only when stopped)
  const handleSpeedChange = useCallback((newSpeedIndex: number) => {
    if (isOn) return // Can't change speed while running
    
    setSpeedIndex(newSpeedIndex)
    // Speed will be applied when starting spindle
  }, [isOn])
  
  // Flash status if action attempted while disabled (but not if disabled due to spindle running)
  const handleDisabledAction = useCallback(() => {
    if (!canControl && !isOn) {
      // Only flash if disabled for reasons other than spindle running
      onFlashStatus()
    }
  }, [canControl, isOn, onFlashStatus])

  // Don't flash when disabled due to spindle running
  const onFlashStatusForSpindleControls = isOn ? () => {} : onFlashStatus

  return (
    <div className="p-3 space-y-3">
      {/* Notice when spindle is running */}
      {isOn && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2 text-xs text-blue-700 dark:text-blue-400">
          Direction and speed cannot be changed while the spindle is running.
        </div>
      )}
      
      {/* Direction toggle */}
      <div className="space-y-1">
        <div className="flex gap-2 w-full">
          <div className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground">Most common</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground">Not common</span>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatusForSpindleControls}
            onAction={() => handleDirectionChange('cw')}
            requirements={{
              requiresConnected: true,
              requiresPort: true,
              disallowAlarm: true,
              disallowRunning: false, // Allow direction change during jobs (when spindle is off)
              disallowNotConnected: true,
            }}
            customDisabled={isJobRunning || isOn} // Disable when job running or spindle is on
            variant={direction === 'cw' ? 'default' : 'outline'}
            className="flex-1"
          >
            <RotateCw className="w-4 h-4 mr-1" />
            CW
          </MachineActionButton>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatusForSpindleControls}
            onAction={() => handleDirectionChange('ccw')}
            requirements={{
              requiresConnected: true,
              requiresPort: true,
              disallowAlarm: true,
              disallowRunning: false, // Allow direction change during jobs (when spindle is off)
              disallowNotConnected: true,
            }}
            customDisabled={isJobRunning || isOn} // Disable when job running or spindle is on
            variant={direction === 'ccw' ? 'default' : 'outline'}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            CCW
          </MachineActionButton>
        </div>
      </div>
      
      {/* Speed control */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>Speed (RPM)</span>
          <span className="font-mono font-medium">{speed} RPM</span>
        </div>
        <MachineActionWrapper
          isDisabled={isDisabled || isOn}
          onFlashStatus={onFlashStatusForSpindleControls}
        >
          <Slider 
            value={[speedIndex]} 
            onValueChange={(v) => {
              if (isDisabled || isOn) {
                handleDisabledAction()
                return
              }
              handleSpeedChange(v[0])
            }}
            max={speeds.length - 1} 
            step={1}
            disabled={isDisabled || isOn} // Disable when spindle is on OR controls are disabled
          />
        </MachineActionWrapper>
        <div className="flex justify-between text-[10px] text-muted-foreground px-1">
          <span>0</span>
          <span>500</span>
          <span>1k</span>
          <span>1.5k</span>
          <span>2k</span>
          <span>2.5k</span>
          <span>3k</span>
        </div>
      </div>
      
      {/* On/Off toggle */}
        <MachineActionButton
        isConnected={isConnected}
        connectedPort={connectedPort}
        machineStatus={machineStatus}
        onFlashStatus={onFlashStatus}
        onAction={handleToggleSpindle}
        requirements={isOn ? ActionRequirements.allowHold : {
          requiresConnected: true,
          requiresPort: true,
          disallowAlarm: true,
          disallowRunning: false, // Allow spindle start during jobs (but not during hold)
          disallowHold: true, // Don't allow starting spindle during hold
          disallowNotConnected: true,
        }}
        customDisabled={!isOn && (isJobRunning && machineStatus !== 'hold')} // Allow stop during hold, disable start during other running states
        className={`w-full h-12 ${isOn ? 'bg-green-600 hover:bg-green-700' : ''}`}
        variant={isOn ? 'default' : 'outline'}
      >
        <Circle className={`w-4 h-4 mr-2 ${isOn ? 'fill-white' : ''}`} />
        {isOn ? 'Stop Spindle' : 'Start Spindle'}
      </MachineActionButton>
    </div>
  )
}
