import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useScrollSpy } from '@/hooks/useScrollSpy'
import { useDebouncedCallback } from '@/hooks/useDebounce'
import { useGetStateQuery, useSetStateMutation } from '@/services/api'
import { useTheme } from '@/components/theme-provider'
import { SettingsNav, settingsSections } from './SettingsNav'
import { 
  GeneralSection, 
  AppearanceSection,
  MachineSection,
  JoystickSection,
  UserAccountsSection,
  CommandsSection,
  EventsSection,
  AboutSection,
  type MachineConfig,
  type UserAccount,
  type Command,
  type EventHandler,
  type Theme,
  type AccentColor,
  type JoystickConfig,
} from './sections'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Check, Loader2 } from 'lucide-react'

// App version - in a real app this would come from package.json or API
const APP_VERSION = '2.0.0-beta'

// Default machine configuration
const DEFAULT_MACHINE_CONFIG: MachineConfig = {
  name: 'My CNC Machine',
  limits: {
    xmin: 0,
    xmax: 300,
    ymin: 0,
    ymax: 300,
    zmin: -50,
    zmax: 0,
  },
  ignoreErrors: false,
}

const MOCK_USERS: UserAccount[] = []

const MOCK_COMMANDS: Command[] = [
  {
    id: '1',
    title: 'Zero All Axes',
    commands: 'G10 L20 P1 X0 Y0 Z0',
    enabled: true,
    mtime: Date.now() - 86400000,
  },
]

const MOCK_EVENTS: EventHandler[] = [
  {
    id: '1',
    event: 'gcode:start',
    trigger: 'gcode',
    commands: 'M3 S1000',
    enabled: true,
    mtime: Date.now() - 172800000,
  },
]

// Default joystick configuration
const DEFAULT_JOYSTICK_CONFIG: JoystickConfig = {
  enabled: false,
  selectedGamepad: null,
  buttonMappings: {
    0: 'zero_all',      // A - Zero all
    1: 'emergency_stop', // B - E-Stop
    2: 'home_all',      // X - Home
    3: 'spindle_toggle', // Y - Spindle
    4: 'speed_slow',    // LB - Slow
    5: 'speed_fast',    // RB - Fast
    12: 'jog_y_pos',    // D-Up
    13: 'jog_y_neg',    // D-Down
    14: 'jog_x_neg',    // D-Left
    15: 'jog_x_pos',    // D-Right
  },
  analogMappings: {
    left_x: 'jog_x',
    left_y: 'jog_y',
    right_x: 'none',
    right_y: 'jog_z',
  },
  deadzone: 0.15,
  sensitivity: 1.0,
  invertX: false,
  invertY: false,
  invertZ: false,
  analogJogSpeedXY: 3000,
  analogJogSpeedZ: 1000,
}

