import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useScrollSpy } from '@/hooks/useScrollSpy'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import { trackSettingsChange } from '@/services/analytics'
import { 
  useGetSettingsQuery, 
  useSetSettingsMutation,
  useGetEventsQuery,
  useCreateEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useGetMacrosQuery,
  useCreateMacroMutation,
  useUpdateMacroMutation,
  useDeleteMacroMutation,
  useGetToolsQuery,
  useCreateToolMutation,
  useUpdateToolMutation,
  useDeleteToolMutation,
  useGetWatchFoldersQuery,
  useCreateWatchFolderMutation,
  useDeleteWatchFolderMutation,
  useGetCurrentVersionQuery,
  useGetExtensionsQuery,
  useSetExtensionsMutation,
  // useGetGamepadsQuery - not currently used but may be needed in future
  useRefreshGamepadsMutation,
  useSetSelectedGamepadMutation,
  useGetCamerasQuery,
  useCreateCameraMutation,
  useUpdateCameraMutation,
  useDeleteCameraMutation,
  type PartialSettings,
  type Camera,
} from '@/services/api'
import { socketService } from '@/services/socket'
import { useTheme } from '@/components/theme-provider'
import { store } from '@/store'
import { api } from '@/services/api'
import { SettingsNav } from './SettingsNav'
import { useSettingsSections } from './settingsSections'
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
  EventsSection,
  ToolLibrarySection,
  AdvancedSection,
  AboutSection,
  type MachineConfig,
  type ConnectionConfig,
  type CameraConfig,
  type ZeroingMethodsConfig,
  type ZeroingStrategiesConfig,
  type AdvancedConfig,
  type Macro,
  type EventHandler,
  type Tool,
  type Theme,
  type AccentColor,
  type JoystickConfig,
  type CncAction,
  type WatchFolder,
  type GoogleDriveStatus,
} from './sections'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { SystemSettings, Extensions } from '@/services/api'


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
  homingCorner: 'front-left',  // Most common homing position
  autoSwitchToMonitorEnabled: true,   // Enabled by default
  toolSpinupDelayEnabled: true,   // Enabled by default
  toolSpinupDelaySeconds: 5,      // 5 seconds default delay
}

// Default camera configuration
const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  enabled: false,
  mediaSource: 'ip-camera',
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

