import { useState, useEffect, useCallback, useRef } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { socketService } from '@/services/socket'
import { useSetExtensionsMutation } from '@/services/api'
import type { ZeroingMethod } from '../../../shared/schemas/settings'
import { useGcodeCommand, useBitsetterReference } from '@/hooks'
import { buildSetZeroCommand, buildSetZeroWithOffsetCommand } from '@/utils/gcode'
import { parseConsoleMessage } from '@/routes/Setup/utils/consoleParser'
import { ZeroingWizard } from './ZeroingWizard'
import { getTotalSteps } from './wizards/utils'
import { ManualZeroingWizard } from './wizards/ManualZeroingWizard'
import { TouchPlateZeroingWizard } from './wizards/TouchPlateZeroingWizard'
import { BitSetterZeroingWizard } from './wizards/BitSetterZeroingWizard'
import { BitSetterToolChangeWizard } from './wizards/BitSetterToolChangeWizard'
import { BitZeroZeroingWizard } from './wizards/BitZeroZeroingWizard'
import { CustomZeroingWizard } from './wizards/CustomZeroingWizard'
import { useToolChange } from '@/contexts/ToolChangeContext'

interface ZeroingWizardTabProps {
  method: ZeroingMethod
  onClose: () => void
  isConnected: boolean
  connectedPort: string | null
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  currentWCS?: string
  isToolChange?: boolean
}

