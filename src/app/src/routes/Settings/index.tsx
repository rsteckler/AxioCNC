import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useScrollSpy } from '@/hooks/useScrollSpy'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import { 
  useGetSettingsQuery, 
  useSetSettingsMutation,
  useGetCommandsQuery,
  useCreateCommandMutation,
  useUpdateCommandMutation,
  useDeleteCommandMutation,
  useGetEventsQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useGetMacrosQuery,
  useCreateMacroMutation,
  useUpdateMacroMutation,
  useDeleteMacroMutation,
  useGetWatchFoldersQuery,
  useCreateWatchFolderMutation,
  useDeleteWatchFolderMutation,
  useGetCurrentVersionQuery,
  useGetVersionQuery,
  type PartialSettings,
} from '@/services/api'
import { socketService } from '@/services/socket'
import { useTheme } from '@/components/theme-provider'
import { SettingsNav, settingsSections } from './SettingsNav'
import { 
  GeneralSection, 
  AppearanceSection,
  ConnectionSection,
  MachineSection,
  CameraSection,
  ZeroingMethodsSection,
  ZeroingStrategiesSection,
  JoystickSection,
  MacrosSection,
  CommandsSection,
  EventsSection,
  AboutSection,
  type MachineConfig,
  type ConnectionConfig,
  type CameraConfig,
  type ZeroingMethodsConfig,
  type ZeroingStrategiesConfig,
  type Macro,
  type Command,
  type EventHandler,
  type Theme,
  type AccentColor,
  type JoystickConfig,
  type WatchFolder,
  type GoogleDriveStatus,
} from './sections'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'


// =============================================================================
// DEFAULT CONFIGURATIONS
// These are the "factory defaults" used when resetting settings
// =============================================================================

// Default connection configuration
const DEFAULT_CONNECTION_CONFIG: ConnectionConfig = {
  port: '',                    // User must select
  baudRate: 115200,            // Standard for GRBL controllers
  controllerType: 'Grbl',      // Default controller type
  setDTR: true,                // Most controllers expect DTR high
  setRTS: true,                // Most controllers expect RTS high
  rtscts: false,               // Hardware flow control rarely used
  autoConnect: false,          // Safer to require explicit connection
}

// Default machine configuration
const DEFAULT_MACHINE_CONFIG: MachineConfig = {
  name: 'My CNC Machine',
  limits: {
    xmin: 0,
    xmax: 300,                 // 300mm ~ 12" - common hobby size
    ymin: 0,
    ymax: 300,
    zmin: -80,                 // 80mm Z travel
    zmax: 0,
  },
  ignoreErrors: false,         // Safer to halt on errors
}

// Default camera configuration
const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  enabled: false,
  mediaSource: 'webcam',
  autoDetect: true,
  selectedDeviceId: null,
  ipCameraUrl: '',
  flipHorizontal: false,
  flipVertical: false,
  rotation: 0,
  crosshair: true,             // Useful for alignment
  crosshairColor: '#ff0000',   // Red for visibility
}

// Default zeroing methods configuration
const DEFAULT_ZEROING_METHODS_CONFIG: ZeroingMethodsConfig = {
  methods: [
    {
      id: 'manual-default',
      type: 'manual',
      name: 'Manual',
      enabled: true,
      axes: 'xyz',
    },
    {
      id: 'touchplate-default',
      type: 'touchplate',
      name: 'Touch Plate',
      enabled: true,
      axes: 'z',
      plateThickness: 19.05,   // 3/4" (0.75") common aluminum plate
      probeFeedrate: 100,      // mm/min - slow for accuracy
      probeDistance: 25,       // mm - typical probe travel
      requireCheck: true,      // Safety first
    },
  ],
}

// Default zeroing strategies configuration
const DEFAULT_ZEROING_STRATEGIES_CONFIG: ZeroingStrategiesConfig = {
  initialSetup: 'manual-default',   // Manual zeroing for initial setup
  toolChange: 'touchplate-default', // Use touch plate for tool changes
  afterPause: 'skip',               // Usually not needed after pause
}

// Default general settings
const DEFAULT_LANGUAGE = 'en'
const DEFAULT_CHECK_FOR_UPDATES = true
const DEFAULT_ALLOW_ANALYTICS = true  // Help improve AxioCNC

