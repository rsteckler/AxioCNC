import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle } from 'lucide-react'

// Machine presets with default work area limits
interface MachinePreset {
  id: string
  name: string
  manufacturer: string
  limits: {
    xmin: number
    xmax: number
    ymin: number
    ymax: number
    zmin: number
    zmax: number
  }
}

const MACHINE_PRESETS: MachinePreset[] = [
  // Carbide 3D
  { id: 'shapeoko-3', name: 'Shapeoko 3', manufacturer: 'Carbide 3D', limits: { xmin: 0, xmax: 425, ymin: 0, ymax: 425, zmin: -75, zmax: 0 } },
  { id: 'shapeoko-4', name: 'Shapeoko 4', manufacturer: 'Carbide 3D', limits: { xmin: 0, xmax: 425, ymin: 0, ymax: 425, zmin: -75, zmax: 0 } },
  { id: 'shapeoko-xl', name: 'Shapeoko XL', manufacturer: 'Carbide 3D', limits: { xmin: 0, xmax: 850, ymin: 0, ymax: 425, zmin: -75, zmax: 0 } },
  { id: 'shapeoko-xxl', name: 'Shapeoko XXL', manufacturer: 'Carbide 3D', limits: { xmin: 0, xmax: 850, ymin: 0, ymax: 850, zmin: -75, zmax: 0 } },
  { id: 'shapeoko-pro', name: 'Shapeoko Pro', manufacturer: 'Carbide 3D', limits: { xmin: 0, xmax: 425, ymin: 0, ymax: 425, zmin: -75, zmax: 0 } },
  { id: 'nomad-3', name: 'Nomad 3', manufacturer: 'Carbide 3D', limits: { xmin: 0, xmax: 203, ymin: 0, ymax: 203, zmin: -76, zmax: 0 } },
  
  // Inventables
  { id: 'x-carve-500', name: 'X-Carve 500mm', manufacturer: 'Inventables', limits: { xmin: 0, xmax: 250, ymin: 0, ymax: 250, zmin: -65, zmax: 0 } },
  { id: 'x-carve-750', name: 'X-Carve 750mm', manufacturer: 'Inventables', limits: { xmin: 0, xmax: 500, ymin: 0, ymax: 500, zmin: -65, zmax: 0 } },
  { id: 'x-carve-1000', name: 'X-Carve 1000mm', manufacturer: 'Inventables', limits: { xmin: 0, xmax: 800, ymin: 0, ymax: 800, zmin: -65, zmax: 0 } },
  { id: 'carvey', name: 'Carvey', manufacturer: 'Inventables', limits: { xmin: 0, xmax: 300, ymin: 0, ymax: 200, zmin: -70, zmax: 0 } },
  
  // Onefinity
  { id: 'onefinity-machinist', name: 'Machinist X-35', manufacturer: 'Onefinity', limits: { xmin: 0, xmax: 400, ymin: 0, ymax: 400, zmin: -114, zmax: 0 } },
  { id: 'onefinity-woodworker', name: 'Woodworker X-35', manufacturer: 'Onefinity', limits: { xmin: 0, xmax: 816, ymin: 0, ymax: 816, zmin: -114, zmax: 0 } },
  { id: 'onefinity-journeyman', name: 'Journeyman X-50', manufacturer: 'Onefinity', limits: { xmin: 0, xmax: 1219, ymin: 0, ymax: 1219, zmin: -114, zmax: 0 } },
  { id: 'onefinity-foreman', name: 'Foreman', manufacturer: 'Onefinity', limits: { xmin: 0, xmax: 1295, ymin: 0, ymax: 1295, zmin: -133, zmax: 0 } },
  
  // Sienci Labs
  { id: 'longmill-12x12', name: 'LongMill MK1 12x12', manufacturer: 'Sienci Labs', limits: { xmin: 0, xmax: 307, ymin: 0, ymax: 307, zmin: -114, zmax: 0 } },
  { id: 'longmill-12x30', name: 'LongMill MK1 12x30', manufacturer: 'Sienci Labs', limits: { xmin: 0, xmax: 307, ymin: 0, ymax: 775, zmin: -114, zmax: 0 } },
  { id: 'longmill-30x30', name: 'LongMill MK1 30x30', manufacturer: 'Sienci Labs', limits: { xmin: 0, xmax: 775, ymin: 0, ymax: 775, zmin: -114, zmax: 0 } },
  { id: 'longmill-mk2-12x30', name: 'LongMill MK2 12x30', manufacturer: 'Sienci Labs', limits: { xmin: 0, xmax: 307, ymin: 0, ymax: 775, zmin: -114, zmax: 0 } },
  { id: 'longmill-mk2-48x30', name: 'LongMill MK2 48x30', manufacturer: 'Sienci Labs', limits: { xmin: 0, xmax: 1219, ymin: 0, ymax: 775, zmin: -114, zmax: 0 } },
  { id: 'altmill', name: 'AltMill', manufacturer: 'Sienci Labs', limits: { xmin: 0, xmax: 1219, ymin: 0, ymax: 1219, zmin: -140, zmax: 0 } },
  
  // OpenBuilds
  { id: 'openbuilds-lead-1010', name: 'LEAD 1010', manufacturer: 'OpenBuilds', limits: { xmin: 0, xmax: 1000, ymin: 0, ymax: 1000, zmin: -90, zmax: 0 } },
  { id: 'openbuilds-lead-1515', name: 'LEAD 1515', manufacturer: 'OpenBuilds', limits: { xmin: 0, xmax: 1500, ymin: 0, ymax: 1500, zmin: -90, zmax: 0 } },
  { id: 'openbuilds-workbee-750', name: 'WorkBee 750x750', manufacturer: 'OpenBuilds', limits: { xmin: 0, xmax: 690, ymin: 0, ymax: 750, zmin: -122, zmax: 0 } },
  { id: 'openbuilds-workbee-1050', name: 'WorkBee 1050x1050', manufacturer: 'OpenBuilds', limits: { xmin: 0, xmax: 990, ymin: 0, ymax: 1050, zmin: -122, zmax: 0 } },
  { id: 'openbuilds-workbee-1510', name: 'WorkBee 1510x1510', manufacturer: 'OpenBuilds', limits: { xmin: 0, xmax: 1450, ymin: 0, ymax: 1510, zmin: -122, zmax: 0 } },
  { id: 'openbuilds-minimill', name: 'MiniMill', manufacturer: 'OpenBuilds', limits: { xmin: 0, xmax: 170, ymin: 0, ymax: 170, zmin: -45, zmax: 0 } },
  
  // DIY / Open Source
  { id: 'mpcnc-primo', name: 'MPCNC Primo', manufacturer: 'V1 Engineering', limits: { xmin: 0, xmax: 600, ymin: 0, ymax: 600, zmin: -80, zmax: 0 } },
  { id: 'lowrider-3', name: 'LowRider 3 CNC', manufacturer: 'V1 Engineering', limits: { xmin: 0, xmax: 1200, ymin: 0, ymax: 2400, zmin: -100, zmax: 0 } },
  { id: 'printcnc', name: 'PrintNC', manufacturer: 'PrintNC', limits: { xmin: 0, xmax: 600, ymin: 0, ymax: 600, zmin: -100, zmax: 0 } },
  { id: 'root-4', name: 'Root 4 CNC', manufacturer: 'Root CNC', limits: { xmin: 0, xmax: 600, ymin: 0, ymax: 600, zmin: -85, zmax: 0 } },
  
  // Desktop / Hobby
  { id: '3018-pro', name: '3018-Pro', manufacturer: 'Generic', limits: { xmin: 0, xmax: 300, ymin: 0, ymax: 180, zmin: -45, zmax: 0 } },
  { id: '3018-prover', name: '3018-PROVer', manufacturer: 'Genmitsu', limits: { xmin: 0, xmax: 300, ymin: 0, ymax: 180, zmin: -45, zmax: 0 } },
  { id: 'sainsmart-4030', name: 'SainSmart 4030', manufacturer: 'SainSmart', limits: { xmin: 0, xmax: 400, ymin: 0, ymax: 300, zmin: -55, zmax: 0 } },
  { id: 'foxalien-4040-xe', name: '4040-XE', manufacturer: 'FoxAlien', limits: { xmin: 0, xmax: 400, ymin: 0, ymax: 400, zmin: -80, zmax: 0 } },
  { id: 'foxalien-masuter-pro', name: 'Masuter Pro', manufacturer: 'FoxAlien', limits: { xmin: 0, xmax: 400, ymin: 0, ymax: 400, zmin: -80, zmax: 0 } },
  
  // Laser Cutters with CNC capability
  { id: 'snapmaker-2-a350', name: 'Snapmaker 2.0 A350', manufacturer: 'Snapmaker', limits: { xmin: 0, xmax: 320, ymin: 0, ymax: 350, zmin: -330, zmax: 0 } },
  
  // Avid CNC
  { id: 'avid-pro-4824', name: 'PRO 4824', manufacturer: 'Avid CNC', limits: { xmin: 0, xmax: 1219, ymin: 0, ymax: 610, zmin: -152, zmax: 0 } },
  { id: 'avid-pro-4848', name: 'PRO 4848', manufacturer: 'Avid CNC', limits: { xmin: 0, xmax: 1219, ymin: 0, ymax: 1219, zmin: -152, zmax: 0 } },
  { id: 'avid-pro-4896', name: 'PRO 4896', manufacturer: 'Avid CNC', limits: { xmin: 0, xmax: 2438, ymin: 0, ymax: 1219, zmin: -152, zmax: 0 } },
]