export default function Settings() {
  const { theme, accentColor, setTheme, setAccentColor } = useTheme()
  
  // RTK Query hooks
  const { data: appState, isLoading } = useGetStateQuery()
  const [setState] = useSetStateMutation()

  // Local state for form values
  const [language, setLanguage] = useState('en')
  const [allowAnalytics, setAllowAnalytics] = useState(false)
  
  // Mock state for CRUD sections (will be connected to API later)
  const [machineConfig, setMachineConfig] = useState<MachineConfig>(DEFAULT_MACHINE_CONFIG)
  const [users, setUsers] = useState<UserAccount[]>(MOCK_USERS)
  const [commands, setCommands] = useState<Command[]>(MOCK_COMMANDS)
  const [events, setEvents] = useState<EventHandler[]>(MOCK_EVENTS)
  const [joystickConfig, setJoystickConfig] = useState<JoystickConfig>(DEFAULT_JOYSTICK_CONFIG)
  const [detectedGamepads, setDetectedGamepads] = useState<{ id: string; index: number; name: string; buttons: number; axes: number }[]>([])
  
  // Saving indicator state
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Scroll spy for navigation
  const sectionIds = settingsSections.map(s => s.id)
  const { activeId, scrollTo } = useScrollSpy(sectionIds, { offset: 100 })

  // Initialize local state from API data
  useEffect(() => {
    if (appState) {
      setAllowAnalytics(appState.allowAnonymousUsageDataCollection ?? false)
      // Backend stores ignoreErrors under controller.exception.ignoreErrors
      const controllerState = appState.controller as { exception?: { ignoreErrors?: boolean } } | undefined
      if (controllerState?.exception?.ignoreErrors !== undefined) {
        setMachineConfig(prev => ({ ...prev, ignoreErrors: controllerState.exception!.ignoreErrors! }))
      }
    }
  }, [appState])

  // Auto-save function with debounce
  const debouncedSave = useDebouncedCallback(
    async (data: Record<string, unknown>) => {
      setIsSaving(true)
      try {
        await setState(data).unwrap()
        setLastSaved(new Date())
      } catch (error) {
        console.error('Failed to save setting:', error)
      } finally {
        setIsSaving(false)
      }
    },
    500
  )

  // Handlers for General section
  const handleLanguageChange = useCallback((value: string) => {
    setLanguage(value)
    debouncedSave({ lang: value })
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

  const handleRestoreDefaults = useCallback(() => {
    console.log('Restore defaults')
    // TODO: Implement restore defaults
  }, [])

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
        // Save ignoreErrors to backend immediately
        debouncedSave({ controller: { exception: { ignoreErrors: changes.ignoreErrors } } })
      }
      return updated
    })
    // TODO: Auto-save other machine config to backend
  }, [debouncedSave])

  // User accounts handlers (UI only for now)
  const handleAddUser = useCallback(() => {
    console.log('Add user')
    // TODO: Open modal to add user
  }, [])

  const handleEditUser = useCallback((user: UserAccount) => {
    console.log('Edit user:', user)
    // TODO: Open modal to edit user
  }, [])

  const handleDeleteUser = useCallback((id: string) => {
    setUsers(prev => prev.filter(u => u.id !== id))
  }, [])

  const handleToggleUserEnabled = useCallback((id: string, enabled: boolean) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, enabled } : u))
  }, [])

  // Commands handlers (UI only for now)
  const handleAddCommand = useCallback(() => {
    console.log('Add command')
    // TODO: Open modal to add command
  }, [])

  const handleEditCommand = useCallback((command: Command) => {
    console.log('Edit command:', command)
    // TODO: Open modal to edit command
  }, [])

  const handleDeleteCommand = useCallback((id: string) => {
    setCommands(prev => prev.filter(c => c.id !== id))
  }, [])

  const handleToggleCommandEnabled = useCallback((id: string, enabled: boolean) => {
    setCommands(prev => prev.map(c => c.id === id ? { ...c, enabled } : c))
  }, [])

  // Events handlers (UI only for now)
  const handleAddEvent = useCallback(() => {
    console.log('Add event')
    // TODO: Open modal to add event
  }, [])

  const handleEditEvent = useCallback((event: EventHandler) => {
    console.log('Edit event:', event)
    // TODO: Open modal to edit event
  }, [])

  const handleDeleteEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id))
  }, [])

  const handleToggleEventEnabled = useCallback((id: string, enabled: boolean) => {
    setEvents(prev => prev.map(e => e.id === id ? { ...e, enabled } : e))
  }, [])

  // Joystick handlers
  const handleJoystickConfigChange = useCallback((changes: Partial<JoystickConfig>) => {
    setJoystickConfig(prev => ({ ...prev, ...changes }))
  }, [])

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
              allowAnalytics={allowAnalytics}
              onLanguageChange={handleLanguageChange}
              onAnalyticsChange={handleAnalyticsChange}
              onImportSettings={handleImportSettings}
              onExportSettings={handleExportSettings}
              onRestoreDefaults={handleRestoreDefaults}
            />

            <AppearanceSection
              theme={theme as Theme}
              accentColor={accentColor as AccentColor}
              onThemeChange={setTheme}
              onAccentColorChange={setAccentColor}
            />

            <MachineSection
              config={machineConfig}
              onConfigChange={handleMachineConfigChange}
            />

            <JoystickSection
              config={joystickConfig}
              detectedGamepads={detectedGamepads}
              onConfigChange={handleJoystickConfigChange}
              onRefreshGamepads={handleRefreshGamepads}
            />

            <UserAccountsSection
              users={users}
              onAdd={handleAddUser}
              onEdit={handleEditUser}
              onDelete={handleDeleteUser}
              onToggleEnabled={handleToggleUserEnabled}
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
              version={APP_VERSION}
            />
          </main>
        </div>
      </div>
    </div>
  )
}
