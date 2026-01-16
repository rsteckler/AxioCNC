import React, { useState, useCallback, useRef, useEffect } from 'react'
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { MachineActionButton } from '@/components/MachineActionButton'
import { MachineActionWrapper } from '@/components/MachineActionWrapper'
import { ActionRequirements, canPerformAction } from '@/utils/machineState'
import { DiagonalArrowUpLeft, DiagonalArrowUpRight, DiagonalArrowDownLeft, DiagonalArrowDownRight } from '@/components/icons/DiagonalArrows'
import { useGcodeCommand, useAnalogJog, sendJogControlInput } from '@/hooks'
import { buildGoToZeroCommand } from '@/utils/gcode'
import { normalizeToCircle } from '@/utils/analogNormalize'
import { useGetExtensionsQuery, useGetSettingsQuery } from '@/services/api'
import type { PanelProps } from '../types'

export function JogPanel({ isConnected, connectedPort, machineStatus, onFlashStatus }: PanelProps) {
  // Load mode from localStorage or use default
  const [mode, setMode] = useState<'steps' | 'analog'>(() => {
    const stored = localStorage.getItem('axiocnc-setup-jog-mode')
    if (stored === 'steps' || stored === 'analog') {
      return stored
    }
    return 'steps'
  })
  const [distanceIndex, setDistanceIndex] = useState(3) // Default to 10mm
  const distances = [0.01, 0.1, 1, 10, 100, 500, 'Continuous'] as const
  const currentDistance = distances[distanceIndex]
  
  // Check debug mode from extensions
  const { data: advancedConfig } = useGetExtensionsQuery({ key: 'advanced' })
  const debugMode = (advancedConfig && typeof advancedConfig === 'object' && 'debugMode' in advancedConfig)
    ? (advancedConfig as { debugMode?: boolean }).debugMode ?? false
    : false
  
  // Get settings for joystick config
  const { data: settings } = useGetSettingsQuery()
  
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
  // joystickPos: visual position (clamped to circle, follows mouse cursor)
  // jogValues: normalized values for jogging (directionally normalized)
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 })
  const [jogValues, setJogValues] = useState({ x: 0, y: 0 })
  const [zLevel, setZLevel] = useState(50) // 0-100, 50 = center/stopped
  const [isDraggingXY, setIsDraggingXY] = useState(false)
  const [isDraggingZ, setIsDraggingZ] = useState(false)
  const xyJoystickRef = useRef<HTMLDivElement>(null)
  const zLeverRef = useRef<HTMLDivElement>(null)
  
  // Poll analog controls when in analog mode
  // Use jogValues (normalized) for actual jogging
  const analogValues = useAnalogJog(
    {
      x: jogValues.x,
      y: jogValues.y,
      z: zLevel,
    },
    mode === 'analog', // enabled when in analog mode
    0.05, // 5% deadzone
    60 // 60fps polling rate
  )
  
  // Send jog control inputs to server when in analog mode and joystick is enabled
  useEffect(() => {
    if (mode === 'analog' && settings?.joystick?.enabled) {
      sendJogControlInput(analogValues.x, analogValues.y, analogValues.z)
    }
  }, [mode, settings?.joystick?.enabled, analogValues.x, analogValues.y, analogValues.z])
  
  // Calculate joystick values from mouse position
  const updateJoystickFromMouse = useCallback((clientX: number, clientY: number) => {
    const element = xyJoystickRef.current
    if (!element) return
    
    const rect = element.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const xRaw = ((clientX - rect.left) - centerX) / centerX
    const yRaw = ((clientY - rect.top) - centerY) / centerY
    
    // Calculate magnitude
    const mag = Math.sqrt(xRaw * xRaw + yRaw * yRaw)
    
    // Clamp visual position to circle (for drag target)
    if (mag > 1) {
      setJoystickPos({ x: xRaw / mag, y: yRaw / mag })
    } else {
      setJoystickPos({ x: xRaw, y: yRaw })
    }
    
    // Normalize for circular input (for jog values)
    const normalized = normalizeToCircle(xRaw, yRaw)
    setJogValues(normalized)
  }, [])
  
  // Handle XY joystick mouse down
  const handleXYMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
    if (!canJog) {
      e.preventDefault()
      e.stopPropagation()
      onFlashStatus()
      return
    }
    setIsDraggingXY(true)
    updateJoystickFromMouse(e.clientX, e.clientY)
  }, [isConnected, connectedPort, machineStatus, onFlashStatus, updateJoystickFromMouse])
  
  // Document-level mouse move and up handlers for XY joystick
  useEffect(() => {
    if (!isDraggingXY) return
    
    const handleMouseMove = (e: MouseEvent) => {
      updateJoystickFromMouse(e.clientX, e.clientY)
    }
    
    const handleMouseUp = () => {
      setIsDraggingXY(false)
      setJoystickPos({ x: 0, y: 0 })
      setJogValues({ x: 0, y: 0 })
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingXY, updateJoystickFromMouse])
  
  // Calculate Z level from mouse position
  const updateZFromMouse = useCallback((clientY: number) => {
    const element = zLeverRef.current
    if (!element) return
    
    const rect = element.getBoundingClientRect()
    const y = (clientY - rect.top) / rect.height
    // Clamp to 0-100, inverted (top = 100, bottom = 0)
    setZLevel(Math.max(0, Math.min(100, (1 - y) * 100)))
  }, [])
  
  // Handle Z lever mouse down
  const handleZMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
    if (!canJog) {
      e.preventDefault()
      e.stopPropagation()
      onFlashStatus()
      return
    }
    setIsDraggingZ(true)
    updateZFromMouse(e.clientY)
  }, [isConnected, connectedPort, machineStatus, onFlashStatus, updateZFromMouse])
  
  // Document-level mouse move and up handlers for Z lever
  useEffect(() => {
    if (!isDraggingZ) return
    
    const handleMouseMove = (e: MouseEvent) => {
      updateZFromMouse(e.clientY)
    }
    
    const handleMouseUp = () => {
      setIsDraggingZ(false)
      setZLevel(50) // Return to center
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingZ, updateZFromMouse])

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <Button 
          variant={mode === 'steps' ? 'default' : 'ghost'} 
          size="sm" 
          className="flex-1 h-7 text-xs"
          onClick={() => {
            setMode('steps')
            localStorage.setItem('axiocnc-setup-jog-mode', 'steps')
          }}
        >
          Steps
        </Button>
        <Button 
          variant={mode === 'analog' ? 'default' : 'ghost'} 
          size="sm" 
          className="flex-1 h-7 text-xs"
          onClick={() => {
            setMode('analog')
            localStorage.setItem('axiocnc-setup-jog-mode', 'analog')
          }}
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
              ref={xyJoystickRef}
              className="relative w-36 h-36 rounded-full bg-muted border-2 border-border cursor-crosshair select-none"
              onMouseDown={handleXYMouseDown}
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
                ref={zLeverRef}
                className="relative h-32 w-10 rounded-full bg-muted border-2 border-border cursor-ns-resize select-none"
                onMouseDown={handleZMouseDown}
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
          
          {/* Debug panel - shows normalized XYZ values when debug mode is enabled */}
          {debugMode && (
            <div className="mt-2 p-2 bg-muted/50 rounded border border-border/50">
              <div className="text-[10px] text-muted-foreground mb-1 font-medium">Debug: Normalized Values</div>
              <div className="flex gap-4 text-xs font-mono">
                <div className="flex items-center gap-1">
                  <span className="text-red-500 font-bold">X:</span>
                  <span className="text-foreground">{analogValues.x.toFixed(3)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-green-500 font-bold">Y:</span>
                  <span className="text-foreground">{analogValues.y.toFixed(3)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-blue-500 font-bold">Z:</span>
                  <span className="text-foreground">{analogValues.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
