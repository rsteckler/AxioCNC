import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle } from 'lucide-react'

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
    onConfigChange({
      limits: {
        ...config.limits,
        [axis]: numValue,
      },
    })
  }

  return (
    <SettingsSection
      id="machine"
      title="Machine"
      description="Configure your CNC machine's work area, limits, and controller behavior"
    >
      {/* Machine Name */}
      <SettingsField
        label="Machine Name"
        description="A friendly name for your CNC machine"
      >
        <Input
          value={config.name}
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* X Axis */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-sm">
                X
              </div>
              <span className="font-medium">X Axis</span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Minimum (mm)</Label>
                <Input
                  type="number"
                  value={config.limits.xmin}
                  onChange={(e) => handleLimitChange('xmin', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Maximum (mm)</Label>
                <Input
                  type="number"
                  value={config.limits.xmax}
                  onChange={(e) => handleLimitChange('xmax', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Travel: {config.limits.xmax - config.limits.xmin} mm
              </div>
            </div>
          </div>

          {/* Y Axis */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center font-bold text-sm">
                Y
              </div>
              <span className="font-medium">Y Axis</span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Minimum (mm)</Label>
                <Input
                  type="number"
                  value={config.limits.ymin}
                  onChange={(e) => handleLimitChange('ymin', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Maximum (mm)</Label>
                <Input
                  type="number"
                  value={config.limits.ymax}
                  onChange={(e) => handleLimitChange('ymax', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Travel: {config.limits.ymax - config.limits.ymin} mm
              </div>
            </div>
          </div>

          {/* Z Axis */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
                Z
              </div>
              <span className="font-medium">Z Axis</span>
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Minimum (mm)</Label>
                <Input
                  type="number"
                  value={config.limits.zmin}
                  onChange={(e) => handleLimitChange('zmin', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Maximum (mm)</Label>
                <Input
                  type="number"
                  value={config.limits.zmax}
                  onChange={(e) => handleLimitChange('zmax', e.target.value)}
                  className="mt-1"
                />
              </div>
              <div className="text-xs text-muted-foreground pt-1 border-t">
                Travel: {config.limits.zmax - config.limits.zmin} mm
              </div>
            </div>
          </div>
        </div>

        {/* Work Area Summary */}
        <div className="p-4 rounded-lg bg-muted/30 border">
          <h5 className="text-sm font-medium mb-2">Work Area Summary</h5>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Width (X):</span>
              <span className="ml-2 font-mono">{config.limits.xmax - config.limits.xmin} mm</span>
            </div>
            <div>
              <span className="text-muted-foreground">Depth (Y):</span>
              <span className="ml-2 font-mono">{config.limits.ymax - config.limits.ymin} mm</span>
            </div>
            <div>
              <span className="text-muted-foreground">Height (Z):</span>
              <span className="ml-2 font-mono">{Math.abs(config.limits.zmax - config.limits.zmin)} mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Controller Behavior */}
      <div className="space-y-4 pt-4">
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
          <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
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