export function ZeroingWizardTab({ 
  method, 
  onClose,
  isConnected, 
  connectedPort,
  machinePosition,
  workPosition,
  probeContact = false,
  currentWCS = 'G54',
  isToolChange = false
}: ZeroingWizardTabProps) {
  // Get isFirstToolChange from context for bitsetter tool changes
  // Also check forceSubsequentToolChange debug flag
  const { isFirstToolChange: contextIsFirstToolChange, forceSubsequentToolChange } = useToolChange()
  // For tool changes, use context value; for initial setup, default to true (first)
  // But respect forceSubsequentToolChange debug flag for bitsetter (always subsequent if enabled)
  let isFirstToolChange = isToolChange ? contextIsFirstToolChange : true
  // Debug flag overrides: if forceSubsequentToolChange is enabled and method is bitsetter, always use subsequent wizard
  if (forceSubsequentToolChange && method.type === 'bitsetter') {
    isFirstToolChange = false
  }
  
  // For bitsetter tool changes, use isFirstToolChange to determine which wizard
  // For non-bitsetter or non-tool-change, always use regular wizard
  const [currentStep, setCurrentStep] = useState(1)
  const [probeStatus, setProbeStatus] = useState<'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'>('idle')
  const [probeError, setProbeError] = useState<string | null>(null)
  const [bitsetterNavigated, setBitsetterNavigated] = useState(false)
  
  // Extensions API for bitsetter toolReference storage
  const [setExtensions] = useSetExtensionsMutation()
  
  // Hooks for G-code commands and bitsetter reference
  const { sendGcode } = useGcodeCommand(connectedPort)
  const { clearBitsetterReference } = useBitsetterReference()
  
  // Reset to step 1 when method changes
  useEffect(() => {
    setCurrentStep(1)
    setBitsetterNavigated(false)
  }, [method.id])
  
  const totalSteps = getTotalSteps(method, isToolChange, isFirstToolChange)
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
      setCurrentStep(prev => {
        // Reset navigation state when going back from bitsetter step 3 to step 2
        if (method.type === 'bitsetter' && prev === (method.requireCheck === false ? 2 : 3)) {
          setBitsetterNavigated(false)
        }
        return prev - 1
      })
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
    
    // Mark navigation as started
    setBitsetterNavigated(true)
    
    // Navigate to bitsetter position safely using machine coordinates (G53)
    // Sequence: Raise Z to safe height -> Move XY -> Lower Z to bitsetter position
    const safeHeight = -5 // Always retract to Z=-5 in machine coordinates
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
    
    // Build macro string that calculates center on the controller
    // Macro uses variables: %X_RIGHT, %X_LEFT, %Y_TOP, %Y_BTM
    // Position variables: posx, posy, posz
    // Calculations: %X_CHORD=(X_RIGHT-X_LEFT), %X_OFFSET=X_CHORD/2, etc.
    const macroLines = [
      'G91', // Relative positioning
      'G21', // Metric units
      '',
      '; X-Axis Probing',
      `G38.2 X${probeDistance} F${probeFeedrateA}`, // Fast probe X right
      'G0 X-2', // Retract 2mm
      `G38.2 X5 F${probeFeedrateB}`, // Fine probe X right edge
      'G90', // Absolute mode to read position
      '%X_RIGHT=posx', // Capture X right position
      'G91', // Back to relative
      `G0 X-${probeMajorRetract}`, // Retract before left probe
      '',
      `G38.2 X-${probeDistance} F${probeFeedrateA}`, // Fast probe X left
      'G0 X2', // Retract 2mm
      `G38.2 X-5 F${probeFeedrateB}`, // Fine probe X left edge
      'G90', // Absolute mode to read position
      '%X_LEFT=posx', // Capture X left position
      '',
      '; Calculate X center and move there',
      '%X_CHORD=X_RIGHT-X_LEFT', // Calculate actual hole width
      '%X_OFFSET=X_CHORD/2', // Distance from X_LEFT to center
      'G91', // Relative mode
      'G0 X[X_OFFSET]', // Move to actual X center
      'G4 P1', // Dwell 1 second
      setXZeroCommand, // Set X0 at calculated center
      '',
      '; Y-Axis Probing',
      'G91', // Relative mode
      `G38.2 Y${probeDistance} F${probeFeedrateA}`, // Fast probe Y top
      'G0 Y-2', // Retract 2mm
      `G38.2 Y5 F${probeFeedrateB}`, // Fine probe Y top edge
      'G90', // Absolute mode to read position
      '%Y_TOP=posy', // Capture Y top position
      'G91', // Back to relative
      `G0 Y-${probeMajorRetract}`, // Retract before bottom probe
      '',
      `G38.2 Y-${probeDistance} F${probeFeedrateA}`, // Fast probe Y bottom
      'G0 Y2', // Retract 2mm
      `G38.2 Y-5 F${probeFeedrateB}`, // Fine probe Y bottom edge
      'G90', // Absolute mode to read position
      '%Y_BTM=posy', // Capture Y bottom position
      '',
      '; Calculate Y center and move there',
      '%Y_CHORD=Y_TOP-Y_BTM', // Calculate actual hole height
      '%Y_OFFSET=Y_CHORD/2', // Distance from Y_BTM to center
      'G91', // Relative mode
      'G0 Y[Y_OFFSET]', // Move to actual Y center
      'G4 P1', // Dwell 1 second
      setYZeroCommand, // Set Y0 at calculated center
      '',
      '; Calculate Z probe location using actual hole radius',
      '%HOLE_RADIUS=Y_CHORD/2', // Use Y chord for radius (hole is circular)
      `%Z_PROBE_X=HOLE_RADIUS+${zProbeKeepout}`, // X offset for Z probe (keepout)
      `%Z_PROBE_Y=HOLE_RADIUS+${zProbeKeepout}`, // Y offset for Z probe (keepout)
      '',
      '; Z-Axis Probing',
      `G0 Z${zProbe}`, // Lift out of hole
      'G0 X[Z_PROBE_X] Y[Z_PROBE_Y]', // Move above plate using actual hole radius
      `G38.2 Z-${zProbe} F${probeFeedrateA}`, // Fast probe Z down
      'G0 Z2', // Retract 2mm
      `G38.2 Z-5 F${probeFeedrateB}`, // Fine probe Z down
      setZZeroCommand, // Set Z0 with plate thickness offset
      `G0 Z${zFinal}`, // Raise to final height
      '',
      '; Final: Move to origin',
      'G90', // Absolute positioning
      'G0 X0 Y0', // Move to work origin
      'G4 P1', // Dwell 1 second
    ]
    
    const macroString = macroLines.join('\n')
    
    // Parse G-code to count lines for progress tracking
    const gcodeLines = macroString
      .split(/\r?\n/)
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith(';')) // Remove empty lines and comments
    
    const totalLines = gcodeLines.length
    
    if (totalLines === 0) {
      setProbeError('Failed to generate BitZero macro. Please check your settings.')
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
        }
      }
    }
    
    // Track responses via serialport:read events (ok responses)
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
        if (linesReceived >= totalLines && currentStatusRef === 'probing' && !isCleanedUp) {
          setProbeStatus('complete')
          currentStatusRef = 'complete'
          cleanup()
          return
        }
      } else if (line.type === 'error' || line.type === 'alarm') {
        // Look for the failing line in recent messages (format: "> G0 X0 (ln=15)")
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
        setProbeError('Machine entered error state during probe sequence')
        setProbeStatus('error')
        currentStatusRef = 'error'
        cleanup()
      }
    }
    
    // Handle disconnections
    const handleDisconnect = (..._args: unknown[]) => {
      if (isCleanedUp) return
      setProbeError('Socket disconnected during probe sequence')
      setProbeStatus('error')
      currentStatusRef = 'error'
      cleanup()
    }
    
    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true
      
      socketService.off('serialport:write', handleSerialWrite)
      socketService.off('serialport:read', handleSerialRead)
      socketService.off('workflow:state', handleWorkflowState)
      socketService.off('disconnect', handleDisconnect)
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    
    // Set up listeners
    socketService.on('serialport:write', handleSerialWrite)
    socketService.on('serialport:read', handleSerialRead)
    socketService.on('workflow:state', handleWorkflowState)
    socketService.once('disconnect', handleDisconnect)
    
    try {
      // Process macro string to strip comments from assignment lines (same as custom G-code)
      const processedMacro = macroString
        .split(/\r?\n/)
        .map((line: string) => {
          const trimmed = line.trim()
          // For assignment expression lines (starting with % but not %msg or %wait),
          // strip comments using the same regex pattern as builtinCommand.match
          if (trimmed.startsWith('%') && !trimmed.match(/^%msg\b/i) && !trimmed.match(/^%wait\b/i)) {
            return trimmed.replace(/;.*$/, '').trim()
          }
          return trimmed
        })
        .filter((line: string) => line.length > 0) // Remove empty lines
        .join('\n')
      
      // Send the macro via the 'gcode' command (same as custom G-code)
      sendGcode(processedMacro)
      
      // Set timeout as safety net (5 minutes max)
      timeoutId = setTimeout(() => {
        if (currentStatusRef === 'probing' && !isCleanedUp) {
          setProbeError('Probe sequence timed out. Please check the machine and try again.')
          setProbeStatus('error')
          currentStatusRef = 'error'
          cleanup()
        }
      }, 5 * 60 * 1000) // 5 minutes
    } catch (error) {
      console.error('BitZero probe error:', error)
      setProbeError(error instanceof Error ? error.message : 'An error occurred during the probe sequence')
      setProbeStatus('error')
      cleanup()
    }
  }, [connectedPort, method, currentWCS, clearBitsetterReference, sendGcode, buildSetZeroCommand, buildSetZeroWithOffsetCommand])
  
  const handleCustomProbe = useCallback(async () => {
    if (!connectedPort || method.type !== 'custom') {
      return
    }
   
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
    
    const gcodeLines = gcodeString
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.length > 0 && !line.startsWith(';'))
    
    const totalLines = gcodeLines.length
    
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
    let currentStatusRef = 'probing'
    
    const handleSerialWrite = (...args: unknown[]) => {
      if (isCleanedUp) return
      
      const data = args[0] as string
      const context = args[1] as { source?: string } | undefined
      
      if (context?.source === 'feeder' || (!context?.source && data.trim())) {
        const trimmed = data.trim()
        if (trimmed && !trimmed.startsWith('$') && !trimmed.match(/^<.*>$/)) {
          linesSent++
        }
      }
    }
    
    const recentMessages: string[] = []
    const handleSerialRead = (...args: unknown[]) => {
      if (isCleanedUp) return
      
      const message = args[0] as string
      if (!message || typeof message !== 'string') return
      
      recentMessages.push(message.trim())
      if (recentMessages.length > 5) {
        recentMessages.shift()
      }
      
      const line = parseConsoleMessage(message, 'read')
      
      if (line.type === 'ok') {
        linesReceived++
        
        if (linesReceived >= totalLines && currentStatusRef === 'probing' && !isCleanedUp) {
          setProbeStatus('complete')
          currentStatusRef = 'complete'
          cleanup()
          return
        }
      } else if (line.type === 'error' || line.type === 'alarm') {
        const failingLine = recentMessages.find(msg => msg.startsWith('> '))
        
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
    
    const handleWorkflowState = (...args: unknown[]) => {
      if (isCleanedUp) return
      
      const state = args[0] as string
      
      if (lastWorkflowState === null) {
        lastWorkflowState = state
      } else if (lastWorkflowState === 'idle' && state === 'running') {
        lastWorkflowState = state
      } else if (lastWorkflowState === 'running' && state === 'idle') {
        if (currentStatusRef === 'probing') {
          setProbeStatus('complete')
          currentStatusRef = 'complete'
          cleanup()
        }
        lastWorkflowState = state
      } else {
        lastWorkflowState = state
      }
      
      if (state === 'error' || state === 'alarm') {
        setProbeError('Machine entered error state during G-code execution')
        setProbeStatus('error')
        currentStatusRef = 'error'
        cleanup()
      }
    }
    
    const handleDisconnect = (..._args: unknown[]) => {
      if (isCleanedUp) return
      setProbeError('Socket disconnected during G-code execution')
      setProbeStatus('error')
      currentStatusRef = 'error'
      cleanup()
    }
    
    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true
      
      socketService.off('serialport:write', handleSerialWrite)
      socketService.off('serialport:read', handleSerialRead)
      socketService.off('workflow:state', handleWorkflowState)
      socketService.off('disconnect', handleDisconnect)
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    
    socketService.on('serialport:write', handleSerialWrite)
    socketService.on('serialport:read', handleSerialRead)
    socketService.on('workflow:state', handleWorkflowState)
    socketService.once('disconnect', handleDisconnect)
    
    try {
      const processedGcode = gcodeString
        .split(/\r?\n/)
        .map((line: string) => {
          const trimmed = line.trim()
          if (trimmed.startsWith('%') && !trimmed.match(/^%msg\b/i) && !trimmed.match(/^%wait\b/i)) {
            return trimmed.replace(/;.*$/, '').trim()
          }
          return line
        })
        .join('\n')
      
      sendGcode(processedGcode)
      
      timeoutId = setTimeout(() => {
        if (!isCleanedUp && currentStatusRef === 'probing') {
          console.warn(`G-code execution timeout - lines sent: ${linesSent}/${totalLines}, received: ${linesReceived}/${totalLines}`)
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
      }, 60000)
      
    } catch (error) {
      cleanup()
      setProbeError(`Error sending G-code: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setProbeStatus('error')
    }
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
                  sendGcode('G90') // Ensure absolute mode
                  setTimeout(() => {
                    sendGcode('G53 G0 Z-5') // Always retract to Z=-5 in machine coordinates
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
        return (
        <ManualZeroingWizard
          method={method}
          currentStep={currentStep}
          machinePosition={machinePosition}
          workPosition={workPosition}
        />
      )
    }
    if (method.type === 'touchplate') {
        return (
        <TouchPlateZeroingWizard
          method={method}
          currentStep={currentStep}
          workPosition={workPosition}
          probeContact={probeContact}
          probeStatus={probeStatus}
          isConnected={isConnected}
          connectedPort={connectedPort}
          onProbe={handleTouchPlateProbe}
        />
      )
    }
    if (method.type === 'bitsetter') {
      // For bitsetter, use isFirstToolChange to determine which wizard
      // - First tool change (or initial setup): use regular wizard (includes "Install First Tool" step)
      // - Subsequent tool change: use tool change wizard (skips "Install First Tool")
      // forceSubsequentToolChange debug flag is already handled above (sets isFirstToolChange to false)
      if (!isFirstToolChange) {
        // Subsequent tool change (or forced by debug flag) - use tool change wizard
        return (
          <BitSetterToolChangeWizard
            method={method}
            currentStep={currentStep}
            machinePosition={machinePosition}
            probeContact={probeContact}
            probeStatus={probeStatus}
            probeError={probeError}
            bitsetterNavigated={bitsetterNavigated}
            currentWCS={currentWCS}
            isConnected={isConnected}
            connectedPort={connectedPort}
            onNavigate={handleBitsetterNavigate}
            onProbe={handleBitsetterProbe}
          />
        )
      }
      // First tool change or initial setup - use regular wizard
      return (
        <BitSetterZeroingWizard
          method={method}
          currentStep={currentStep}
          machinePosition={machinePosition}
          probeContact={probeContact}
          probeStatus={probeStatus}
          probeError={probeError}
          bitsetterNavigated={bitsetterNavigated}
          currentWCS={currentWCS}
          isConnected={isConnected}
          connectedPort={connectedPort}
          onNavigate={handleBitsetterNavigate}
          onProbe={handleBitsetterProbe}
        />
      )
    }
    if (method.type === 'bitzero') {
        return (
        <BitZeroZeroingWizard
          method={method}
          currentStep={currentStep}
          workPosition={workPosition}
          probeContact={probeContact}
          probeStatus={probeStatus}
          probeError={probeError}
          currentWCS={currentWCS}
          isConnected={isConnected}
          connectedPort={connectedPort}
          onProbe={handleBitZeroProbe}
        />
      )
    }
    if (method.type === 'custom') {
        return (
        <CustomZeroingWizard
          method={method}
          currentStep={currentStep}
          probeStatus={probeStatus}
          probeError={probeError}
          isConnected={isConnected}
          connectedPort={connectedPort}
          onProbe={handleCustomProbe}
        />
      )
    }
    // Other method types will be implemented later
    return <div>Method type {method.type} not yet implemented</div>
  }
  
  // Old render functions removed - now using separate wizard components
  // renderManualStep, renderTouchPlateStep, renderBitsetterStep, renderBitZeroStep, renderCustomStep
  // were extracted to: ManualZeroingWizard, TouchPlateZeroingWizard, BitSetterZeroingWizard, BitZeroZeroingWizard, CustomZeroingWizard
  
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
  
         // Calculate canGoNext based on method-specific conditions
         const canGoNext = !(
           (method.type === 'custom' && currentStep === 1 && probeStatus !== 'complete') ||
           (method.type === 'touchplate' && 
            currentStep === (method.requireCheck === false ? 2 : 3) &&
            probeStatus !== 'complete') ||
           (method.type === 'bitsetter' && 
            // For bitsetter, check navigation requirement on Navigate step
            // For first tool: step 1 (if requireCheck false) or step 2 (if requireCheck true)
            // For subsequent tool: step 1 (if requireCheck false) or step 2 (if requireCheck true)
            ((!isFirstToolChange && currentStep === (method.requireCheck === false ? 1 : 2)) ||
             (isFirstToolChange && currentStep === (method.requireCheck === false ? 1 : 2))) &&
            !bitsetterNavigated) ||
           (method.type === 'bitzero' && 
            currentStep === (method.requireCheck === false ? 3 : 4) &&
            probeStatus !== 'complete')
         )

  return (
    <ZeroingWizard
      method={method}
      totalSteps={totalSteps}
      currentStep={currentStep}
      isFirstStep={isFirstStep}
      isLastStep={isLastStep}
      onNext={handleNext}
      onBack={handleBack}
      onComplete={handleComplete}
      onClose={onClose}
      canGoNext={canGoNext}
      isFirstToolChange={isFirstToolChange}
    >
      {renderStepContent()}
    </ZeroingWizard>
  )
}
