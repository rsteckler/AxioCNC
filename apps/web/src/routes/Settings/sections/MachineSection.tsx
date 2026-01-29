import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ExternalLink } from 'lucide-react'
import { useMemo, useState, useEffect } from 'react'
import { dimensionsToLimits, limitsToDimensions, type HomingCorner, type MachineDimensions } from '@/lib/machineLimits'
import { useGetMachinePresetsQuery, type MachinePreset } from '@/services/api'

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
  homingCorner?: HomingCorner  // Optional: inferred if not provided
  autoSwitchToMonitorEnabled: boolean
  toolSpinupDelayEnabled: boolean
  toolSpinupDelaySeconds: number
}

interface MachineSectionProps {
  config: MachineConfig
  onConfigChange: (config: Partial<MachineConfig>) => void
}

export function MachineSection({
  config,
  onConfigChange,
}: MachineSectionProps) {
  const { t } = useTranslation()
  // Convert limits to dimensions + corner for UI display
  const { dimensions, corner: inferredCorner } = useMemo(() => {
    if (!config.limits) {
      return {
        dimensions: { width: 300, depth: 300, height: 80 },
        corner: 'front-left' as HomingCorner
      }
    }
    return limitsToDimensions(config.limits)
  }, [config.limits])
  
  // Use configured corner or inferred corner
  const homingCorner = config.homingCorner ?? inferredCorner
  
  // Local state for dimensions (derived from limits or user input)
  const [localDimensions, setLocalDimensions] = useState<MachineDimensions>(dimensions)
  const [localCorner, setLocalCorner] = useState<HomingCorner>(homingCorner)
  
  // Update local state when limits change externally
  useEffect(() => {
    if (config.limits) {
      const { dimensions: newDimensions, corner: newCorner } = limitsToDimensions(config.limits)
      setLocalDimensions(newDimensions)
      // Always prioritize explicitly set homingCorner over inferred corner
      const cornerToUse = config.homingCorner ?? newCorner
      setLocalCorner(cornerToUse)
    }
  }, [config.limits, config.homingCorner, config.name])
  
  // Handle dimension change
  const handleDimensionChange = (axis: keyof MachineDimensions, value: string) => {
    const numValue = Math.max(0, parseFloat(value) || 0)
    const newDimensions = {
      ...localDimensions,
      [axis]: numValue,
    }
    setLocalDimensions(newDimensions)
    
    // Convert to limits and update config
    const newLimits = dimensionsToLimits(newDimensions, localCorner)
    onConfigChange({
      limits: newLimits,
      homingCorner: localCorner,
    })
  }
  
  // Handle corner change
  const handleCornerChange = (corner: HomingCorner) => {
    setLocalCorner(corner)
    
    // Convert to limits and update config
    const newLimits = dimensionsToLimits(localDimensions, corner)
    onConfigChange({
      limits: newLimits,
      homingCorner: corner,
    })
  }

  // Fetch presets from API
  const { data: presetsData, isLoading: presetsLoading } = useGetMachinePresetsQuery()
  const presets = useMemo(() => presetsData?.presets || [], [presetsData?.presets])
  
  // Group presets by manufacturer
  const PRESETS_BY_MANUFACTURER = useMemo(() => {
    return presets.reduce((acc, preset) => {
      if (!acc[preset.manufacturer]) acc[preset.manufacturer] = []
      acc[preset.manufacturer].push(preset)
      return acc
    }, {} as Record<string, MachinePreset[]>)
  }, [presets])
  
  const handlePresetSelect = (presetId: string) => {
    if (presetId === 'custom') return
    
    const preset = presets.find(p => p.id === presetId)
    if (preset) {
      // Convert dimensions + corner to limits
      const limits = dimensionsToLimits(preset.dimensions, preset.homingCorner)
      
      setLocalDimensions(preset.dimensions)
      setLocalCorner(preset.homingCorner)
      
      onConfigChange({
        name: preset.name,
        limits,
        homingCorner: preset.homingCorner,
      })
    }
  }

  // Find if current config matches a preset
  const matchingPreset = useMemo(() => {
    if (!config.limits || presets.length === 0) return undefined
    
    // Convert current limits to dimensions + corner for comparison
    const { dimensions: currentDimensions, corner: currentCorner } = limitsToDimensions(config.limits)
    
    return presets.find(p => 
      p.name === config.name &&
      p.dimensions.width === currentDimensions.width &&
      p.dimensions.depth === currentDimensions.depth &&
      p.dimensions.height === currentDimensions.height &&
      p.homingCorner === (config.homingCorner ?? currentCorner)
    )
  }, [config, presets])

  return (
    <SettingsSection
      id="machine"
      title={t('Machine')}
      description={t('Configure your CNC machine\'s work area and limits')}
    >
      {/* Machine Preset Selector */}
      <SettingsField
        label={t('Machine Preset')}
        description={t('Select your machine to auto-fill recommended settings, or choose Custom to enter values manually')}
      >
        {presetsLoading ? (
          <div className="text-sm text-muted-foreground">{t('Loading presets...')}</div>
        ) : (
          <Select 
            value={matchingPreset?.id || 'custom'} 
            onValueChange={handlePresetSelect}
          >
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder={t('Select a machine...')} />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="custom">
                <span className="text-muted-foreground">{t('Custom / Manual Entry')}</span>
              </SelectItem>
              {Object.entries(PRESETS_BY_MANUFACTURER).map(([manufacturer, manufacturerPresets]) => (
                <div key={manufacturer}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                    {manufacturer}
                  </div>
                  {manufacturerPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span>{preset.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {preset.dimensions.width}×{preset.dimensions.depth}mm
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        )}
      </SettingsField>

      {/* Machine Presets Tip */}
      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
        <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
          {t('Don\'t see your machine listed? Help us build out the machine presets by sharing your machine specs.')}
        </p>
        <a
          href="https://github.com/rsteckler/AxioCNC/issues/2"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          {t('Share your machine specs')}
        </a>
      </div>

      {/* Machine Name */}
      <SettingsField
        label={t('Machine Name')}
        description={t('A friendly name for your CNC machine')}
      >
        <Input
          value={config.name ?? ''}
          onChange={(e) => onConfigChange({ name: e.target.value })}
          placeholder={t('My CNC Machine')}
          className="max-w-sm"
        />
      </SettingsField>

      {/* Work Area Dimensions */}
      <div className="space-y-4 pt-2">
        <div>
          <h4 className="font-medium text-sm mb-1">{t('Work Area Dimensions')}</h4>
          <p className="text-sm text-muted-foreground">
            {t('Define the physical dimensions of your machine\'s work area in millimeters')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* X Axis - Width */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-sm">
                X
              </div>
              <span className="font-medium text-sm">{t('Width (X)')}</span>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t('Width (mm)')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={localDimensions.width}
                  onChange={(e) => handleDimensionChange('width', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
            </div>
          </div>

          {/* Y Axis - Depth */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center font-bold text-sm">
                Y
              </div>
              <span className="font-medium text-sm">{t('Depth (Y)')}</span>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t('Depth (mm)')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={localDimensions.depth}
                  onChange={(e) => handleDimensionChange('depth', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
            </div>
          </div>

          {/* Z Axis - Height */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
                Z
              </div>
              <span className="font-medium text-sm">{t('Height (Z)')}</span>
            </div>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">{t('Height (mm)')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  value={localDimensions.height}
                  onChange={(e) => handleDimensionChange('height', e.target.value)}
                  className="mt-1 h-8"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Homing Corner Selector */}
        <div className="space-y-3 pt-2">
          <div>
            <h4 className="font-medium text-sm mb-1">{t('Homing Position')}</h4>
            <p className="text-sm text-muted-foreground mb-3">
              {t('Select which corner the machine moves to when homed. The machine will be at this corner when X=0, Y=0 (and Z at maximum height).')}
            </p>
          </div>
          
          <div className="space-y-2">
            {/* Visual Corner Selector */}
            <div className="p-4 rounded-lg border bg-card">
              <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                {/* Back Left */}
                <Button
                  type="button"
                  variant={localCorner === 'back-left' ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleCornerChange('back-left')}
                  className="h-20 flex items-center justify-center"
                >
                  <div className="text-sm font-medium">{t('Back Left')}</div>
                </Button>
                
                {/* Back Right */}
                <Button
                  type="button"
                  variant={localCorner === 'back-right' ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleCornerChange('back-right')}
                  className="h-20 flex items-center justify-center"
                >
                  <div className="text-sm font-medium">{t('Back Right')}</div>
                </Button>
                
                {/* Front Left */}
                <Button
                  type="button"
                  variant={localCorner === 'front-left' ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleCornerChange('front-left')}
                  className="h-20 flex items-center justify-center"
                >
                  <div className="text-sm font-medium">{t('Front Left')}</div>
                </Button>
                
                {/* Front Right */}
                <Button
                  type="button"
                  variant={localCorner === 'front-right' ? 'default' : 'outline'}
                  size="lg"
                  onClick={() => handleCornerChange('front-right')}
                  className="h-20 flex items-center justify-center"
                >
                  <div className="text-sm font-medium">{t('Front Right')}</div>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controller Behavior */}
      <div className="space-y-3 pt-4">
        <SettingsField
          label={t('Auto-switch to Monitor when jobs start')}
          description={t('Automatically navigate to the Monitor tab when starting a job from Setup')}
          tooltip={t('When enabled and you\'re in Setup, starting a job will automatically switch to the Monitor tab before the job begins running.')}
          horizontal
        >
          <Switch
            checked={config.autoSwitchToMonitorEnabled}
            onCheckedChange={(checked) => onConfigChange({ autoSwitchToMonitorEnabled: checked })}
          />
        </SettingsField>

        <SettingsField
          label={t('Tool Spinup Delay')}
          description={t('Delay motion to allow the tool to spin up when running or resuming a program')}
          tooltip={t('When enabled, the controller will wait for the specified number of seconds before starting motion after a program starts or resumes. This allows the spindle/router to reach full speed before cutting begins.')}
          horizontal
        >
          <Switch
            checked={config.toolSpinupDelayEnabled}
            onCheckedChange={(checked) => onConfigChange({ toolSpinupDelayEnabled: checked })}
          />
        </SettingsField>

        {config.toolSpinupDelayEnabled && (
          <SettingsField
            label={t('Delay Time')}
            description={t('Time in seconds to wait before starting motion')}
            tooltip={t('The number of seconds to delay motion after starting or resuming a program. Typical values are 1-5 seconds depending on your spindle/router startup time.')}
          >
            <div className="flex items-center gap-2 max-w-xs">
              <Input
                type="number"
                step="0.1"
                min="0"
                max="60"
                value={config.toolSpinupDelaySeconds}
                onChange={(e) => {
                  const value = Math.max(0, Math.min(60, parseFloat(e.target.value) || 0))
                  onConfigChange({ toolSpinupDelaySeconds: value })
                }}
                className="h-9"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">{t('seconds')}</span>
            </div>
          </SettingsField>
        )}
      </div>
    </SettingsSection>
  )
}