; Preflight complete
`,
}

// Default joystick configuration (Xbox-style layout)

// Server-side (Linux) Xbox controller button mappings
const SERVER_BUTTON_MAPPINGS: Record<number, CncAction> = {
  0: 'zero_all',       // A - Zero all axes
  1: 'emergency_stop', // B - E-Stop (red button = stop)
  3: 'home_all',       // X - Home all axes
  4: 'spindle_on', // Y - Toggle spindle (using spindle_on as toggle)
  6: 'speed_slow',     // LB - Slow jog speed
  7: 'speed_fast',     // RB - Fast jog speed
  12: 'jog_y_pos',     // D-pad Up
  13: 'jog_y_neg',     // D-pad Down
  14: 'jog_x_neg',     // D-pad Left
  15: 'jog_x_pos',     // D-pad Right
}

// Client-side (browser) Xbox controller button mappings
const CLIENT_BUTTON_MAPPINGS: Record<number, CncAction> = {
  0: 'zero_all',       // A - Zero all axes
  1: 'emergency_stop', // B - E-Stop (red button = stop)
  2: 'home_all',       // X - Home all axes
  3: 'spindle_on', // Y - Toggle spindle (using spindle_on as toggle)
  4: 'speed_slow',     // LB - Slow jog speed
  5: 'speed_fast',     // RB - Fast jog speed
  6: 'none',           // LT (usually axis, but mapped as button in browser)
  7: 'none',           // RT (usually axis, but mapped as button in browser)
  8: 'none',           // Back
  9: 'none',           // Start
  10: 'none',          // Left Stick Click
  11: 'none',          // Right Stick Click
  12: 'jog_y_pos',     // D-pad Up
  13: 'jog_y_neg',     // D-pad Down
  14: 'jog_x_neg',     // D-pad Left
  15: 'jog_x_pos',     // D-pad Right
}

/**
 * Get default button mappings based on connection location
 */
function getDefaultButtonMappings(connectionLocation: 'server' | 'client'): Record<number, CncAction> {
  return connectionLocation === 'client' ? CLIENT_BUTTON_MAPPINGS : SERVER_BUTTON_MAPPINGS
}

const DEFAULT_ADVANCED_CONFIG: AdvancedConfig = {
  debugMode: false,
  showAdvancedSettings: false,
}

const DEFAULT_JOYSTICK_CONFIG: JoystickConfig = {
  enabled: false,
  connectionLocation: 'server',
  selectedGamepad: null,
  buttonMappings: SERVER_BUTTON_MAPPINGS, // Default to server mappings
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
  locked: false,
}

export default function Settings() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { theme, accentColor, customThemeId, setTheme, setAccentColor, setCustomTheme } = useTheme()
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true)
  
  // RTK Query hooks
  const { data: settings, isLoading: isLoadingSettings, refetch: refetchSettings } = useGetSettingsQuery()
  const [setSettings] = useSetSettingsMutation()
  
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
  
  // Tools API (Tool Library)
  const { data: toolsData, isLoading: isLoadingTools } = useGetToolsQuery()
  const [createTool] = useCreateToolMutation()
  const [updateTool] = useUpdateToolMutation()
  const [deleteTool] = useDeleteToolMutation()
  
  // Watch Folders API
  const { data: watchFoldersData, isLoading: isLoadingWatchFolders } = useGetWatchFoldersQuery()
  const [createWatchFolder] = useCreateWatchFolderMutation()
  const [deleteWatchFolder] = useDeleteWatchFolderMutation()
  
  // Version API
  const { data: currentVersionData } = useGetCurrentVersionQuery()
  
  // Extensions API for advanced config
  const { data: extensionsData } = useGetExtensionsQuery({ key: 'advanced' })
  const [setExtensions] = useSetExtensionsMutation()

  // Gamepads API (server-side)
  // serverGamepadsData not currently used but may be needed in future
  // const { data: serverGamepadsData } = useGetGamepadsQuery(undefined, {
  //   skip: true, // Don't auto-fetch - we'll use refresh mutation
  // })
  const [refreshGamepads] = useRefreshGamepadsMutation()
  const [setSelectedGamepad] = useSetSelectedGamepadMutation()
  
  // Cameras API
  const { data: camerasData } = useGetCamerasQuery()
  const [createCamera] = useCreateCameraMutation()
  const [updateCamera] = useUpdateCameraMutation()
  const [deleteCamera] = useDeleteCameraMutation()
  
  // Notifications
  const { showErrorNotification, showInfoNotification } = useNotifications()
  
  // Import confirmation dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [pendingImportData, setPendingImportData] = useState<{
    settings?: SystemSettings
    macros?: Macro[]
    events?: EventHandler[]
    tools?: Tool[]
    cameras?: Camera[]
    watchFolders?: WatchFolder[]
    extensions?: Extensions
  } | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  
  // Derive events/macros/tools/watchFolders from API data (wrap in useMemo to prevent recreating on every render)
  // Cast event/trigger strings to the expected union types
  const events: EventHandler[] = useMemo(() => (eventsData?.records ?? []) as EventHandler[], [eventsData?.records])
  const macros: Macro[] = useMemo(() => macrosData?.records ?? [], [macrosData?.records])
  const tools: Tool[] = useMemo(() => toolsData?.records ?? [], [toolsData?.records])
  const watchFolders: WatchFolder[] = useMemo(() => (watchFoldersData?.records ?? []) as WatchFolder[], [watchFoldersData?.records])
  
  const isLoading = isLoadingSettings || isLoadingEvents || isLoadingMacros || isLoadingTools || isLoadingWatchFolders

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
  const [zeroingMethodsConfig, setZeroingMethodsConfig] = useState<ZeroingMethodsConfig>(DEFAULT_ZEROING_METHODS_CONFIG)
  const [zeroingStrategiesConfig, setZeroingStrategiesConfig] = useState<ZeroingStrategiesConfig>(DEFAULT_ZEROING_STRATEGIES_CONFIG)
  // Users, Commands, Events, Macros now come from API (defined above)
  const [joystickConfig, setJoystickConfig] = useState<JoystickConfig>(DEFAULT_JOYSTICK_CONFIG)
  const [detectedGamepads, setDetectedGamepads] = useState<{ id: string; index: number; name: string; buttons: number; axes: number }[]>([])
  const [advancedConfig, setAdvancedConfig] = useState<AdvancedConfig>(DEFAULT_ADVANCED_CONFIG)
  
  // Saving indicator state
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Scroll spy for navigation - filter out advanced if not enabled
  const settingsSections = useSettingsSections()
  const sectionIds = settingsSections
    .filter((s: { id: string }) => s.id !== 'advanced' || advancedConfig.showAdvancedSettings)
    .map((s: { id: string }) => s.id)
  const { activeId, scrollTo } = useScrollSpy(sectionIds, { offset: 100 })

  // Track if we've initialized from API to prevent refetch overwrites
  const hasInitialized = useRef(false)
  const [forceReinit] = useState(0) // Reserved for future use (e.g., settings import)

  // Initialize advanced config from extensions API
  useEffect(() => {
    if (extensionsData && typeof extensionsData === 'object' && 'debugMode' in extensionsData) {
      const config = extensionsData as unknown as AdvancedConfig
      setAdvancedConfig(prev => ({ ...prev, ...config }))
    }
  }, [extensionsData])

  // Initialize local state from API data (only on first load or after import)
  useEffect(() => {
    // Only initialize once - after that, local state is the source of truth
    // But allow re-initialization if forceReinit changes (after import)
    if (settings && (!hasInitialized.current || forceReinit > 0)) {
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
          homingCorner: settings.machine?.homingCorner ?? prev.homingCorner,
        }))
      }
      
      // Controller settings
      if (settings.machine?.autoSwitchToMonitor !== undefined) {
        setMachineConfig(prev => ({ ...prev, autoSwitchToMonitorEnabled: settings.machine!.autoSwitchToMonitor! }))
      }
      if (settings.machine?.toolSpinup?.enabled !== undefined) {
        setMachineConfig(prev => ({ ...prev, toolSpinupDelayEnabled: settings.machine!.toolSpinup!.enabled! }))
      }
      if (settings.machine?.toolSpinup?.delaySeconds !== undefined) {
        setMachineConfig(prev => ({ ...prev, toolSpinupDelaySeconds: settings.machine!.toolSpinup!.delaySeconds! }))
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
        setJoystickConfig(prev => {
          const loaded = { ...prev, ...settings.joystick }
          
          // If buttonMappings are empty or incomplete, apply defaults based on connectionLocation
          const connectionLocation = loaded.connectionLocation || 'server'
          const defaultMappings = getDefaultButtonMappings(connectionLocation)
          
          if (!loaded.buttonMappings || Object.keys(loaded.buttonMappings).length === 0) {
            loaded.buttonMappings = { ...defaultMappings }
          }
          
          return loaded
        })
      }
    }
  }, [settings, forceReinit])
  
  // Track which camera we've loaded to prevent overwriting user input
  const lastLoadedCameraId = useRef<string | null>(null)
  const isUserEditing = useRef(false)
  
  // Load camera from cameras API into local state (only on initial load or when camera ID changes)
  // Don't reload when user is actively editing or when enabled state changes
  // Extract complex expression for static checking
  const firstCameraId = camerasData?.records?.[0]?.id
  const camerasRecords = camerasData?.records
  
  useEffect(() => {
    if (camerasRecords && cameraConfig.mediaSource === 'ip-camera' && !isUserEditing.current) {
      // Since we only support one camera, just get the first one
      const camera = camerasRecords[0]
      const currentCameraId = camera?.id
      
      // Only load if this is a different camera (by ID) - this prevents overwriting user input
      // Also skip if camera is disabled and we're just toggling (prevents reloading old data)
      if (camera && currentCameraId && lastLoadedCameraId.current !== currentCameraId) {
        // Strip credentials from URL - they should be in separate username/password fields
        // IMPORTANT: Preserve the original protocol (rtsp://, http://, https://)
        let cleanUrl = camera.inputUrl || ''
        
        if (cleanUrl) {
          try {
            const url = new URL(cleanUrl)
            // Remove credentials from URL but preserve protocol
            url.username = ''
            url.password = ''
            cleanUrl = url.toString()
          } catch {
            // If URL parsing fails, try to remove credentials manually
            // Preserve protocol by only replacing the auth part
            cleanUrl = cleanUrl.replace(/\/\/([^:@]+):([^@]+)@/, '//')
            cleanUrl = cleanUrl.replace(/\/\/\*\*\*\*:\*\*\*\*@/, '//')
          }
        }
        
        // Try to load password from localStorage (password not returned from API for security)
        const storedPasswordKey = `camera_password_${currentCameraId}`
        const storedPassword = localStorage.getItem(storedPasswordKey)
        
        setCameraConfig(prev => {
          // Only update if the URL actually changed (to prevent overwriting user input)
          // Compare the clean URL (without credentials) to the current URL (without credentials)
          const prevUrlClean = prev.ipCameraUrl ? (() => {
            try {
              const u = new URL(prev.ipCameraUrl);
              u.username = '';
              u.password = '';
              return u.toString();
            } catch {
              return prev.ipCameraUrl.replace(/\/\/([^:@]+):([^@]+)@/, '//').replace(/\/\/\*\*\*\*:\*\*\*\*@/, '//');
            }
          })() : '';
          
          const isFirstLoad = lastLoadedCameraId.current === null;
          const urlChanged = prevUrlClean !== cleanUrl;
          const usernameChanged = prev.username !== camera.username;
          
          // Always update enabled state on first load, or if URL/username changed
          // Don't update enabled state from API when user is actively editing
          if (isFirstLoad || urlChanged || usernameChanged) {
            return {
              ...prev,
              ipCameraUrl: cleanUrl, // This should preserve rtsp://, http://, https://
              username: camera.username,
              // Load password from localStorage if available, otherwise keep existing (user may have typed it)
              password: storedPassword || prev.password,
              // Always update enabled on first load, otherwise only if URL/username changed (not when user is toggling)
              enabled: isFirstLoad ? camera.enabled : (urlChanged || usernameChanged ? camera.enabled : prev.enabled),
            };
          }
          return prev; // No change needed
        })
        
        lastLoadedCameraId.current = currentCameraId
      }
    }
  }, [firstCameraId, camerasRecords, cameraConfig.mediaSource]) // Only trigger when camera ID changes, records array changes, or mediaSource changes, not on enabled changes

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
      // Don't save if component is unmounting/unmounted
      if (!isMountedRef.current) {
        pendingChanges.current = {}
        return
      }
      
      const changes = pendingChanges.current
      pendingChanges.current = {}
      
      if (Object.keys(changes).length === 0) return
      
      setIsSaving(true)
      try {
        await setSettings(changes).unwrap()
        
        // Track settings changes to analytics
        try {
          // Track each changed setting
          for (const [category, value] of Object.entries(changes)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
              // Nested object (e.g., connection, machine, appearance)
              for (const [key, settingValue] of Object.entries(value)) {
                trackSettingsChange(category, key, settingValue)
              }
            } else {
              // Top-level setting (e.g., lang, checkForUpdates)
              trackSettingsChange('general', category, value)
            }
          }
        } catch (analyticsError) {
          // Don't break settings save if analytics fails
          if (import.meta.env.DEV) {
            console.warn('[Settings] Failed to track settings change:', analyticsError)
          }
        }
        
        // Check again after async operation - component might have unmounted
        if (isMountedRef.current) {
          setLastSaved(new Date())
        }
      } catch (error) {
        console.error('Failed to save settings:', error)
      } finally {
        // Only update state if still mounted
        if (isMountedRef.current) {
          setIsSaving(false)
        }
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

  // Settings backup handlers
  const handleExportSettings = useCallback(async () => {
    if (isExporting) return
    
    setIsExporting(true)
    try {
      // Get all extensions (not just 'advanced')
      // For now, we'll just export the advanced extension, but this could be expanded
      const allExtensions: Extensions = {}
      if (extensionsData) {
        allExtensions.advanced = extensionsData
      }
      
      // Collect all data for export
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        appVersion: currentVersionData?.version ?? '0.0.0',
        settings: settings ?? {},
        macros: macrosData?.records ?? [],
        events: eventsData?.records ?? [],
        tools: toolsData?.records ?? [],
        cameras: camerasData?.records ?? [],
        watchFolders: watchFoldersData?.records ?? [],
        extensions: allExtensions,
      }

      // Create and download file
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
      link.download = `axiocnc-settings-${timestamp}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Show success notification
      showInfoNotification(t('Settings Exported'), t('Your settings have been exported successfully.'))
    } catch (error) {
      console.error('Export failed:', error)
      showErrorNotification(t('Export Failed'), t('Failed to export settings. Please try again.'))
    } finally {
      setIsExporting(false)
    }
  }, [
    isExporting,
    settings,
    macrosData,
    eventsData,
    toolsData,
    camerasData,
    watchFoldersData,
    extensionsData,
    currentVersionData,
    showInfoNotification,
    showErrorNotification,
  ])

  const handleImportSettings = useCallback((data: unknown) => {
    // Validate structure
    if (!data || typeof data !== 'object') {
      showErrorNotification(t('Import Failed'), t('Invalid file format. Please select a valid settings file.'))
      return
    }

    const importData = data as {
      version?: string
      settings?: SystemSettings
      macros?: Macro[]
      events?: EventHandler[]
      tools?: Tool[]
      cameras?: Camera[]
      watchFolders?: WatchFolder[]
      extensions?: Extensions
    }

    // Validate that we have at least some data
    if (!importData.settings && !importData.macros && !importData.events && 
        !importData.tools && !importData.cameras && !importData.watchFolders && 
        !importData.extensions) {
      showErrorNotification(t('Import Failed'), t('The file does not contain any settings data.'))
      return
    }

    // Store pending import data and show confirmation dialog
    setPendingImportData(importData)
    setImportDialogOpen(true)
  }, [showErrorNotification])

  const handleConfirmImport = useCallback(async () => {
    if (!pendingImportData || isImporting) return

    setIsImporting(true)
    setImportDialogOpen(false)

    try {
      // Apply system settings
      if (pendingImportData.settings) {
        await setSettings(pendingImportData.settings).unwrap()
      }

      // Apply macros (delete all existing, then create imported ones)
      if (pendingImportData.macros) {
        // Delete all existing macros
        for (const macro of macros) {
          try {
            await deleteMacro(macro.id).unwrap()
          } catch (error) {
            console.error('Failed to delete macro during import:', error)
          }
        }
        // Create imported macros
        for (const macro of pendingImportData.macros) {
          try {
            await createMacro({
              name: macro.name,
              description: macro.description,
              content: macro.content,
            }).unwrap()
          } catch (error) {
            console.error('Failed to create macro during import:', error)
          }
        }
      }

      // Apply events (delete all existing, then create imported ones)
      if (pendingImportData.events) {
        // Delete all existing events
        for (const event of events) {
          try {
            await deleteEvent(event.id).unwrap()
          } catch (error) {
            console.error('Failed to delete event during import:', error)
          }
        }
        // Create imported events
        for (const event of pendingImportData.events) {
          try {
            await createEvent({
              event: event.event,
              trigger: event.trigger,
              commands: event.commands,
              enabled: event.enabled ?? true,
            }).unwrap()
          } catch (error) {
            console.error('Failed to create event during import:', error)
          }
        }
      }

      // Apply tools (delete all existing, then create imported ones)
      if (pendingImportData.tools) {
        // Delete all existing tools
        for (const tool of tools) {
          try {
            await deleteTool(tool.id).unwrap()
          } catch (error) {
            console.error('Failed to delete tool during import:', error)
          }
        }
        // Create imported tools
        for (const tool of pendingImportData.tools) {
          try {
            await createTool({
              toolId: tool.toolId,
              name: tool.name,
              description: tool.description,
              diameter: tool.diameter,
              diameterUnit: tool.diameterUnit,
              type: tool.type,
            }).unwrap()
          } catch (error) {
            console.error('Failed to create tool during import:', error)
          }
        }
      }

      // Apply cameras (delete all existing, then create imported ones)
      if (pendingImportData.cameras) {
        // Delete all existing cameras
        const existingCameras = camerasData?.records ?? []
        for (const camera of existingCameras) {
          try {
            await deleteCamera(camera.id).unwrap()
          } catch (error) {
            console.error('Failed to delete camera during import:', error)
          }
        }
        // Create imported cameras (passwords won't be in export for security)
        for (const camera of pendingImportData.cameras) {
          try {
            await createCamera({
              name: camera.name,
              inputUrl: camera.inputUrl,
              username: camera.username,
              password: camera.password, // May be undefined if exported without password
              enabled: camera.enabled ?? false,
            }).unwrap()
          } catch (error) {
            console.error('Failed to create camera during import:', error)
          }
        }
      }

      // Apply watch folders (delete all existing, then create imported ones)
      if (pendingImportData.watchFolders) {
        // Delete all existing watch folders
        for (const folder of watchFolders) {
          try {
            await deleteWatchFolder(folder.id).unwrap()
          } catch (error) {
            console.error('Failed to delete watch folder during import:', error)
          }
        }
        // Create imported watch folders
        for (const folder of pendingImportData.watchFolders) {
          try {
            await createWatchFolder({
              name: folder.name,
              type: folder.type,
              path: folder.path,
              enabled: folder.enabled ?? true,
            }).unwrap()
          } catch (error) {
            console.error('Failed to create watch folder during import:', error)
          }
        }
      }

      // Apply extensions
      if (pendingImportData.extensions) {
        for (const [key, value] of Object.entries(pendingImportData.extensions)) {
          try {
            await setExtensions({ key, data: value as Record<string, unknown> }).unwrap()
          } catch (error) {
            console.error(`Failed to set extension ${key} during import:`, error)
          }
        }
      }

      // Invalidate all relevant cache tags to force refetch of all data
      store.dispatch(api.util.invalidateTags([
        'Settings',
        'Extensions',
        'Macros',
        'Events',
        'Tools',
        'Cameras',
        'WatchFolders',
      ]))

      // Directly update local state from imported settings (don't wait for refetch)
      if (pendingImportData.settings) {
        const importedSettings = pendingImportData.settings
        
        // Update general settings
        setLanguage(importedSettings.lang ?? 'en')
        setCheckForUpdates(importedSettings.checkForUpdates ?? true)
        setAllowAnalytics(importedSettings.allowAnonymousUsageDataCollection ?? false)
        
        // Update machine config
        if (importedSettings.machine) {
          setMachineConfig(prev => ({
            ...prev,
            name: importedSettings.machine?.name ?? prev.name,
            limits: importedSettings.machine?.limits ?? prev.limits,
            homingCorner: importedSettings.machine?.homingCorner ?? prev.homingCorner,
            autoSwitchToMonitorEnabled: importedSettings.machine?.autoSwitchToMonitor ?? prev.autoSwitchToMonitorEnabled,
            toolSpinupDelayEnabled: importedSettings.machine?.toolSpinup?.enabled ?? prev.toolSpinupDelayEnabled,
            toolSpinupDelaySeconds: importedSettings.machine?.toolSpinup?.delaySeconds ?? prev.toolSpinupDelaySeconds,
          }))
        }
        
        // Update connection config
        if (importedSettings.connection) {
          setConnectionConfig(prev => ({ ...prev, ...importedSettings.connection }))
        }
        
        // Update camera config
        if (importedSettings.camera) {
          setCameraConfig(prev => ({ ...prev, ...importedSettings.camera }))
        }
        
        // Update zeroing methods config
        if (importedSettings.zeroingMethods) {
          setZeroingMethodsConfig(prev => ({ ...prev, ...importedSettings.zeroingMethods }))
        }
        
        // Update zeroing strategies config
        if (importedSettings.zeroingStrategies) {
          setZeroingStrategiesConfig(prev => ({ ...prev, ...importedSettings.zeroingStrategies }))
        }
        
        // Update joystick config
        if (importedSettings.joystick) {
          setJoystickConfig(prev => {
            const loaded = { ...prev, ...importedSettings.joystick }
            const connectionLocation = loaded.connectionLocation || 'server'
            const defaultMappings = getDefaultButtonMappings(connectionLocation)
            if (!loaded.buttonMappings || Object.keys(loaded.buttonMappings).length === 0) {
              loaded.buttonMappings = { ...defaultMappings }
            }
            return loaded
          })
        }
        
        // Update appearance settings (theme, accent color, custom theme)
        if (importedSettings.appearance) {
          if (importedSettings.appearance.theme) {
            setTheme(importedSettings.appearance.theme as 'light' | 'dark' | 'system')
          }
          if (importedSettings.appearance.accentColor) {
            setAccentColor(importedSettings.appearance.accentColor as 'orange' | 'blue' | 'green' | 'purple' | 'red' | 'zinc')
          }
          if (importedSettings.appearance.customThemeId !== undefined) {
            setCustomTheme(importedSettings.appearance.customThemeId)
          }
        }
      }
      
      // Update advanced config from imported extensions
      if (pendingImportData.extensions?.advanced) {
        const advancedData = pendingImportData.extensions.advanced
        if (typeof advancedData === 'object' && advancedData !== null) {
          const config = advancedData as unknown as AdvancedConfig
          setAdvancedConfig(prev => ({ ...prev, ...config }))
        }
      }
      
      // Also refetch to ensure cache is updated for future operations
      await refetchSettings()

      showInfoNotification(t('Settings Imported'), t('Your settings have been imported successfully. You may need to re-enter camera passwords.'))
    } catch (error) {
      console.error('Import failed:', error)
      showErrorNotification(t('Import Failed'), t('Failed to import some settings. Please check the console for details.'))
    } finally {
      setIsImporting(false)
      setPendingImportData(null)
    }
  }, [
    pendingImportData,
    isImporting,
    setSettings,
    macros,
    deleteMacro,
    createMacro,
    events,
    deleteEvent,
    createEvent,
    tools,
    deleteTool,
    createTool,
    camerasData,
    deleteCamera,
    createCamera,
    watchFolders,
    deleteWatchFolder,
    createWatchFolder,
    setExtensions,
    refetchSettings,
    setTheme,
    setAccentColor,
    setCustomTheme,
    showInfoNotification,
    showErrorNotification,
  ])

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
    debouncedSave({
      lang: DEFAULT_LANGUAGE,
      checkForUpdates: DEFAULT_CHECK_FOR_UPDATES,
      allowAnonymousUsageDataCollection: DEFAULT_ALLOW_ANALYTICS,
      connection: DEFAULT_CONNECTION_CONFIG,
      machine: {
        name: DEFAULT_MACHINE_CONFIG.name,
        limits: DEFAULT_MACHINE_CONFIG.limits,
        autoSwitchToMonitor: DEFAULT_MACHINE_CONFIG.autoSwitchToMonitorEnabled,
        toolSpinup: {
          enabled: DEFAULT_MACHINE_CONFIG.toolSpinupDelayEnabled,
          delaySeconds: DEFAULT_MACHINE_CONFIG.toolSpinupDelaySeconds,
        },
      },
      camera: DEFAULT_CAMERA_CONFIG,
      zeroingMethods: DEFAULT_ZEROING_METHODS_CONFIG,
      zeroingStrategies: DEFAULT_ZEROING_STRATEGIES_CONFIG,
      joystick: DEFAULT_JOYSTICK_CONFIG,
    })
    
    console.log('Settings reset to defaults')
  }, [debouncedSave, setTheme, setAccentColor, setCustomTheme, watchFolders, deleteWatchFolder, events, deleteEvent, macros, deleteMacro, createMacro])

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

  const handleShowSetupTutorial = useCallback(() => {
    // Mark as unmounting to prevent any pending state updates
    isMountedRef.current = false
    // Clear any pending debounced saves
    pendingChanges.current = {}
    navigate('/', { state: { showSetupTutorial: true } })
  }, [navigate])


  // Connection config handler
  const handleConnectionConfigChange = useCallback((changes: Partial<ConnectionConfig>) => {
    setConnectionConfig(prev => ({ ...prev, ...changes }))
    debouncedSave({ connection: changes })
  }, [debouncedSave])

  const handleRefreshPorts = useCallback(() => {
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
      socketService.list()
  }, [])
  
  // Auto-refresh ports on mount
  useEffect(() => {
    handleRefreshPorts()
  }, [handleRefreshPorts])

  const handleTestConnection = useCallback(async (): Promise<{ success: boolean; message?: string }> => {
    if (!connectionConfig.port) {
      return { success: false, message: 'No port selected' }
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
          socketService.close(port, () => {
            resolve({ 
              success: true, 
              message: t('Successfully connected to {{port}} at {{baudRate}} baud ({{controllerType}})', {
                port,
                baudRate,
                controllerType: controllerType || 'Grbl',
              }),
            })
          })
        }
      }
      
      socketService.on('serialport:open', handlePortOpen)
      
      // Attempt to open the port
      socketService.open(port, {
        baudrate: baudRate,
        controllerType: controllerType || 'Grbl'
      }, (err: Error | null) => {
        if (err) {
          clearTimeout(testTimeout)
          socketService.off('serialport:open', handlePortOpen)
          const errorMessage = err.message || (typeof err === 'string' ? err : 'Connection failed')
          resolve({ 
            success: false, 
            message: t('Connection failed: {{error}}. Check that the port is available and the machine is powered on.', {
              error: errorMessage,
            }),
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
      if (changes.homingCorner !== undefined) {
        updated.homingCorner = changes.homingCorner
      }
      if (changes.autoSwitchToMonitorEnabled !== undefined) {
        updated.autoSwitchToMonitorEnabled = changes.autoSwitchToMonitorEnabled
      }
      if (changes.toolSpinupDelayEnabled !== undefined) {
        updated.toolSpinupDelayEnabled = changes.toolSpinupDelayEnabled
      }
      if (changes.toolSpinupDelaySeconds !== undefined) {
        updated.toolSpinupDelaySeconds = changes.toolSpinupDelaySeconds
      }
      return updated
    })
    
    // Save to backend
    const saveData: PartialSettings = {}
    if (changes.name !== undefined || changes.limits || changes.homingCorner !== undefined || changes.autoSwitchToMonitorEnabled !== undefined) {
      saveData.machine = saveData.machine || {}
      if (changes.name !== undefined) saveData.machine.name = changes.name
      if (changes.limits) saveData.machine.limits = changes.limits
      if (changes.homingCorner !== undefined) saveData.machine.homingCorner = changes.homingCorner
      if (changes.autoSwitchToMonitorEnabled !== undefined) {
        saveData.machine.autoSwitchToMonitor = changes.autoSwitchToMonitorEnabled
      }
    }
    if (changes.toolSpinupDelayEnabled !== undefined || changes.toolSpinupDelaySeconds !== undefined) {
      saveData.machine = saveData.machine || {}
      saveData.machine.toolSpinup = {}
      if (changes.toolSpinupDelayEnabled !== undefined) {
        saveData.machine.toolSpinup.enabled = changes.toolSpinupDelayEnabled
      }
      if (changes.toolSpinupDelaySeconds !== undefined) {
        saveData.machine.toolSpinup.delaySeconds = changes.toolSpinupDelaySeconds
      }
    }
    if (Object.keys(saveData).length > 0) {
      debouncedSave(saveData)
    }
  }, [debouncedSave])

  // Camera config handler - directly uses cameras API
  const handleCameraConfigChange = useCallback(async (changes: Partial<CameraConfig>) => {
    const updated = { ...cameraConfig, ...changes }
    
    // Mark that user is editing to prevent API from overwriting changes
    isUserEditing.current = true
    
    // Update local state
    setCameraConfig(updated)
    
    // Since we only support one camera, get the first (and only) camera
    const existingCamera = camerasData?.records?.[0]
    
    // If password is being set/changed, store it in localStorage (API doesn't return it for security)
    if (changes.password !== undefined && existingCamera?.id) {
      const storedPasswordKey = `camera_password_${existingCamera.id}`
      if (changes.password) {
        localStorage.setItem(storedPasswordKey, changes.password)
      } else {
        localStorage.removeItem(storedPasswordKey)
      }
    }
    
    // Save to cameras API if:
    // 1. We have a URL (create or update with URL)
    // 2. OR we're updating enabled state and a camera already exists (allow toggling enabled without URL)
    const shouldSaveToCamerasAPI = updated.mediaSource === 'ip-camera' && (
      updated.ipCameraUrl || // Has URL - always save
      (changes.enabled !== undefined && existingCamera) // Or updating enabled state for existing camera
    )
    
    if (shouldSaveToCamerasAPI) {
      // Strip any credentials from the URL - they should be in separate username/password fields
      let cleanInputUrl = updated.ipCameraUrl || ''
      if (cleanInputUrl) {
        try {
          const url = new URL(cleanInputUrl)
          // Remove credentials from URL
          url.username = ''
          url.password = ''
          cleanInputUrl = url.toString()
        } catch {
          // If URL parsing fails, try to remove credentials manually
          cleanInputUrl = cleanInputUrl.replace(/\/\/([^:@]+):([^@]+)@/, '//')
          cleanInputUrl = cleanInputUrl.replace(/\/\/\*\*\*\*:\*\*\*\*@/, '//')
        }
      }
      
      const cameraData: Partial<Omit<Camera, 'id' | 'createdAt' | 'updatedAt'>> = {
        name: 'Camera 1',
        enabled: updated.enabled, // Always include enabled state
      }
      
      // Only include URL-related fields if we have a URL
      if (updated.ipCameraUrl) {
        cameraData.inputUrl = cleanInputUrl
        cameraData.username = updated.username
        cameraData.password = updated.password
      }
      
      // Show saving indicator
      setIsSaving(true)
      
      try {
        if (existingCamera) {
          // Update existing camera (id is ignored by backend, but we pass it for API compatibility)
          await updateCamera({ id: existingCamera.id, updates: cameraData }).unwrap()
        } else if (updated.ipCameraUrl) {
          // Only create new camera if we have a URL (required for creation)
          // Name defaults to 'Camera 1' if not provided
          await createCamera({
            name: 'Camera 1',
            inputUrl: cleanInputUrl,
            username: updated.username,
            password: updated.password,
            enabled: updated.enabled ?? false,
          }).unwrap()
        }
        // Show saved indicator
        setLastSaved(new Date())
      } catch (err) {
        console.error('Failed to save camera:', err)
      } finally {
        setIsSaving(false)
        // Reset editing flag after a short delay to allow API to update
        setTimeout(() => {
          isUserEditing.current = false
        }, 1000)
      }
    } else {
      // Reset editing flag immediately if not saving to API
      setTimeout(() => {
        isUserEditing.current = false
      }, 500)
    }
    
    // Only save display options (flip, rotation, crosshair) to settings.camera
    const displayOptions: Partial<CameraConfig> = {}
    if (changes.flipHorizontal !== undefined) displayOptions.flipHorizontal = changes.flipHorizontal
    if (changes.flipVertical !== undefined) displayOptions.flipVertical = changes.flipVertical
    if (changes.rotation !== undefined) displayOptions.rotation = changes.rotation
    if (changes.crosshair !== undefined) displayOptions.crosshair = changes.crosshair
    if (changes.crosshairColor !== undefined) displayOptions.crosshairColor = changes.crosshairColor
    
    if (Object.keys(displayOptions).length > 0) {
      debouncedSave({ camera: displayOptions })
    }
  }, [cameraConfig, camerasData, createCamera, updateCamera, debouncedSave])


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

  // Tools handlers (API-backed)
  const handleAddTool = useCallback(async (tool: Omit<Tool, 'id' | 'mtime'>) => {
    try {
      await createTool(tool).unwrap()
    } catch (error) {
      console.error('Failed to create tool:', error)
    }
  }, [createTool])

  const handleEditTool = useCallback(async (tool: Tool) => {
    try {
      await updateTool({ id: tool.id, updates: { toolId: tool.toolId, name: tool.name, description: tool.description, diameter: tool.diameter, diameterUnit: tool.diameterUnit, type: tool.type } }).unwrap()
    } catch (error) {
      console.error('Failed to update tool:', error)
    }
  }, [updateTool])

  const handleDeleteTool = useCallback(async (id: string) => {
    try {
      await deleteTool(id).unwrap()
    } catch (error) {
      console.error('Failed to delete tool:', error)
    }
  }, [deleteTool])

  // Joystick handlers
  const handleJoystickConfigChange = useCallback(async (changes: Partial<JoystickConfig>) => {
    setJoystickConfig(prev => {
      const updated = { ...prev, ...changes }
      
      // If connectionLocation changed, apply appropriate default button mappings
      // (only if current mappings match the old defaults, to preserve user customizations)
      if ('connectionLocation' in changes && changes.connectionLocation) {
        const oldDefaults = getDefaultButtonMappings(prev.connectionLocation)
        const newDefaults = getDefaultButtonMappings(changes.connectionLocation)
        
        // Check if current mappings match old defaults
        // Compare all keys in old defaults and all keys in current mappings
        const oldDefaultKeys = Object.keys(oldDefaults).map(Number).sort()
        const currentMappingKeys = Object.keys(prev.buttonMappings).map(Number).sort()
        
        // Check if keys match and values match
        const keysMatch = oldDefaultKeys.length === currentMappingKeys.length &&
          oldDefaultKeys.every((key, i) => key === currentMappingKeys[i])
        
        const valuesMatch = keysMatch && oldDefaultKeys.every(key => {
          return prev.buttonMappings[key] === oldDefaults[key]
        })
        
        // If mappings match old defaults (or are empty), apply new defaults
        if (valuesMatch || Object.keys(prev.buttonMappings).length === 0) {
          updated.buttonMappings = { ...newDefaults } as Record<number, CncAction>
        }
        // Otherwise, keep existing mappings (user has customizations)
      }
      
      // If selectedGamepad changed and connectionLocation is 'server', also call the API
      if ('selectedGamepad' in changes && updated.connectionLocation === 'server') {
        setSelectedGamepad({ gamepadId: changes.selectedGamepad || null }).catch(err => {
          console.error('Failed to set selected gamepad on server:', err)
        })
      }
      
      return updated
    })
    debouncedSave({ joystick: changes })
  }, [debouncedSave, setSelectedGamepad])

  // Advanced config handler (stored in extensions API)
  const handleAdvancedConfigChange = useCallback(async (changes: Partial<AdvancedConfig>) => {
    setAdvancedConfig(prev => {
      const updated = { ...prev, ...changes }
      // Store in extensions API
      setExtensions({ key: 'advanced', data: updated }).catch(err => {
        console.error('Failed to save advanced config:', err)
      })
      return updated
    })
  }, [setExtensions])

  const handleRefreshGamepads = useCallback(async () => {
    if (!isMountedRef.current) {
      return []
    }
    // Check if using server-side or client-side gamepad
    if (joystickConfig.connectionLocation === 'server') {
      // Call server API to refresh gamepads
      try {
        const result = await refreshGamepads().unwrap()
        const detected = result.gamepads.map((gp, idx) => ({
          id: gp.id,
          index: idx,
          name: gp.name,
          buttons: gp.buttons || 16,
          axes: gp.axes || 4,
        }))
        if (isMountedRef.current) {
          setDetectedGamepads(detected)
        }
      } catch (error) {
        console.error('Failed to refresh server gamepads:', error)
      }
    } else {
      // Use browser Gamepad API for client-side gamepads
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
      
      if (isMountedRef.current) {
        setDetectedGamepads(detected)
      }
      
      return detected
    }
    return []
  }, [joystickConfig.connectionLocation, refreshGamepads])

  // Auto-refresh gamepads when joystick config is initialized or connectionLocation changes
  // This ensures the gamepad list is populated so the Select can match the saved selectedGamepad
  useEffect(() => {
    // Refresh gamepads when:
    // 1. Settings have been initialized
    // 2. Joystick is enabled
    // 3. No gamepads are detected yet (or connectionLocation changed)
    // This ensures the saved selectedGamepad can be matched in the Select dropdown
    if (hasInitialized.current && joystickConfig.enabled) {
      if (detectedGamepads.length === 0 || joystickConfig.selectedGamepad) {
        handleRefreshGamepads()
      }
    }
  }, [joystickConfig.connectionLocation, joystickConfig.enabled, joystickConfig.selectedGamepad, detectedGamepads.length, handleRefreshGamepads])

  // Listen for gamepad connection events (client-side only)
  // This allows automatic reconnection when a gamepad is plugged in
  useEffect(() => {
    if (joystickConfig.connectionLocation !== 'client' || !joystickConfig.enabled) {
      return
    }

    // Track pending timeouts and animation frames to cancel on unmount
    let pendingRaf: number | null = null
    let pendingTimeout: ReturnType<typeof setTimeout> | null = null

    const handleGamepadConnected = async (e: GamepadEvent) => {
      const gamepad = e.gamepad
      if (!gamepad) return

      // Always refresh the list first to ensure it's up to date
      // This will update detectedGamepads state
      const detected = await handleRefreshGamepads()
      
      // Check if component is still mounted before proceeding
      // This prevents state updates after navigation/unmount
      if (!isMountedRef.current) {
        return
      }
      
      // Check if the gamepad is now in the detected list
      const isInList = detected.some(gp => gp.id === gamepad.id)
      
      // Wait for React state to update after refresh, then check if we should auto-select
      // Use requestAnimationFrame + setTimeout to ensure state has propagated
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = null
        pendingTimeout = setTimeout(() => {
          pendingTimeout = null
          // Check if component is still mounted before updating state
          if (!isMountedRef.current) {
            return
          }
          
          // Check the current selected gamepad
          const currentSelected = joystickConfig.selectedGamepad
          if (currentSelected === gamepad.id) {
            // Gamepad is already selected, nothing to do
            return
          } else if (!currentSelected && isInList) {
            // No gamepad selected yet, and this one is now detected - auto-select it
            handleJoystickConfigChange({ selectedGamepad: gamepad.id })
          }
          // If a different gamepad is selected, don't change it
        }, 100)
      })
    }

    const handleGamepadDisconnected = (e: GamepadEvent) => {
      const gamepad = e.gamepad
      if (!gamepad) return

      // Check if component is still mounted before updating state
      if (!isMountedRef.current) {
        return
      }
      
      // Refresh the list to update connection status
      handleRefreshGamepads()
    }

    // Add event listeners
    window.addEventListener('gamepadconnected', handleGamepadConnected)
    window.addEventListener('gamepaddisconnected', handleGamepadDisconnected)

    // Also check for already-connected gamepads on mount
    // (browsers require user interaction, but we can check if one is already connected)
    if (joystickConfig.selectedGamepad) {
      const gamepads = navigator.getGamepads?.() || []
      const isConnected = Array.from(gamepads).some(
        gp => gp && gp.id === joystickConfig.selectedGamepad
      )
      
      if (isConnected) {
        // Gamepad is already connected, refresh the list
        handleRefreshGamepads()
      }
    }

    return () => {
      // Cancel any pending animation frames and timeouts to prevent state updates after unmount
      if (pendingRaf !== null) {
        cancelAnimationFrame(pendingRaf)
      }
      if (pendingTimeout !== null) {
        clearTimeout(pendingTimeout)
      }
      window.removeEventListener('gamepadconnected', handleGamepadConnected)
      window.removeEventListener('gamepaddisconnected', handleGamepadDisconnected)
    }
  }, [joystickConfig.connectionLocation, joystickConfig.enabled, joystickConfig.selectedGamepad, handleRefreshGamepads, handleJoystickConfigChange])

  // Mark component as mounted on mount and unmounted on cleanup
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])
  
  // Cancel any pending debounced saves when unmounting
  useEffect(() => {
    return () => {
      // Cancel pending flush when component unmounts
      pendingChanges.current = {}
    }
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
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={() => {
                // Mark as unmounting to prevent any pending state updates
                isMountedRef.current = false
                // Clear any pending debounced saves
                pendingChanges.current = {}
                // Navigate
                navigate('/')
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            <div className="h-6 w-px bg-border" />
            <h1 className="text-xl font-semibold">{t('Settings')}</h1>
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
              <SettingsNav 
                activeId={activeId} 
                onNavigate={scrollTo}
                showAdvanced={advancedConfig.showAdvancedSettings}
              />
            </div>
          </aside>

          {/* Settings content */}
          <main className="flex-1 min-w-0 max-w-3xl">
            <GeneralSection
              language={language}
              watchFolders={watchFolders}
              googleDriveStatus={googleDriveStatus}
              onLanguageChange={handleLanguageChange}
              onImportSettings={handleImportSettings}
              onExportSettings={handleExportSettings}
              onRestoreDefaults={handleRestoreDefaults}
              onAddWatchFolder={handleAddWatchFolder}
              onRemoveWatchFolder={handleRemoveWatchFolder}
              onConnectGoogleDrive={handleConnectGoogleDrive}
              onDisconnectGoogleDrive={handleDisconnectGoogleDrive}
              isExporting={isExporting}
              isImporting={isImporting}
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
              onConfigChange={handleCameraConfigChange}
            />

            <JoystickSection
              config={joystickConfig}
              detectedGamepads={detectedGamepads}
              onConfigChange={handleJoystickConfigChange}
              onRefreshGamepads={handleRefreshGamepads}
            />

            <ToolLibrarySection
              tools={tools}
              onAdd={handleAddTool}
              onEdit={handleEditTool}
              onDelete={handleDeleteTool}
            />

            <MacrosSection
              macros={macros}
              onAdd={handleAddMacro}
              onEdit={handleEditMacro}
              onDelete={handleDeleteMacro}
            />

            <EventsSection
              events={events}
              onAdd={handleAddEvent}
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
              onToggleEnabled={handleToggleEventEnabled}
            />

            {advancedConfig.showAdvancedSettings && (
              <AdvancedSection
                config={advancedConfig}
                onConfigChange={handleAdvancedConfigChange}
              />
            )}

            <AboutSection
              version={currentVersionData?.version ?? 'Unknown'}
              checkForUpdates={checkForUpdates}
              allowAnalytics={allowAnalytics}
              onCheckForUpdatesChange={handleCheckForUpdatesChange}
              onAnalyticsChange={handleAnalyticsChange}
              onEnableAdvancedSettings={() => handleAdvancedConfigChange({ showAdvancedSettings: true })}
              onShowSetupTutorial={handleShowSetupTutorial}
            />
          </main>
        </div>
      </div>

      {/* Import Confirmation Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Settings</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p className="text-destructive font-medium">
                  This will replace all your current settings. This action cannot be undone.
                </p>
                <p>
                  The following data will be imported:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  {pendingImportData?.settings && <li>System settings (connection, machine, camera, etc.)</li>}
                  {pendingImportData?.macros && <li>{pendingImportData.macros.length} macro(s)</li>}
                  {pendingImportData?.events && <li>{pendingImportData.events.length} event handler(s)</li>}
                  {pendingImportData?.tools && <li>{pendingImportData.tools.length} tool(s)</li>}
                  {pendingImportData?.cameras && <li>{pendingImportData.cameras.length} camera(s)</li>}
                  {pendingImportData?.watchFolders && <li>{pendingImportData.watchFolders.length} watch folder(s)</li>}
                  {pendingImportData?.extensions && <li>Extension data</li>}
                </ul>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 font-medium">
                    Important: Camera passwords are not included in exports for security reasons. 
                    You will need to re-enter camera passwords after importing.
                  </p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false)
                setPendingImportData(null)
              }}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmImport}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                'Import Settings'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
