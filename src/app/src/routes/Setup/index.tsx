import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { socketService } from '@/services/socket'
import { useGetSettingsQuery, useGetControllersQuery, useLazyGetMachineStatusQuery, type MachineStatus as ApiMachineStatus } from '@/services/api'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'
import { useGcodeCommand, useJoystickInput } from '@/hooks'
import { useMachineState, useJobState, useAppDispatch } from '@/store/hooks'
import { machineStateSync } from '@/services/machineStateSync'
import { setConnecting, setFlashing, setConnectionState, setMachineStatus, setHomed, setSpindleState, setSpindleSpeed } from '@/store/machineSlice'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { 
  ChevronDown,
  Home, Play, Pause, Square, Unlock, 
  Crosshair, RotateCcw, RotateCw, GripVertical,
  Zap, Target, FileCode,
  Move, Navigation, Bell, AlertCircle, X,
  HelpCircle, Camera, Gamepad2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MachineActionButton } from '@/components/MachineActionButton'
import { PageStatusBar } from '@/components/PageStatusBar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ActionRequirements } from '@/utils/machineState'

// Import extracted panels - explicit imports for Vite compatibility
import { DROPanel } from './panels/DROPanel'
import { JogPanel } from './panels/JogPanel'
import { ProbePanel } from './panels/ProbePanel'
import { MacrosPanel } from './panels/MacrosPanel'
import { SpindlePanel } from './panels/SpindlePanel'
import { RapidPanel } from './panels/RapidPanel'
import { FilePanel } from './panels/FilePanel'
import { ToolsPanel } from './panels/ToolsPanel'
import { VisualizerPanel } from './panels/VisualizerPanel'
import { CameraPanel } from './panels/CameraPanel'
import { JoystickPanel } from './panels/JoystickPanel'
import type { PanelProps } from './types'

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

// Panel configuration with metadata
const panelConfig: Record<string, { 
  title: string
  icon: React.ElementType
  component: React.FC<PanelProps>
}> = {
  dro: { title: 'Position', icon: Crosshair, component: DROPanel },
  jog: { title: 'Jog Control', icon: Move, component: JogPanel },
  rapid: { title: 'Rapid', icon: Navigation, component: RapidPanel },
  probe: { title: 'Probe', icon: Target, component: ProbePanel },
  macros: { title: 'Macros', icon: Zap, component: MacrosPanel },
  file: { title: 'File', icon: FileCode, component: FilePanel },
  spindle: { title: 'Spindle', icon: RotateCw, component: SpindlePanel },
  camera: { title: 'Camera', icon: Camera, component: CameraPanel },
  joystick: { title: 'Joystick', icon: Gamepad2, component: JoystickPanel },
}

// Sortable Panel Component
function SortablePanel({ 
  id, 
  isCollapsed, 
  onToggle,
  panelProps,
  onStartWizard
}: { 
  id: string
  isCollapsed: boolean
  onToggle: () => void
  panelProps: PanelProps
  onStartWizard?: (method: ZeroingMethod) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // When dragging, show a placeholder outline where item will go
    opacity: isDragging ? 0 : 1,
  }

  const config = panelConfig[id]
  if (!config) return null
  const PanelContent = config.component
  const Icon = config.icon

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Placeholder shown when this item is being dragged (shows where it came from / will land) */}
      {isDragging && (
        <div className="absolute inset-0 rounded-lg border-2 border-dashed border-primary bg-primary/10" />
      )}
      {/* The actual panel */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        {/* Header row */}
        <div className="flex items-center border-b border-border bg-muted/30">
          {/* Drag handle - listeners applied ONLY here */}
          <div 
            {...attributes}
            {...listeners}
            className="p-2 cursor-grab hover:bg-muted/50 transition-colors touch-none"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          {/* Header content - clickable for collapse */}
          <div 
            className="flex-1 flex items-center gap-2 pr-3 py-2 cursor-pointer" 
            onClick={onToggle}
          >
            <Icon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium flex-1">{config.title}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          </div>
        </div>
        {/* Panel content */}
        {!isCollapsed && (
          id === 'probe' && onStartWizard ? (
            <ProbePanel {...panelProps} onStartWizard={onStartWizard} />
          ) : (
            <PanelContent {...panelProps} />
          )
        )}
      </div>
    </div>
  )
}

