import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { 
  Gamepad2, 
  RefreshCw, 
  CircleDot,
  Play,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { JoystickTestDialog } from './JoystickTestDialog'

import { 
  CNC_ACTIONS,
  GAMEPAD_BUTTONS,
  type CncAction,
} from './joystickConstants'

// Re-export for convenience
// eslint-disable-next-line react-refresh/only-export-components
export { CNC_ACTIONS, getGamepadButtons, type CncAction } from './joystickConstants'

export type AnalogAxis = 'left_x' | 'left_y' | 'right_x' | 'right_y'
export type AnalogMapping = 'none' | 'jog_x' | 'jog_y' | 'jog_z' | 'feed_rate'

export interface JoystickConfig {
  enabled: boolean
  connectionLocation: 'server' | 'client'
  selectedGamepad: string | null
  buttonMappings: Record<number, CncAction>
  analogMappings: Record<AnalogAxis, AnalogMapping>
  deadzone: number
  sensitivity: number
  invertX: boolean
  invertY: boolean
  invertZ: boolean
  analogJogSpeedXY: number // mm/min max speed for X/Y analog jogging
  analogJogSpeedZ: number  // mm/min max speed for Z analog jogging
  locked: boolean // Lock joystick to prevent accidental movement
}

interface DetectedGamepad {
  id: string
  index: number
  name: string
  buttons: number
  axes: number
}

interface JoystickSectionProps {
  config: JoystickConfig
  detectedGamepads: DetectedGamepad[]
  onConfigChange: (config: Partial<JoystickConfig>) => void
  onRefreshGamepads: () => void
}

export function JoystickSection({
  config,
  detectedGamepads,
  onConfigChange,
  onRefreshGamepads,
}: JoystickSectionProps) {
  const { t } = useTranslation()
  const [activeButtonIndex] = useState<number | null>(null)
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [isGamepadConnected, setIsGamepadConnected] = useState(false)

  // Check if selected gamepad is currently connected
  const checkGamepadConnection = useCallback(() => {
    if (!config.selectedGamepad) {
      setIsGamepadConnected(false)
      return
    }

    if (config.connectionLocation === 'client') {
      // Check browser Gamepad API
      const gamepads = navigator.getGamepads?.() || []
      const isConnected = Array.from(gamepads).some(
        gp => gp && gp.id === config.selectedGamepad
      )
      setIsGamepadConnected(isConnected)
    } else {
      // Check if gamepad is in detectedGamepads list (server-side)
      const isConnected = detectedGamepads.some(
        gp => gp.id === config.selectedGamepad
      )
      setIsGamepadConnected(isConnected)
    }
  }, [config.selectedGamepad, config.connectionLocation, detectedGamepads])

  // Check connection status periodically and when dependencies change
  useEffect(() => {
    checkGamepadConnection()
    
    if (config.connectionLocation === 'client' && config.selectedGamepad) {
      // For client-side, check more frequently (gamepads can connect/disconnect)
      const interval = setInterval(checkGamepadConnection, 1000)
      return () => clearInterval(interval)
    }
  }, [checkGamepadConnection, config.connectionLocation, config.selectedGamepad])

  // Also check when detectedGamepads changes (for server-side)
  useEffect(() => {
    if (config.connectionLocation === 'server') {
      checkGamepadConnection()
    }
  }, [detectedGamepads, config.connectionLocation, checkGamepadConnection])


  const handleButtonMappingChange = (buttonIndex: number, action: CncAction) => {
    onConfigChange({
      buttonMappings: {
        ...config.buttonMappings,
        [buttonIndex]: action,
      },
    })
  }

  const handleAnalogMappingChange = (axis: AnalogAxis, mapping: AnalogMapping) => {
    onConfigChange({
      analogMappings: {
        ...config.analogMappings,
        [axis]: mapping,
      },
    })
  }

  // Group actions by category for the select dropdown
  const actionsByCategory = CNC_ACTIONS.reduce((acc, action) => {
    if (!acc[action.category]) acc[action.category] = []
    acc[action.category].push(action)
    return acc
  }, {} as Record<string, typeof CNC_ACTIONS>)

  return (
    <SettingsSection
      id="joystick"
      title={t('Joystick / Gamepad')}
      description={t('Configure gamepad controls for hands-on CNC operation')}
    >
      {/* Enable/Disable */}
      <SettingsField
        label={t('Enable Gamepad Support')}
        description={t('Use a connected gamepad to control your CNC machine')}
        horizontal
      >
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onConfigChange({ enabled })}
        />
      </SettingsField>

      {config.enabled && (
        <>
          {/* Connection Location */}
          <SettingsField
            label={t('Gamepad Connection Location')}
            description={t('Choose which machine the joystick is connected to. If you\'re running this browser on the same machine that\'s running the AxioCNC server, choose Server for better reliability. Note: Server-side gamepads only work on Linux servers.')}
          >
            <Select
              value={config.connectionLocation || 'server'}
              onValueChange={(value: 'server' | 'client') => onConfigChange({ connectionLocation: value, selectedGamepad: null })}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="server">{t('Server (Machine running AxioCNC)')}</SelectItem>
                <SelectItem value="client">{t('Client (Machine running browser)')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>

          {/* Gamepad Selection */}
          <SettingsField
            label={t('Select Gamepad')}
            tooltip={config.selectedGamepad 
              ? (isGamepadConnected 
                  ? t('Connected') 
                  : t('Disconnected') + (config.connectionLocation === 'client' ? '. ' + t('Press a button on your gamepad while this webpage is focused to connect.') : ''))
              : undefined
            }
            description={config.connectionLocation === 'server' 
              ? t('Select a gamepad connected to the server machine')
              : t('Select a gamepad connected to this browser\'s machine')}
          >
            <div className="flex gap-2 items-center">
              <Select
                value={config.selectedGamepad || 'none'}
                onValueChange={(value) => onConfigChange({ selectedGamepad: value === 'none' ? null : value })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('Select a gamepad...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {detectedGamepads.length === 0 ? t('No gamepads detected') : t('None selected')}
                  </SelectItem>
                  {detectedGamepads.map((gp) => (
                    <SelectItem key={gp.id} value={gp.id}>
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4" />
                        <span>{gp.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {t('{{count}} buttons', { count: gp.buttons })}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                  {/* Show selected gamepad even if not detected */}
                  {config.selectedGamepad && !detectedGamepads.find(gp => gp.id === config.selectedGamepad) && (
                    <SelectItem value={config.selectedGamepad}>
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4" />
                        <span className="text-muted-foreground">
                          {config.selectedGamepad.split('(')[0].trim() || t('Gamepad')} {t('(not detected)')}
                        </span>
                      </div>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={onRefreshGamepads}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              {config.selectedGamepad && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card">
                  {isGamepadConnected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      <span className="text-sm text-green-600 dark:text-green-400">{t('Connected')}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm text-red-600 dark:text-red-400">{t('Disconnected')}</span>
                    </>
                  )}
                </div>
              )}
              <Button 
                variant="outline" 
                onClick={() => setTestDialogOpen(true)}
                className="gap-2"
                disabled={!config.selectedGamepad}
              >
                <Play className="w-4 h-4" />
                {t('Test')}
              </Button>
            </div>
            {config.connectionLocation === 'client' && (
              <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  {t('For browser-connected gamepads, you must press a button on your gamepad while this webpage is focused to connect.')}
                </p>
              </div>
            )}
          </SettingsField>

          {/* Analog Stick Settings */}
          <div className="space-y-4 pt-4">
            <h4 className="font-medium text-sm">{t('Analog Stick Configuration')}</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Stick */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <CircleDot className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{t('Left Stick')}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">{t('Horizontal (X)')}</Label>
                    <Select
                      value={config.analogMappings.left_x}
                      onValueChange={(v) => handleAnalogMappingChange('left_x', v as AnalogMapping)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('None')}</SelectItem>
                        <SelectItem value="jog_x">{t('Jog X Axis')}</SelectItem>
                        <SelectItem value="jog_y">{t('Jog Y Axis')}</SelectItem>
                        <SelectItem value="jog_z">{t('Jog Z Axis')}</SelectItem>
                        <SelectItem value="feed_rate">{t('Feed Rate')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">{t('Vertical (Y)')}</Label>
                    <Select
                      value={config.analogMappings.left_y}
                      onValueChange={(v) => handleAnalogMappingChange('left_y', v as AnalogMapping)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('None')}</SelectItem>
                        <SelectItem value="jog_x">{t('Jog X Axis')}</SelectItem>
                        <SelectItem value="jog_y">{t('Jog Y Axis')}</SelectItem>
                        <SelectItem value="jog_z">{t('Jog Z Axis')}</SelectItem>
                        <SelectItem value="feed_rate">{t('Feed Rate')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Right Stick */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <CircleDot className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">{t('Right Stick')}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">{t('Horizontal (X)')}</Label>
                    <Select
                      value={config.analogMappings.right_x}
                      onValueChange={(v) => handleAnalogMappingChange('right_x', v as AnalogMapping)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('None')}</SelectItem>
                        <SelectItem value="jog_x">{t('Jog X Axis')}</SelectItem>
                        <SelectItem value="jog_y">{t('Jog Y Axis')}</SelectItem>
                        <SelectItem value="jog_z">{t('Jog Z Axis')}</SelectItem>
                        <SelectItem value="feed_rate">{t('Feed Rate')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">{t('Vertical (Y)')}</Label>
                    <Select
                      value={config.analogMappings.right_y}
                      onValueChange={(v) => handleAnalogMappingChange('right_y', v as AnalogMapping)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('None')}</SelectItem>
                        <SelectItem value="jog_x">{t('Jog X Axis')}</SelectItem>
                        <SelectItem value="jog_y">{t('Jog Y Axis')}</SelectItem>
                        <SelectItem value="jog_z">{t('Jog Z Axis')}</SelectItem>
                        <SelectItem value="feed_rate">{t('Feed Rate')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Analog Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <SettingsField
                label={t('Deadzone')}
                description={t('Ignore small stick movements')}
                tooltip={t('Values below this threshold are ignored to prevent drift')}
              >
                <div className="flex items-center gap-4">
                  <Slider
                    value={[config.deadzone]}
                    onValueChange={([v]) => onConfigChange({ deadzone: v })}
                    min={0}
                    max={0.5}
                    step={0.01}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {(config.deadzone * 100).toFixed(0)}%
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label={t('Sensitivity')}
                description={t('Response curve for analog input')}
              >
                <div className="flex items-center gap-4">
                  <Slider
                    value={[config.sensitivity]}
                    onValueChange={([v]) => onConfigChange({ sensitivity: v })}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {config.sensitivity.toFixed(1)}x
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label={t('Max XY Jog Speed')}
                description={t('Maximum speed for X/Y axis jogging')}
                tooltip={t('The speed at full stick deflection for X and Y axes in mm/min')}
              >
                <div className="flex items-center gap-4">
                  <Slider
                    value={[config.analogJogSpeedXY]}
                    onValueChange={([v]) => onConfigChange({ analogJogSpeedXY: v })}
                    min={100}
                    max={10000}
                    step={100}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-24 text-right">
                    {config.analogJogSpeedXY} {t('mm/min')}
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label={t('Max Z Jog Speed')}
                description={t('Maximum speed for Z axis jogging')}
                tooltip={t('The speed at full stick deflection for Z axis in mm/min. Often set lower than XY for safety.')}
              >
                <div className="flex items-center gap-4">
                  <Slider
                    value={[config.analogJogSpeedZ]}
                    onValueChange={([v]) => onConfigChange({ analogJogSpeedZ: v })}
                    min={50}
                    max={5000}
                    step={50}
                    className="flex-1"
                  />
                  <span className="text-sm text-muted-foreground w-24 text-right">
                    {config.analogJogSpeedZ} {t('mm/min')}
                  </span>
                </div>
              </SettingsField>
            </div>

            {/* Axis Inversion */}
            <div className="flex flex-wrap gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="invert-x"
                  checked={config.invertX}
                  onCheckedChange={(invertX) => onConfigChange({ invertX })}
                />
                <Label htmlFor="invert-x" className="text-sm">{t('Invert X')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="invert-y"
                  checked={config.invertY}
                  onCheckedChange={(invertY) => onConfigChange({ invertY })}
                />
                <Label htmlFor="invert-y" className="text-sm">{t('Invert Y')}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="invert-z"
                  checked={config.invertZ}
                  onCheckedChange={(invertZ) => onConfigChange({ invertZ })}
                />
                <Label htmlFor="invert-z" className="text-sm">{t('Invert Z')}</Label>
              </div>
            </div>
          </div>

          {/* Button Mappings */}
          <div className="space-y-4 pt-6">
            <h4 className="font-medium text-sm">{t('Button Mappings')}</h4>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>{t('Button')}</TableHead>
                    <TableHead>{t('Action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GAMEPAD_BUTTONS.filter(b => !('isDpad' in b) || !(b as { isDpad?: boolean }).isDpad).map((button) => (
                    <TableRow 
                      key={button.index}
                      className={cn(
                        activeButtonIndex === button.index && 'bg-primary/10'
                      )}
                    >
                      <TableCell className="text-muted-foreground">
                        {button.icon}
                      </TableCell>
                      <TableCell className="font-medium">
                        {button.name}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={config.buttonMappings[button.index] || 'none'}
                          onValueChange={(v) => handleButtonMappingChange(button.index, v as CncAction)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(actionsByCategory).map(([category, actions]) => (
                              <div key={category}>
                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                  {category}
                                </div>
                                {actions.map((action) => (
                                  <SelectItem key={action.value} value={action.value}>
                                    {action.label}
                                  </SelectItem>
                                ))}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* D-pad buttons in a single row */}
                  <TableRow>
                    <TableCell colSpan={3} className="pt-4">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-muted-foreground w-20">{t('D-Pad:')}</span>
                        {GAMEPAD_BUTTONS.filter(b => 'isDpad' in b && (b as { isDpad: boolean }).isDpad).map((button) => (
                          <div key={button.index} className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-muted-foreground">
                                {button.icon}
                              </div>
                              <span className="text-sm font-medium">{button.name}</span>
                            </div>
                            <Select
                              value={config.buttonMappings[button.index] || 'none'}
                              onValueChange={(v) => handleButtonMappingChange(button.index, v as CncAction)}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(actionsByCategory).map(([category, actions]) => (
                                  <div key={category}>
                                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                                      {category}
                                    </div>
                                    {actions.map((action) => (
                                      <SelectItem key={action.value} value={action.value}>
                                        {action.label}
                                      </SelectItem>
                                    ))}
                                  </div>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      {/* Test Dialog */}
      <JoystickTestDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        config={config}
        gamepadId={config.selectedGamepad}
      />
    </SettingsSection>
  )
}

