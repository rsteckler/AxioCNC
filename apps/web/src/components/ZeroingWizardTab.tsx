import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { socketService } from '@/services/socket'
import { useSetExtensionsMutation, useGetExtensionsQuery } from '@/services/api'
import type { ZeroingMethod } from '../../../shared/src/schemas/settings'
import { useGcodeCommand, useBitsetterReference } from '@/hooks'
import { buildSetZeroCommand, buildSetZeroWithOffsetCommand } from '@/utils/gcode'
import { parseConsoleMessage } from '@/routes/Setup/utils/consoleParser'
import { ZeroingWizard } from './ZeroingWizard'
import { getTotalSteps } from './wizards/utils'
import { ManualZeroingWizard } from './wizards/ManualZeroingWizard'
import { TouchPlateZeroingWizard } from './wizards/TouchPlateZeroingWizard'
import { BitSetterFirstToolWizard } from './wizards/BitSetterFirstToolWizard'
import { BitSetterNextToolWizard } from './wizards/BitSetterNextToolWizard'
import { BitZeroZeroingWizard } from './wizards/BitZeroZeroingWizard'
import { CustomZeroingWizard } from './wizards/CustomZeroingWizard'
import { useToolChange } from '@/contexts/ToolChangeContext'
import { useJobState, useWorkflowState } from '@/store/hooks'

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
  const { t } = useTranslation()
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
  
  // Refs for reliable state detection (avoid stale closures)
  const isProbingRef = useRef(false)
  const probeStartedRef = useRef(false)
  const probeCleanupRef = useRef<(() => void) | null>(null)
  
  // Extensions API for bitsetter toolReference storage
  const [setExtensions] = useSetExtensionsMutation()
  
  // Get jobId from job state for tracking first tool change completion
  const jobState = useJobState()
  const jobId = jobState?.jobId
  
  // Get workflow state to check if there's an active job in pause state
  const workflowState = useWorkflowState()
  const isJobPaused = workflowState === 'paused'
  
  // Get initial tool reference for subsequent tool changes (from first tool change)
  const toolReferenceKey = `bitsetter.toolReference.${currentWCS}`
  const { data: toolReferenceData } = useGetExtensionsQuery(
    { key: toolReferenceKey },
    { skip: !connectedPort || !currentWCS || method.type !== 'bitsetter' || isFirstToolChange }
  )
  
  // Extract initial tool reference value
  const initialToolReference = toolReferenceData && typeof toolReferenceData === 'object' && 'value' in toolReferenceData
    ? (toolReferenceData as { value?: number }).value
    : null
  
  // Hooks for G-code commands and bitsetter reference
  const { sendGcode } = useGcodeCommand(connectedPort)
  const { clearBitsetterReference } = useBitsetterReference()
  
  // Reset to step 1 when method changes
  useEffect(() => {
    setCurrentStep(1)
    setBitsetterNavigated(false)
  }, [method.id])
  
  // Sync refs with probe status
  useEffect(() => {
    isProbingRef.current = probeStatus === 'probing'
  }, [probeStatus])
  
  // Listen to feeder:status events (always active) - PRIMARY method for detecting probe completion
  useEffect(() => {
    const handleFeederStatus = (...args: unknown[]) => {
      // Only process if we're actively probing (use ref to avoid stale closure)
      if (!isProbingRef.current || !probeStartedRef.current) {
        return
      }

      const feederData = args[0] as {
        queue?: number
        pending?: boolean
        hold?: boolean
      }

      // Probe complete when queue is empty and not pending and not on hold
      // This matches the reliable state detection pattern
      if (feederData.queue === 0 && !feederData.pending && !feederData.hold) {
        if (probeStartedRef.current && isProbingRef.current) {
          // Clear any fallback timeouts
          if (probeCleanupRef.current) {
            probeCleanupRef.current()
          }
          
          // Mark probe as complete (or capturing for bitsetter first tool)
          // The specific probe handler will set the appropriate status
          // For bitsetter first tool, set to 'capturing' to trigger position capture
          // For others, set to 'complete'
          if (method.type === 'bitsetter' && isFirstToolChange) {
            setProbeStatus('capturing')
          } else {
            setProbeStatus('complete')
          }
          probeStartedRef.current = false
        }
      }
    }

    socketService.on('feeder:status', handleFeederStatus)

    return () => {
      socketService.off('feeder:status', handleFeederStatus)
    }
  }, [probeStatus, method.type, isFirstToolChange])
  
  const totalSteps = getTotalSteps(method, isToolChange, isFirstToolChange, isJobPaused)
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
    
    // Clear bitsetter reference only when setting Z zero via touchplate (Z reference becomes invalid)
    if (method.axes === 'z') {
      await clearBitsetterReference(currentWCS)
    }
    
    // Per-axis touchplate: probe only the selected axis (x, y, or z)
    const axis = method.axes.toUpperCase() as 'X' | 'Y' | 'Z'
    const setZeroCommand = buildSetZeroWithOffsetCommand(currentWCS, axis, method.plateThickness)
    // Probe toward negative axis direction; retract positive
    const probeCmd = `G38.2 ${axis}-${method.probeDistance} F${method.probeFeedrate}`
    const retractCmd = `G0 ${axis}10`
    const commands = [
      'G21', // Metric units
      'M5', // Stop spindle
      'G90', // Absolute mode
      'G91', // Relative mode (for probe)
      probeCmd,
      'G90', // Absolute mode
      setZeroCommand, // Set zero with plate thickness offset
      'G91', // Relative mode
      retractCmd, // Retract 10mm along probed axis
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
    
    // For subsequent tool changes, store XY coordinates before navigating to bitsetter
    if (!isFirstToolChange) {
      storedMachineCoordsRef.current = { x: machinePosition.x, y: machinePosition.y }
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
  }, [connectedPort, method, sendGcode, isFirstToolChange, machinePosition])
  
  const handleBitsetterProbe = useCallback(async () => {
    if (!connectedPort || method.type !== 'bitsetter') {
      return
    }
    
    // For first tool change, use macro approach; for subsequent, use sequential commands
    if (isFirstToolChange) {
      // First tool change: run macro, then capture position and store tool reference
      setProbeStatus('probing')
      setProbeError(null)
      probeStartedRef.current = true
      
      const bitsetterMethod = method as Extract<ZeroingMethod, { type: 'bitsetter' }>
      const probeDistance = bitsetterMethod.probeDistance || 50
      const probeRapidFeedrate = bitsetterMethod.probeFeedrate || 200
      
      // Build macro string with values inserted
      const macroLines = [
        '; Wait until the planner queue is empty',
        '%wait',
        '',
        '; Save modal state',
        '%UNITS = modal.units',
        '%DISTANCE = modal.distance',
        '%FEEDRATE = modal.feedrate',
        '%SPINDLE = modal.spindle',
        '%MOTION = modal.motion',
        '',
        'G21 ;metric',
        'M5   ;Stop spindle',
        '',
        'G91',
        `G38.2 Z-${probeDistance} F${probeRapidFeedrate} ;fast probe(so it doesn't take forever)`,
        'G0 z2',
        'G38.2 z-5 F40	;"dial-it-in" probes',
        'G4 P.25',
        'G38.4 z10 F20',
        'G4 P.25',
        'G38.2 z-2 F10',
        'G4 P.25',
        'G38.4 z10 F5',
        'G4 P.25',
        '',
        '; Restore modal state',
        '[UNITS] [DISTANCE] [FEEDRATE] [SPINDLE] [MOTION]',
        '',
        '%wait',
        '; This is where we need to end the macro and capture the current z position',
      ]
      
      const macroString = macroLines.join('\n')
      
      let isCleanedUp = false
      let timeoutId: NodeJS.Timeout | null = null
      
      // Track errors via serialport:read events (only for error detection)
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
        
        if (line.type === 'error' || line.type === 'alarm') {
          // Look for the failing line in recent messages (format: "> G0 X0 (ln=15)")
          const failingLine = recentMessages.find(msg => msg.startsWith('> '))
          
          // Include the failing line in the error message if found
          const errorMsg = failingLine
            ? `${line.message}\n\n${t('Failing line: {{line}}', { line: failingLine })}`
            : line.message
          
          setProbeError(errorMsg)
          setProbeStatus('error')
          probeStartedRef.current = false
          cleanup()
          return
        }
      }
      
      // Handle disconnections
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const handleDisconnect = (..._args: unknown[]) => {
        if (isCleanedUp) return
        setProbeError(t('Socket disconnected during probe sequence'))
        setProbeStatus('error')
        probeStartedRef.current = false
        cleanup()
      }
      
      const cleanup = () => {
        if (isCleanedUp) return
        isCleanedUp = true
        
        socketService.off('serialport:read', handleSerialRead)
        socketService.off('disconnect', handleDisconnect)
        
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }
      
      // Store cleanup function in ref so feeder:status handler can call it
      probeCleanupRef.current = cleanup
      
      // Set up listeners (only for error detection - completion detected via feeder:status)
      socketService.on('serialport:read', handleSerialRead)
      socketService.once('disconnect', handleDisconnect)
      
      try {
        // Process macro string to strip comments from assignment lines (same as BitZero)
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
        
        // Send the macro via the 'gcode' command (same as BitZero)
        sendGcode(processedMacro)
        
        // Set timeout as safety net (5 minutes max)
        timeoutId = setTimeout(() => {
          if (probeStatus === 'probing' && !isCleanedUp) {
            setProbeError(t('Probe sequence timed out. Please check the machine and try again.'))
            setProbeStatus('error')
            probeStartedRef.current = false
            cleanup()
          }
        }, 5 * 60 * 1000) // 5 minutes
      } catch (error) {
        console.error('BitSetter probe error:', error)
        setProbeError(error instanceof Error ? error.message : t('An error occurred during the probe sequence'))
        setProbeStatus('error')
        probeStartedRef.current = false
        cleanup()
      }
    } else {
      // Subsequent tool change: use macro approach
      if (!initialToolReference) {
        setProbeError(t('Initial tool reference not found. Please run first tool change before subsequent tool changes.'))
        setProbeStatus('error')
        return
      }
      
      setProbeStatus('probing')
      setProbeError(null)
      probeStartedRef.current = true
      
      // Use stored machine coordinates (captured before navigating to bitsetter)
      if (!storedMachineCoordsRef.current) {
        // Fallback: store current position if not already stored (shouldn't happen)
        storedMachineCoordsRef.current = { x: machinePosition.x, y: machinePosition.y }
      }
      
      const bitsetterMethod = method as Extract<ZeroingMethod, { type: 'bitsetter' }>
      const probeDistance = bitsetterMethod.probeDistance || 50
      const probeRapidFeedrate = bitsetterMethod.probeFeedrate || 200
      
      // Build macro string with values inserted
      const macroLines = [
        '; Wait until the planner queue is empty',
        '%wait',
        '',
        '; Save modal state',
        '%UNITS = modal.units',
        '%DISTANCE = modal.distance',
        '%FEEDRATE = modal.feedrate',
        '%SPINDLE = modal.spindle',
        '%MOTION = modal.motion',
        '',
        'G21 ;metric',
        'M5   ;Stop spindle',
        '',
        'G91',
        `G38.2 Z-${probeDistance} F${probeRapidFeedrate} ;fast probe(so it doesn't take forever)`,
        'G0 z2',
        'G38.2 z-5 F40	;"dial-it-in" probes',
        'G4 P.25',
        'G38.4 z10 F20',
        'G4 P.25',
        'G38.2 z-2 F10',
        'G4 P.25',
        'G38.4 z10 F5',
        'G4 P.25',
        '',
        'G90',
        '%wait',
        `; Update Z offset for new tool`,
        `G10 L20 Z${initialToolReference}`,
        '%wait',
        '',
        '; Restore modal state',
        '[UNITS] [DISTANCE] [FEEDRATE] [SPINDLE] [MOTION]',
        '',
        '%wait',
      ]
      
      const macroString = macroLines.join('\n')
      
      let isCleanedUp = false
      let timeoutId: NodeJS.Timeout | null = null
      
      // Track errors via serialport:read events (only for error detection)
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
        
        if (line.type === 'error' || line.type === 'alarm') {
          // Look for the failing line in recent messages (format: "> G0 X0 (ln=15)")
          const failingLine = recentMessages.find(msg => msg.startsWith('> '))
          
          // Include the failing line in the error message if found
          const errorMsg = failingLine
            ? `${line.message}\n\n${t('Failing line: {{line}}', { line: failingLine })}`
            : line.message
          
          setProbeError(errorMsg)
          setProbeStatus('error')
          probeStartedRef.current = false
          cleanup()
          return
        }
      }
      
      // Handle disconnections
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const handleDisconnect = (..._args: unknown[]) => {
        if (isCleanedUp) return
        setProbeError(t('Socket disconnected during probe sequence'))
        setProbeStatus('error')
        probeStartedRef.current = false
        cleanup()
      }
      
      const cleanup = () => {
        if (isCleanedUp) return
        isCleanedUp = true
        
        socketService.off('serialport:read', handleSerialRead)
        socketService.off('disconnect', handleDisconnect)
        
        if (timeoutId) {
          clearTimeout(timeoutId)
          timeoutId = null
        }
      }
      
      // Store cleanup function in ref so feeder:status handler can call it
      probeCleanupRef.current = cleanup
      
      // Set up listeners (only for error detection - completion detected via feeder:status)
      socketService.on('serialport:read', handleSerialRead)
      socketService.once('disconnect', handleDisconnect)
      
      try {
        // Process macro string to strip comments from assignment lines (same as BitZero)
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
        
        // Send the macro via the 'gcode' command (same as BitZero)
        sendGcode(processedMacro)
        
        // Set timeout as safety net (5 minutes max)
        timeoutId = setTimeout(() => {
          if (probeStatus === 'probing' && !isCleanedUp) {
            setProbeError(t('Probe sequence timed out. Please check the machine and try again.'))
            setProbeStatus('error')
            probeStartedRef.current = false
            cleanup()
          }
        }, 5 * 60 * 1000) // 5 minutes
      } catch (error) {
        console.error('BitSetter probe error:', error)
        setProbeError(error instanceof Error ? error.message : t('An error occurred during the probe sequence'))
        setProbeStatus('error')
        probeStartedRef.current = false
        cleanup()
      }
    }
  }, [connectedPort, method, machinePosition, isFirstToolChange, sendGcode, initialToolReference])
  
  const handleBitZeroProbe = useCallback(async () => {
    if (!connectedPort || method.type !== 'bitzero') {
      return
    }
    
    const bitzeroMethod = method as Extract<ZeroingMethod, { type: 'bitzero' }>
    const axes = bitzeroMethod.axes ?? 'xyz'
    
    // Clear bitsetter reference only when this BitZero run sets Z (axes 'z' or 'xyz')
    if (axes === 'z' || axes === 'xyz') {
      await clearBitsetterReference(currentWCS)
    }
    
    setProbeStatus('probing')
    setProbeError(null)
    probeStartedRef.current = true

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

    // Build macro based on axes: xyz (full), xy (X+Y only), z (Z only)
    const macroLines: string[] = ['G91', 'G21', '']

    if (axes === 'z') {
      // BitZero Z only: probe Z and set Z zero (tool already at XY position)
      macroLines.push(
        '; Z-Axis Probing',
        `G38.2 Z-${probeDistance} F${probeFeedrateA}`,
        'G0 Z2',
        `G38.2 Z-5 F${probeFeedrateB}`,
        setZZeroCommand,
        `G0 Z${zFinal}`,
        '',
        'G90'
      )
    } else {
      // X and/or Y probing (xy or xyz)
      if (axes === 'xy' || axes === 'xyz') {
        macroLines.push(
          '; X-Axis Probing',
          `G38.2 X${probeDistance} F${probeFeedrateA}`,
          'G0 X-2',
          `G38.2 X5 F${probeFeedrateB}`,
          'G90',
          '%X_RIGHT=posx',
          'G91',
          `G0 X-${probeMajorRetract}`,
          '',
          `G38.2 X-${probeDistance} F${probeFeedrateA}`,
          'G0 X2',
          `G38.2 X-5 F${probeFeedrateB}`,
          'G90',
          '%X_LEFT=posx',
          '',
          '; Calculate X center and move there',
          '%X_CHORD=X_RIGHT-X_LEFT',
          '%X_OFFSET=X_CHORD/2',
          'G91',
          'G0 X[X_OFFSET]',
          'G4 P1',
          setXZeroCommand,
          '',
          '; Y-Axis Probing',
          'G91',
          `G38.2 Y${probeDistance} F${probeFeedrateA}`,
          'G0 Y-2',
          `G38.2 Y5 F${probeFeedrateB}`,
          'G90',
          '%Y_TOP=posy',
          'G91',
          `G0 Y-${probeMajorRetract}`,
          '',
          `G38.2 Y-${probeDistance} F${probeFeedrateA}`,
          'G0 Y2',
          `G38.2 Y-5 F${probeFeedrateB}`,
          'G90',
          '%Y_BTM=posy',
          '',
          '; Calculate Y center and move there',
          '%Y_CHORD=Y_TOP-Y_BTM',
          '%Y_OFFSET=Y_CHORD/2',
          'G91',
          'G0 Y[Y_OFFSET]',
          'G4 P1',
          setYZeroCommand,
          ''
        )
      }
      if (axes === 'xyz') {
        macroLines.push(
          '; Calculate Z probe location using actual hole radius',
          '%HOLE_RADIUS=Y_CHORD/2',
          `%Z_PROBE_X=HOLE_RADIUS+${zProbeKeepout}`,
          `%Z_PROBE_Y=HOLE_RADIUS+${zProbeKeepout}`,
          '',
          '; Z-Axis Probing',
          `G0 Z${zProbe}`,
          'G0 X[Z_PROBE_X] Y[Z_PROBE_Y]',
          `G38.2 Z-${zProbe} F${probeFeedrateA}`,
          'G0 Z2',
          `G38.2 Z-5 F${probeFeedrateB}`,
          setZZeroCommand,
          `G0 Z${zFinal}`,
          ''
        )
      }
      macroLines.push(
        '; Final: Move to origin',
        'G90',
        'G0 X0 Y0',
        'G4 P1'
      )
    }

    const macroString = macroLines.join('\n')
    
    let isCleanedUp = false
    let timeoutId: NodeJS.Timeout | null = null
    
    // Track errors via serialport:read events (only for error detection)
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
      
      if (line.type === 'error' || line.type === 'alarm') {
        // Look for the failing line in recent messages (format: "> G0 X0 (ln=15)")
        const failingLine = recentMessages.find(msg => msg.startsWith('> '))
        
        // Include the failing line in the error message if found
        const errorMsg = failingLine
          ? `${line.message}\n\n${t('Failing line: {{line}}', { line: failingLine })}`
          : line.message
        
        setProbeError(errorMsg)
        setProbeStatus('error')
        probeStartedRef.current = false
        cleanup()
        return
      }
    }
    
    // Handle disconnections
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleDisconnect = (..._args: unknown[]) => {
      if (isCleanedUp) return
      setProbeError(t('Socket disconnected during probe sequence'))
      setProbeStatus('error')
      probeStartedRef.current = false
      cleanup()
    }
    
    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true
      
      socketService.off('serialport:read', handleSerialRead)
      socketService.off('disconnect', handleDisconnect)
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    
    // Store cleanup function in ref so feeder:status handler can call it
    probeCleanupRef.current = cleanup
    
    // Set up listeners (only for error detection - completion detected via feeder:status)
    socketService.on('serialport:read', handleSerialRead)
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
        if (probeStatus === 'probing' && !isCleanedUp) {
          setProbeError(t('Probe sequence timed out. Please check the machine and try again.'))
          setProbeStatus('error')
          probeStartedRef.current = false
          cleanup()
        }
      }, 5 * 60 * 1000) // 5 minutes
    } catch (error) {
      console.error('BitZero probe error:', error)
      setProbeError(error instanceof Error ? error.message : t('An error occurred during the probe sequence'))
      setProbeStatus('error')
      probeStartedRef.current = false
      cleanup()
    }
  }, [connectedPort, method, currentWCS, clearBitsetterReference, sendGcode, probeStatus])
  
  const handleCustomProbe = useCallback(async () => {
    if (!connectedPort || method.type !== 'custom') {
      return
    }
   
    if (method.axes.includes('z')) {
      await clearBitsetterReference(currentWCS)
    }
    
    setProbeStatus('probing')
    setProbeError(null)
    probeStartedRef.current = true
    
    const customMethod = method as Extract<ZeroingMethod, { type: 'custom' }>
    const gcodeString = customMethod.gcode.trim()
    
    if (!gcodeString) {
      setProbeError(t('No G-code found. Please configure the custom G-code in settings.'))
      setProbeStatus('error')
      probeStartedRef.current = false
      return
    }
    
    let isCleanedUp = false
    let timeoutId: NodeJS.Timeout | null = null
    
    // Track errors via serialport:read events (only for error detection)
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
      
      if (line.type === 'error' || line.type === 'alarm') {
        const failingLine = recentMessages.find(msg => msg.startsWith('> '))
        
        const errorMsg = failingLine
          ? `${line.message}\n\n${t('Failing line: {{line}}', { line: failingLine })}`
          : line.message
        
        setProbeError(errorMsg)
        setProbeStatus('error')
        probeStartedRef.current = false
        cleanup()
        return
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleDisconnect = (..._args: unknown[]) => {
      if (isCleanedUp) return
      setProbeError(t('Socket disconnected during G-code execution'))
      setProbeStatus('error')
      probeStartedRef.current = false
      cleanup()
    }
    
    const cleanup = () => {
      if (isCleanedUp) return
      isCleanedUp = true
      
      socketService.off('serialport:read', handleSerialRead)
      socketService.off('disconnect', handleDisconnect)
      
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
    }
    
    // Store cleanup function in ref so feeder:status handler can call it
    probeCleanupRef.current = cleanup
    
    // Set up listeners (only for error detection - completion detected via feeder:status)
    socketService.on('serialport:read', handleSerialRead)
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
        if (probeStatus === 'probing' && !isCleanedUp) {
          setProbeError(t('G-code execution timed out. Please check the machine and verify completion manually.'))
          setProbeStatus('error')
          probeStartedRef.current = false
          cleanup()
        }
      }, 5 * 60 * 1000) // 5 minutes (consistent with other probes)
      
    } catch (error) {
      cleanup()
      setProbeError(t('Error sending G-code: {{message}}', { message: error instanceof Error ? error.message : t('Unknown error') }))
      setProbeStatus('error')
      probeStartedRef.current = false
    }
  }, [connectedPort, method, currentWCS, clearBitsetterReference, sendGcode])
  
  // Monitor workPosition after probe to capture TOOL_REFERENCE
  const capturingPositionRef = useRef(false)
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Store machine X, Y for subsequent tool change (captured before navigating to bitsetter)
  const storedMachineCoordsRef = useRef<{ x: number; y: number } | null>(null)
  
  // Capture position when probeStatus changes to 'capturing' (first tool) or 'complete' (subsequent tool)
  // The macro ends with G4 P0.5 (dwell) and %wait (planner queue empty),
  // so the position is already stable when the macro completes
  useEffect(() => {
    // Handle both 'capturing' (first tool) and 'complete' (subsequent tool) status
    // For subsequent tool changes, status goes directly to 'complete', so we need to handle that too
    const shouldProcess = 
      (probeStatus === 'capturing' || (probeStatus === 'complete' && !isFirstToolChange)) && 
      !capturingPositionRef.current
    
    if (shouldProcess) {
      // The macro already completed with dwell and %wait, so position is stable
      // Just wait a short delay (200ms) for position to be reported, then capture
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current)
      }
      
      captureTimeoutRef.current = setTimeout(() => {
        if (isFirstToolChange) {
          // First tool change: capture position and store tool reference
          const currentPos = { ...workPosition }
          
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
              // Store first tool change completion flag for this job
              if (jobId) {
                const firstToolChangeFlagKey = `bitsetter.firstToolChangeCompleted.${currentWCS}.${jobId}`
                setExtensions({
                  key: firstToolChangeFlagKey,
                  data: {
                    completed: true,
                    timestamp: new Date().toISOString(),
                    jobId,
                    wcs: currentWCS
                  }
                }).catch((err) => {
                  console.error('Failed to store first tool change completion flag:', err)
                })
              }
              setProbeStatus('complete')
              // Retract to safe height after storing reference
              if (method.type === 'bitsetter' && connectedPort) {
                sendGcode('G90') // Ensure absolute mode
                setTimeout(() => {
                  sendGcode('G53 G0 Z-5') // Retract to Z=-5 in machine coordinates
                  // For first tool change, move to WCS home (X0 Y0)
                  setTimeout(() => {
                    sendGcode('G0 X0 Y0') // Move to WCS home
                  }, 500)
                }, 200)
              }
            })
            .catch((err) => {
              console.error('Failed to store bitsetter reference:', err)
              setProbeStatus('error')
              setProbeError(t('Failed to store tool reference. Please try again.'))
              capturingPositionRef.current = false
            })
        } else {
          // Subsequent tool change: no position capture needed, just retract and return to stored XY
          capturingPositionRef.current = true
          
          // Retract Z and return to stored X, Y
          if (method.type === 'bitsetter' && connectedPort && storedMachineCoordsRef.current) {
            const storedCoords = storedMachineCoordsRef.current
            sendGcode('G90') // Ensure absolute mode
            setTimeout(() => {
              sendGcode('G53 G0 Z-5') // Retract to Z=-5 in machine coordinates
              setTimeout(() => {
                sendGcode(`G53 G0 X${storedCoords.x} Y${storedCoords.y}`) // Return to stored X, Y
                storedMachineCoordsRef.current = null // Clear after use
              }, 500)
            }, 200)
          } else {
            console.warn('[ZeroingWizard] Cannot return to stored XY - missing conditions:', {
              methodType: method.type,
              hasConnectedPort: !!connectedPort,
              hasStoredCoords: !!storedMachineCoordsRef.current
            })
          }
        }
      }, 200) // Short delay just to ensure position is reported
    }
    
    // Cleanup timeout on unmount or status change
    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current)
      }
    }
  }, [probeStatus, currentWCS, setExtensions, method, connectedPort, sendGcode, isFirstToolChange, workPosition, jobId])
  
  const handleComplete = async () => {
    // Clear bitsetter reference when Z zero is being set (touchplate Z, bitzero Z/XYZ, manual/custom with Z)
    const touchplateSetsZ = method.type === 'touchplate' && method.axes === 'z'
    const bitzeroSetsZ = method.type === 'bitzero' && (method.axes === 'z' || method.axes === 'xyz')
    const manualSetsZ = method.type === 'manual' && method.axes.includes('z')
    const customSetsZ = method.type === 'custom' && method.axes.includes('z')
    if (touchplateSetsZ || bitzeroSetsZ || manualSetsZ || customSetsZ) {
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
          isJobPaused={isJobPaused}
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
          <BitSetterNextToolWizard
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
            isJobPaused={isJobPaused}
          />
        )
      }
      // First tool change or initial setup - use regular wizard
      return (
        <BitSetterFirstToolWizard
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
          isJobPaused={isJobPaused}
        />
      )
    }
    if (method.type === 'bitzero') {
        return (
        <BitZeroZeroingWizard
          method={method}
          currentStep={currentStep}
          machinePosition={machinePosition}
          probeContact={probeContact}
          probeStatus={probeStatus}
          probeError={probeError}
          currentWCS={currentWCS}
          isConnected={isConnected}
          connectedPort={connectedPort}
          onProbe={handleBitZeroProbe}
          isJobPaused={isJobPaused}
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
          isJobPaused={isJobPaused}
        />
      )
    }
    // Other method types will be implemented later
    return <div>Method type {method.type} not yet implemented</div>
  }
  
  // Old render functions removed - now using separate wizard components
  // renderManualStep, renderTouchPlateStep, renderBitsetterStep, renderBitZeroStep, renderCustomStep
  // were extracted to: ManualZeroingWizard, TouchPlateZeroingWizard, BitSetterFirstToolWizard, BitZeroZeroingWizard, CustomZeroingWizard
  
  if (!isConnected || !connectedPort) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">{t('Not Connected')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('Please connect to a machine before running this zeroing method.')}
          </p>
          <Button variant="outline" onClick={onClose} className="mt-4">
            {t('Close')}
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
           (method.type === 'bitsetter' && 
            isToolChange && !isFirstToolChange &&
            // For bitsetter subsequent tool changes, probe step requires probe to be complete
            // Probe step: step 3 (if requireCheck false) or step 4 (if requireCheck true)
            currentStep === (method.requireCheck === false ? 3 : 4) &&
            probeStatus !== 'complete') ||
           (method.type === 'bitsetter' && 
            isToolChange && isFirstToolChange &&
            // For bitsetter first tool changes, probe step requires probe to be complete
            // Probe step: step 3 (if requireCheck false) or step 4 (if requireCheck true)
            currentStep === (method.requireCheck === false ? 3 : 4) &&
            probeStatus !== 'complete') ||
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
