import React, { useState, useCallback } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { MachineActionButton } from '@/components/MachineActionButton'
import { MachineActionWrapper } from '@/components/MachineActionWrapper'
import { ActionRequirements, canPerformAction } from '@/utils/machineState'
import { DiagonalArrowUpLeft, DiagonalArrowUpRight, DiagonalArrowDownLeft, DiagonalArrowDownRight } from '@/components/icons/DiagonalArrows'
import { useGcodeCommand } from '@/hooks'
import { buildGoToZeroCommand } from '@/utils/gcode'
import type { PanelProps } from '../types'

export function JogPanel({ isConnected, connectedPort, machineStatus, onFlashStatus }: PanelProps) {
  const [mode, setMode] = useState<'steps' | 'analog'>('steps')
  const [distanceIndex, setDistanceIndex] = useState(3) // Default to 10mm
  const distances = [0.01, 0.1, 1, 10, 100, 500, 'Continuous'] as const
  const currentDistance = distances[distanceIndex]
  
  // G-code command hook
  const { sendGcode } = useGcodeCommand(connectedPort)
  
  // Handle jog command
  const handleJog = useCallback((x: number, y: number, z: number) => {
    // For "Continuous", we'll use a very large distance (999999)
    // In practice, continuous jogging would need different handling
    const distance = currentDistance === 'Continuous' ? 999999 : currentDistance
    
    // Build the movement command
    const parts: string[] = []
    if (x !== 0) parts.push(`X${x * distance}`)
    if (y !== 0) parts.push(`Y${y * distance}`)
    if (z !== 0) parts.push(`Z${z * distance}`)
    
    if (parts.length === 0) return
    
    const command = parts.join(' ')
    
    // Send jog commands: G91 (relative), G0 (rapid move), G90 (absolute)
    sendGcode('G91') // relative mode
    sendGcode(`G0 ${command}`) // rapid move
    sendGcode('G90') // absolute mode
  }, [currentDistance, sendGcode])
  
  // Handle go to zero for XY axes
  const handleGoToZeroXY = useCallback(() => {
    const gcode = buildGoToZeroCommand('XY')
    if (gcode) {
      sendGcode(gcode)
    }
  }, [sendGcode])
  
  // Handle go to zero for Z axis
  const handleGoToZeroZ = useCallback(() => {
    const gcode = buildGoToZeroCommand('Z')
    if (gcode) {
      sendGcode(gcode)
    }
  }, [sendGcode])
  
  // Analog joystick state
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 })
  const [zLevel, setZLevel] = useState(50) // 0-100, 50 = center/stopped
  
  // Handle joystick drag
  const handleJoystickMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const x = ((e.clientX - rect.left) - centerX) / centerX
    const y = ((e.clientY - rect.top) - centerY) / centerY
    // Clamp to circle
    const dist = Math.sqrt(x * x + y * y)
    if (dist > 1) {
      setJoystickPos({ x: x / dist, y: y / dist })
    } else {
      setJoystickPos({ x, y })
    }
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <Button 
          variant={mode === 'steps' ? 'default' : 'ghost'} 
          size="sm" 
          className="flex-1 h-7 text-xs"
          onClick={() => setMode('steps')}
        >
          Steps
        </Button>
        <Button 
          variant={mode === 'analog' ? 'default' : 'ghost'} 
          size="sm" 
          className="flex-1 h-7 text-xs"
          onClick={() => setMode('analog')}
        >
          Analog
        </Button>
      </div>
      
      {mode === 'steps' ? (
        <>
          {/* XY and Z Controls side by side */}
          <div className="flex items-center justify-center gap-24">
            {/* XY Pad - 3x3 with diagonals */}
            <div className="grid grid-cols-3 gap-1" style={{ width: '140px' }}>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(-1, 1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <DiagonalArrowUpLeft />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(0, 1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronUp className="w-5 h-5" />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(1, 1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <DiagonalArrowUpRight />
              </MachineActionButton>
              
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(-1, 0, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={handleGoToZeroXY}
                requirements={ActionRequirements.jog}
                variant="outline"
                className="aspect-square p-0 text-xs font-bold"
                title="Go to XY zero"
              >
                XY 0
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(1, 0, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronRight className="w-5 h-5" />
              </MachineActionButton>
              
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(-1, -1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <DiagonalArrowDownLeft />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(0, -1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronDown className="w-5 h-5" />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(1, -1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <DiagonalArrowDownRight />
              </MachineActionButton>
            </div>
            
            {/* Z Controls - vertically stacked */}
            <div className="flex flex-col gap-1" style={{ width: '56px' }}>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(0, 0, 1)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronUp className="w-5 h-5 text-blue-500" />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={handleGoToZeroZ}
                requirements={ActionRequirements.jog}
                variant="outline"
                className="aspect-square p-0 text-xs font-bold text-blue-500"
                title="Go to Z zero"
              >
                Z 0
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(0, 0, -1)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronDown className="w-5 h-5 text-blue-500" />
              </MachineActionButton>
            </div>
          </div>
          
          {/* Distance selector */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Distance</span>
              <span className="font-mono font-medium">
                {currentDistance === 'Continuous' ? 'Continuous' : `${currentDistance} mm`}
              </span>
            </div>
            <MachineActionWrapper
              isDisabled={!canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)}
              onFlashStatus={onFlashStatus}
            >
              <Slider 
                value={[distanceIndex]} 
                onValueChange={(v) => setDistanceIndex(v[0])}
                max={distances.length - 1} 
                step={1}
                disabled={!canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)}
              />
            </MachineActionWrapper>
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>0.01</span>
              <span>0.1</span>
              <span>1</span>
              <span>10</span>
              <span>100</span>
              <span>500</span>
              <span>∞</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Analog mode */}
          <div className="flex items-center justify-center gap-12">
            {/* XY Joystick */}
            <div 
              className="relative w-36 h-36 rounded-full bg-muted border-2 border-border cursor-crosshair select-none"
              onMouseMove={(e) => {
                const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
                if (!canJog) {
                  return // Don't flash on hover, just prevent movement
                }
                if (e.buttons === 1) {
                  handleJoystickMove(e)
                }
              }}
              onMouseDown={(e) => {
                const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
                if (!canJog) {
                  e.preventDefault()
                  e.stopPropagation()
                  onFlashStatus()
                  return
                }
                handleJoystickMove(e)
              }}
              onMouseUp={() => setJoystickPos({ x: 0, y: 0 })}
              onMouseLeave={() => setJoystickPos({ x: 0, y: 0 })}
            >
              {/* Crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-full h-px bg-border" />
                <div className="absolute h-full w-px bg-border" />
              </div>
              {/* Axis labels */}
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-green-500 font-bold">Y+</span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-green-500 font-bold">Y-</span>
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-red-500 font-bold">X-</span>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-red-500 font-bold">X+</span>
              {/* Joystick thumb */}
              <div 
                className="absolute w-8 h-8 rounded-full bg-primary shadow-lg border-2 border-primary-foreground transition-transform"
                style={{
                  left: `calc(50% + ${joystickPos.x * 50}% - 16px)`,
                  top: `calc(50% + ${joystickPos.y * 50}% - 16px)`,
                }}
              />
            </div>
            
            {/* Z Lever */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-blue-500 font-bold">Z+</span>
              <div 
                className="relative h-32 w-10 rounded-full bg-muted border-2 border-border cursor-ns-resize select-none"
                onMouseMove={(e) => {
                  const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
                  if (!canJog) {
                    return // Don't flash on hover, just prevent movement
                  }
                  if (e.buttons === 1) {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const y = (e.clientY - rect.top) / rect.height
                    setZLevel(Math.max(0, Math.min(100, (1 - y) * 100)))
                  }
                }}
                onMouseDown={(e) => {
                  const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
                  if (!canJog) {
                    e.preventDefault()
                    e.stopPropagation()
                    onFlashStatus()
                    return
                  }
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = (e.clientY - rect.top) / rect.height
                  setZLevel(Math.max(0, Math.min(100, (1 - y) * 100)))
                }}
                onMouseUp={() => setZLevel(50)}
                onMouseLeave={() => setZLevel(50)}
              >
                {/* Center line */}
                <div className="absolute top-1/2 left-2 right-2 h-px bg-border" />
                {/* Visual thumb */}
                <div 
                  className="absolute left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-blue-500 shadow-lg border-2 border-white pointer-events-none"
                  style={{ top: `calc(${100 - zLevel}% - 14px)` }}
                />
              </div>
              <span className="text-[10px] text-blue-500 font-bold">Z-</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
