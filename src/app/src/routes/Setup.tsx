import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { socketService } from '@/services/socket'
import { useGetSettingsQuery, useGetControllersQuery, useLazyGetMachineStatusQuery, type MachineStatus as MachineStatusType } from '@/services/api'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'
import { useGcodeCommand } from '@/hooks'
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
  HelpCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MachineActionButton } from '@/components/MachineActionButton'
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
  
  // Panel order - just an array of IDs
  const [panelOrder, setPanelOrder] = useState(['dro', 'jog', 'spindle', 'rapid', 'probe', 'file', 'macros'])
  
  // Track which panels are collapsed
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({})
  
  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Machine status type
  type MachineStatus = 
    | 'not_connected'
    | 'connected_pre_home'
    | 'connected_post_home'
    | 'alarm'
    | 'running'
    | 'hold'
    | 'error'
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectedPort, setConnectedPort] = useState<string | null>(null)
  const [machineStatus, setMachineStatus] = useState<MachineStatus>('not_connected')
  const [isFlashing, setIsFlashing] = useState(false)
  const [isHomed, setIsHomed] = useState(false)
  const [isJobRunning, setIsJobRunning] = useState(false)
  const [homingInProgress, setHomingInProgress] = useState(false)
  
  // Position state
  const [machinePosition, setMachinePosition] = useState({ x: 0, y: 0, z: 0 })
  const [workPosition, setWorkPosition] = useState({ x: 0, y: 0, z: 0 })
  const [currentWCS, setCurrentWCS] = useState('G54') // Work Coordinate System
  
  // Spindle state
  const [spindleState, setSpindleState] = useState<'M3' | 'M4' | 'M5'>('M5')
  const [spindleSpeed, setSpindleSpeed] = useState<number>(0)
  
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
  
  // Get connection settings from API
  const { data: settings } = useGetSettingsQuery()
  
  // Get active controllers to check if we're already connected when remounting
  // Refetch on mount to ensure we have fresh data when navigating back
  const { data: controllersData } = useGetControllersQuery(undefined, {
    refetchOnMountOrArgChange: true, // Always refetch when component mounts
  })

  // Lazy query for machine status (we'll call it manually when needed)
  const [getMachineStatus] = useLazyGetMachineStatusQuery()

  // Store backend machine status
  const [backendMachineStatus, setBackendMachineStatus] = useState<MachineStatusType | null>(null)
  
  // G-code command hook for main component handlers
  const { sendCommand } = useGcodeCommand(connectedPort)
  
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
  
  // Handle Connect/Disconnect
  const handleConnect = useCallback(() => {
    // Prevent double-clicking while connecting
    if (isConnecting) {
      return
    }
    
    // Check if settings are loaded
    if (!settings) {
      showErrorNotification('Settings Not Loaded', 'Please wait for settings to load, or check your connection to the server')
      return
    }
    
    // Check if port is configured
    if (!settings.connection?.port) {
      showErrorNotification('No Port Configured', 'Please configure a serial port in Settings before connecting')
      return
    }
    
    // Validate connection settings
    const { port, baudRate, controllerType } = settings.connection
    
    if (!port || port.trim() === '') {
      showErrorNotification('Invalid Port', 'Serial port is empty. Please configure a valid port in Settings')
      return
    }
    
    if (!baudRate || baudRate <= 0) {
      showErrorNotification('Invalid Baud Rate', `Baud rate must be greater than 0. Current: ${baudRate}`)
      return
    }
    
    if (isConnected && connectedPort) {
      // Disconnect
      
      const socket = socketService.getSocket()
      if (!socket) {
        // Socket not available - update UI immediately
        setIsConnected(false)
        setConnectedPort(null)
        setMachineStatus('not_connected')
        isHomedRef.current = false
        setIsHomed(false)
        setIsJobRunning(false)
        setSpindleState('M5')
        setSpindleSpeed(0)
        return
      }
      
      
      // Mark as manually disconnected to prevent restore
      manuallyDisconnectedRef.current = true
      
      // Update UI optimistically (will be confirmed by serialport:close event)
      setIsConnected(false)
      setConnectedPort(null)
      setMachineStatus('not_connected')
      isHomedRef.current = false
      setIsHomed(false)
      setIsJobRunning(false)
      setSpindleState('M5')
      setSpindleSpeed(0)
      
      // Request disconnect from backend
      socket.emit('close', connectedPort, (err: Error | null) => {
        if (err) {
          console.error('Disconnect error:', err)
          // If already disconnected, that's fine - UI is already updated
          // Only show error if it's a real error (not "already disconnected")
          const errorMessage = err.message || (typeof err === 'string' ? err : 'Failed to disconnect from machine')
          if (!errorMessage.toLowerCase().includes('not connected') && 
              !errorMessage.toLowerCase().includes('already') &&
              !errorMessage.toLowerCase().includes('not found')) {
            showErrorNotification('Disconnect Failed', errorMessage)
          }
        }
        // UI is already updated above, so we don't need to update it here
        // The serialport:close event will also confirm the disconnect
      })
    } else {
      // Connect
      setIsConnecting(true)
      
      // Set a timeout for connection attempts (10 seconds)
      const connectionTimeout = setTimeout(() => {
        setIsConnecting(false)
        showErrorNotification('Connection Timeout', 'Connection attempt timed out. Please check that the port is available and the machine is powered on.')
      }, 10000)
      
      // Ensure socket is connected first
      let socket = socketService.getSocket()
      if (!socket || !socketService.isConnected()) {
        socket = socketService.connect()
        if (!socket) {
          clearTimeout(connectionTimeout)
          setIsConnecting(false)
          showErrorNotification('Socket Connection Failed', 'Failed to establish socket connection. Please check your authentication and try again.')
          return
        }
      }
      
      // Wait a moment for socket to be ready if it was just connected
      const attemptConnection = () => {
        socket = socketService.getSocket()
        if (!socket) {
          clearTimeout(connectionTimeout)
          setIsConnecting(false)
          showErrorNotification('Socket Not Ready', 'Socket connection is not ready. Please try again.')
          return
        }
        
        socket.emit('open', port, {
          baudrate: baudRate,
          controllerType: controllerType || 'Grbl'
        }, (err: Error | null) => {
          clearTimeout(connectionTimeout)
          setIsConnecting(false)
          if (err) {
            console.error('Connection error:', err)
            const errorMessage = err.message || (typeof err === 'string' ? err : 'Failed to connect to machine')
            showErrorNotification('Connection Failed', errorMessage)
          } else {
            setIsConnected(true)
            setConnectedPort(port)
            setMachineStatus('connected_pre_home')
            isHomedRef.current = false
            setIsHomed(false) // Reset homing state on new connection
          }
        })
      }
      
      // If socket was just connected, give it a moment to initialize
      if (!socketService.isConnected()) {
        setTimeout(attemptConnection, 100)
      } else {
        attemptConnection()
      }
    }
  }, [settings, isConnected, isConnecting, connectedPort, showErrorNotification])
  
  // Flash status when action attempted while disconnected
  const flashStatus = useCallback(() => {
    // Trigger flash animation: 150ms ramp up, 3x 50ms flash, 150ms ramp down (450ms total)
    setIsFlashing(true)
    setTimeout(() => {
      setIsFlashing(false)
    }, 450)
  }, [])
  
  // Handle Home button - transitions to post-home after successful homing
  const handleHome = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot home: not connected')
      flashStatus()
      return
    }
    setHomingInProgress(true)
    homingInProgressRef.current = true
    sendCommand('homing')
    // Note: actual transition to post-home happens when we receive homing completion from controller
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Reset button - goes to pre-home state
  const handleReset = useCallback(() => {
    if (!connectedPort) return
    sendCommand('reset')
    setMachineStatus('connected_pre_home')
    isHomedRef.current = false
    setIsHomed(false) // Reset homing state after reset
    setHomingInProgress(false)
    homingInProgressRef.current = false
    setIsJobRunning(false)
  }, [connectedPort, sendCommand])
  
  // Handle Unlock button (clears alarms) - goes to pre-home state after unlock
  const handleUnlock = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot unlock: not connected')
      flashStatus()
      return
    }
    sendCommand('unlock')
    // After unlock, transition to pre-home (position might not be trusted)
    setMachineStatus('connected_pre_home')
    isHomedRef.current = false
    setIsHomed(false)
    setHomingInProgress(false)
    homingInProgressRef.current = false
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle E-Stop button (emergency stop - force stop all motion)
  const handleEStop = useCallback(() => {
    if (!connectedPort) return
    
    // Stop workflow first (with force option)
    sendCommand('gcode:stop', { force: true })
    
    // Always send reset command to Grbl (sends Ctrl-X) regardless of state
    // This ensures E-Stop always sends something to the machine
    sendCommand('reset')
    
    // E-Stop should stop any running job
    setIsJobRunning(false)
    // Reset homing state after E-Stop (machine position may be invalid)
    isHomedRef.current = false
    setIsHomed(false)
    setHomingInProgress(false)
    homingInProgressRef.current = false
    setMachineStatus('connected_pre_home')
    // Clear hold state on E-Stop
    setHoldReason(null)
  }, [connectedPort, sendCommand])
  
  // Handle Resume button (sends ~ to resume from hold and resets feeder/sender state)
  const handleResume = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot resume: not connected')
      flashStatus()
      return
    }
    // Send gcode:resume command (sends ~ AND resets feeder/sender hold state)
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
    setIsJobRunning(false)
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
      
      setIsConnected(true)
      setConnectedPort(data.port)
      setIsConnecting(false)
      
      // On initial connection, backend will send current state via:
      // - controller:state (activeState, positions, etc.)
      // - feeder:status (hold state, hold reason)
      // - sender:status (hold state, hold reason)
      // - workflow:state (running/idle/paused)
      // Don't reset state here - wait for those events to set the truth
      // If this is a new connection (not page refresh), state will be reset below
      if (!hasReceivedInitialStateRef.current) {
        // Wait for initial state from backend
        // State will be set by controller:state, feeder:status, sender:status, workflow:state events
        // Set a default status that will be overridden by actual state
        setMachineStatus('connected_pre_home')
      }
    }
    
    const handleSerialPortClose = (..._args: unknown[]) => {
      // Args may contain port info, but we don't need it for cleanup
      setIsConnected(false)
      setConnectedPort(null)
      setIsConnecting(false)
      setMachineStatus('not_connected')
      isHomedRef.current = false
      setIsHomed(false)
      setHomingInProgress(false)
      homingInProgressRef.current = false
      setIsJobRunning(false)
      setSpindleState('M5')
      setSpindleSpeed(0)
    }
    
    const handleSocketError = (...args: unknown[]) => {
      const error = args[0]
      console.error('Socket error:', error)
      setIsConnecting(false)
      setMachineStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'Socket connection error occurred'
      showErrorNotification('Socket Error', errorMessage)
    }
    
    // Listen for controller state changes to detect alarm, running, and homing states
    // This is called on initial connection (page refresh) AND on state changes
    const handleControllerState = (...args: unknown[]) => {
      // Backend sends: controller:state(GRBL, state)
      // State structure: { status: { activeState: 'Idle'|'Run'|'Alarm'|... }, parserstate: {...} }
      // Note: args[0] is controllerType (e.g., 'GRBL'), but we don't need it for state processing
      const state = args[1] as { 
        status?: {
          activeState?: string
          mpos?: { x?: string; y?: string; z?: string }
          wpos?: { x?: string; y?: string; z?: string }
          pinState?: string // Grbl v1.1: 'P' indicates probe triggered, e.g., 'PZ' = probe + Z limit
        }
        parserstate?: {
          modal?: {
            wcs?: string
            spindle?: string // 'M3', 'M4', or 'M5'
          }
          spindle?: string // Speed value as string (e.g., "1000.0")
        }
      }
      
      // Update positions
      if (state.status?.mpos) {
        setMachinePosition({
          x: parseFloat(state.status.mpos.x || '0'),
          y: parseFloat(state.status.mpos.y || '0'),
          z: parseFloat(state.status.mpos.z || '0')
        })
      }
      if (state.status?.wpos) {
        setWorkPosition({
          x: parseFloat(state.status.wpos.x || '0'),
          y: parseFloat(state.status.wpos.y || '0'),
          z: parseFloat(state.status.wpos.z || '0')
        })
      }
      
      // Update WCS from parserstate
      if (state.parserstate?.modal?.wcs) {
        setCurrentWCS(state.parserstate.modal.wcs)
      }
      
      // Update spindle state from parserstate
      if (state.parserstate?.modal?.spindle) {
        const spindle = state.parserstate.modal.spindle
        if (spindle === 'M3' || spindle === 'M4' || spindle === 'M5') {
          setSpindleState(spindle)
        }
      }
      
      // Update probe contact status from pinState (Grbl v1.1)
      // pinState contains 'P' when probe is triggered
      if (state.status?.pinState !== undefined) {
        const pinState = state.status.pinState || ''
        setProbeContact(pinState.includes('P'))
      }
      
      // Update spindle speed from parserstate
      if (state.parserstate?.spindle !== undefined) {
        const speed = parseFloat(state.parserstate.spindle || '0')
        setSpindleSpeed(speed)
      }
      
      // Only update status if we're actually connected
      if (!isConnectedRef.current) return
      
      // Mark that we've received initial state from backend (for page refresh handling)
      hasReceivedInitialStateRef.current = true
      
      // Extract activeState from nested structure
      const activeState = state.status?.activeState || ''
      const isAlarm = activeState === 'Alarm'
      const isHold = activeState === 'Hold'
      const isHoming = activeState === 'Home'
      const isIdle = activeState === 'Idle'
      
      // Check if homing completed FIRST - when we transition from 'Home' state to 'Idle'
      // This must run before the status update logic to avoid race conditions
      let homingJustCompleted = false
      // Check if we're idle and homing was in progress - this indicates homing completed
      // We check homingInProgressRef to detect the transition from Home to Idle
      if (isIdle && !isHoming && homingInProgressRef.current && !isHomedRef.current && isConnectedRef.current) {
        // Homing was in progress and now we're idle - homing completed
        isHomedRef.current = true
        setIsHomed(true)
        setHomingInProgress(false)
        homingInProgressRef.current = false
        setMachineStatus('connected_post_home')
        homingJustCompleted = true
      } else if (isIdle && !isHoming && !homingInProgressRef.current && !isHomedRef.current) {
        // Reset homing progress flag if we're idle without homing active
        setHomingInProgress(false)
      }
      
      // Priority: Alarm > Hold > Running (from workflow) > Idle (post-home) > Idle (pre-home)
      // Note: Running state is handled by workflow:state, not controller:state
      // Don't override running/hold status unless we get an alarm
      // Use isHomedRef to avoid stale closure issues
      // Don't override status if homing just completed (already set above)
      // Note: Hold from controller:state is complementary to sender:status hold
      //       sender:status provides hold reason (M0, M6, etc.), controller:state confirms Hold state
      if (isAlarm) {
        // Check current status before updating - this is the "previous" value for transition detection
        const currentStatus = machineStatusRef.current
        const isTransitioningToAlarm = currentStatus !== 'alarm'
        
        setMachineStatus('alarm')
        setIsJobRunning(false)
        // Clear hold on alarm
        setHoldReason(null)
        
        // Show notification when transitioning TO alarm state (not when already in alarm)
        if (isTransitioningToAlarm) {
          // Try to get alarm message from ref (updated by VisualizerPanel when serialport:read events arrive)
          let alarmMessage = lastAlarmMessageRef.current
          
          // If still no message found, wait a short time for the alarm message to arrive via serialport:read
          // This handles the case where controller:state arrives before serialport:read
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
      } else if (isHold) {
        // Grbl reports Hold state - set machine status to hold
        // If we already have hold reason from sender:status, keep it
        // If not, we still show hold status (reason might come later)
        setMachineStatus('hold')
        setIsJobRunning(true) // Job is still running, just paused
      } else if (!isJobRunning && !homingJustCompleted && machineStatus !== 'hold') {
        // Only update status if workflow is not running, not in hold, and homing didn't just complete
        // Workflow running state takes priority over controller idle state
        // Hold state takes priority over idle state
        if (isIdle && isHomedRef.current) {
          // Idle after homing = post-home ready
          setMachineStatus('connected_post_home')
        } else if (isHoming) {
          // Homing in progress - stay in pre-home until complete
          setMachineStatus('connected_pre_home')
        } else if (isIdle && !isHomedRef.current) {
          // Idle but not homed = pre-home
          setMachineStatus('connected_pre_home')
        }
      } else if (isIdle && machineStatus === 'hold' && !isHold) {
        // If we were in hold and now we're idle (not hold), clear hold state
        // This handles the case where hold is cleared (e.g., after resume)
        setHoldReason(null)
        // Let workflow/controller determine the new status
        if (isHomedRef.current) {
          setMachineStatus('connected_post_home')
        } else {
          setMachineStatus('connected_pre_home')
        }
      } else if (isHold && machineStatus !== 'hold') {
        // Controller shows Hold but UI doesn't - set hold state
        // (holdReason will be set by sender:status or feeder:status if available)
        setMachineStatus('hold')
        setIsJobRunning(true)
      } else if (!isHold && machineStatus === 'hold') {
        // Controller no longer shows Hold but UI does - clear hold state
        setHoldReason(null)
        if (isHomedRef.current) {
          setMachineStatus('connected_post_home')
        } else {
          setMachineStatus('connected_pre_home')
        }
      }
    }
    
    // Listen for workflow state to detect running jobs
    const handleWorkflowState = (...args: unknown[]) => {
      const workflowState = args[0] as string
      if (typeof workflowState !== 'string') return
      
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      // workflowState is 'idle', 'running', or 'paused'
      // Note: Don't override hold status - hold takes priority
      // Use functional setState to check current status
      setMachineStatus((currentStatus) => {
        if (currentStatus === 'hold') {
          // Hold takes priority - don't change status
          if (workflowState === 'running') {
            setIsJobRunning(true)
          }
          return currentStatus
        }
        
        if (workflowState === 'running') {
          setIsJobRunning(true)
          return 'running'
        } else {
          setIsJobRunning(false)
          // When workflow stops (idle or paused), let controller state determine the status
          // The controller state handler will set the appropriate status
          return currentStatus // Keep current status, controller will update it
        }
      })
    }
    
    // Listen for sender status to detect hold state (for loaded G-code files)
    const handleSenderStatus = (...args: unknown[]) => {
      const senderData = args[0] as {
      hold?: boolean
      holdReason?: { data?: string; msg?: string; err?: boolean }
      name?: string
      size?: number
      total?: number
      sent?: number
      received?: number
      }
      if (!senderData || typeof senderData !== 'object') return
      
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      if (senderData.hold && senderData.holdReason) {
        // Machine is in hold state (from sender - loaded G-code files)
        setHoldReason(senderData.holdReason)
        setMachineStatus('hold')
        setIsJobRunning(true) // Job is still running, just paused
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
        isHomedRef.current = true
        setIsHomed(true)
        setHomingInProgress(false)
        homingInProgressRef.current = false
        setMachineStatus('connected_post_home')
      }
    }
    
    const handleSocketDisconnect = (...args: unknown[]) => {
      const reason = args[0]
      if (isConnected) {
        setIsConnected(false)
        setConnectedPort(null)
        setMachineStatus('not_connected')
        isHomedRef.current = false
        setIsHomed(false)
        setIsJobRunning(false)
        setSpindleState('M5')
        setSpindleSpeed(0)
        const reasonStr = typeof reason === 'string' ? reason : 'Connection lost'
        showErrorNotification('Connection Lost', `Socket disconnected: ${reasonStr}`)
      }
    }
    
    socketService.on('serialport:open', handleSerialPortOpen)
    socketService.on('serialport:close', handleSerialPortClose)
    socketService.on('error', handleSocketError)
    socketService.on('disconnect', handleSocketDisconnect)
    socketService.on('controller:state', handleControllerState)
    socketService.on('workflow:state', handleWorkflowState)
    socketService.on('sender:status', handleSenderStatus)
    socketService.on('feeder:status', handleFeederStatus)
    socketService.on('controller:homing', handleHomingComplete)
    socketService.on('grbl:homing', handleHomingComplete) // Grbl-specific
    socketService.on('marlin:homing', handleHomingComplete) // Marlin-specific
    
    
    return () => {
      socketService.off('serialport:open', handleSerialPortOpen)
      socketService.off('serialport:close', handleSerialPortClose)
      socketService.off('error', handleSocketError)
      socketService.off('disconnect', handleSocketDisconnect)
      socketService.off('controller:state', handleControllerState)
      socketService.off('workflow:state', handleWorkflowState)
      socketService.off('sender:status', handleSenderStatus)
      socketService.off('feeder:status', handleFeederStatus)
      socketService.off('controller:homing', handleHomingComplete)
      socketService.off('grbl:homing', handleHomingComplete)
      socketService.off('marlin:homing', handleHomingComplete)
    }
  }, [showErrorNotification, isConnected])
  
  // Listen to machine:status events from backend (single source of truth)
  useEffect(() => {
    const socket = socketService.getSocket()
    if (!socket) {
      return
    }


    const handleMachineStatus: (...args: unknown[]) => void = (...args) => {
      const port = args[0] as string
      const status = args[1] as MachineStatusType
      if (typeof port !== 'string' || !status || typeof status !== 'object') return

      // Update backend status
      setBackendMachineStatus(status)

      // Only update local state if this is for the configured port
      if (status.port === settings?.connection?.port) {
        
        setIsConnected(status.connected)
        setConnectedPort(status.connected ? status.port : null)
        setMachineStatus(status.machineStatus)
        setIsHomed(status.isHomed)
        isHomedRef.current = status.isHomed
        setIsJobRunning(status.isJobRunning)
        
        if (status.controllerState) {
          setMachinePosition({
            x: parseFloat(status.controllerState.mpos?.x || '0'),
            y: parseFloat(status.controllerState.mpos?.y || '0'),
            z: parseFloat(status.controllerState.mpos?.z || '0')
          })
          setWorkPosition({
            x: parseFloat(status.controllerState.wpos?.x || '0'),
            y: parseFloat(status.controllerState.wpos?.y || '0'),
            z: parseFloat(status.controllerState.wpos?.z || '0')
          })
        }
      }
    }

    socket.on('machine:status', handleMachineStatus)

    // Request current status on mount
    if (settings?.connection?.port) {
      socket.emit('machine:status:request', settings.connection.port)
    } else {
      socket.emit('machine:status:request')
    }

    return () => {
      socket.off('machine:status', handleMachineStatus)
    }
  }, [settings?.connection?.port])

  // Separate effect to restore connection state when component mounts or controllers data loads
  // This handles both navigation back (socket connected) and hard refresh (socket not connected yet)
  // NOTE: This is a fallback - the machine:status Socket.IO events should be the primary source
  useEffect(() => {
    // If we already have backend machine status, use that instead
    if (backendMachineStatus && backendMachineStatus.connected && backendMachineStatus.port === settings?.connection?.port) {
      setIsConnected(backendMachineStatus.connected)
      setConnectedPort(backendMachineStatus.port)
      setMachineStatus(backendMachineStatus.machineStatus)
      setIsHomed(backendMachineStatus.isHomed)
      isHomedRef.current = backendMachineStatus.isHomed
      setIsJobRunning(backendMachineStatus.isJobRunning)
      return
    }
    
    const checkAndRestore = () => {
      
      // Only run if we're not already connected
      if (isConnected) {
        return
      }
      
      // If we manually disconnected, don't restore
      if (manuallyDisconnectedRef.current) {
        return
      }
      
      // Try to get machine status from API first (more reliable than controllers)
      if (settings?.connection?.port) {
        getMachineStatus({ port: settings.connection.port })
          .unwrap()
          .then((response) => {
            if (response.status && response.status.connected) {
              const status = response.status
              
              setIsConnected(true)
              setConnectedPort(status.port)
              setMachineStatus(status.machineStatus)
              setIsHomed(status.isHomed)
              isHomedRef.current = status.isHomed
              setIsJobRunning(status.isJobRunning)
              
              // Store backend status so restore effect can use it
              setBackendMachineStatus(status)
              
              // Join port room ONLY if socket is connected
              // The backend should preserve state when joining an existing connection
              // Request status via Socket.IO instead of calling open
              const socket = socketService.getSocket()
              if (socket?.connected) {
                // Request current status via Socket.IO (backend will preserve state)
                socket.emit('machine:status:request', status.port)
                
                // Also join the port room to receive console events
                // But only if we haven't already joined (to avoid triggering serialport:open)
                // Actually, we need to join the room - but the backend should handle this gracefully
                // The backend's handleSerialPortOpen now preserves state, so this should be safe
                const connectionOptions = settings.connection ? {
                  controllerType: settings.connection.controllerType || 'Grbl',
                  baudrate: settings.connection.baudRate || 115200,
                  rtscts: settings.connection.rtscts || false,
                } : {
                  controllerType: 'Grbl',
                  baudrate: 115200,
                  rtscts: false,
                }
                
                socket.emit('open', status.port, connectionOptions, (err: Error | null) => {
                  if (!err) {
                    // Request status again after joining to ensure we have latest
                    setTimeout(() => {
                      socket.emit('machine:status:request', status.port)
                    }, 100)
                    
                    // Force a status report to trigger console events and verify listeners are working
                    setTimeout(() => {
                      socket.emit('command', status.port, 'statusreport')
                    }, 200)
                  } else {
                    console.error('[Setup] Error joining port room:', err)
                  }
                })
              } else {
              }
            }
          })
          .catch((err) => {
            console.warn('[Setup] Failed to get machine status from API, falling back to controllers:', err)
            // Fall through to controllers-based restore
            restoreFromControllers()
          })
        return
      }
      
      // Fallback: restore from controllers data (old method)
      restoreFromControllers()
    }

    const restoreFromControllers = () => {
      // Wait for controllers data to be available
      if (!controllersData) {
        return
      }
      
      const controllers = controllersData || []
      if (controllers.length > 0) {
        const activeController = controllers[0]
        const port = activeController.port
        if (!port) {
          return
        }
        
        setIsConnected(true)
        setConnectedPort(port)
        
        // Use homed flag from backend controller
        const isHomed = activeController.homed === true
        const controllerState = activeController.controller?.state as { status?: { activeState?: string } } | undefined
        
        if (controllerState?.status?.activeState === 'Alarm') {
          setMachineStatus('alarm')
          setIsHomed(false)
        } else if (isHomed) {
          setMachineStatus('connected_post_home')
          setIsHomed(true)
        } else {
          setMachineStatus('connected_pre_home')
          setIsHomed(false)
        }
        isHomedRef.current = isHomed
        
        // Join port room
        const socket = socketService.getSocket()
        if (socket?.connected) {
          const connectionOptions = {
            controllerType: activeController.controller?.type || 'Grbl',
            baudrate: activeController.baudrate || 115200,
            rtscts: activeController.rtscts || false,
          }
          socket.emit('open', port, connectionOptions)
        }
      }
    }
    
    // Check immediately on mount
    checkAndRestore()
      
    // Also check when controllersData changes (in case it loads after mount)
  }, [controllersData, isConnected, connectedPort, settings?.connection?.port, backendMachineStatus, getMachineStatus])
  
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
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }
  
  const togglePanel = (panelId: string) => {
    setCollapsedPanels(prev => ({ ...prev, [panelId]: !prev[panelId] }))
  }

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
          <Button variant="ghost" size="sm">Monitor</Button>
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
      <div className="h-12 border-b border-border bg-muted/30 flex items-center px-4 gap-2">
        <span className="text-sm text-muted-foreground mr-2">Machine:</span>
        {/* Machine status - rectangular badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={`
                  relative px-3 py-1.5 rounded border flex items-center gap-2 min-w-[140px] justify-center
                  transition-all duration-200
                  ${
                    machineStatus === 'connected_post_home' || machineStatus === 'running'
                      ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' 
                      : machineStatus === 'connected_pre_home'
                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
                      : machineStatus === 'hold'
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400'
                      : machineStatus === 'alarm'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                      : machineStatus === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                      : 'bg-muted border-border text-muted-foreground'
                  }
                `}
                style={isFlashing ? {
                  animation: 'flash-bright 450ms ease-in-out'
                } : {}}
              >
                <div 
                  className={`
                    w-2 h-2 rounded-full
                    ${
                      machineStatus === 'connected_post_home' || machineStatus === 'running'
                        ? 'bg-green-500' 
                        : machineStatus === 'connected_pre_home'
                        ? 'bg-yellow-500'
                        : machineStatus === 'hold'
                        ? 'bg-orange-500'
                        : machineStatus === 'alarm' || machineStatus === 'error'
                        ? 'bg-red-500'
                        : 'bg-zinc-500'
                    }
                  `} 
                />
                <span className="text-xs font-medium pr-3">
                  {machineStatus === 'not_connected'
                    ? 'Not connected'
                    : machineStatus === 'connected_pre_home'
                    ? 'Ready (Run Home)'
                    : machineStatus === 'connected_post_home'
                    ? 'Ready'
                    : machineStatus === 'alarm'
                    ? 'Alarm'
                    : machineStatus === 'running'
                    ? 'Busy'
                    : machineStatus === 'hold'
                    ? 'Hold'
                    : machineStatus === 'error'
                    ? 'Error'
                    : 'Unknown'}
                </span>
                {/* Help icon in top right */}
                <HelpCircle className="absolute top-0.5 right-0.5 w-3 h-3 text-white cursor-help" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">
                {machineStatus === 'not_connected'
                  ? 'AxioCNC is not connected to your machine.'
                  : machineStatus === 'connected_pre_home'
                  ? 'Your machine is connected, but AxioCNC can\'t verify that the displayed position matches the physical machine. Home your machine to establish truth of position.'
                  : machineStatus === 'connected_post_home'
                  ? 'Your machine is connected and ready.'
                  : machineStatus === 'hold'
                  ? 'Your machine is paused and motion is disabled for safety. This can happen during a tool change, or because a job was paused. Click Resume to enable machine motion.'
                  : machineStatus === 'alarm'
                  ? 'The machine is in an error state and motion has been disabled. Hit Reset to clear the alarm. If the machine is still in alarm state after a reset, it may need to be unlocked to complete the reset. In all cases, the machine should be rehomed after clearing the alarm to establish truth of position. AxioCNC can\'t verify that the displayed position matches the physical machine until it is rehomed.'
                  : machineStatus === 'running'
                  ? 'Your machine is running a job.'
                  : machineStatus === 'error'
                  ? 'An error has occurred.'
                  : 'Unknown machine status.'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Action buttons - context-aware based on machine status */}
        {machineStatus === 'hold' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="default" size="sm" onClick={handleResume}>
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
            <Button variant="outline" size="sm" onClick={handleStop}>
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          </>
        )}
        
        {machineStatus === 'not_connected' && (
          <div className="ml-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        )}
        
        {/* Connected pre-home: Yellow Ready (Run Home) - Show Disconnect and Home */}
        {machineStatus === 'connected_pre_home' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleHome}>
              <Home className="w-4 h-4 mr-1" /> Run Home
            </Button>
          </>
        )}
        
        {/* Connected post-home: Green Ready - Show Disconnect and Home */}
        {machineStatus === 'connected_post_home' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleHome}>
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          </>
        )}
        
        {/* Running: Green Busy - Show Disconnect and Home */}
        {machineStatus === 'running' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleHome} disabled>
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          </>
        )}
        
        {/* Alarm: Red Alarm - Show Unlock and Home */}
        {machineStatus === 'alarm' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleUnlock}>
              <Unlock className="w-4 h-4 mr-1" /> Unlock
            </Button>
            <Button variant="outline" size="sm" onClick={handleHome}>
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          </>
        )}
        
        <div className="flex-1" />
        
        <div className="w-px h-6 bg-border mx-2" />
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">Job:</span>
          <Button variant="outline" size="sm">
            <Play className="w-4 h-4 mr-1" /> Start
          </Button>
          <Button variant="outline" size="sm">
            <Pause className="w-4 h-4 mr-1" /> Pause
          </Button>
        </div>
      </div>
      
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
                {panelOrder.map((panelId) => (
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
                      spindleSpeed
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
