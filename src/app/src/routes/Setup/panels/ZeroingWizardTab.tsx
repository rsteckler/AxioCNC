import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Target, AlertCircle, HelpCircle, Check, X, RotateCcw, Navigation, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { socketService } from '@/services/socket'
import { useSetExtensionsMutation } from '@/services/api'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'
import { useGcodeCommand, useBitsetterReference } from '@/hooks'
import { buildSetZeroCommand, buildSetZeroWithOffsetCommand } from '@/utils/gcode'
import { parseConsoleMessage } from '../utils/consoleParser'

// Helper function to get axes label
function getAxesLabel(axes: string): string {
  return axes.toUpperCase()
}

interface ZeroingWizardTabProps {
  method: ZeroingMethod
  onClose: () => void
  isConnected: boolean
  connectedPort: string | null
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  currentWCS?: string
}

export function ZeroingWizardTab({ 
  method, 
  onClose,
  isConnected, 
  connectedPort,
  machinePosition,
  workPosition,
  probeContact = false,
  currentWCS = 'G54'
}: ZeroingWizardTabProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [probeStatus, setProbeStatus] = useState<'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'>('idle')
  const [probeError, setProbeError] = useState<string | null>(null)
  
  // Extensions API for bitsetter toolReference storage
  const [setExtensions] = useSetExtensionsMutation()
  
  // Hooks for G-code commands and bitsetter reference
  const { sendGcode } = useGcodeCommand(connectedPort)
  const { clearBitsetterReference } = useBitsetterReference()
  
  // Reset to step 1 when method changes
  useEffect(() => {
    setCurrentStep(1)
  }, [method.id])
  
  // Get total steps based on method type
  const getTotalSteps = () => {
    if (method.type === 'manual') {
      return 3
    }
    if (method.type === 'touchplate') {
      // If requireCheck is false, skip the verification step (3 steps instead of 4)
      return method.requireCheck === false ? 3 : 4
    }
    if (method.type === 'bitsetter') {
      // If requireCheck is false, skip the verification step (3 steps instead of 4)
      return method.requireCheck === false ? 3 : 4
    }
    if (method.type === 'bitzero') {
      // If requireCheck is false, skip the verification step (4 steps instead of 5)
      return method.requireCheck === false ? 4 : 5
    }
    if (method.type === 'custom') {
      // Custom G-code: step 1 = run G-code, step 2 = complete
      return 2
    }
    // Other methods will be implemented later
    return 1
  }
  
  const totalSteps = getTotalSteps()
  const isLastStep = currentStep === totalSteps
  const isFirstStep = currentStep === 1
  
  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1)
    } else {
      // On last step, complete the wizard
      handleComplete()
    }
  }
  
  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1)
    }
  }
  
  const handleSetZero = useCallback(async (axes: 'x' | 'y' | 'z' | 'xy' | 'xyz') => {
    // Clear bitsetter reference if Z zero is being set (bitsetter reference becomes invalid)
    if (axes.includes('z')) {
      await clearBitsetterReference(currentWCS)
    }
    
    // Build G10 command to set zero using utility function
    const gcode = buildSetZeroCommand(currentWCS, axes)
    if (gcode) {
      sendGcode(gcode)
    }
  }, [currentWCS, clearBitsetterReference, sendGcode])
  
  const handleTouchPlateProbe = useCallback(async () => {
    if (!connectedPort || method.type !== 'touchplate') {
      return
    }
    
    // Clear bitsetter reference when setting Z zero via touchplate (bitsetter reference becomes invalid)
    await clearBitsetterReference(currentWCS)
    
    // Build probe sequence:
    // 1. Switch to relative mode
    // 2. Probe down (G38.2 for Grbl)
    // 3. Switch to absolute mode
    // 4. Set zero with plate thickness offset (G10 L20 Px Z[plateThickness])
    // 5. Retract
    const setZeroCommand = buildSetZeroWithOffsetCommand(currentWCS, 'Z', method.plateThickness)
    const commands = [
      'G21', // Metric units
      'M5', // Stop spindle
      'G90', // Absolute mode
      'G91', // Relative mode (for probe)
      `G38.2 Z-${method.probeDistance} F${method.probeFeedrate}`, // Probe down
      'G90', // Absolute mode
      setZeroCommand, // Set zero with plate thickness
      'G91', // Relative mode
      'G0 Z10', // Retract 10mm
      'G90', // Absolute mode
    ]
    
    // Send commands sequentially
    commands.forEach((cmd, index) => {
      setTimeout(() => {
        sendGcode(cmd)
      }, index * 100) // Small delay between commands
    })
  }, [connectedPort, method, currentWCS, clearBitsetterReference, sendGcode])
  
  const handleBitsetterNavigate = useCallback(() => {
    if (!connectedPort || method.type !== 'bitsetter') {
      return
    }
    
    // Navigate to bitsetter position safely using machine coordinates (G53)
    // Sequence: Raise Z to safe height -> Move XY -> Lower Z to bitsetter position
    const safeHeight = method.position.z + method.retractHeight
    const commands = [
      'G90', // Absolute mode (ensure we're in absolute mode)
      `G53 G0 Z${safeHeight}`, // Raise Z to safe height above bitsetter (machine coordinates)
      `G53 G0 X${method.position.x} Y${method.position.y}`, // Move to bitsetter XY position (machine coordinates)
      `G53 G0 Z${method.position.z}`, // Lower to bitsetter Z position (machine coordinates, tool should be above sensor)
    ]
    
    // Send commands sequentially with delays to allow each command to complete
    commands.forEach((cmd, index) => {
      setTimeout(() => {
        sendGcode(cmd)
      }, index * 300) // Longer delay for navigation commands to allow movement to complete
    })
  }, [connectedPort, method, sendGcode])
  
  const handleBitsetterProbe = useCallback(async () => {
    if (!connectedPort || method.type !== 'bitsetter') {
      return
    }
    
    // Reset capture flag for new probe
    capturingPositionRef.current = false
    
    setProbeStatus('probing')
    setProbeError(null)
    
    // Multi-stage probe sequence based on user's example script:
    // 1. Fast probe down
    // 2. Small retract
    // 3. Fine probe down with pauses
    // 4. Probe up to verify contact loss
    // 5. Fine probe down again
    // 6. Probe up to verify contact loss again
    // 7. Switch to absolute mode
    // 8. Capture position (TOOL_REFERENCE)
    // 9. Retract to safe height
    
    const rapidFeedrate = method.probeFeedrate || 200 // Fast feedrate for initial probe
    const fineFeedrate = 40 // Fine feedrate for dialing in
    
    const commands = [
      'G21', // Metric units
      'M5', // Stop spindle
      'G90', // Absolute positioning
      'G91', // Switch to relative mode for probing
      `G38.2 Z-${method.probeDistance} F${rapidFeedrate}`, // Fast probe down
      'G0 Z2', // Small retract
      `G38.2 Z-5 F${fineFeedrate}`, // Fine probe down
      'G4 P0.25', // Pause 0.25 seconds
      'G38.4 Z10 F20', // Probe up to verify contact loss
      'G4 P0.25', // Pause 0.25 seconds
      'G38.2 Z-2 F10', // Very fine probe down
      'G4 P0.25', // Pause 0.25 seconds
      'G38.4 Z10 F5', // Ultra fine probe up to verify contact loss
      'G4 P0.25', // Pause 0.25 seconds
      'G90', // Switch back to absolute mode (position is now stable)
    ]
    
    // Store the position before probing to detect when it stabilizes after probe
    const positionBeforeProbe = { ...workPosition }
    previousWorkPositionRef.current = positionBeforeProbe
    
    // Send probe sequence commands sequentially
    let commandIndex = 0
    const sendNextCommand = () => {
      if (commandIndex < commands.length) {
        sendGcode(commands[commandIndex])
        commandIndex++
        // Vary delays: longer for movements, shorter for pauses
        // Probe commands need more time (500ms for G38.2/G38.4, 300ms for G4)
        const cmd = commands[commandIndex - 1]
        const delay = cmd.startsWith('G4') ? 350 : (cmd.startsWith('G38') ? 800 : 300)
        setTimeout(sendNextCommand, delay)
      } else {
        // After probe sequence completes, wait for controller state to update
        // Then capture position once it stabilizes
        setTimeout(() => {
          setProbeStatus('capturing')
          // Position will be captured via useEffect watching workPosition
        }, 1000) // Longer delay to ensure controller has processed all commands
      }
    }
    
    sendNextCommand()
  }, [connectedPort, method, workPosition, sendGcode])
  
  const handleBitZeroProbe = useCallback(async () => {
    if (!connectedPort || method.type !== 'bitzero') {
      return
    }
    
    // Clear bitsetter reference when setting Z zero via bitzero (bitsetter reference becomes invalid)
    await clearBitsetterReference(currentWCS)
    
    setProbeStatus('probing')
    setProbeError(null)
    
    // BitZero probe sequence based on user's macro:
    // 1. Probe X right, retract, fine probe, capture X_RIGHT
    // 2. Probe X left, retract, fine probe, capture X_LEFT, calculate center, set X0
    // 3. Probe Y top, retract, fine probe, capture Y_TOP
    // 4. Probe Y bottom, retract, fine probe, capture Y_BTM, calculate center, set Y0
    // 5. Move to Z probe location (above plate)
    // 6. Probe Z, retract, fine probe, set Z0 with thickness offset
    // 7. Final retract and move to origin
    
    const bitzeroMethod = method as Extract<ZeroingMethod, { type: 'bitzero' }>
    
    // Use settings or defaults from macro
    const zProbeThickness = bitzeroMethod.probeThickness || 12.7 // Default 12.7mm (0.5")
    const probeDistance = bitzeroMethod.probeDistance || 25 // Default 25mm
    const probeFeedrateA = bitzeroMethod.probeFeedrate || 150 // Fast feedrate
    const probeFeedrateB = 50 // Slow feedrate for fine probing
    const probeMajorRetract = 2 // Retract distance before probing opposite side
    const zProbe = 15 // Lift out of hole and max Z probe
    const zProbeKeepout = 10 // Distance (X&Y) from edge of hole for Z probe
    const zFinal = 15 // Final height above probe
    
    // Build G10 commands using utilities
    const setXZeroCommand = buildSetZeroCommand(currentWCS, 'x')
    const setYZeroCommand = buildSetZeroCommand(currentWCS, 'y')
    const setZZeroCommand = buildSetZeroWithOffsetCommand(currentWCS, 'Z', zProbeThickness)
    
    const commands = [
      'G91', // Relative positioning
      'G21', // Metric units
      // Probe X right edge
      `G38.2 X${probeDistance} F${probeFeedrateA}`, // Probe toward right until contact
      'G0 X-2', // Retract 2mm
      `G38.2 X5 F${probeFeedrateB}`, // Slow fine probe to find exact right edge
      // At this point we're at X_RIGHT edge (macro: %X_RIGHT = posx)
      `G0 X-${probeMajorRetract}`, // Retract before probing left
      // Probe X left edge  
      `G38.2 X-${probeDistance} F${probeFeedrateA}`, // Probe toward left until contact
      'G0 X2', // Retract 2mm
      `G38.2 X-5 F${probeFeedrateB}`, // Slow fine probe to find exact left edge
      // At this point we're at X_LEFT edge (macro: %X_LEFT = posx)
      // Macro calculates: %X_CHORD = X_RIGHT - X_LEFT, then moves X[X_CHORD/2] to center
      // Without macro variables, we can't calculate X_CHORD exactly. 
      // We'll approximate by moving right from left edge by half the probe distance.
      // This assumes the hole is roughly probeDistance wide, which should be close for most cases.
      // Note: For exact center calculation, the controller would need to support macro variables
      // or we'd need to read work positions from controller state after each probe.
      `G0 X${probeDistance / 2}`, // Move to approximate X center (macro: G0 X[X_CHORD/2])
      'G4 P1', // Dwell 1 second (macro: %wait)
      setXZeroCommand, // Set X0 at current position (hole X center) - macro: G10L20X0
      // Probe Y top edge
      `G38.2 Y${probeDistance} F${probeFeedrateA}`, // Probe toward top until contact
      'G0 Y-2', // Retract 2mm
      `G38.2 Y5 F${probeFeedrateB}`, // Slow fine probe to find exact top edge
      // At this point we're at Y_TOP edge (macro: %Y_TOP = posy)
      `G0 Y-${probeMajorRetract}`, // Retract before probing bottom
      // Probe Y bottom edge
      `G38.2 Y-${probeDistance} F${probeFeedrateA}`, // Probe toward bottom until contact
      'G0 Y2', // Retract 2mm
      `G38.2 Y-5 F${probeFeedrateB}`, // Slow fine probe to find exact bottom edge
      // At this point we're at Y_BTM edge (macro: %Y_BTM = posy)
      // Macro calculates: %Y_CHORD = Y_TOP - Y_BTM, %HOLE_RADIUS = Y_CHORD/2
      // Then moves Y[HOLE_RADIUS] to center
      // Similar to X axis, we'll approximate center by moving up from bottom edge
      // by half the probe distance (assuming hole is roughly probeDistance tall)
      `G0 Y${probeDistance / 2}`, // Move to approximate Y center (macro: G0 Y[HOLE_RADIUS])
      // Note: Same approximation limitation as X axis
      'G4 P1', // Dwell 1 second (macro: %wait)
      setYZeroCommand, // Set Y0 at current position (hole Y center) - macro: G10L20Y0
      // Move to Z probe location (above plate, away from hole)
      // After setting Y0, we're at hole center (X0, Y0). Move relative to get above plate.
      // In macro: HOLE_RADIUS = Y_CHORD/2, we approximate with probeDistance/2
      `G0 Z${zProbe}`, // Lift out of hole (macro: G0 Z[Z_PROBE])
      `X${probeDistance / 2 + zProbeKeepout} Y${probeDistance / 2 + zProbeKeepout}`, // Move above plate, relative from center (macro: X[HOLE_RADIUS + Z_PROBE_KEEPOUT] Y[HOLE_RADIUS + Z_PROBE_KEEPOUT])
      // Probe Z
      `G38.2 Z-${zProbe} F${probeFeedrateA}`, // Probe Z down (macro: G38.2 Z-[Z_PROBE] F[PROBE_FEEDRATE_A])
      'G0 Z2', // Retract 2mm
      `G38.2 Z-5 F${probeFeedrateB}`, // Slow fine probe (macro: G38.2 Z-5 F[PROBE_FEEDRATE_B])
      setZZeroCommand, // Set Z0 with plate thickness offset (macro: G10L20Z[Z_PROBE_THICKNESS])
      `G0 Z${zFinal}`, // Raise to final height (macro: G0 Z[Z_FINAL])
      'G90', // Absolute positioning (macro: G90)
      'G0 X0 Y0', // Move to work origin (macro: G0 X0 Y0)
      'G4 P1', // Dwell 1 second (macro: %wait)
    ]
    
    // Send probe sequence commands sequentially
    let commandIndex = 0
    const sendNextCommand = () => {
      if (commandIndex < commands.length) {
        sendGcode(commands[commandIndex])
        commandIndex++
        // Vary delays: longer for probe movements, shorter for positioning
        const cmd = commands[commandIndex - 1]
        const delay = cmd.startsWith('G4') ? 1100 : (cmd.startsWith('G38') ? 1000 : (cmd.startsWith('G10') ? 500 : 400))
        setTimeout(sendNextCommand, delay)
      } else {
        // After probe sequence completes
        setTimeout(() => {
          setProbeStatus('complete')
        }, 1000)
      }
    }
    
    sendNextCommand()
  }, [connectedPort, method, currentWCS, clearBitsetterReference, sendGcode])
  
  // Monitor workPosition after probe to capture TOOL_REFERENCE
  const previousWorkPositionRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const capturingPositionRef = useRef(false)
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    // Only capture position if we're in capturing state and haven't captured yet
    if (probeStatus === 'capturing' && !capturingPositionRef.current) {
      const previousPos = previousWorkPositionRef.current
      
      // Check if position has changed (probe has completed) and stabilized
      // Position should have changed from before probe, then stabilized
      if (previousPos) {
        // Wait for position to stabilize (no change for 500ms)
        if (captureTimeoutRef.current) {
          clearTimeout(captureTimeoutRef.current)
        }
        
        captureTimeoutRef.current = setTimeout(() => {
          // Check again if position is stable
          const currentPos = { ...workPosition }
          if (previousWorkPositionRef.current && Math.abs(currentPos.z - previousWorkPositionRef.current.z) < 0.001) {
            capturingPositionRef.current = true
            setProbeStatus('storing')
            
            // Store TOOL_REFERENCE in Extensions API
            // This is the work Z position at bitsetter contact point
            const toolReference = currentPos.z
            const wcsKey = `bitsetter.toolReference.${currentWCS}`
            
            setExtensions({ 
              key: wcsKey, 
              data: { 
                value: toolReference, 
                wcs: currentWCS, 
                timestamp: new Date().toISOString() 
              } 
            })
              .unwrap()
              .then(() => {
                setProbeStatus('complete')
                // Retract to safe height after storing reference
                if (method.type === 'bitsetter' && connectedPort) {
                  const safeHeight = method.position.z + method.retractHeight
                  sendGcode('G90') // Ensure absolute mode
                  setTimeout(() => {
                    sendGcode(`G53 G0 Z${safeHeight}`) // Retract in machine coordinates
                  }, 200)
                }
              })
              .catch((err) => {
                console.error('Failed to store bitsetter reference:', err)
                setProbeStatus('error')
                setProbeError('Failed to store tool reference. Please try again.')
                capturingPositionRef.current = false
              })
          }
        }, 500) // Wait 500ms for position to stabilize
      }
    }
    
    // Update previous position reference
    previousWorkPositionRef.current = { ...workPosition }
    
    // Cleanup timeout on unmount or status change
    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current)
      }
    }
  }, [workPosition, probeStatus, currentWCS, setExtensions, method, connectedPort, sendGcode])
  
  const handleComplete = async () => {
    // For touchplate, manual, bitzero, and custom (if Z axis), clear bitsetter reference if Z zero is being set
    if (method.type === 'touchplate' || 
        method.type === 'bitzero' || 
        (method.type === 'manual' && method.axes.includes('z')) ||
        (method.type === 'custom' && method.axes.includes('z'))) {
      await clearBitsetterReference(currentWCS)
    }
    
    // For touchplate, the probe already sets zero, so just close
    if (method.type === 'touchplate') {
      onClose()
      return
    }
    
    // For bitsetter, the probe already captured the reference, so just close
    if (method.type === 'bitsetter') {
      onClose()
      return
    }
    
    // For bitzero, the probe already sets XYZ zero, so just close
    if (method.type === 'bitzero') {
      onClose()
      return
    }
    
    // For custom, the G-code already ran, so just close
    if (method.type === 'custom') {
      onClose()
      return
    }
    
    // For manual, set zero for the axes specified by the method
    if (method.type === 'manual') {
      await handleSetZero(method.axes)
      onClose()
      return
    }
    
    onClose()
  }
  
  // Render step content based on method type and current step
  const renderStepContent = () => {
    if (method.type === 'manual') {
      return renderManualStep(currentStep, method.axes)
    }
    if (method.type === 'touchplate') {
      return renderTouchPlateStep(currentStep, method)
    }
    if (method.type === 'bitsetter') {
      return renderBitsetterStep(currentStep, method)
    }
    if (method.type === 'bitzero') {
      return renderBitZeroStep(currentStep, method)
    }
    if (method.type === 'custom') {
      return renderCustomStep(currentStep, method)
    }
    // Other method types will be implemented later
    return <div>Method type {method.type} not yet implemented</div>
  }
  
  const renderManualStep = (step: number, axes: string) => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 1: Position XY</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Use the jog controls to move the tool to the XY location that matches the zero point in your CAM software.
                </p>
                {axes.includes('x') && axes.includes('y') && (
                  <>
                    <p>
                      When the endmill is directly above the desired point, press the zero buttons in the Position panel:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span>Zero button</span>
                        <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </span>
                        <span>next to X</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>Zero button</span>
                        <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </span>
                        <span>next to Y</span>
                      </li>
                    </ul>
                    <p>
                      This sets the current position as the zero point for this job. After you have set zero for X and Y, press Next to continue.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Current Machine Position:</div>
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
                  Tip: You can use the Z controls to lower the bit near the surface for better accuracy when positioning XY. We'll set the Z zero in the next step.
                </p>
              </div>
            )}
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 2: Position Z (Paper Test)</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Lower the Z-axis until the tool just touches the surface. A piece of paper should barely slide in and out with friction.
                </p>
                {axes.includes('z') && (
                  <>
                    <p>
                      When the tool is positioned correctly, press the zero button in the Position panel:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span>Zero button</span>
                        <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </span>
                        <span>next to Z</span>
                      </li>
                    </ul>
                    <p>
                      After you have set zero for Z, press Next to continue.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Current Machine Position:</div>
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
                    <p className="font-medium">Paper Test Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Place a piece of paper (about 0.1mm thick) on the surface</li>
                      <li>Slowly lower the Z-axis using small jog steps</li>
                      <li>Stop when the paper can barely slide in and out with friction</li>
                      <li>The tool should just touch the paper, not press into it</li>
                    </ol>
                  </div>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>Tip:</strong> Use very small jog distances (0.01mm) for fine adjustment when approaching the surface.
                  </p>
                </div>
              </div>
            )}
          </div>
        )
      case 3:
        // Check if WCS is at zero for the axes that were zeroed (2 decimal accuracy = 0.01mm tolerance)
        const isAtZero = 
          (!axes.includes('x') || Math.abs(workPosition.x) < 0.01) &&
          (!axes.includes('y') || Math.abs(workPosition.y) < 0.01) &&
          (!axes.includes('z') || Math.abs(workPosition.z) < 0.01)
        
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 3: Confirm Zero</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Zero has been set for {getAxesLabel(axes)}. Pressing XY0 in the jog controls will return to this XY position, and pressing Z0 will move Z down to this depth.
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">Work Coordinate System Position:</div>
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
                  <p className="font-medium">Zero confirmed: The work coordinate system is set to the current position.</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-sm text-red-900 dark:text-red-100">
                  <p className="font-medium">Warning: The current position is not at the zero position. The work coordinate system shows non-zero values.</p>
                </div>
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }
  
  const renderTouchPlateStep = (step: number, method: ZeroingMethod) => {
    if (method.type !== 'touchplate') return null
    
    // TypeScript should narrow to TouchPlateConfig here, but we'll be explicit
    const touchplateMethod = method as Extract<ZeroingMethod, { type: 'touchplate' }>
    
    // Map step numbers based on requireCheck setting
    // If requireCheck is false, skip step 1 (verification), so step 1->position, step 2->probe
    const skipVerification = touchplateMethod.requireCheck === false
    const actualStep = skipVerification ? step + 1 : step
    
    switch (actualStep) {
      case 1:
        // Step 1: Verify Touch Plate (only shown if requireCheck is true)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 1: Verify Touch Plate</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Verify that the touch plate is working by manually touching it to the tool. The touch plate should trigger when contact is made.
                </p>
                <p>
                  This ensures the probe circuit is functioning correctly before starting the zeroing process.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Touch the plate to the tool manually. If the probe triggers correctly, you're ready to proceed. If not, check your wiring and probe settings.
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${
                probeContact 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    probeContact ? 'bg-green-500' : 'bg-muted'
                  }`} />
                  <span className="text-sm font-medium">
                    Probe Status: {probeContact ? 'Contact Detected' : 'No Contact'}
                  </span>
                </div>
                {probeContact && (
                  <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                    The probe circuit is working correctly. You can proceed to the next step.
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      case 2:
        // Step 2: Position Touch Plate (shown as step 1 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 1 : 2}: Position Touch Plate</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Place the touch plate on the workpiece at the location where you want to set Z zero.
                </p>
                <p>
                  Use the jog controls to position the tool above the touch plate location. The tool should be positioned so it can probe down onto the plate.
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Work Coordinate System Position:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{workPosition.x.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{workPosition.y.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Z: </span>
                  <span className="font-mono">{workPosition.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Make sure the touch plate is flat on the workpiece surface and the tool can reach it when probing down.
              </p>
            </div>
          </div>
        )
      case 3:
        // Step 3: Run Probe (shown as step 2 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 2 : 3}: Run Probe</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Press the probe button below to start the automatic Z-probe sequence. The tool will probe down until it contacts the touch plate, then set Z zero accounting for the plate thickness ({touchplateMethod.plateThickness}mm).
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">Probe Settings:</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Plate Thickness: </span>
                  <span className="font-mono">{touchplateMethod.plateThickness}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Probe Feedrate: </span>
                  <span className="font-mono">{touchplateMethod.probeFeedrate}mm/min</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Probe Distance: </span>
                  <span className="font-mono">{touchplateMethod.probeDistance}mm</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center py-4">
              <Button
                onClick={handleTouchPlateProbe}
                variant="default"
                size="lg"
                className="gap-2"
                disabled={!isConnected || !connectedPort}
              >
                <Target className="w-5 h-5" />
                Start Z-Probe
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Warning:</strong> Make sure the tool is positioned above the touch plate and there is enough clearance for the probe distance ({touchplateMethod.probeDistance}mm) before starting.
              </p>
            </div>
          </div>
        )
      case 4:
        // Step 4: Remove Touch Plate (shown as step 3 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 3 : 4}: Remove Touch Plate</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Remove the touch plate from the workpiece. The probe sequence has completed and Z zero has been set accounting for the plate thickness ({touchplateMethod.plateThickness}mm).
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
                <p className="font-medium">Zeroing Complete</p>
                <p>
                  Z zero has been set at the touch plate location accounting for the plate thickness. You can now remove the touch plate and proceed with your job.
                </p>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }
  
  const renderBitsetterStep = (step: number, method: ZeroingMethod) => {
    if (method.type !== 'bitsetter') return null
    
    // TypeScript should narrow to BitSetterConfig here, but we'll be explicit
    const bitsetterMethod = method as Extract<ZeroingMethod, { type: 'bitsetter' }>
    
    // Map step numbers based on requireCheck setting
    // If requireCheck is false, skip step 1 (verification), so step 1->navigate, step 2->tool change, step 3->probe
    const skipVerification = bitsetterMethod.requireCheck === false
    const actualStep = skipVerification ? step + 1 : step
    
    switch (actualStep) {
      case 1:
        // Step 1: Verify BitSetter Circuit (only shown if requireCheck is true)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 1: Verify BitSetter Circuit</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Verify that the BitSetter circuit is working by manually pressing the sensor down. The BitSetter should trigger when the sensor is pressed.
                </p>
                <p>
                  This ensures the probe circuit is functioning correctly before starting the zeroing process.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Press the BitSetter sensor down manually with your finger or a tool. If the probe triggers correctly, you're ready to proceed. If not, check your wiring and probe settings.
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${
                probeContact 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    probeContact ? 'bg-green-500' : 'bg-muted'
                  }`} />
                  <span className="text-sm font-medium">
                    Probe Status: {probeContact ? 'Contact Detected' : 'No Contact'}
                  </span>
                </div>
                {probeContact && (
                  <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                    The probe circuit is working correctly. You can proceed to the next step.
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      case 2:
        // Step 2: Navigate to BitSetter (shown as step 1 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 1 : 2}: Navigate to BitSetter</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  The tool will automatically navigate to the BitSetter location configured in settings. The machine will move to the BitSetter position safely.
                </p>
                <p>
                  <strong>BitSetter Location:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                  <li>X: {bitsetterMethod.position.x.toFixed(3)}mm</li>
                  <li>Y: {bitsetterMethod.position.y.toFixed(3)}mm</li>
                  <li>Z: {bitsetterMethod.position.z.toFixed(3)}mm</li>
                </ul>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Current Position:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{machinePosition.x.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{machinePosition.y.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Z: </span>
                  <span className="font-mono">{machinePosition.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center py-4">
              <Button
                onClick={handleBitsetterNavigate}
                variant="default"
                size="lg"
                className="gap-2"
                disabled={!isConnected || !connectedPort}
              >
                <Navigation className="w-5 h-5" />
                Navigate to BitSetter
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Warning:</strong> Make sure there is a clear path to the BitSetter location and that no obstacles will interfere with the tool movement.
              </p>
            </div>
          </div>
        )
      case 3:
        // Step 3: Install First Tool (shown as step 2 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 2 : 3}: Install First Tool</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Install the first tool before probing. We will measure the length of this tool so tool changes during the job are easier and you will only need to re-measure on the bitsetter instead of setting Z again on the material.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Once the first tool is installed, press Next to proceed to the probing step.
              </p>
            </div>
          </div>
        )
      case 4:
        // Step 4: Run Probe (shown as step 3 if requireCheck is false)
        const isProbing = probeStatus === 'probing' || probeStatus === 'capturing' || probeStatus === 'storing'
        const isProbeComplete = probeStatus === 'complete'
        const isProbeError = probeStatus === 'error'
        
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 3 : 4}: Run Probe</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Press the probe button below to start the automatic BitSetter probe sequence. The tool will perform a multi-stage probe sequence to accurately measure the tool length.
                </p>
                <p>
                  After probing, the tool reference will be stored. The tool will automatically retract to a safe height above the BitSetter.
                </p>
              </div>
            </div>
            
            {/* Probe Status */}
            {isProbing && (
              <div className={`p-4 rounded-lg border ${
                probeStatus === 'probing' ? 'bg-blue-500/10 border-blue-500/30' :
                probeStatus === 'capturing' ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-purple-500/10 border-purple-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full animate-pulse ${
                    probeStatus === 'probing' ? 'bg-blue-500' :
                    probeStatus === 'capturing' ? 'bg-amber-500' :
                    'bg-purple-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {probeStatus === 'probing' && 'Running probe sequence...'}
                      {probeStatus === 'capturing' && 'Capturing position...'}
                      {probeStatus === 'storing' && 'Storing tool reference...'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {probeStatus === 'probing' && 'The tool is probing down to contact the BitSetter sensor.'}
                      {probeStatus === 'capturing' && 'Reading work position after probe contact...'}
                      {probeStatus === 'storing' && 'Saving tool reference to Extensions API...'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isProbeComplete && (
              <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Probe complete! Tool reference stored.
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      The tool reference has been saved for {currentWCS}. You can now use this reference for tool changes.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isProbeError && (
              <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/30">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      Probe error
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      {probeError || 'An error occurred during the probe sequence. Please try again.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">Probe Settings:</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Probe Feedrate: </span>
                  <span className="font-mono">{bitsetterMethod.probeFeedrate}mm/min</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Probe Distance: </span>
                  <span className="font-mono">{bitsetterMethod.probeDistance}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Retract Height: </span>
                  <span className="font-mono">{bitsetterMethod.retractHeight}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Work Coordinate: </span>
                  <span className="font-mono">{currentWCS}</span>
                </div>
              </div>
            </div>
            
            {/* Current Position Display */}
            {!isProbeComplete && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium">Current Work Position:</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">X: </span>
                    <span className="font-mono">{workPosition.x.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Y: </span>
                    <span className="font-mono">{workPosition.y.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Z: </span>
                    <span className="font-mono">{workPosition.z.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-center py-4">
              <Button
                onClick={handleBitsetterProbe}
                variant="default"
                size="lg"
                className="gap-2"
                disabled={!isConnected || !connectedPort || isProbing}
              >
                {isProbing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {probeStatus === 'probing' && 'Probing...'}
                    {probeStatus === 'capturing' && 'Capturing...'}
                    {probeStatus === 'storing' && 'Storing...'}
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5" />
                    {isProbeComplete ? 'Probe Complete' : 'Start BitSetter Probe'}
                  </>
                )}
              </Button>
            </div>
            
            {!isProbing && !isProbeComplete && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Warning:</strong> Make sure the tool is positioned above the BitSetter and there is enough clearance for the probe distance ({bitsetterMethod.probeDistance}mm) before starting. The tool should already be at the BitSetter location from the previous step.
                </p>
              </div>
            )}
            
            {isProbeComplete && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                  <p className="font-medium">Tool reference stored</p>
                  <p>
                    The tool reference for {currentWCS} has been saved. When you change tools during a job, you can use this reference to automatically adjust the Z offset.
                  </p>
                </div>
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }
  
  const renderBitZeroStep = (step: number, method: ZeroingMethod) => {
    if (method.type !== 'bitzero') return null
    
    // TypeScript should narrow to BitZeroConfig here, but we'll be explicit
    const bitzeroMethod = method as Extract<ZeroingMethod, { type: 'bitzero' }>
    
    // Map step numbers based on requireCheck setting
    // If requireCheck is false, skip step 1 (verification), so step 1->place, step 2->jog, step 3->probe, step 4->remove
    const skipVerification = bitzeroMethod.requireCheck === false
    const actualStep = skipVerification ? step + 1 : step
    
    const isProbing = probeStatus === 'probing' || probeStatus === 'complete'
    const isProbeComplete = probeStatus === 'complete'
    const isProbeError = probeStatus === 'error'
    
    switch (actualStep) {
      case 1:
        // Step 1: Verify BitZero Circuit (only shown if requireCheck is true)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 1: Verify BitZero Circuit</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Verify that the magnetic conductor is positively attached to the tool and that the circuit is functioning correctly.
                </p>
                <p>
                  This ensures the probe circuit is working before starting the zeroing process.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Attach the magnetic conductor to the tool, then lift the BitZero probe until it touches the tool. If the probe triggers correctly, the magnetic conductor is properly attached and the circuit is functioning.
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${
                probeContact 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    probeContact ? 'bg-green-500' : 'bg-muted'
                  }`} />
                  <span className="text-sm font-medium">
                    Probe Status: {probeContact ? 'Contact Detected' : 'No Contact'}
                  </span>
                </div>
                {probeContact && (
                  <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                    The probe circuit is working correctly. You can proceed to the next step.
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      case 2:
        // Step 2: Place BitZero on Corner (shown as step 1 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 1 : 2}: Place BitZero on Corner</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Place the BitZero probe on the corner of your workpiece, making sure it's secure and flat.
                </p>
                <p>
                  The BitZero should be positioned so the conductive hole in the bottom left (-X-Y) corner is accessible for probing. Make sure the probe is firmly attached and won't move during probing.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Important:</strong> Ensure the BitZero is securely mounted and flat against the workpiece. The probe must not move during the zeroing sequence.
              </p>
            </div>
          </div>
        )
      case 3:
        // Step 3: Jog Tool into Hole (shown as step 2 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 2 : 3}: Jog Tool into Hole</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Use the jog controls to carefully position the tool into the conductive hole in the bottom left corner of the BitZero probe.
                </p>
                <p>
                  <strong>Important:</strong> The tool should be positioned <strong>below the Z surface</strong> of the probe (inside the hole). Use small movements when you get close to avoid damaging the tool or probe.
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Current Work Position:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{workPosition.x.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{workPosition.y.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Z: </span>
                  <span className="font-mono">{workPosition.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                <p className="font-medium">Jogging Tips:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Use large movements to get close to the hole</li>
                  <li>Switch to small movements (0.1mm or less) when approaching the hole</li>
                  <li>Ensure the tool is positioned below the Z surface of the probe</li>
                  <li>The tool should be centered in the hole as much as possible</li>
                </ul>
              </div>
            </div>
          </div>
        )
      case 4:
        // Step 4: Run Probe (shown as step 3 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 3 : 4}: Run Probe</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Press the probe button below to start the automatic BitZero probe sequence. The tool will:
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
                  <li>Probe right until contact, then probe left to find X edges and calculate X center</li>
                  <li>Probe top and bottom to find Y edges and calculate Y center</li>
                  <li>Move above the plate and probe Z to set Z zero</li>
                </ol>
                <p>
                  After probing, XYZ zero will be set at the corner of your workpiece.
                </p>
              </div>
            </div>
            
            {/* Probe Status */}
            {isProbing && (
              <div className={`p-4 rounded-lg border ${
                probeStatus === 'probing' ? 'bg-blue-500/10 border-blue-500/30' :
                probeStatus === 'complete' ? 'bg-green-500/10 border-green-500/30' :
                'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${
                    probeStatus === 'probing' ? 'bg-blue-500 animate-pulse' :
                    'bg-green-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {probeStatus === 'probing' && 'Running probe sequence...'}
                      {probeStatus === 'complete' && 'Probe complete! XYZ zero set.'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {probeStatus === 'probing' && 'The tool is probing X, Y, and Z axes to find the corner zero point.'}
                      {probeStatus === 'complete' && 'XYZ zero has been set at the corner of your workpiece.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isProbeComplete && (
              <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Probe complete! XYZ zero set.
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      The corner zero point has been established. You can now remove the BitZero probe.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isProbeError && (
              <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/30">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      Probe error
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      {probeError || 'An error occurred during the probe sequence. Please try again.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">Probe Settings:</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Probe Feedrate: </span>
                  <span className="font-mono">{bitzeroMethod.probeFeedrate}mm/min</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Probe Distance: </span>
                  <span className="font-mono">{bitzeroMethod.probeDistance}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Probe Thickness: </span>
                  <span className="font-mono">{bitzeroMethod.probeThickness}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Work Coordinate: </span>
                  <span className="font-mono">{currentWCS}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center py-4">
              <Button
                onClick={handleBitZeroProbe}
                variant="default"
                size="lg"
                className="gap-2"
                disabled={!isConnected || !connectedPort || isProbing}
              >
                {isProbing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {probeStatus === 'probing' && 'Probing...'}
                    {probeStatus === 'complete' && 'Complete'}
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5" />
                    Start BitZero Probe
                  </>
                )}
              </Button>
            </div>
            
            {!isProbing && !isProbeComplete && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Warning:</strong> Make sure the tool is positioned in the hole below the Z surface before starting. The tool should already be in the hole from the previous step.
                </p>
              </div>
            )}
          </div>
        )
      case 5:
        // Step 5: Remove BitZero (shown as step 4 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 4 : 5}: Remove BitZero</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Remove the BitZero probe from the workpiece. The probe sequence has completed and XYZ zero has been set at the corner of your workpiece.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
                <p className="font-medium">Zeroing Complete</p>
                <p>
                  XYZ zero has been set at the corner of your workpiece ({currentWCS}). You can now remove the BitZero probe and proceed with your job.
                </p>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }
  
  const handleCustomProbe = useCallback(async () => {
    if (!connectedPort || method.type !== 'custom') {
      return
    }
    
    // Get socket for event listeners (needed for progress tracking)
    const socket = socketService.getSocket()
    if (!socket || !socket.connected) {
      setProbeError('Socket not connected. Please check your connection and try again.')
      setProbeStatus('error')
      return
    }
    
    // Clear bitsetter reference if Z axis is being zeroed
    if (method.axes.includes('z')) {
      await clearBitsetterReference(currentWCS)
    }
    
    setProbeStatus('probing')
    setProbeError(null)
    
    const customMethod = method as Extract<ZeroingMethod, { type: 'custom' }>
    const gcodeString = customMethod.gcode.trim()
    
    if (!gcodeString) {
      setProbeError('No G-code found. Please configure the custom G-code in settings.')
      setProbeStatus('error')
      return
    }
    
    // Parse G-code to count lines for progress tracking
    const gcodeLines = gcodeString
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith(';')) // Remove empty lines and comments
    
    const totalLines = gcodeLines.length
    
    // If no actual G-code lines, mark as error (can't execute empty G-code)
    if (totalLines === 0) {
      setProbeError('No G-code found. Please configure the custom G-code in settings.')
      setProbeStatus('error')
      return
    }
    let linesSent = 0
    let linesReceived = 0
    let lastWorkflowState: string | null = null
    let isCleanedUp = false
    let timeoutId: NodeJS.Timeout | null = null
    let currentStatusRef = 'probing' // Track status to avoid closure issues
    
    // Track progress via serialport:write events (each line sent)
    // Note: This gives us line-by-line fidelity as each G-code line is sent
    const handleSerialWrite = (...args: unknown[]) => {
      if (isCleanedUp) return
      
      const data = args[0] as string
      const context = args[1] as { source?: string } | undefined
      
      // Only count lines sent from the feeder (not manual commands or status queries)
      if (context?.source === 'feeder' || (!context?.source && data.trim())) {
        const trimmed = data.trim()
        // Filter out Grbl status queries and other non-G-code commands
        if (trimmed && !trimmed.startsWith('$') && !trimmed.match(/^<.*>$/)) {
          linesSent++
          // We now have line-by-line progress tracking!
        }
      }
    }
    
    // Track responses via serialport:read events (ok responses)
    // This gives us line-by-line acknowledgment tracking
    // Keep a small buffer of recent messages to find the failing line if error comes out of order
    const recentMessages: string[] = []
    const handleSerialRead = (...args: unknown[]) => {
      if (isCleanedUp) return
      
      const message = args[0] as string
      if (!message || typeof message !== 'string') return
      
      // Keep a buffer of the last 5 messages to catch the failing line if it arrives before the error
      recentMessages.push(message.trim())
      if (recentMessages.length > 5) {
        recentMessages.shift()
      }
      
      const line = parseConsoleMessage(message, 'read')
      
      if (line.type === 'ok') {
        linesReceived++
        
        // Check if all lines have been acknowledged - if so, mark as complete immediately
        // This handles cases where workflow state might not transition (e.g., single-line commands)
        if (linesReceived >= totalLines && currentStatusRef === 'probing' && !isCleanedUp) {
          setProbeStatus('complete')
          currentStatusRef = 'complete'
          cleanup()
          return
        }
      } else if (line.type === 'error' || line.type === 'alarm') {
        // Look for the failing line in recent messages (format: "> G0 X0 (ln=15)")
        // Backend emits it just before the error, but messages might arrive out of order
        const failingLine = recentMessages.find(msg => msg.startsWith('> '))
        
        // Include the failing line in the error message if found
        const errorMsg = failingLine
          ? `${line.message}\n\nFailing line: ${failingLine}`
          : line.message
        
        setProbeError(errorMsg)
        setProbeStatus('error')
        currentStatusRef = 'error'
        cleanup()
        return
      }
    }
    
    // Track workflow state changes (idle -> running -> idle = complete)
    // This is the most reliable indicator of completion
    const handleWorkflowState = (...args: unknown[]) => {
      if (isCleanedUp) return
      
      const state = args[0] as string
      
      if (lastWorkflowState === null) {
        lastWorkflowState = state
      } else if (lastWorkflowState === 'idle' && state === 'running') {
        // Workflow started - G-code is being executed
        lastWorkflowState = state
      } else if (lastWorkflowState === 'running' && state === 'idle') {
        // Workflow completed - all G-code has finished
        if (currentStatusRef === 'probing') {
          setProbeStatus('complete')
          currentStatusRef = 'complete'
          cleanup()
        }
        lastWorkflowState = state
      } else {
        lastWorkflowState = state
      }
      
      // Handle error states
      if (state === 'error' || state === 'alarm') {
        setProbeError('Machine entered error state during G-code execution')
        setProbeStatus('error')
        currentStatusRef = 'error'
        cleanup()
      }
    }
    
    // Handle disconnections
    const handleDisconnect = (..._args: unknown[]) => {
      if (isCleanedUp) return
      setProbeError('Socket disconnected during G-code execution')
      setProbeStatus('error')
      currentStatusRef = 'error'
      cleanup()
    }
    
    // Get socket reference that will be available in cleanup
    const socketRef = socket
    
    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true
      
      // Get socket again for cleanup (in case it was reconnected)
      const cleanupSocket = socketService.getSocket()
      if (cleanupSocket) {
        cleanupSocket.off('serialport:write', handleSerialWrite)
        cleanupSocket.off('serialport:read', handleSerialRead)
        cleanupSocket.off('workflow:state', handleWorkflowState)
        cleanupSocket.off('disconnect', handleDisconnect)
      }
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    
    // Set up listeners
    socketRef.on('serialport:write', handleSerialWrite)
    socketRef.on('serialport:read', handleSerialRead)
    socketRef.on('workflow:state', handleWorkflowState)
    socketRef.once('disconnect', handleDisconnect)
    
    try {
      // Send the entire G-code block to the backend via the 'gcode' command
      // Match legacy frontend behavior: send as STRING (like macro.content), not array
      // 
      // The backend's builtinCommand.match() strips comments with: .replace(/;.*$/, '').trim()
      // But this only applies to %msg and %wait commands. Assignment expressions like
      // %PROBE_DISTANCE = 20 ;comment go through a different path that doesn't strip comments.
      // 
      // However, the backend's evaluate-assignment-expression uses esprima which cannot
      // parse JavaScript with inline comments. Assignment lines with comments will cause
      // parse errors because esprima sees the text after ";" as an unexpected identifier.
      // 
      // The solution: Strip comments from assignment lines using the same pattern as
      // builtinCommand.match does: .replace(/;.*$/, '').trim() but only for % lines
      // that aren't %msg or %wait (which are handled differently by the backend).
      const processedGcode = gcodeString
        .split(/\r?\n/)
        .map((line: string) => {
          const trimmed = line.trim()
          // For assignment expression lines (starting with % but not %msg or %wait),
          // strip comments using the same regex pattern as builtinCommand.match
          // The backend's builtinCommand.match() strips comments with .replace(/;.*$/, '')
          // but only for %msg/%wait. Assignment expressions need comments stripped too
          // because evaluate-assignment-expression uses esprima which can't parse JS with comments
          if (trimmed.startsWith('%') && !trimmed.match(/^%msg\b/i) && !trimmed.match(/^%wait\b/i)) {
            // Use same comment-stripping logic as builtinCommand.match: .replace(/;.*$/, '')
            return trimmed.replace(/;.*$/, '').trim()
          }
          // For all other lines (including %msg, %wait, and regular G-code), preserve as-is
          // The backend will handle comments appropriately for these
          return line
        })
        .join('\n')
      
      // Send as STRING (same format as macro.content) - backend will split and process
      sendGcode(processedGcode)
      
      // Fallback timeout - if workflow doesn't complete within reasonable time, mark as complete anyway
      // This handles cases where workflow state might not transition properly
      timeoutId = setTimeout(() => {
        if (!isCleanedUp && currentStatusRef === 'probing') {
          console.warn(`G-code execution timeout - lines sent: ${linesSent}/${totalLines}, received: ${linesReceived}/${totalLines}`)
          // If we've sent most lines and received most responses, assume it's done
          if (linesSent >= totalLines * 0.8 && linesReceived >= totalLines * 0.8) {
            setProbeStatus('complete')
            currentStatusRef = 'complete'
          } else {
            setProbeError('G-code execution may not have completed - please verify manually')
            setProbeStatus('error')
            currentStatusRef = 'error'
          }
          cleanup()
        }
      }, 60000) // 60 second timeout
      
    } catch (error) {
      cleanup()
      setProbeError(`Error sending G-code: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setProbeStatus('error')
    }
  }, [connectedPort, method, currentWCS, clearBitsetterReference, sendGcode])
  
  const renderCustomStep = (step: number, method: ZeroingMethod) => {
    if (method.type !== 'custom') return null
    
    const customMethod = method as Extract<ZeroingMethod, { type: 'custom' }>
    const isProbing = probeStatus === 'probing'
    const isProbeComplete = probeStatus === 'complete'
    const isProbeError = probeStatus === 'error'
    
    switch (step) {
      case 1:
        // Step 1: Run Custom G-code
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 1: Run Custom G-code</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Review the custom G-code below and press the button to execute it. The G-code will run sequentially until complete.
                </p>
              </div>
            </div>
            
            {/* Run Button */}
            <div className="flex items-center justify-center py-4">
              <Button
                onClick={handleCustomProbe}
                variant="default"
                size="lg"
                className="gap-2"
                disabled={!isConnected || !connectedPort || !customMethod.gcode || isProbing || isProbeComplete}
              >
                <Target className="w-5 h-5" />
                {isProbing ? 'Running...' : isProbeComplete ? 'G-code Complete' : 'Run Custom G-code'}
              </Button>
            </div>
            
            {/* Probe Status - Executing G-code box */}
            {(isProbing || isProbeComplete || isProbeError) && (
              <div className={`p-3 rounded-lg border ${
                isProbeComplete 
                  ? 'bg-green-500/10 border-green-500/30'
                  : isProbeError
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-blue-500/10 border-blue-500/30'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    isProbeComplete ? 'bg-green-500' : isProbeError ? 'bg-red-500' : 'bg-blue-500 animate-pulse'
                  }`} />
                  <span className="text-sm font-medium">
                    {isProbeComplete 
                      ? 'G-code Execution Complete'
                      : isProbeError
                      ? 'Error During Execution'
                      : 'Executing G-code...'}
                  </span>
                </div>
                {probeError && (
                  <p className="text-xs text-red-900 dark:text-red-100 mt-1 ml-5">
                    {probeError}
                  </p>
                )}
                {isProbeComplete && (
                  <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                    All G-code commands have been executed. Proceed to the next step to complete the zeroing process.
                  </p>
                )}
              </div>
            )}
            
            {/* Warning */}
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Warning:</strong> Make sure the machine is in a safe state before running the G-code. Verify the G-code will not cause collisions or unsafe movements.
              </p>
            </div>
            
            {/* Display G-code */}
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-sm font-medium mb-2">Custom G-code:</div>
              <pre className="text-xs font-mono bg-background border rounded p-3 overflow-x-auto max-h-48 overflow-y-auto">
                {customMethod.gcode || '(No G-code configured)'}
              </pre>
              {!customMethod.gcode && (
                <p className="text-xs text-muted-foreground mt-2">
                  Please configure the custom G-code in settings before running this probe method.
                </p>
              )}
            </div>
          </div>
        )
      case 2:
        // Step 2: Complete (only shown after G-code is done)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 2: Complete</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  The custom G-code has been executed. Verify that the zeroing operation completed successfully before proceeding.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <Check className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-green-900 dark:text-green-100 space-y-1">
                <p className="font-medium">G-code Execution Complete</p>
                <p>
                  The custom G-code probe sequence has finished. If the zeroing was successful, click Complete to finish.
                </p>
              </div>
            </div>
          </div>
        )
      default:
        return null
    }
  }
  
  if (!isConnected || !connectedPort) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">Not Connected</h3>
          <p className="text-sm text-muted-foreground">
            Please connect to a machine before running this zeroing method.
          </p>
          <Button variant="outline" onClick={onClose} className="mt-4">
            Close
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {method.type === 'bitsetter' ? 'BitSetter (First Tool)' : method.name}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Step {currentStep} of {totalSteps} - {getAxesLabel(method.axes)} Zeroing
        </p>
      </div>
      
      {/* Progress indicator - full width with justified steps */}
      <div className="relative w-full py-4 mb-4">
        {/* Full-width connecting line behind circles */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-muted" />
        
        {/* Steps container with justify-between - first on left, last on right, middle centered */}
        <div className="relative flex items-center justify-between w-full">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNum = index + 1
            const isActive = stepNum === currentStep
            const isComplete = stepNum < currentStep
            
            return (
              <div
                key={stepNum}
                className="relative z-10"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground border-2 border-background'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : stepNum}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Progress line that extends as steps are completed */}
        {currentStep > 1 && (
          <div 
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-green-500 transition-all duration-300 z-0"
            style={{
              left: '16px', // Half of circle width (w-8 = 32px, so 16px is center)
              width: totalSteps === 3
                ? currentStep === 2 
                  ? 'calc(50% - 32px)' // To middle of second circle
                  : 'calc(100% - 32px)' // To middle of third circle
                : currentStep === totalSteps
                ? 'calc(100% - 32px)'
                : `calc(${((currentStep - 1) / (totalSteps - 1)) * 100}% - 32px)`
            }}
          />
        )}
      </div>
      
      {/* Step content */}
      <div className="flex-1 overflow-y-auto min-h-0 mb-4">
        {renderStepContent()}
      </div>
      
      {/* Navigation buttons */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        {!isFirstStep && (
          <Button
            variant="outline"
            onClick={handleBack}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        <div className="flex-1" />
        {isLastStep ? (
          <Button onClick={handleComplete} className="gap-2">
            <Check className="w-4 h-4" />
            Complete
          </Button>
        ) : (
          <Button 
            onClick={handleNext} 
            className="gap-2"
            disabled={method.type === 'custom' && currentStep === 1 && probeStatus !== 'complete'}
          >
            Next
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
