import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Switch } from '@/components/ui/switch'

export interface AdvancedConfig {
  debugMode: boolean
  showAdvancedSettings: boolean
}

interface AdvancedSectionProps {
  config: AdvancedConfig
  onConfigChange: (changes: Partial<AdvancedConfig>) => void
}

export function AdvancedSection({
  config,
  onConfigChange,
}: AdvancedSectionProps) {
  return (
    <SettingsSection
      id="advanced"
      title="Advanced"
      description="Advanced options for debugging and development"
    >
      <SettingsField
        label="Show Advanced Settings"
        description="Display the Advanced settings section with debugging and development options"
        horizontal
      >
        <Switch
          checked={config.showAdvancedSettings}
          onCheckedChange={(showAdvancedSettings) => onConfigChange({ showAdvancedSettings })}
        />
      </SettingsField>

      <SettingsField
        label="Debug Mode"
        description="Enable debug logging and development features"
        horizontal
      >
        <Switch
          checked={config.debugMode}
          onCheckedChange={(debugMode) => onConfigChange({ debugMode })}
        />
      </SettingsField>
    </SettingsSection>
  )
}
