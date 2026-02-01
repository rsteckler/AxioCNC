import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation } from 'react-router-dom'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { socketService } from '@/services/socket'
import { track } from '@/services/analytics'
import { useGetSettingsQuery, useGetExtensionsQuery, useSetSettingsMutation, useGetCurrentVersionQuery } from '@/services/api'
// useGetControllersQuery not currently used but may be needed in future
import type { ZeroingMethod } from '../../../../shared/src/schemas/settings'
import { useGcodeCommand, useJoystickInput, useGitHubVersion, compareVersions } from '@/hooks'
import { 
  useMachineState, 
  useJobState, 
  useAppDispatch,
  useIsConnected,
  useConnectedPort,
  useIsHomed,
  useIsJobRunning,
  useWorkflowState,
  useMachinePosition,
  useWorkPosition,
  useSpindleState,
  useSpindleSpeed,
} from '@/store/hooks'
import { machineStateSync } from '@/services/machineStateSync'
import { setConnecting, setFlashing } from '@/store/machineSlice'
import type { MachineReadinessStatus } from '@/types/machine'
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
  Square, 
  Crosshair, RotateCcw, RotateCw, GripVertical,
  Zap, Target, FileCode, ClipboardList,
  Move, Navigation,
  Camera, Gamepad2, Bug,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MachineActionButton } from '@/components/MachineActionButton'
import { PageStatusBar } from '@/components/PageStatusBar'
import { ActionRequirements } from '@/utils/machineState'

// Import extracted panels - explicit imports for Vite compatibility
import { DROPanel } from './panels/DROPanel'
import { JogPanel } from './panels/JogPanel'
import { JobSetupPanel } from './panels/JobSetupPanel'
import { ProbePanel } from './panels/ProbePanel'
import { MacrosPanel } from './panels/MacrosPanel'
import { SpindlePanel } from './panels/SpindlePanel'
import { ZeroingMethodSelectDialog } from '@/components/ZeroingMethodSelectDialog'
import { UpdateNotificationDialog } from '@/components/UpdateNotificationDialog'
import { NotificationSystem } from '@/components/NotificationSystem'
import { SetupTutorialDialog } from '@/components/SetupTutorialDialog'
import { useNotifications } from '@/hooks/useNotifications'
import { RapidPanel } from './panels/RapidPanel'
import { FilePanel } from './panels/FilePanel'
import { ToolsPanel } from './panels/ToolsPanel'
import { VisualizerPanel } from './panels/VisualizerPanel'
import { CameraPanel } from './panels/CameraPanel'
import { JoystickPanel } from './panels/JoystickPanel'
import { DebugPanel } from './panels/DebugPanel'
import type { PanelProps } from './types'

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

// Panel configuration with metadata - will be created inside component to use i18n
const createPanelConfig = (t: (key: string) => string): Record<string, { 
  title: string
  icon: React.ElementType
  component: React.FC<PanelProps>
}> => ({
  dro: { title: t('Position'), icon: Crosshair, component: DROPanel },
  jog: { title: t('Jog Control'), icon: Move, component: JogPanel },
  rapid: { title: t('Rapid'), icon: Navigation, component: RapidPanel },
  jobSetup: { title: t('Job setup'), icon: ClipboardList, component: JobSetupPanel },
  probe: { title: t('Probe'), icon: Target, component: ProbePanel },
  macros: { title: t('Macros'), icon: Zap, component: MacrosPanel },
  file: { title: t('File'), icon: FileCode, component: FilePanel },
  spindle: { title: t('Spindle'), icon: RotateCw, component: SpindlePanel },
  camera: { title: t('Camera'), icon: Camera, component: CameraPanel },
  joystick: { title: t('Joystick'), icon: Gamepad2, component: JoystickPanel },
  debug: { title: t('Debug'), icon: Bug, component: DebugPanel },
})

