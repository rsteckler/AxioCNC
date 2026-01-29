import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  return (
    <SettingsSection
      id="advanced"
      title={t('Advanced')}
      description={t('Advanced options for debugging and development')}
    >
      <SettingsField
        label={t('Show Advanced Settings')}
        description={t('Display the Advanced settings section with debugging and development options')}
        horizontal
      >
        <Switch
          checked={config.showAdvancedSettings}
          onCheckedChange={(showAdvancedSettings) => onConfigChange({ showAdvancedSettings })}
        />
      </SettingsField>

      <SettingsField
        label={t('Debug Mode')}
        description={t('Enable debug logging and development features')}
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
