import { useState } from 'react'
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
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Square,
  Circle,
  Triangle,
  Hexagon,
  Play,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { JoystickTestDialog } from './JoystickTestDialog'

// CNC Actions that can be mapped to gamepad buttons
export type CncAction = 
  | 'none'
  | 'jog_x_pos' | 'jog_x_neg' | 'jog_y_pos' | 'jog_y_neg' | 'jog_z_pos' | 'jog_z_neg'
  | 'home_all' | 'home_x' | 'home_y' | 'home_z'
  | 'zero_all' | 'zero_x' | 'zero_y' | 'zero_z'
  | 'start' | 'stop' | 'pause' | 'resume'
  | 'feed_hold' | 'cycle_start'
  | 'spindle_on' | 'spindle_off' | 'spindle_toggle'
  | 'speed_slow' | 'speed_medium' | 'speed_fast'
  | 'emergency_stop'

export const CNC_ACTIONS: { value: CncAction; label: string; category: string }[] = [
  { value: 'none', label: 'None', category: 'General' },
  // Jogging
  { value: 'jog_x_pos', label: 'Jog X+', category: 'Jogging' },
  { value: 'jog_x_neg', label: 'Jog X-', category: 'Jogging' },
  { value: 'jog_y_pos', label: 'Jog Y+', category: 'Jogging' },
  { value: 'jog_y_neg', label: 'Jog Y-', category: 'Jogging' },
  { value: 'jog_z_pos', label: 'Jog Z+', category: 'Jogging' },
  { value: 'jog_z_neg', label: 'Jog Z-', category: 'Jogging' },
  // Homing
  { value: 'home_all', label: 'Home All', category: 'Homing' },
  { value: 'home_x', label: 'Home X', category: 'Homing' },
  { value: 'home_y', label: 'Home Y', category: 'Homing' },
  { value: 'home_z', label: 'Home Z', category: 'Homing' },
  // Zeroing
  { value: 'zero_all', label: 'Zero All', category: 'Zeroing' },
  { value: 'zero_x', label: 'Zero X', category: 'Zeroing' },
  { value: 'zero_y', label: 'Zero Y', category: 'Zeroing' },
  { value: 'zero_z', label: 'Zero Z', category: 'Zeroing' },
  // Job Control
  { value: 'start', label: 'Start Job', category: 'Job Control' },
  { value: 'stop', label: 'Stop Job', category: 'Job Control' },
  { value: 'pause', label: 'Pause Job', category: 'Job Control' },
  { value: 'resume', label: 'Resume Job', category: 'Job Control' },
  { value: 'feed_hold', label: 'Feed Hold', category: 'Job Control' },
  { value: 'cycle_start', label: 'Cycle Start', category: 'Job Control' },
  // Spindle
  { value: 'spindle_on', label: 'Spindle On', category: 'Spindle' },
  { value: 'spindle_off', label: 'Spindle Off', category: 'Spindle' },
  { value: 'spindle_toggle', label: 'Spindle Toggle', category: 'Spindle' },
  // Speed
  { value: 'speed_slow', label: 'Jog Speed: Slow', category: 'Speed' },
  { value: 'speed_medium', label: 'Jog Speed: Medium', category: 'Speed' },
  { value: 'speed_fast', label: 'Jog Speed: Fast', category: 'Speed' },
  // Safety
  { value: 'emergency_stop', label: 'Emergency Stop', category: 'Safety' },
]