// Default appearance settings
const DEFAULT_THEME = 'system'
const DEFAULT_ACCENT_COLOR = 'orange'

// Default preflight macro
const DEFAULT_PREFLIGHT_MACRO = {
  name: 'Preflight Check',
  description: 'To run after the machine is connected; verifies axis motion, spindle motion, and probe connection',
  content: `; Preflight Check Macro
; Verifies axis motion, spindle motion, and probe connection

; Home all axes first
$H

; Move to safe position for preflight
G53 G0 Z-5        ; Move Z up near top
G53 G0 X-50 Y-50  ; Move to front-left corner

; Test each axis motion
G91               ; Relative positioning
G0 X5             ; Move X positive
G0 X-5            ; Move X back
G0 Y5             ; Move Y positive
G0 Y-5            ; Move Y back
G0 Z-5            ; Move Z down
G0 Z5             ; Move Z back up
G90               ; Back to absolute positioning

; Spin up spindle briefly
M3 S1000          ; Start spindle at 1000 RPM
G4 P2             ; Dwell 2 seconds
M5                ; Stop spindle

; Request probe confirmation
; (User should touch probe to confirm it's working)
M0 (Touch probe to verify connection, then resume)

; Preflight complete
`,
}

// Default joystick configuration (Xbox-style layout)
const DEFAULT_JOYSTICK_CONFIG: JoystickConfig = {
  enabled: false,
  selectedGamepad: null,
  buttonMappings: {
    0: 'zero_all',       // A - Zero all axes
    1: 'emergency_stop', // B - E-Stop (red button = stop)
    2: 'home_all',       // X - Home all axes
    3: 'spindle_toggle', // Y - Toggle spindle
    4: 'speed_slow',     // LB - Slow jog speed
    5: 'speed_fast',     // RB - Fast jog speed
    12: 'jog_y_pos',     // D-pad Up
    13: 'jog_y_neg',     // D-pad Down
    14: 'jog_x_neg',     // D-pad Left
    15: 'jog_x_pos',     // D-pad Right
  },
  analogMappings: {
    left_x: 'jog_x',     // Left stick X = jog X axis
    left_y: 'jog_y',     // Left stick Y = jog Y axis
    right_x: 'none',     // Right stick X = unused
    right_y: 'jog_z',    // Right stick Y = jog Z axis
  },
  deadzone: 0.15,        // 15% deadzone to prevent drift
  sensitivity: 1.0,      // Normal sensitivity
  invertX: false,
  invertY: false,
  invertZ: false,
  analogJogSpeedXY: 3000, // mm/min max jog speed for X/Y
  analogJogSpeedZ: 1000,
}