// Sortable Panel Component
function SortablePanel({ 
  id, 
  isCollapsed, 
  onToggle,
  panelProps,
  onStartWizard,
  onOpenJobSetupPanel,
  panelConfig
}: { 
  id: string
  isCollapsed: boolean
  onToggle: () => void
  panelProps: PanelProps
  onStartWizard?: (method: ZeroingMethod) => void
  onOpenJobSetupPanel?: () => void
  panelConfig: ReturnType<typeof createPanelConfig>
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
          id === 'jobSetup' && onOpenJobSetupPanel ? (
            <JobSetupPanel {...panelProps} onSetUpJob={onOpenJobSetupPanel} />
          ) : id === 'probe' && onStartWizard ? (
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
function DragOverlayPanel({ id, isCollapsed, panelProps, panelConfig }: { id: string; isCollapsed: boolean; panelProps: PanelProps; panelConfig: ReturnType<typeof createPanelConfig> }) {
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Create panel config with translations
  const panelConfig = createPanelConfig(t)
  
  // Get connection settings from API
  const { data: settings } = useGetSettingsQuery()
  const [setSettings] = useSetSettingsMutation()
  
  // Get current version from API
  const { data: currentVersionData, isLoading: isLoadingCurrentVersion } = useGetCurrentVersionQuery()
  const currentVersion = currentVersionData?.version ?? '0.0.0'
  
  // Get latest version from GitHub (only if automatic updates are enabled)
  const checkForUpdates = settings?.firstUse?.checkForUpdates ?? true
  const { latestVersion: gitHubLatestVersion, releaseUrl } = useGitHubVersion()
  
  // Get advanced config (for debug mode)
  const { data: extensionsData } = useGetExtensionsQuery({ key: 'advanced' })
  const debugMode = extensionsData && typeof extensionsData === 'object' && 'debugMode' in extensionsData
    ? (extensionsData as { debugMode?: boolean }).debugMode ?? false
    : false

  const [isTutorialOpen, setIsTutorialOpen] = useState(false)
  const hasShownTutorialRef = useRef(false)
  
  // Update notification dialog state
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false)
  const hasShownUpdateRef = useRef(false)
  const hideSetupTutorial = settings?.firstUse?.hideSetupTutorial ?? false
  const shouldForceShowTutorial = Boolean(
    (location.state as { showSetupTutorial?: boolean } | null)?.showSetupTutorial
  )

  const handleTutorialOpenChange = useCallback((open: boolean) => {
    setIsTutorialOpen(open)
    
    // When closing the dialog, mark it as seen so it doesn't show again
    if (!open && !hideSetupTutorial) {
      setSettings({ firstUse: { hideSetupTutorial: true } })
        .unwrap()
        .catch((error) => {
          console.error('Failed to update tutorial setting:', error)
        })
    }
  }, [hideSetupTutorial, setSettings])

  useEffect(() => {
    if (shouldForceShowTutorial) {
      setIsTutorialOpen(true)
      hasShownTutorialRef.current = true
      sessionStorage.setItem('axiocnc-setup-tutorial-shown', 'true')
      navigate(location.pathname, { replace: true, state: null })
      return
    }

    if (!settings || hideSetupTutorial) {
      return
    }

    const hasShownInSession = sessionStorage.getItem('axiocnc-setup-tutorial-shown') === 'true'
    if (!hasShownTutorialRef.current && !hasShownInSession) {
      setIsTutorialOpen(true)
      hasShownTutorialRef.current = true
      sessionStorage.setItem('axiocnc-setup-tutorial-shown', 'true')
    }
  }, [settings, hideSetupTutorial, shouldForceShowTutorial, navigate, location.pathname])
  
  // Check for updates and show dialog once per session
  useEffect(() => {
    // Only check if automatic updates are enabled
    if (!checkForUpdates) {
      return
    }
    
    // Don't show if we've already shown it this session
    if (hasShownUpdateRef.current) {
      return
    }
    
    // Wait for current version query to finish loading
    if (isLoadingCurrentVersion) {
      return
    }
    
    // Wait for both current and latest version to be available
    // Also check that currentVersion is not the default fallback value "0.0.0"
    if (!currentVersion || currentVersion === '0.0.0' || !gitHubLatestVersion) {
      return
    }
    
    // Normalize versions (remove any 'v' prefix and trim whitespace)
    const normalizedCurrent = currentVersion.trim().replace(/^v/i, '')
    const normalizedLatest = gitHubLatestVersion.trim().replace(/^v/i, '')
    
    // Check if update is available (latest > current)
    // Only show dialog if latest version is strictly greater than current version
    const comparison = compareVersions(normalizedCurrent, normalizedLatest)
    const isUpdateAvailable = comparison < 0 && normalizedCurrent !== normalizedLatest
    
    if (isUpdateAvailable) {
      const hasShownInSession = sessionStorage.getItem('axiocnc-update-notification-shown') === 'true'
      if (!hasShownInSession) {
        setIsUpdateDialogOpen(true)
        hasShownUpdateRef.current = true
        sessionStorage.setItem('axiocnc-update-notification-shown', 'true')
      }
    }
  }, [checkForUpdates, currentVersion, gitHubLatestVersion, isLoadingCurrentVersion])
  
  // Panel order - just an array of IDs
  // Load from localStorage or use default
  // Store the last known position of joystick panel before it was removed
  const joystickPositionRef = useRef<number | null>(null)
  // Store the last known position of debug panel before it was removed
  const debugPositionRef = useRef<number | null>(null)

  const [panelOrder, setPanelOrder] = useState<string[]>(() => {
    const stored = localStorage.getItem('axiocnc-setup-panel-order')
    const validPanels = ['dro', 'jog', 'spindle', 'rapid', 'probe', 'file', 'macros', 'camera', 'joystick', 'debug', 'jobSetup']
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.every((id: string) => validPanels.includes(id))) {
          // Store joystick position if it exists in the saved order
          const joystickIndex = parsed.indexOf('joystick')
          if (joystickIndex !== -1) {
            joystickPositionRef.current = joystickIndex
          }
          // Ensure jobSetup is present: insert just before probe if missing (Phase 5 migration)
          if (!parsed.includes('jobSetup')) {
            const probeIndex = parsed.indexOf('probe')
            const insertAt = probeIndex >= 0 ? probeIndex : parsed.length
            return [...parsed.slice(0, insertAt), 'jobSetup', ...parsed.slice(insertAt)]
          }
          return parsed
        }
      } catch {
        // Invalid JSON, use default
      }
    }
    return ['dro', 'rapid', 'jog', 'file', 'jobSetup', 'probe', 'macros', 'spindle', 'camera']
  })
  
  // Add/remove joystick panel to order when joystick is enabled/disabled
  // Preserve its position when re-adding, default to after 'jog'
  useEffect(() => {
    if (settings?.joystick?.enabled && !panelOrder.includes('joystick')) {
      setPanelOrder(prev => {
        // If we have a saved position, restore it there
        if (joystickPositionRef.current !== null && joystickPositionRef.current < prev.length) {
          const newOrder = [...prev]
          newOrder.splice(joystickPositionRef.current, 0, 'joystick')
          return newOrder
        }
        // Otherwise insert after 'jog' (default position)
        const jogIndex = prev.indexOf('jog')
        if (jogIndex !== -1) {
          const newOrder = [...prev]
          newOrder.splice(jogIndex + 1, 0, 'joystick')
          return newOrder
        }
        // Fallback: add to end if 'jog' not found
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
  
  // Add/remove debug panel to order when debug mode is enabled/disabled
  // Preserve its position when re-adding, default to end
  useEffect(() => {
    if (debugMode && !panelOrder.includes('debug')) {
      setPanelOrder(prev => {
        // If we have a saved position, restore it there
        if (debugPositionRef.current !== null && debugPositionRef.current < prev.length) {
          const newOrder = [...prev]
          newOrder.splice(debugPositionRef.current, 0, 'debug')
          return newOrder
        }
        // Otherwise add to end (default position)
        return [...prev, 'debug']
      })
    } else if (!debugMode && panelOrder.includes('debug')) {
      setPanelOrder(prev => {
        // Save the position before removing
        const debugIndex = prev.indexOf('debug')
        if (debugIndex !== -1) {
          debugPositionRef.current = debugIndex
        }
        return prev.filter(id => id !== 'debug')
      })
    }
  }, [debugMode, panelOrder])
  
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
  
  // Extract values from Redux state using selectors
  const isConnected = useIsConnected()
  const connectedPort = useConnectedPort()
  const machineStatus = machineState.machineStatus
  const isHomed = useIsHomed()
  const isJobRunning = useIsJobRunning()
  const workflowState = useWorkflowState()
  const machinePosition = useMachinePosition()
  const workPosition = useWorkPosition()
  const spindleState = useSpindleState()
  const spindleSpeed = useSpindleSpeed()
  
  // UI-specific state (not in Redux)
  const [homingInProgress, setHomingInProgress] = useState(false)
  const [currentWCS, setCurrentWCS] = useState('G54') // Work Coordinate System
  
  // Probe status (from pinState - 'P' indicates probe contact)
  const [probeContact, setProbeContact] = useState<boolean>(false)
  
  // Wizard state (old single-method flow for Probe panel)
  const [wizardMethod, setWizardMethod] = useState<ZeroingMethod | null>(null)
  const [showMethodSelectDialog, setShowMethodSelectDialog] = useState(false)
  const [pendingJobStart, setPendingJobStart] = useState(false) // Track if we need to start job after wizard completes

  // Job setup wizard (Phase 5: plan + blocks; entry from panel or Run)
  const [jobSetupWizardOpen, setJobSetupWizardOpen] = useState(false)
  const [jobSetupPendingJobStart, setJobSetupPendingJobStart] = useState(false)

  // G-code command hook - must be declared before use in callbacks
  const { sendCommand } = useGcodeCommand(connectedPort)

  // Open Job Setup Wizard (from left-column panel or from Run). When pendingJobStart, onSetupComplete will close and start job.
  const handleOpenJobSetupWizard = useCallback((options: { pendingJobStart: boolean }) => {
    setJobSetupWizardOpen(true)
    setJobSetupPendingJobStart(options.pendingJobStart)
  }, [])

  const handleJobSetupWizardClose = useCallback(() => {
    setJobSetupWizardOpen(false)
    setJobSetupPendingJobStart(false)
  }, [])

  const handleJobSetupComplete = useCallback(() => {
    if (jobSetupPendingJobStart) {
      setJobSetupWizardOpen(false)
      setJobSetupPendingJobStart(false)
      const shouldSwitch = settings?.machine?.autoSwitchToMonitor ?? true
      if (shouldSwitch) {
        navigate('/monitor')
        setTimeout(() => {
          if (connectedPort) sendCommand('gcode:start')
        }, 100)
      } else {
        setTimeout(() => {
          if (connectedPort) sendCommand('gcode:start')
        }, 100)
      }
    }
  }, [jobSetupPendingJobStart, settings?.machine?.autoSwitchToMonitor, navigate, connectedPort, sendCommand])

  // Handler for starting single-method wizard from Probe panel (called by ProbePanel Run buttons)
  const handleStartWizard = useCallback((method: ZeroingMethod | 'ask' | null) => {
    if (method === 'ask') {
      setShowMethodSelectDialog(true)
      setPendingJobStart(true)
    } else if (method) {
      setWizardMethod(method)
      setPendingJobStart(true)
    }
  }, [])

  // Handle method selection from dialog
  const handleMethodSelect = useCallback((method: ZeroingMethod | 'skip') => {
    if (method === 'skip') {
      // Skip not applicable for initial setup - just close dialog
      setShowMethodSelectDialog(false)
      return
    }
    setShowMethodSelectDialog(false)
    setWizardMethod(method)
    // Switch to wizard tab is handled by VisualizerPanel when wizardMethod is set
  }, [])

  // Handle wizard close - start job if pending
  const handleWizardClose = useCallback(() => {
    setWizardMethod(null)
    // If we were starting a job, start it now that wizard is complete
    if (pendingJobStart) {
      setPendingJobStart(false)
      // Check if we should navigate to Monitor before starting
      const shouldSwitch = settings?.machine?.autoSwitchToMonitor ?? true // Default to true
      
      if (shouldSwitch) {
        // Navigate to Monitor first, then start job after navigation completes
        navigate('/monitor')
        // Small delay to ensure navigation completes before starting job
        setTimeout(() => {
          if (connectedPort) {
            sendCommand('gcode:start')
          }
        }, 100)
      } else {
        // Start job directly without navigation
        setTimeout(() => {
          if (connectedPort) {
            sendCommand('gcode:start')
          }
        }, 100)
      }
    }
  }, [pendingJobStart, connectedPort, sendCommand, settings, navigate])
  
  // Refs to track state in event handlers to avoid stale closures
  const machineStatusRef = useRef<MachineReadinessStatus>(machineStatus)
  machineStatusRef.current = machineStatus // Keep ref in sync
  const isConnectedRef = useRef(isConnected)
  isConnectedRef.current = isConnected
  const isHomedRef = useRef(isHomed)
  isHomedRef.current = isHomed
  const homingInProgressRef = useRef(homingInProgress)
  homingInProgressRef.current = homingInProgress
  const lastAlarmMessageRef = useRef<string | null>(null) // Track last alarm message from console
  
  // Get active controllers to check if we're already connected when remounting
  // Refetch on mount to ensure we have fresh data when navigating back
  // controllersData not currently used but may be needed in future
  // const { data: controllersData } = useGetControllersQuery(undefined, {
  //   refetchOnMountOrArgChange: true, // Always refetch when component mounts
  // })
  
  // Client-side joystick input hook
  useJoystickInput({
    enabled: settings?.joystick?.enabled ?? false,
    connectionLocation: settings?.joystick?.connectionLocation ?? 'server',
    selectedGamepadId: settings?.joystick?.selectedGamepad ?? null,
  })
  
  // Use shared notification system
  const { showErrorNotification } = useNotifications()
  
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
  }, [connectedPort, sendCommand])
  
  
  // Track if we've received initial state from backend (for page refresh)
  const hasReceivedInitialStateRef = useRef(false)
  
  // Track if we manually disconnected (to prevent restore after manual disconnect)
  const manuallyDisconnectedRef = useRef(false)
  
  // Track connection start time for duration calculation
  const connectionStartTimeRef = useRef<number | null>(null)
  
  // Listen for connection events and errors
  useEffect(() => {
    const handleSerialPortOpen = (...args: unknown[]) => {
      // data may be needed in future - keep args for now
      const data = args[0] as { port?: string; baudrate?: number; controllerType?: string } | undefined
      
      // Clear manual disconnect flag when we successfully connect
      manuallyDisconnectedRef.current = false
      
      // Machine state updates are handled by machineStateSync
      dispatch(setConnecting(false))
      
      // Track connection start time
      connectionStartTimeRef.current = Date.now()
      
      // Track controller connection
      try {
        // Use baudrate from event data if available, otherwise fall back to settings
        // Send the actual value even if it seems invalid - helps debug issues
        const baudRate = data?.baudrate ?? settings?.connection?.baudRate ?? null
        track('controller_connected', {
          controller_type: data?.controllerType || 'unknown',
          port: data?.port || connectedPort || 'unknown',
          baud_rate: baudRate,
        })
      } catch (analyticsError) {
        // Don't break connection if analytics fails
        if (import.meta.env.DEV) {
          console.warn('[Setup] Failed to track controller connection:', analyticsError)
        }
      }
    }
    
    const handleSerialPortClose = () => {
      // Machine state updates are handled by machineStateSync
      // Only update page-specific state
      setHomingInProgress(false)
      homingInProgressRef.current = false
      
      // Track controller disconnection
      try {
        const connectionStartTime = connectionStartTimeRef.current
        const duration = connectionStartTime ? Math.floor((Date.now() - connectionStartTime) / 1000) : 0
        
        track('controller_disconnected', {
          controller_type: settings?.controller?.type || 'unknown',
          port: connectedPort || 'unknown',
          duration,
        })
      } catch (analyticsError) {
        // Don't break disconnection if analytics fails
        if (import.meta.env.DEV) {
          console.warn('[Setup] Failed to track controller disconnection:', analyticsError)
        }
      }
    }
    
    const handleSocketError = (...args: unknown[]) => {
      const error = args[0]
      console.error('Socket error:', error)
      dispatch(setConnecting(false))
      const errorMessage = error instanceof Error ? error.message : t('Socket connection error occurred')
      showErrorNotification(t('Socket Error'), errorMessage)
    }
    
    // Listen for controller state changes to detect alarm, running, and homing states
    // This is called on initial connection (page refresh) AND on state changes
    const handleMachineStatus = (...args: unknown[]) => {
      // Backend sends: machine:status(port, status)
      // Status now includes full controller state including parserstate
      // port may be needed in future - keep args for now
      // const port = args[0] as string
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
      // isHold may be needed in future
      // const isHold = activeState === 'Hold'
      const isHoming = activeState === 'Home'
      const isIdle = activeState === 'Idle'
      
      // Check if homing completed FIRST - when we transition from 'Home' state to 'Idle'
      // This must run before the status update logic to avoid race conditions
      // homingJustCompleted may be needed for future features
      // let homingJustCompleted = false
      // Check if we're idle and homing was in progress - this indicates homing completed
      // We check homingInProgressRef to detect the transition from Home to Idle
      if (isIdle && !isHoming && homingInProgressRef.current && !isHomedRef.current && isConnectedRef.current) {
        // Homing was in progress and now we're idle - homing completed
        setHomingInProgress(false)
        homingInProgressRef.current = false
        // homingJustCompleted = true
      } else if (isIdle && !isHoming && !homingInProgressRef.current && !isHomedRef.current) {
        // Reset homing progress flag if we're idle without homing active
        setHomingInProgress(false)
      }
      
      // Page-specific: Show alarm notifications
      // Machine status updates are handled by machineStateSync, but we show notifications here
      if (isAlarm) {
        // Check current status before updating - this is the "previous" value for transition detection
        const currentStatus = machineStatusRef.current
        const isTransitioningToAlarm = currentStatus !== 'alarm'
        
        // Show notification when transitioning TO alarm state (not when already in alarm)
        if (isTransitioningToAlarm) {
          // Try to get alarm message from ref (updated by VisualizerPanel when serialport:read events arrive)
          const alarmMessage = lastAlarmMessageRef.current
          
          // If still no message found, wait a short time for the alarm message to arrive via serialport:read
          // This handles the case where machine:status arrives before serialport:read
          if (!alarmMessage) {
            // Wait up to 100ms for alarm message to arrive
            setTimeout(() => {
              const delayedMessage = lastAlarmMessageRef.current || t('Machine alarm triggered')
              showErrorNotification(t('Machine Alarm'), delayedMessage)
            }, 100)
          } else {
            // Message found immediately, show notification right away
            showErrorNotification(t('Machine Alarm'), alarmMessage)
          }
        }
      }
    }
    
    // Listen for workflow state - machine state is handled by machineStateSync
    // This handler is kept for page-specific logic if needed
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleWorkflowState = (..._args: unknown[]) => {
      // Machine state updates are handled by machineStateSync
      // Keep this handler for any page-specific logic if needed
    }
    
    // Listen for sender status - machine state is handled by machineStateSync
    // This handler is kept for potential page-specific logic
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const handleSenderStatus = (..._args: unknown[]) => {
      // Sender status is handled by machineStateSync for global state
      // No page-specific logic needed at this time
    }
    
    // Listen for feeder status - marks that we've received initial state from backend
    // This is called on initial connection (page refresh) AND on state changes
    const handleFeederStatus = () => {
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      // Mark that we've received initial state from backend
      hasReceivedInitialStateRef.current = true
    }
    
    // Listen for homing completion (controller-specific events)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      if (isConnectedRef.current) {
        // Machine state updates are handled by machineStateSync
        // Only show notification (page-specific)
        const reasonStr = typeof reason === 'string' ? reason : t('Connection lost')
        showErrorNotification(t('Connection Lost'), t('Socket disconnected: {{reason}}', { reason: reasonStr }))
      }
    }
    
    // Note: machine:status is handled by machineStateSync for global state
    // We listen here for page-specific logic (WCS, probe, notifications, hold reason)
    // Note: machineStateSync notifications are handled by NotificationSystem component
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
  }, [dispatch, flashStatus, showErrorNotification]) // dispatch and flashStatus are stable, showErrorNotification from hook
  
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
          <Button variant="default" size="sm">{t('Setup')}</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/monitor')}>{t('Monitor')}</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/stats')}>{t('Stats')}</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>{t('Settings')}</Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://axiocnc.com/docs" target="_blank" rel="noopener noreferrer">
              {t('Docs')}
            </a>
          </Button>
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Notifications button */}
        <NotificationSystem />
        
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
            {t('Reset')}
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
            {t('E-Stop')}
          </MachineActionButton>
        </div>
      </header>
      
      {/* Setup control bar - screen-specific controls */}
      <PageStatusBar
        onError={showErrorNotification}
        workflowState={workflowState}
        isJobRunning={isJobRunning}
        connectedPort={connectedPort}
        isConnected={isConnected}
        machineStatus={machineStatus}
        onFlashStatus={flashStatus}
        disabled={!isConnected || machineStatus === 'alarm'}
        hasFile={!!jobState?.name}
        onStartWizard={handleStartWizard}
        onOpenJobSetupWizard={handleOpenJobSetupWizard}
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
                    // Filter out debug panel if debug mode is not enabled
                    if (panelId === 'debug') {
                      return debugMode
                    }
                    return true
                  })
                  .map((panelId) => (
                    <SortablePanel
                      key={panelId}
                      id={panelId}
                      isCollapsed={collapsedPanels[panelId] ?? false}
                      onToggle={() => togglePanel(panelId)}
                      panelConfig={panelConfig}
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
                      onOpenJobSetupPanel={() => {
                        setJobSetupWizardOpen(true)
                        setJobSetupPendingJobStart(false)
                      }}
                    />
                  ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <DragOverlayPanel 
                  id={activeId} 
                  isCollapsed={collapsedPanels[activeId] ?? false}
                  panelConfig={panelConfig}
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
              onWizardClose={handleWizardClose}
              machinePosition={machinePosition}
              workPosition={workPosition}
              probeContact={probeContact}
              lastAlarmMessageRef={lastAlarmMessageRef}
              currentWCS={currentWCS}
              senderState={jobState}
              jobSetupWizardOpen={jobSetupWizardOpen}
              onJobSetupClose={handleJobSetupWizardClose}
              onJobSetupComplete={handleJobSetupComplete}
            />
          </div>
          {/* Tools - 25% height */}
          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <ToolsPanel />
          </div>
        </div>
      </main>
      
      {/* Setup tutorial dialog */}
      <SetupTutorialDialog
        open={isTutorialOpen}
        onOpenChange={handleTutorialOpenChange}
      />
      {/* Update notification dialog */}
      {gitHubLatestVersion && (
        <UpdateNotificationDialog
          open={isUpdateDialogOpen}
          onOpenChange={setIsUpdateDialogOpen}
          currentVersion={currentVersion}
          latestVersion={gitHubLatestVersion}
          releaseUrl={releaseUrl || undefined}
        />
      )}
      {/* Method selection dialog for "ask" strategy (Probe panel single-method flow) */}
      <ZeroingMethodSelectDialog
        open={showMethodSelectDialog}
        onOpenChange={setShowMethodSelectDialog}
        methods={settings?.zeroingMethods?.methods ?? []}
        title={t('Select Zeroing Method')}
        description={t('Choose a zeroing method to use before starting the job:')}
        onSelect={handleMethodSelect}
      />
    </div>
  )
}