// Standard gamepad buttons (Linux Xbox controller mapping)
// Note: LT/RT are axes (4 and 5), not buttons
export const GAMEPAD_BUTTONS = [
  { index: 0, name: 'A', icon: <Circle className="w-4 h-4" /> },
  { index: 1, name: 'B', icon: <Circle className="w-4 h-4" /> },
  // Button 2 is not used on this controller
  { index: 3, name: 'X', icon: <Square className="w-4 h-4" /> },
  { index: 4, name: 'Y', icon: <Triangle className="w-4 h-4" /> },
  // Button 5 is not used on this controller
  { index: 6, name: 'LB', icon: <Hexagon className="w-4 h-4" /> },
  { index: 7, name: 'RB', icon: <Hexagon className="w-4 h-4" /> },
  // Buttons 8, 9 are not shown in UI
  { index: 10, name: 'Back', icon: <Square className="w-3 h-3" /> },
  { index: 11, name: 'Start', icon: <Square className="w-3 h-3" /> },
  { index: 13, name: 'Left Stick Click', icon: <CircleDot className="w-4 h-4" /> },
  { index: 14, name: 'Right Stick Click', icon: <CircleDot className="w-4 h-4" /> },
  { index: 12, name: 'D-Pad Up', icon: <ArrowUp className="w-4 h-4" />, isDpad: true },
  { index: 16, name: 'D-Pad Down', icon: <ArrowDown className="w-4 h-4" />, isDpad: true },
  { index: 17, name: 'D-Pad Left', icon: <ArrowLeft className="w-4 h-4" />, isDpad: true },
  { index: 15, name: 'D-Pad Right', icon: <ArrowRight className="w-4 h-4" />, isDpad: true },
  // Note: D-pad buttons (12=Up, 15=Right, 16=Down, 17=Left) map to axes 6 and 7, not buttons
]

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
  const [activeButtonIndex] = useState<number | null>(null)
  const [testDialogOpen, setTestDialogOpen] = useState(false)

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
      title="Joystick / Gamepad"
      description="Configure gamepad controls for hands-on CNC operation"
    >
      {/* Enable/Disable */}
      <SettingsField
        label="Enable Gamepad Support"
        description="Use a connected gamepad to control your CNC machine"
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
            label="Gamepad Connection Location"
            description="Choose which machine the joystick is connected to. If you're running this browser on the same machine that's running the AxioCNC server, choose Server for better reliability. Note: Server-side gamepads only work on Linux servers."
          >
            <Select
              value={config.connectionLocation || 'server'}
              onValueChange={(value: 'server' | 'client') => onConfigChange({ connectionLocation: value, selectedGamepad: null })}
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="server">Server (Machine running AxioCNC)</SelectItem>
                <SelectItem value="client">Client (Machine running browser)</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>

          {/* Gamepad Selection */}
          <SettingsField
            label="Select Gamepad"
            description={config.connectionLocation === 'server' 
              ? 'Select a gamepad connected to the server machine'
              : 'Select a gamepad connected to this browser\'s machine'}
          >
            <div className="flex gap-2">
              <Select
                value={config.selectedGamepad || 'none'}
                onValueChange={(value) => onConfigChange({ selectedGamepad: value === 'none' ? null : value })}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a gamepad..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {detectedGamepads.length === 0 ? 'No gamepads detected' : 'None selected'}
                  </SelectItem>
                  {detectedGamepads.map((gp) => (
                    <SelectItem key={gp.id} value={gp.id}>
                      <div className="flex items-center gap-2">
                        <Gamepad2 className="w-4 h-4" />
                        <span>{gp.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {gp.buttons} buttons
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={onRefreshGamepads}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setTestDialogOpen(true)}
                className="gap-2"
              >
                <Play className="w-4 h-4" />
                Test
              </Button>
            </div>
            {detectedGamepads.length === 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                Connect a gamepad and press any button to detect it
              </p>
            )}
          </SettingsField>

          {/* Analog Stick Settings */}
          <div className="space-y-4 pt-4">
            <h4 className="font-medium text-sm">Analog Stick Configuration</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Left Stick */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <CircleDot className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Left Stick</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Horizontal (X)</Label>
                    <Select
                      value={config.analogMappings.left_x}
                      onValueChange={(v) => handleAnalogMappingChange('left_x', v as AnalogMapping)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="jog_x">Jog X Axis</SelectItem>
                        <SelectItem value="jog_y">Jog Y Axis</SelectItem>
                        <SelectItem value="jog_z">Jog Z Axis</SelectItem>
                        <SelectItem value="feed_rate">Feed Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Vertical (Y)</Label>
                    <Select
                      value={config.analogMappings.left_y}
                      onValueChange={(v) => handleAnalogMappingChange('left_y', v as AnalogMapping)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="jog_x">Jog X Axis</SelectItem>
                        <SelectItem value="jog_y">Jog Y Axis</SelectItem>
                        <SelectItem value="jog_z">Jog Z Axis</SelectItem>
                        <SelectItem value="feed_rate">Feed Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Right Stick */}
              <div className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-2 mb-3">
                  <CircleDot className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Right Stick</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Horizontal (X)</Label>
                    <Select
                      value={config.analogMappings.right_x}
                      onValueChange={(v) => handleAnalogMappingChange('right_x', v as AnalogMapping)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="jog_x">Jog X Axis</SelectItem>
                        <SelectItem value="jog_y">Jog Y Axis</SelectItem>
                        <SelectItem value="jog_z">Jog Z Axis</SelectItem>
                        <SelectItem value="feed_rate">Feed Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Vertical (Y)</Label>
                    <Select
                      value={config.analogMappings.right_y}
                      onValueChange={(v) => handleAnalogMappingChange('right_y', v as AnalogMapping)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="jog_x">Jog X Axis</SelectItem>
                        <SelectItem value="jog_y">Jog Y Axis</SelectItem>
                        <SelectItem value="jog_z">Jog Z Axis</SelectItem>
                        <SelectItem value="feed_rate">Feed Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            {/* Analog Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <SettingsField
                label="Deadzone"
                description="Ignore small stick movements"
                tooltip="Values below this threshold are ignored to prevent drift"
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
                label="Sensitivity"
                description="Response curve for analog input"
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
                label="Max XY Jog Speed"
                description="Maximum speed for X/Y axis jogging"
                tooltip="The speed at full stick deflection for X and Y axes in mm/min"
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
                    {config.analogJogSpeedXY} mm/min
                  </span>
                </div>
              </SettingsField>

              <SettingsField
                label="Max Z Jog Speed"
                description="Maximum speed for Z axis jogging"
                tooltip="The speed at full stick deflection for Z axis in mm/min. Often set lower than XY for safety."
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
                    {config.analogJogSpeedZ} mm/min
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
                <Label htmlFor="invert-x" className="text-sm">Invert X</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="invert-y"
                  checked={config.invertY}
                  onCheckedChange={(invertY) => onConfigChange({ invertY })}
                />
                <Label htmlFor="invert-y" className="text-sm">Invert Y</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="invert-z"
                  checked={config.invertZ}
                  onCheckedChange={(invertZ) => onConfigChange({ invertZ })}
                />
                <Label htmlFor="invert-z" className="text-sm">Invert Z</Label>
              </div>
            </div>
          </div>

          {/* Button Mappings */}
          <div className="space-y-4 pt-6">
            <h4 className="font-medium text-sm">Button Mappings</h4>
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Button</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {GAMEPAD_BUTTONS.filter(b => !(b as any).isDpad).map((button) => (
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
                        <span className="text-sm font-medium text-muted-foreground w-20">D-Pad:</span>
                        {GAMEPAD_BUTTONS.filter(b => (b as any).isDpad).map((button) => (
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