export default function Settings() {
  const { theme, accentColor, customThemeId, setTheme, setAccentColor, setCustomTheme } = useTheme()
  
  // RTK Query hooks
  const { data: settings, isLoading: isLoadingSettings } = useGetSettingsQuery()
  const [setSettings] = useSetSettingsMutation()
  
  // Commands API
  const { data: commandsData, isLoading: isLoadingCommands } = useGetCommandsQuery()
  const [createCommand] = useCreateCommandMutation()
  const [updateCommand] = useUpdateCommandMutation()
  const [deleteCommand] = useDeleteCommandMutation()
  
  // Events API
  const { data: eventsData, isLoading: isLoadingEvents } = useGetEventsQuery()
  const [createEvent] = useCreateEventMutation()
  const [updateEvent] = useUpdateEventMutation()
  const [deleteEvent] = useDeleteEventMutation()
  
  // Macros API
  const { data: macrosData, isLoading: isLoadingMacros } = useGetMacrosQuery()
  const [createMacro] = useCreateMacroMutation()
  const [updateMacro] = useUpdateMacroMutation()
  const [deleteMacro] = useDeleteMacroMutation()
  
  // Watch Folders API
  const { data: watchFoldersData, isLoading: isLoadingWatchFolders } = useGetWatchFoldersQuery()
  const [createWatchFolder] = useCreateWatchFolderMutation()
  const [deleteWatchFolder] = useDeleteWatchFolderMutation()
  
  // Version API
  const { data: currentVersionData } = useGetCurrentVersionQuery()
  const { data: latestVersionData } = useGetVersionQuery()
  
  // Derive commands/events/macros/watchFolders from API data
  const commands: Command[] = commandsData?.records ?? []
  // Cast event/trigger strings to the expected union types
  const events: EventHandler[] = (eventsData?.records ?? []) as EventHandler[]
  const macros: Macro[] = macrosData?.records ?? []
  const watchFolders: WatchFolder[] = (watchFoldersData?.records ?? []) as WatchFolder[]
  
  const isLoading = isLoadingSettings || isLoadingCommands || isLoadingEvents || isLoadingMacros || isLoadingWatchFolders

  // Local state for form values
  const [language, setLanguage] = useState('en')
  const [checkForUpdates, setCheckForUpdates] = useState(true)
  const [allowAnalytics, setAllowAnalytics] = useState(false)
  // Watch folders now come from API (defined above)
  const [googleDriveStatus, setGoogleDriveStatus] = useState<GoogleDriveStatus>({
    isConnected: false,
    isConnecting: false,
  })
  
  // Mock state for CRUD sections (will be connected to API later)
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>(DEFAULT_CONNECTION_CONFIG)
  const [detectedPorts, setDetectedPorts] = useState<{ path: string; manufacturer?: string }[]>([])
  const [machineConfig, setMachineConfig] = useState<MachineConfig>(DEFAULT_MACHINE_CONFIG)
  const [cameraConfig, setCameraConfig] = useState<CameraConfig>(DEFAULT_CAMERA_CONFIG)
  const [detectedCameras, setDetectedCameras] = useState<{ deviceId: string; label: string }[]>([])
  const [zeroingMethodsConfig, setZeroingMethodsConfig] = useState<ZeroingMethodsConfig>(DEFAULT_ZEROING_METHODS_CONFIG)
  const [zeroingStrategiesConfig, setZeroingStrategiesConfig] = useState<ZeroingStrategiesConfig>(DEFAULT_ZEROING_STRATEGIES_CONFIG)
  // Users, Commands, Events, Macros now come from API (defined above)
  const [joystickConfig, setJoystickConfig] = useState<JoystickConfig>(DEFAULT_JOYSTICK_CONFIG)
  const [detectedGamepads, setDetectedGamepads] = useState<{ id: string; index: number; name: string; buttons: number; axes: number }[]>([])
  
  // Saving indicator state
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Scroll spy for navigation
  const sectionIds = settingsSections.map(s => s.id)
  const { activeId, scrollTo } = useScrollSpy(sectionIds, { offset: 100 })

  // Track if we've initialized from API to prevent refetch overwrites
  const hasInitialized = useRef(false)

  // Initialize local state from API data (only on first load)
  useEffect(() => {
    // Only initialize once - after that, local state is the source of truth
    if (settings && !hasInitialized.current) {
      hasInitialized.current = true
      
      setLanguage(settings.lang ?? 'en')
      setCheckForUpdates(settings.checkForUpdates ?? true)
      setAllowAnalytics(settings.allowAnonymousUsageDataCollection ?? false)
      
      // Machine config from settings
      if (settings.machine) {
        setMachineConfig(prev => ({
          ...prev,
          name: settings.machine?.name ?? prev.name,
          limits: settings.machine?.limits ?? prev.limits,
        }))
      }
      
      // Controller settings
      if (settings.controller?.exception?.ignoreErrors !== undefined) {
        setMachineConfig(prev => ({ ...prev, ignoreErrors: settings.controller!.exception!.ignoreErrors! }))
      }
      
      // Connection config
      if (settings.connection) {
        setConnectionConfig(prev => ({ ...prev, ...settings.connection }))
      }
      
      // Camera config
      if (settings.camera) {
        setCameraConfig(prev => ({ ...prev, ...settings.camera }))
      }
      
      // Zeroing methods config
      if (settings.zeroingMethods) {
        setZeroingMethodsConfig(prev => ({ ...prev, ...settings.zeroingMethods }))
      }
      
      // Zeroing strategies config
      if (settings.zeroingStrategies) {
        setZeroingStrategiesConfig(prev => ({ ...prev, ...settings.zeroingStrategies }))
      }
      
      // Joystick config
      if (settings.joystick) {
        setJoystickConfig(prev => ({ ...prev, ...settings.joystick }))
      }
    }
  }, [settings])

  // Accumulate pending changes for debounced save
  const pendingChanges = useRef<PartialSettings>({})
  
  // Deep merge helper for nested objects
  const deepMerge = useCallback((target: PartialSettings, source: PartialSettings): PartialSettings => {
    const result = { ...target }
    for (const key of Object.keys(source) as (keyof PartialSettings)[]) {
      const sourceVal = source[key]
      const targetVal = result[key]
      if (sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal) &&
          targetVal && typeof targetVal === 'object' && !Array.isArray(targetVal)) {
        result[key] = { ...targetVal, ...sourceVal } as typeof targetVal
      } else {
        result[key] = sourceVal as typeof targetVal
      }
    }
    return result
  }, [])
  
  // Debounced function that sends accumulated changes
  const flushPendingChanges = useDebouncedCallback(
    async () => {
      const changes = pendingChanges.current
      pendingChanges.current = {}
      
      if (Object.keys(changes).length === 0) return
      
      setIsSaving(true)
      try {
        await setSettings(changes).unwrap()
        setLastSaved(new Date())
      } catch (error) {
        console.error('Failed to save settings:', error)
      } finally {
        setIsSaving(false)
      }
    },
    500
  )
  
  // Queue changes to be saved - accumulates rapid changes
  const debouncedSave = useCallback((data: PartialSettings) => {
    pendingChanges.current = deepMerge(pendingChanges.current, data)
    flushPendingChanges()
  }, [deepMerge, flushPendingChanges])

  // Handlers for General section
  const handleLanguageChange = useCallback((value: string) => {
    setLanguage(value)
    debouncedSave({ lang: value })
  }, [debouncedSave])

  const handleCheckForUpdatesChange = useCallback((value: boolean) => {
    setCheckForUpdates(value)
    debouncedSave({ checkForUpdates: value })
  }, [debouncedSave])

  const handleAnalyticsChange = useCallback((value: boolean) => {
    setAllowAnalytics(value)
    debouncedSave({ allowAnonymousUsageDataCollection: value })
  }, [debouncedSave])

  // Settings backup handlers (UI only for now)
  const handleImportSettings = useCallback((data: unknown) => {
    console.log('Import settings:', data)
    // TODO: Implement import functionality
  }, [])

  const handleExportSettings = useCallback(() => {
    console.log('Export settings')
    // TODO: Implement export functionality
  }, [])

  const handleRestoreDefaults = useCallback(async () => {
    // Reset all settings to factory defaults
    
    // General
    setLanguage(DEFAULT_LANGUAGE)
    setCheckForUpdates(DEFAULT_CHECK_FOR_UPDATES)
    setAllowAnalytics(DEFAULT_ALLOW_ANALYTICS)
    
    // Delete all watch folders
    for (const folder of watchFolders) {
      try {
        await deleteWatchFolder(folder.id).unwrap()
      } catch (error) {
        console.error('Failed to delete watch folder:', error)
      }
    }
    
    // Appearance (theme)
    setTheme(DEFAULT_THEME as 'light' | 'dark' | 'system')
    setAccentColor(DEFAULT_ACCENT_COLOR as 'orange' | 'blue' | 'green' | 'purple' | 'red' | 'zinc')
    setCustomTheme(null)  // Clear any custom theme
    
    // Connection
    setConnectionConfig(DEFAULT_CONNECTION_CONFIG)
    
    // Machine
    setMachineConfig(DEFAULT_MACHINE_CONFIG)
    
    // Camera
    setCameraConfig(DEFAULT_CAMERA_CONFIG)
    
    // Zeroing
    setZeroingMethodsConfig(DEFAULT_ZEROING_METHODS_CONFIG)
    setZeroingStrategiesConfig(DEFAULT_ZEROING_STRATEGIES_CONFIG)
    
    // Joystick
    setJoystickConfig(DEFAULT_JOYSTICK_CONFIG)
    
    // Delete all commands
    for (const command of commands) {
      try {
        await deleteCommand(command.id).unwrap()
      } catch (error) {
        console.error('Failed to delete command:', error)
      }
    }
    
    // Delete all events
    for (const event of events) {
      try {
        await deleteEvent(event.id).unwrap()
      } catch (error) {
        console.error('Failed to delete event:', error)
      }
    }
    
    // Delete all macros and create default preflight
    for (const macro of macros) {
      try {
        await deleteMacro(macro.id).unwrap()
      } catch (error) {
        console.error('Failed to delete macro:', error)
      }
    }
    
    // Create default preflight macro
    try {
      await createMacro(DEFAULT_PREFLIGHT_MACRO).unwrap()
    } catch (error) {
      console.error('Failed to create default macro:', error)
    }
    
    // Save to backend (theme is saved via setTheme/setAccentColor/setCustomTheme)
    // Note: ignoreErrors is stored under controller.exception in the backend
    debouncedSave({
      lang: DEFAULT_LANGUAGE,
      checkForUpdates: DEFAULT_CHECK_FOR_UPDATES,
      allowAnonymousUsageDataCollection: DEFAULT_ALLOW_ANALYTICS,
      connection: DEFAULT_CONNECTION_CONFIG,
      machine: {
        name: DEFAULT_MACHINE_CONFIG.name,
        limits: DEFAULT_MACHINE_CONFIG.limits,
      },
      controller: {
        exception: {
          ignoreErrors: DEFAULT_MACHINE_CONFIG.ignoreErrors,
        },
      },
      camera: DEFAULT_CAMERA_CONFIG,
      zeroingMethods: DEFAULT_ZEROING_METHODS_CONFIG,
      zeroingStrategies: DEFAULT_ZEROING_STRATEGIES_CONFIG,
      joystick: DEFAULT_JOYSTICK_CONFIG,
    })
    
    console.log('Settings reset to defaults')
  }, [debouncedSave, setTheme, setAccentColor, setCustomTheme, watchFolders, deleteWatchFolder, commands, deleteCommand, events, deleteEvent, macros, deleteMacro, createMacro])

  // Watch folders handlers (API-backed)
  const handleAddWatchFolder = useCallback(async (folder: Omit<WatchFolder, 'id'>) => {
    try {
      await createWatchFolder({
        name: folder.name,
        type: folder.type,
        path: folder.path,
        enabled: folder.enabled ?? true,
      }).unwrap()
    } catch (error) {
      console.error('Failed to create watch folder:', error)
    }
  }, [createWatchFolder])

  const handleRemoveWatchFolder = useCallback(async (id: string) => {
    try {
      await deleteWatchFolder(id).unwrap()
    } catch (error) {
      console.error('Failed to delete watch folder:', error)
    }
  }, [deleteWatchFolder])

  // Google Drive connection handlers
  const handleConnectGoogleDrive = useCallback(() => {
    setGoogleDriveStatus(prev => ({ ...prev, isConnecting: true, error: undefined }))
    
    // TODO: Implement actual Google OAuth flow
    // For now, simulate a connection after a delay
    setTimeout(() => {
      setGoogleDriveStatus({
        isConnected: true,
        isConnecting: false,
        userEmail: 'user@example.com',
      })
    }, 1500)
  }, [])

  const handleDisconnectGoogleDrive = useCallback(() => {
    setGoogleDriveStatus({
      isConnected: false,
      isConnecting: false,
    })
    // TODO: Optionally remove all Google Drive watch folders via API
  }, [])


  // Connection config handler
  const handleConnectionConfigChange = useCallback((changes: Partial<ConnectionConfig>) => {
    setConnectionConfig(prev => ({ ...prev, ...changes }))
    debouncedSave({ connection: changes })
  }, [debouncedSave])

  const handleRefreshPorts = useCallback(() => {
    // Ensure socket is connected
    if (!socketService.isConnected()) {
      const connected = socketService.connect()
      if (!connected) {
        console.error('Failed to connect socket for port listing')
        return
      }
    }
    
    const socket = socketService.getSocket()
    if (!socket) {
      console.error('Socket not available for port listing')
      return
    }
    
    // Set a timeout for port list (5 seconds)
    const listTimeout = setTimeout(() => {
      socketService.off('serialport:list', handlePortList)
      console.warn('Port list request timed out')
    }, 5000)
    
    // Listen for port list response
    const handlePortList = (...args: unknown[]) => {
      const ports = args[0] as Array<{ port: string; manufacturer?: string; inuse?: boolean }>
      clearTimeout(listTimeout)
      setDetectedPorts(ports.map(p => ({
        path: p.port,  // Backend uses 'port' key, frontend expects 'path'
        manufacturer: p.manufacturer
      })))
      socketService.off('serialport:list', handlePortList)
    }
    
    socketService.on('serialport:list', handlePortList)
    
    // Request port list
    socket.emit('list')
  }, [])
  
  // Auto-refresh ports on mount
  useEffect(() => {
    handleRefreshPorts()
  }, [handleRefreshPorts])

  const handleTestConnection = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!connectionConfig.port) {
      return { success: false, message: 'No port selected' }
    }
    
    // Ensure socket is connected
    if (!socketService.isConnected()) {
      socketService.connect()
    }
    
    const socket = socketService.getSocket()
    if (!socket) {
      return { success: false, message: 'Socket connection not available. Please refresh the page.' }
    }
    
    const { port, baudRate, controllerType } = connectionConfig
    
    // Test connection by attempting to open the port
    return new Promise((resolve) => {
      // Set a timeout for the test (5 seconds)
      const testTimeout = setTimeout(() => {
        resolve({ 
          success: false, 
          message: 'Connection test timed out. The port may be in use or the device may not be responding.' 
        })
      }, 5000)
      
      // Listen for port open confirmation
      const handlePortOpen = (...args: unknown[]) => {
        const data = args[0] as { port: string }
        if (data.port === port) {
          clearTimeout(testTimeout)
          socketService.off('serialport:open', handlePortOpen)
          
          // Immediately close the test connection
          socket.emit('close', port, () => {
            resolve({ 
              success: true, 
              message: `Successfully connected to ${port} at ${baudRate} baud (${controllerType || 'Grbl'})` 
            })
          })
        }
      }
      
      socketService.on('serialport:open', handlePortOpen)
      
      // Attempt to open the port
      socket.emit('open', port, {
        baudrate: baudRate,
        controllerType: controllerType || 'Grbl'
      }, (err: Error | null) => {
        if (err) {
          clearTimeout(testTimeout)
          socketService.off('serialport:open', handlePortOpen)
          const errorMessage = err.message || (typeof err === 'string' ? err : 'Connection failed')
          resolve({ 
            success: false, 
            message: `Connection failed: ${errorMessage}. Check that the port is available and the machine is powered on.` 
          })
        }
        // If no error in callback, the port might already be open or will open soon
        // Wait for serialport:open event (or timeout) to confirm
        // If port is already open, we might get the event immediately
      })
    })
  }, [connectionConfig])

  // Machine config handler
  const handleMachineConfigChange = useCallback((changes: Partial<MachineConfig>) => {
    setMachineConfig(prev => {
      const updated = { ...prev }
      if (changes.name !== undefined) updated.name = changes.name
      if (changes.limits) {
        updated.limits = { ...prev.limits, ...changes.limits }
      }
      if (changes.ignoreErrors !== undefined) {
        updated.ignoreErrors = changes.ignoreErrors
      }
      return updated
    })
    
    // Save to backend
    const saveData: PartialSettings = {}
    if (changes.name !== undefined || changes.limits) {
      saveData.machine = {}
      if (changes.name !== undefined) saveData.machine.name = changes.name
      if (changes.limits) saveData.machine.limits = changes.limits
    }
    if (changes.ignoreErrors !== undefined) {
      saveData.controller = { exception: { ignoreErrors: changes.ignoreErrors } }
    }
    if (Object.keys(saveData).length > 0) {
      debouncedSave(saveData)
    }
  }, [debouncedSave])

  // Camera config handler
  const handleCameraConfigChange = useCallback((changes: Partial<CameraConfig>) => {
    setCameraConfig(prev => ({ ...prev, ...changes }))
    debouncedSave({ camera: changes })
  }, [debouncedSave])

  const handleRefreshCameras = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const cameras = devices
        .filter(device => device.kind === 'videoinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Camera ${device.deviceId.slice(0, 8)}...`,
        }))
      setDetectedCameras(cameras)
    } catch (error) {
      console.error('Failed to enumerate cameras:', error)
    }
  }, [])

  // Zeroing methods config handler
  const handleZeroingMethodsConfigChange = useCallback((changes: Partial<ZeroingMethodsConfig>) => {
    setZeroingMethodsConfig(prev => {
      const updated = { ...prev }
      if (changes.methods) {
        updated.methods = changes.methods
      }
      return updated
    })
    debouncedSave({ zeroingMethods: changes })
  }, [debouncedSave])

  // Zeroing strategies config handler
  const handleZeroingStrategiesConfigChange = useCallback((changes: Partial<ZeroingStrategiesConfig>) => {
    setZeroingStrategiesConfig(prev => ({ ...prev, ...changes }))
    debouncedSave({ zeroingStrategies: changes })
  }, [debouncedSave])

  // Commands handlers (API-backed)
  const handleAddCommand = useCallback(async (command: Omit<Command, 'id' | 'mtime'>) => {
    try {
      await createCommand(command).unwrap()
    } catch (error) {
      console.error('Failed to create command:', error)
    }
  }, [createCommand])

  const handleEditCommand = useCallback(async (command: Command) => {
    try {
      await updateCommand({ id: command.id, updates: { title: command.title, commands: command.commands, enabled: command.enabled } }).unwrap()
    } catch (error) {
      console.error('Failed to update command:', error)
    }
  }, [updateCommand])

  const handleDeleteCommand = useCallback(async (id: string) => {
    try {
      await deleteCommand(id).unwrap()
    } catch (error) {
      console.error('Failed to delete command:', error)
    }
  }, [deleteCommand])

  const handleToggleCommandEnabled = useCallback(async (id: string, enabled: boolean) => {
    try {
      await updateCommand({ id, updates: { enabled } }).unwrap()
    } catch (error) {
      console.error('Failed to toggle command:', error)
    }
  }, [updateCommand])

  // Events handlers (API-backed)
  const handleAddEvent = useCallback(async (event: Omit<EventHandler, 'id' | 'mtime'>) => {
    try {
      await createEvent(event).unwrap()
    } catch (error) {
      console.error('Failed to create event:', error)
    }
  }, [createEvent])

  const handleEditEvent = useCallback(async (event: EventHandler) => {
    try {
      await updateEvent({ id: event.id, updates: { event: event.event, trigger: event.trigger, commands: event.commands, enabled: event.enabled } }).unwrap()
    } catch (error) {
      console.error('Failed to update event:', error)
    }
  }, [updateEvent])

  const handleDeleteEvent = useCallback(async (id: string) => {
    try {
      await deleteEvent(id).unwrap()
    } catch (error) {
      console.error('Failed to delete event:', error)
    }
  }, [deleteEvent])

  const handleToggleEventEnabled = useCallback(async (id: string, enabled: boolean) => {
    try {
      await updateEvent({ id, updates: { enabled } }).unwrap()
    } catch (error) {
      console.error('Failed to toggle event:', error)
    }
  }, [updateEvent])

  // Macros handlers (API-backed)
  const handleAddMacro = useCallback(async (macro: Omit<Macro, 'id' | 'mtime'>) => {
    try {
      await createMacro(macro).unwrap()
    } catch (error) {
      console.error('Failed to create macro:', error)
    }
  }, [createMacro])

  const handleEditMacro = useCallback(async (macro: Macro) => {
    try {
      await updateMacro({ id: macro.id, updates: { name: macro.name, description: macro.description, content: macro.content } }).unwrap()
    } catch (error) {
      console.error('Failed to update macro:', error)
    }
  }, [updateMacro])

  const handleDeleteMacro = useCallback(async (id: string) => {
    try {
      await deleteMacro(id).unwrap()
    } catch (error) {
      console.error('Failed to delete macro:', error)
    }
  }, [deleteMacro])

  // Joystick handlers
  const handleJoystickConfigChange = useCallback((changes: Partial<JoystickConfig>) => {
    setJoystickConfig(prev => ({ ...prev, ...changes }))
    debouncedSave({ joystick: changes })
  }, [debouncedSave])

  const handleRefreshGamepads = useCallback(() => {
    // Use the Gamepad API to detect connected gamepads
    const gamepads = navigator.getGamepads?.() || []
    const detected = Array.from(gamepads)
      .filter((gp): gp is Gamepad => gp !== null)
      .map(gp => ({
        id: gp.id,
        index: gp.index,
        name: gp.id.split('(')[0].trim() || `Gamepad ${gp.index + 1}`,
        buttons: gp.buttons.length,
        axes: gp.axes.length,
      }))
    setDetectedGamepads(detected)
  }, [])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Save status indicator */}
            {isSaving ? (
              <Badge variant="secondary" className="gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Saving...
              </Badge>
            ) : lastSaved ? (
              <Badge variant="secondary" className="gap-1.5 text-muted-foreground">
                <Check className="w-3 h-3" />
                Saved
              </Badge>
            ) : null}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex gap-12">
          {/* Sticky sidebar navigation */}
          <aside className="hidden md:block w-48 flex-shrink-0">
            <div className="sticky top-24">
              <SettingsNav activeId={activeId} onNavigate={scrollTo} />
            </div>
          </aside>

          {/* Settings content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            <GeneralSection
              language={language}
              checkForUpdates={checkForUpdates}
              allowAnalytics={allowAnalytics}
              watchFolders={watchFolders}
              googleDriveStatus={googleDriveStatus}
              onLanguageChange={handleLanguageChange}
              onCheckForUpdatesChange={handleCheckForUpdatesChange}
              onAnalyticsChange={handleAnalyticsChange}
              onImportSettings={handleImportSettings}
              onExportSettings={handleExportSettings}
              onRestoreDefaults={handleRestoreDefaults}
              onAddWatchFolder={handleAddWatchFolder}
              onRemoveWatchFolder={handleRemoveWatchFolder}
              onConnectGoogleDrive={handleConnectGoogleDrive}
              onDisconnectGoogleDrive={handleDisconnectGoogleDrive}
            />

            <AppearanceSection
              theme={theme as Theme}
              accentColor={accentColor as AccentColor}
              customThemeId={customThemeId}
              onThemeChange={setTheme}
              onAccentColorChange={setAccentColor}
              onCustomThemeChange={setCustomTheme}
            />

            <ConnectionSection
              config={connectionConfig}
              detectedPorts={detectedPorts}
              onConfigChange={handleConnectionConfigChange}
              onRefreshPorts={handleRefreshPorts}
              onTestConnection={handleTestConnection}
            />

            <MachineSection
              config={machineConfig}
              onConfigChange={handleMachineConfigChange}
            />

            <ZeroingMethodsSection
              config={zeroingMethodsConfig}
              onConfigChange={handleZeroingMethodsConfigChange}
            />

            <ZeroingStrategiesSection
              config={zeroingStrategiesConfig}
              availableMethods={zeroingMethodsConfig.methods}
              onConfigChange={handleZeroingStrategiesConfigChange}
            />

            <CameraSection
              config={cameraConfig}
              detectedCameras={detectedCameras}
              onConfigChange={handleCameraConfigChange}
              onRefreshCameras={handleRefreshCameras}
            />

            <JoystickSection
              config={joystickConfig}
              detectedGamepads={detectedGamepads}
              onConfigChange={handleJoystickConfigChange}
              onRefreshGamepads={handleRefreshGamepads}
            />

            <MacrosSection
              macros={macros}
              onAdd={handleAddMacro}
              onEdit={handleEditMacro}
              onDelete={handleDeleteMacro}
            />

            <CommandsSection
              commands={commands}
              onAdd={handleAddCommand}
              onEdit={handleEditCommand}
              onDelete={handleDeleteCommand}
              onToggleEnabled={handleToggleCommandEnabled}
            />

            <EventsSection
              events={events}
              onAdd={handleAddEvent}
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
              onToggleEnabled={handleToggleEventEnabled}
            />

            <AboutSection
              version={currentVersionData?.version ?? 'Unknown'}
              latestVersion={latestVersionData?.latest}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