// Drag overlay panel (shown while dragging) - full panel clone
function DragOverlayPanel({ id, isCollapsed, panelProps }: { id: string; isCollapsed: boolean; panelProps: PanelProps }) {
  const config = panelConfig[id]
  if (!config) return null
  const Icon = config.icon
  const PanelContent = config.component

  return (
    <div className="bg-card rounded-lg border-2 border-primary overflow-hidden shadow-2xl scale-[0.96]">
      <div className="flex items-center border-b border-border bg-muted/30">
        <div className="p-2 cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 flex items-center gap-2 pr-3 py-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{config.title}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
        </div>
      </div>
      {!isCollapsed && <PanelContent {...panelProps} />}
    </div>
  )
}

export default function Setup() {
  const navigate = useNavigate()
  
  // Get connection settings from API
  const { data: settings } = useGetSettingsQuery()
  
  // Panel order - just an array of IDs
  // Load from localStorage or use default
  // Store the last known position of joystick panel before it was removed
  const joystickPositionRef = useRef<number | null>(null)

  const [panelOrder, setPanelOrder] = useState<string[]>(() => {
    const stored = localStorage.getItem('axiocnc-setup-panel-order')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Validate it's an array with valid panel IDs
        const validPanels = ['dro', 'jog', 'spindle', 'rapid', 'probe', 'file', 'macros', 'camera', 'joystick']
        if (Array.isArray(parsed) && parsed.every(id => validPanels.includes(id))) {
          // Store joystick position if it exists in the saved order
          const joystickIndex = parsed.indexOf('joystick')
          if (joystickIndex !== -1) {
            joystickPositionRef.current = joystickIndex
          }
          return parsed
        }
      } catch {
        // Invalid JSON, use default
      }
    }
    return ['dro', 'jog', 'spindle', 'rapid', 'probe', 'file', 'macros', 'camera']
  })
  
  // Add/remove joystick panel to order when joystick is enabled/disabled
  // Preserve its position when re-adding
  useEffect(() => {
    if (settings?.joystick?.enabled && !panelOrder.includes('joystick')) {
      setPanelOrder(prev => {
        // If we have a saved position, restore it there
        if (joystickPositionRef.current !== null && joystickPositionRef.current < prev.length) {
          const newOrder = [...prev]
          newOrder.splice(joystickPositionRef.current, 0, 'joystick')
          return newOrder
        }
        // Otherwise add to end
        return [...prev, 'joystick']
      })
    } else if (!settings?.joystick?.enabled && panelOrder.includes('joystick')) {
      setPanelOrder(prev => {
        // Save the position before removing
        const joystickIndex = prev.indexOf('joystick')
        if (joystickIndex !== -1) {
          joystickPositionRef.current = joystickIndex
        }
        return prev.filter(id => id !== 'joystick')
      })
    }
  }, [settings?.joystick?.enabled, panelOrder])
  
  // Track which panels are collapsed
  // Load from localStorage or use default
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>(() => {
    const stored = localStorage.getItem('axiocnc-setup-panel-collapsed')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed
        }
      } catch {
        // Invalid JSON, use default
      }
    }
    return {}
  })
  
  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Get shared machine and job state from Redux
  const dispatch = useAppDispatch()
  const machineState = useMachineState()
  const jobState = useJobState()
  
  // Extract values from Redux state
  const isConnected = machineState.isConnected
  const isConnecting = machineState.isConnecting
  const connectedPort = machineState.connectedPort
  const machineStatus = machineState.machineStatus
  const isFlashing = machineState.isFlashing
  const isHomed = machineState.isHomed
  const isJobRunning = machineState.isJobRunning
  const workflowState = machineState.workflowState
  const machinePosition = machineState.machinePosition
  const workPosition = machineState.workPosition
  const spindleState = machineState.spindleState
  const spindleSpeed = machineState.spindleSpeed
  
  // UI-specific state (not in Redux)
  const [homingInProgress, setHomingInProgress] = useState(false)
  const [currentWCS, setCurrentWCS] = useState('G54') // Work Coordinate System
  
  // Hold state
  const [holdReason, setHoldReason] = useState<{ data?: string; msg?: string } | null>(null)
  
  // Probe status (from pinState - 'P' indicates probe contact)
  const [probeContact, setProbeContact] = useState<boolean>(false)
  
  // Wizard state
  const [wizardMethod, setWizardMethod] = useState<ZeroingMethod | null>(null)
  
  // Refs to track state in event handlers to avoid stale closures
  const machineStatusRef = useRef<MachineStatus>(machineStatus)
  machineStatusRef.current = machineStatus // Keep ref in sync
  const isConnectedRef = useRef(isConnected)
  isConnectedRef.current = isConnected
  const isHomedRef = useRef(isHomed)
  isHomedRef.current = isHomed
  const homingInProgressRef = useRef(homingInProgress)
  homingInProgressRef.current = homingInProgress
  const lastAlarmMessageRef = useRef<string | null>(null) // Track last alarm message from console
  
  // Notifications state
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: Date
    read: boolean
  }>>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  
  // Get active controllers to check if we're already connected when remounting
  // Refetch on mount to ensure we have fresh data when navigating back
  const { data: controllersData } = useGetControllersQuery(undefined, {
    refetchOnMountOrArgChange: true, // Always refetch when component mounts
  })

  // Lazy query for machine status (we'll call it manually when needed)
  const [getMachineStatus] = useLazyGetMachineStatusQuery()
  
  // G-code command hook for main component handlers
  const { sendCommand } = useGcodeCommand(connectedPort)
  
  // Client-side joystick input hook
  useJoystickInput({
    enabled: settings?.joystick?.enabled ?? false,
    connectionLocation: settings?.joystick?.connectionLocation ?? 'server',
    selectedGamepadId: settings?.joystick?.selectedGamepad ?? null,
  })
  
  // Show error notification
  const showErrorNotification = useCallback((title: string, message: string) => {
    const notification = {
      id: Date.now().toString(),
      type: 'error' as const,
      title,
      message,
      timestamp: new Date(),
      read: false
    }
    setNotifications(prev => [notification, ...prev])
    setNotificationsOpen(true)
  }, [])
  
  // Flash status when action attempted while disconnected
  const flashStatus = useCallback(() => {
    // Trigger flash animation: 150ms ramp up, 3x 50ms flash, 150ms ramp down (450ms total)
    dispatch(setFlashing(true))
    setTimeout(() => {
      dispatch(setFlashing(false))
    }, 450)
  }, [dispatch])
  
  // Handle Reset button - goes to pre-home state
  const handleReset = useCallback(() => {
    if (!connectedPort) return
    sendCommand('reset')
    // Machine state updates are handled by machineStateSync
    // Only update page-specific state
    setHomingInProgress(false)
    homingInProgressRef.current = false
  }, [connectedPort, sendCommand])
  
  
  // Handle E-Stop button (emergency stop - force stop all motion)
  const handleEStop = useCallback(() => {
    if (!connectedPort) return
    
    // Stop workflow first (with force option)
    sendCommand('gcode:stop', { force: true })
    
    // Always send reset command to Grbl (sends Ctrl-X) regardless of state
    // This ensures E-Stop always sends something to the machine
    sendCommand('reset')
    
    // Machine state updates are handled by machineStateSync
    // Only update page-specific state
    setHomingInProgress(false)
    homingInProgressRef.current = false
    // Clear hold state on E-Stop (page-specific)
    setHoldReason(null)
  }, [connectedPort, sendCommand])
  
  // Handle Pause button
  const handlePause = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot pause: not connected')
      flashStatus()
      return
    }
    sendCommand('gcode:pause')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Resume button (sends ~ to resume from hold and resets feeder/sender state)
  const handleResume = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot resume: not connected')
      flashStatus()
      return
    }
    // Send gcode:resume command (sends ! AND resets feeder/sender hold state)
    // This is better than cyclestart which only sends ~ without resetting feeder state
    sendCommand('gcode:resume')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Stop button (stops the job during hold)
  const handleStop = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot stop: not connected')
      flashStatus()
      return
    }
    // Stop the job
    sendCommand('gcode:stop')
    // isJobRunning is managed by Redux via workflow:state events
    // Clear hold state
    setHoldReason(null)
    // Status will be updated by workflow:state event
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Track if we've received initial state from backend (for page refresh)
  const hasReceivedInitialStateRef = useRef(false)
  
  // Track if we manually disconnected (to prevent restore after manual disconnect)
  const manuallyDisconnectedRef = useRef(false)
  
  // Listen for connection events and errors
  useEffect(() => {
    const handleSerialPortOpen = (...args: unknown[]) => {
      const data = args[0] as { port: string }
      
      // Clear manual disconnect flag when we successfully connect
      manuallyDisconnectedRef.current = false
      
      // Machine state updates are handled by machineStateSync
      dispatch(setConnecting(false))
    }
    
    const handleSerialPortClose = (..._args: unknown[]) => {
      // Machine state updates are handled by machineStateSync
      // Only update page-specific state
      setHomingInProgress(false)
      homingInProgressRef.current = false
    }
    
    const handleSocketError = (...args: unknown[]) => {
      const error = args[0]
      console.error('Socket error:', error)
      dispatch(setConnecting(false))
      const errorMessage = error instanceof Error ? error.message : 'Socket connection error occurred'
      showErrorNotification('Socket Error', errorMessage)
    }
    
    // Listen for controller state changes to detect alarm, running, and homing states
    // This is called on initial connection (page refresh) AND on state changes
    const handleMachineStatus = (...args: unknown[]) => {
      // Backend sends: machine:status(port, status)
      // Status now includes full controller state including parserstate
      const port = args[0] as string
      const status = args[1] as {
        parserstate?: {
          modal?: {
            wcs?: string // Work Coordinate System (G54, G55, etc.)
          }
        }
        controllerState?: {
          activeState?: string
          pinState?: string | null // Grbl v1.1: 'P' indicates probe triggered
        }
        machineStatus?: string
      }
      
      if (!status || !isConnectedRef.current) return
      
      // Machine state (positions, spindle) is handled by machineStateSync
      // Only update page-specific state here
      
      // Update WCS from parserstate (page-specific)
      if (status.parserstate?.modal?.wcs) {
        setCurrentWCS(status.parserstate.modal.wcs)
      }
      
      // Update probe contact status from pinState (Grbl v1.1) - page-specific
      // pinState contains 'P' when probe is triggered
      if (status.controllerState?.pinState !== undefined) {
        const pinState = status.controllerState.pinState || ''
        setProbeContact(pinState.includes('P'))
      }
      
      // Mark that we've received initial state from backend (for page refresh handling)
      hasReceivedInitialStateRef.current = true
      
      // Extract activeState from nested structure
      const activeState = status.controllerState?.activeState || ''
      const isAlarm = activeState === 'Alarm'
      const isHold = activeState === 'Hold'
      const isHoming = activeState === 'Home'
      const isIdle = activeState === 'Idle'
      
      // Check if homing completed FIRST - when we transition from 'Home' state to 'Idle'
      // This must run before the status update logic to avoid race conditions
      let homingJustCompleted = false
      // Check if we're idle and homing was in progress - this indicates homing completed
      // We check homingInProgressRef to detect the transition from Home to Idle
      if (isIdle && !isHoming && homingInProgressRef.current && !isHomed && isConnected) {
        // Homing was in progress and now we're idle - homing completed
        setHomingInProgress(false)
        homingInProgressRef.current = false
        homingJustCompleted = true
      } else if (isIdle && !isHoming && !homingInProgressRef.current && !isHomed) {
        // Reset homing progress flag if we're idle without homing active
        setHomingInProgress(false)
      }
      
      // Page-specific: Show alarm notifications
      // Machine status updates are handled by machineStateSync, but we show notifications here
      if (isAlarm) {
        // Check current status before updating - this is the "previous" value for transition detection
        const currentStatus = machineStatus
        const isTransitioningToAlarm = currentStatus !== 'alarm'
        
        // Clear hold on alarm (page-specific)
        setHoldReason(null)
        
        // Show notification when transitioning TO alarm state (not when already in alarm)
        if (isTransitioningToAlarm) {
          // Try to get alarm message from ref (updated by VisualizerPanel when serialport:read events arrive)
          let alarmMessage = lastAlarmMessageRef.current
          
          // If still no message found, wait a short time for the alarm message to arrive via serialport:read
          // This handles the case where machine:status arrives before serialport:read
          if (!alarmMessage) {
            // Wait up to 100ms for alarm message to arrive
            setTimeout(() => {
              const delayedMessage = lastAlarmMessageRef.current || 'Machine alarm triggered'
              showErrorNotification('Machine Alarm', delayedMessage)
            }, 100)
          } else {
            // Message found immediately, show notification right away
            showErrorNotification('Machine Alarm', alarmMessage)
          }
        }
      }
    }
    
    // Listen for workflow state - machine state is handled by machineStateSync
    // This handler is kept for page-specific logic if needed
    const handleWorkflowState = (..._args: unknown[]) => {
      // Machine state updates are handled by machineStateSync
      // Keep this handler for any page-specific logic if needed
    }
    
    // Listen for sender status - machine state is handled by machineStateSync
    // This handler is kept for page-specific hold reason tracking
    const handleSenderStatus = (...args: unknown[]) => {
      const senderData = args[0] as {
      hold?: boolean
      holdReason?: { data?: string; msg?: string; err?: boolean }
      }
      if (!senderData || typeof senderData !== 'object') return
      
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      // Page-specific: Track hold reason for display
      if (senderData.hold && senderData.holdReason) {
        setHoldReason(senderData.holdReason)
      } else if (!senderData.hold && machineStatus === 'hold') {
        // Hold was cleared - check if we should reset
        // Only reset if controller state also says we're not in hold
        // This prevents resetting when sender clears but controller still shows Hold
      }
    }
    
    // Listen for feeder status to get hold reason (for macros sent via command('gcode'))
    // NOTE: We don't set hold state from feeder status - only controller state determines hold
    // Feeder status is only used to get the hold reason message (M0 comment, etc.)
    // This is called on initial connection (page refresh) AND on state changes
    const handleFeederStatus = (...args: unknown[]) => {
      const feederData = args[0] as {
      hold?: boolean
      holdReason?: { data?: string; msg?: string; err?: boolean }
      queue?: number
      pending?: boolean
      }
      if (!feederData || typeof feederData !== 'object') return
      
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      // Mark that we've received initial state from backend
      hasReceivedInitialStateRef.current = true
      
      // Only update hold reason if controller confirms we're in Hold state
      // This prevents storing hold reason from stale feeder state
      if (feederData.hold && feederData.holdReason && machineStatusRef.current === 'hold') {
        // Machine is in hold state (confirmed by controller) - update hold reason message
        setHoldReason(prevReason => {
          // Prefer feeder holdReason if it has a message, otherwise keep previous
          if (feederData.holdReason?.msg) {
            return feederData.holdReason
          }
          return prevReason || feederData.holdReason || null
        })
      } else if (!feederData.hold && machineStatusRef.current !== 'hold') {
        // Feeder hold was cleared AND controller confirms we're not in hold - clear hold reason
        if (holdReason) {
          setHoldReason(null)
        }
      }
    }
    
    // Listen for homing completion (controller-specific events)
    const handleHomingComplete = (..._args: unknown[]) => {
      // Args may contain controller type or other info, but we don't need it
      if (isConnectedRef.current) {
        // Machine state updates are handled by machineStateSync
        // Only update page-specific state
        setHomingInProgress(false)
        homingInProgressRef.current = false
      }
    }
    
    const handleSocketDisconnect = (...args: unknown[]) => {
      const reason = args[0]
      if (isConnected) {
        // Machine state updates are handled by machineStateSync
        // Only show notification (page-specific)
        const reasonStr = typeof reason === 'string' ? reason : 'Connection lost'
        showErrorNotification('Connection Lost', `Socket disconnected: ${reasonStr}`)
      }
    }
    
    // Note: machine:status is handled by machineStateSync for global state
    // We listen here for page-specific logic (WCS, probe, notifications, hold reason)
    socketService.on('serialport:open', handleSerialPortOpen)
    socketService.on('serialport:close', handleSerialPortClose)
    socketService.on('error', handleSocketError)
    socketService.on('disconnect', handleSocketDisconnect)
    socketService.on('machine:status', handleMachineStatus) // For WCS, probe, alarm notifications (page-specific)
    socketService.on('workflow:state', handleWorkflowState) // Kept for potential page-specific logic
    socketService.on('sender:status', handleSenderStatus) // For hold reason tracking
    socketService.on('feeder:status', handleFeederStatus)
    socketService.on('controller:homing', handleHomingComplete)
    socketService.on('grbl:homing', handleHomingComplete) // Grbl-specific
    socketService.on('marlin:homing', handleHomingComplete) // Marlin-specific
    socketService.on('joystick:flashStatus', flashStatus) // Flash status when joystick jogging fails
    
    
    return () => {
      socketService.off('serialport:open', handleSerialPortOpen)
      socketService.off('serialport:close', handleSerialPortClose)
      socketService.off('error', handleSocketError)
      socketService.off('disconnect', handleSocketDisconnect)
      socketService.off('machine:status', handleMachineStatus)
      socketService.off('workflow:state', handleWorkflowState)
      socketService.off('sender:status', handleSenderStatus)
      socketService.off('feeder:status', handleFeederStatus)
      socketService.off('controller:homing', handleHomingComplete)
      socketService.off('grbl:homing', handleHomingComplete)
      socketService.off('marlin:homing', handleHomingComplete)
      socketService.off('joystick:flashStatus', flashStatus)
    }
  }, [showErrorNotification, isConnected, flashStatus, machineStatus, isHomed, dispatch])
  
  // Restore state from API on mount (only when needed - not on every navigation)
  // Only restore if:
  // 1. Redux doesn't have valid connection state (page refresh), OR
  // 2. The connected port doesn't match the settings port (port changed)
  // If Redux already has valid connection state, trust it (it persists across navigation)
  useEffect(() => {
    if (!settings?.connection?.port) {
      return
    }

    const needsRestore = 
      !isConnected || // Redux doesn't have connection state (page refresh)
      connectedPort !== settings.connection.port // Port changed

    if (needsRestore) {
      machineStateSync.restoreStateFromAPI(settings.connection.port)
    }
  }, [settings?.connection?.port, isConnected, connectedPort])
  
  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        // Persist to localStorage
        localStorage.setItem('axiocnc-setup-panel-order', JSON.stringify(newOrder))
        return newOrder
      })
    }
  }
  
  const togglePanel = (panelId: string) => {
    setCollapsedPanels(prev => {
      const updated = { ...prev, [panelId]: !prev[panelId] }
      // Persist to localStorage
      localStorage.setItem('axiocnc-setup-panel-collapsed', JSON.stringify(updated))
      return updated
    })
  }
  
  // Persist panel order changes (in case setPanelOrder is called elsewhere)
  useEffect(() => {
    localStorage.setItem('axiocnc-setup-panel-order', JSON.stringify(panelOrder))
  }, [panelOrder])
  
  // Persist collapsed panels changes
  useEffect(() => {
    localStorage.setItem('axiocnc-setup-panel-collapsed', JSON.stringify(collapsedPanels))
  }, [collapsedPanels])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* OverlayScrollbars custom styling */}
      <style>{`
        .os-scrollbar {
          --os-size: 8px;
          --os-padding-perpendicular: 2px;
          --os-padding-axis: 2px;
        }
        .os-scrollbar-handle {
          background: hsl(var(--muted-foreground) / 0.3) !important;
          border-radius: 4px !important;
        }
        .os-scrollbar-handle:hover {
          background: hsl(var(--muted-foreground) / 0.5) !important;
        }
        .os-scrollbar-track {
          background: transparent !important;
        }
        @keyframes flash-bright {
          0% {
            filter: brightness(1);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
          }
          33.3% {
            /* 150ms: Ramp up complete */
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          38.9% {
            /* 175ms: Flash 1 peak */
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          44.4% {
            /* 200ms: Flash 1 low */
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          50% {
            /* 225ms: Flash 2 peak */
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          55.6% {
            /* 250ms: Flash 2 low */
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          61.1% {
            /* 275ms: Flash 3 peak */
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          66.7% {
            /* 300ms: Flash 3 low - start ramp down */
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          100% {
            /* 450ms: Ramp down complete */
            filter: brightness(1);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
          }
        }
      `}</style>
      {/* Header - persistent across all screens */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <img src="/fulllogo.png" alt="AxioCNC" className="h-8 w-auto" />
        </div>
        
        {/* Mode tabs */}
        <div className="flex gap-1 ml-6">
          <Button variant="default" size="sm">Setup</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/monitor')}>Monitor</Button>
          <Button variant="ghost" size="sm">Stats</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>Settings</Button>
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Notifications button */}
        <div className="relative">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setNotificationsOpen(true)}
          >
            <Bell className="w-4 h-4" />
          </Button>
          {notifications.filter(n => !n.read).length > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">
                {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
              </span>
            </div>
          )}
        </div>
        
        {/* Emergency actions - Reset and E-Stop */}
        <div className="ml-4 flex items-center gap-2">
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={flashStatus}
            onAction={handleReset}
            requirements={ActionRequirements.allowAlarm}
            variant="outline"
            size="sm"
            className="h-9 px-4"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </MachineActionButton>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={flashStatus}
            onAction={handleEStop}
            requirements={ActionRequirements.standard}
            variant="destructive"
            size="lg"
            className="h-10 px-6 font-bold uppercase tracking-wide bg-red-600 hover:bg-red-700"
          >
            <Square className="w-5 h-5 mr-2" />
            E-Stop
          </MachineActionButton>
        </div>
      </header>
      
      {/* Setup control bar - screen-specific controls */}
      <PageStatusBar
        onError={showErrorNotification}
        workflowState={workflowState}
        isJobRunning={isJobRunning}
        onStop={handleStop}
        onPause={handlePause}
        onResume={handleResume}
        disabled={!isConnected || machineStatus === 'alarm'}
      />
      
      {/* Dashboard - Two column flex layout */}
      <main className="flex-1 flex gap-2 p-2 min-h-0">
        {/* Left column - scrollable sortable list (33%) */}
        <OverlayScrollbarsComponent 
          className="w-1/3"
          options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={panelOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {panelOrder
                  .filter((panelId) => {
                    // Filter out joystick panel if joystick is not enabled
                    if (panelId === 'joystick') {
                      return settings?.joystick?.enabled ?? false
                    }
                    return true
                  })
                  .map((panelId) => (
                    <SortablePanel
                      key={panelId}
                      id={panelId}
                      isCollapsed={collapsedPanels[panelId] ?? false}
                      onToggle={() => togglePanel(panelId)}
                      panelProps={{
                        isConnected,
                        connectedPort,
                        machineStatus,
                        onFlashStatus: flashStatus,
                        machinePosition,
                        workPosition,
                        currentWCS,
                        isJobRunning,
                        spindleState,
                        spindleSpeed,
                        senderState: jobState, // Pass job state for toolpath animation
                      }}
                      onStartWizard={(method) => setWizardMethod(method)}
                    />
                  ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <DragOverlayPanel 
                  id={activeId} 
                  isCollapsed={collapsedPanels[activeId] ?? false}
                  panelProps={{
                    isConnected,
                    connectedPort,
                    machineStatus,
                    onFlashStatus: flashStatus,
                    machinePosition,
                    workPosition,
                    currentWCS
                  }}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </OverlayScrollbarsComponent>
        
        {/* Right column - fixed layout (66%) */}
        <div className="w-2/3 flex flex-col gap-2 min-h-0">
          {/* Visualizer - 75% height */}
          <div className="flex-[3] min-h-0 bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <VisualizerPanel 
              isConnected={isConnected} 
              connectedPort={connectedPort}
              wizardMethod={wizardMethod}
              onWizardClose={() => setWizardMethod(null)}
              machinePosition={machinePosition}
              workPosition={workPosition}
              probeContact={probeContact}
              lastAlarmMessageRef={lastAlarmMessageRef}
              currentWCS={currentWCS}
              senderState={jobState}
            />
          </div>
          {/* Tools - 25% height */}
          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <ToolsPanel />
          </div>
        </div>
      </main>
      
      {/* Notifications Modal */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Notifications & Errors</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mt-4">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${
                    notification.type === 'error'
                      ? 'border-red-500/50 bg-red-500/10'
                      : notification.type === 'warning'
                      ? 'border-yellow-500/50 bg-yellow-500/10'
                      : 'border-border bg-muted/30'
                  } ${!notification.read ? 'opacity-100' : 'opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {notification.type === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Bell className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{notification.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {notification.timestamp.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setNotifications(prev =>
                          prev.map(n =>
                            n.id === notification.id ? { ...n, read: true } : n
                          )
                        )
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNotifications([])
              }}
            >
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })))
              }}
            >
              Mark All Read
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