// Group presets by manufacturer
const PRESETS_BY_MANUFACTURER = MACHINE_PRESETS.reduce((acc, preset) => {
  if (!acc[preset.manufacturer]) acc[preset.manufacturer] = []
  acc[preset.manufacturer].push(preset)
  return acc
}, {} as Record<string, MachinePreset[]>)

export interface MachineConfig {
  name: string
  limits: {
    xmin: number
    xmax: number
    ymin: number
    ymax: number
    zmin: number
    zmax: number
  }
  ignoreErrors: boolean
}

interface MachineSectionProps {
  config: MachineConfig
  onConfigChange: (config: Partial<MachineConfig>) => void
}

export function MachineSection({
  config,
  onConfigChange,
}: MachineSectionProps) {
  const handleLimitChange = (axis: keyof MachineConfig['limits'], value: string) => {
    const numValue = parseFloat(value) || 0
    const currentLimits = config.limits ?? { xmin: 0, xmax: 0, ymin: 0, ymax: 0, zmin: 0, zmax: 0 }
    onConfigChange({
      limits: {
        ...currentLimits,
        [axis]: numValue,
      },
    })
  }

  const handlePresetSelect = (presetId: string) => {
    if (presetId === 'custom') return
    
    const preset = MACHINE_PRESETS.find(p => p.id === presetId)
    if (preset) {
      onConfigChange({
        name: preset.name,
        limits: { ...preset.limits },
      })
    }
  }

  // Find if current config matches a preset
  const matchingPreset = config.limits ? MACHINE_PRESETS.find(
    p => p.name === config.name &&
      p.limits.xmin === config.limits.xmin &&
      p.limits.xmax === config.limits.xmax &&
      p.limits.ymin === config.limits.ymin &&
      p.limits.ymax === config.limits.ymax &&
      p.limits.zmin === config.limits.zmin &&
      p.limits.zmax === config.limits.zmax
  ) : undefined

  return (
    <SettingsSection
      id="machine"
      title="Machine"
      description="Configure your CNC machine's work area and limits"
    >
      {/* Machine Preset Selector */}
      <SettingsField
        label="Machine Preset"
        description="Select your machine to auto-fill recommended settings, or choose Custom to enter values manually"
      >
        <Select 
          value={matchingPreset?.id || 'custom'} 
          onValueChange={handlePresetSelect}
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder="Select a machine..." />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="custom">
              <span className="text-muted-foreground">Custom / Manual Entry</span>
            </SelectItem>
            {Object.entries(PRESETS_BY_MANUFACTURER).map(([manufacturer, presets]) => (
              <div key={manufacturer}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                  {manufacturer}
                </div>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{preset.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {preset.limits.xmax}×{preset.limits.ymax}mm
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </SettingsField>

      {/* Machine Name */}
      <SettingsField
        label="Machine Name"
        description="A friendly name for your CNC machine"
      >
        <Input
          value={config.name ?? ''}
          onChange={(e) => onConfigChange({ name: e.target.value })}
          placeholder="My CNC Machine"
          className="max-w-sm"
        />
      </SettingsField>

      {/* Work Area Limits */}
      <div className="space-y-4 pt-2">
        <div>
          <h4 className="font-medium text-sm mb-1">Work Area Limits</h4>
          <p className="text-sm text-muted-foreground">
            Define the physical boundaries of your machine's work area in millimeters
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* X Axis */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-sm">
                X
              </div>
              <span className="font-medium text-sm">X Axis</span>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min (mm)</Label>
                <Input
                  type="number"
                  value={config.limits?.xmin ?? 0}
                  onChange={(e) => handleLimitChange('xmin', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max (mm)</Label>
                <Input
                  type="number"
                  value={config.limits?.xmax ?? 0}
                  onChange={(e) => handleLimitChange('xmax', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Travel: {(config.limits?.xmax ?? 0) - (config.limits?.xmin ?? 0)} mm
              </div>
            </div>
          </div>

          {/* Y Axis */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center font-bold text-sm">
                Y
              </div>
              <span className="font-medium text-sm">Y Axis</span>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min (mm)</Label>
                <Input
                  type="number"
                  value={config.limits?.ymin ?? 0}
                  onChange={(e) => handleLimitChange('ymin', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max (mm)</Label>
                <Input
                  type="number"
                  value={config.limits?.ymax ?? 0}
                  onChange={(e) => handleLimitChange('ymax', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Travel: {(config.limits?.ymax ?? 0) - (config.limits?.ymin ?? 0)} mm
              </div>
            </div>
          </div>

          {/* Z Axis */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
                Z
              </div>
              <span className="font-medium text-sm">Z Axis</span>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Min (mm)</Label>
                <Input
                  type="number"
                  value={config.limits?.zmin ?? 0}
                  onChange={(e) => handleLimitChange('zmin', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Max (mm)</Label>
                <Input
                  type="number"
                  value={config.limits?.zmax ?? 0}
                  onChange={(e) => handleLimitChange('zmax', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Travel: {Math.abs((config.limits?.zmax ?? 0) - (config.limits?.zmin ?? 0))} mm
              </div>
            </div>
          </div>
        </div>

        {/* Work Area Summary */}
        <div className="p-3 rounded-lg bg-muted/30 border">
          <h5 className="text-sm font-medium mb-2">Work Area Summary</h5>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Width (X):</span>
              <span className="ml-2 font-mono">{(config.limits?.xmax ?? 0) - (config.limits?.xmin ?? 0)} mm</span>
            </div>
            <div>
              <span className="text-muted-foreground">Depth (Y):</span>
              <span className="ml-2 font-mono">{(config.limits?.ymax ?? 0) - (config.limits?.ymin ?? 0)} mm</span>
            </div>
            <div>
              <span className="text-muted-foreground">Height (Z):</span>
              <span className="ml-2 font-mono">{Math.abs((config.limits?.zmax ?? 0) - (config.limits?.zmin ?? 0))} mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controller Behavior */}
      <div className="space-y-3 pt-4">
        <SettingsField
          label="Continue on Error"
          description="Continue G-code execution when an error is detected"
          tooltip="When enabled, the controller will attempt to continue running the G-code program even if an error is detected. This can be useful for certain recovery scenarios but may cause unexpected machine behavior."
          horizontal
        >
          <Switch
            checked={config.ignoreErrors}
            onCheckedChange={(checked) => onConfigChange({ ignoreErrors: checked })}
          />
        </SettingsField>

        {config.ignoreErrors && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">Safety Warning</span>
                <Badge variant="outline" className="text-warning border-warning/50">
                  Caution
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Enabling this option may cause machine damage if you don't have an 
                Emergency Stop button to prevent dangerous situations. Only enable 
                this if you fully understand the risks.
              </p>
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  )
}
