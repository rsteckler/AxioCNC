import { useCallback, useRef } from 'react'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Download, Upload, RotateCcw } from 'lucide-react'

// Supported languages - same as legacy app
const SUPPORTED_LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'cs', label: 'Čeština' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'hu', label: 'Magyar' },
  { value: 'it', label: 'Italiano' },
  { value: 'ja', label: '日本語' },
  { value: 'nb', label: 'Norsk' },
  { value: 'nl', label: 'Nederlands' },
  { value: 'pl', label: 'Polski' },
  { value: 'pt-br', label: 'Português (Brasil)' },
  { value: 'pt-pt', label: 'Português (Portugal)' },
  { value: 'ru', label: 'Русский' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'uk', label: 'Українська' },
  { value: 'zh-cn', label: '中文 (简体)' },
  { value: 'zh-tw', label: '中文 (繁體)' },
]

interface GeneralSectionProps {
  language: string
  allowAnalytics: boolean
  onLanguageChange: (value: string) => void
  onAnalyticsChange: (value: boolean) => void
  onImportSettings: (data: unknown) => void
  onExportSettings: () => void
  onRestoreDefaults: () => void
}

export function GeneralSection({ 
  language, 
  allowAnalytics,
  onLanguageChange,
  onAnalyticsChange,
  onImportSettings,
  onExportSettings,
  onRestoreDefaults,
}: GeneralSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleAnalyticsChange = useCallback((checked: boolean) => {
    onAnalyticsChange(checked)
  }, [onAnalyticsChange])

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string)
        onImportSettings(data)
      } catch {
        console.error('Invalid JSON file')
      }
    }
    reader.readAsText(file)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <SettingsSection 
      id="general" 
      title="General"
      description="Basic application settings and preferences"
    >
      <SettingsField
        label="Language"
        description="Choose your preferred display language"
      >
        <Select value={language} onValueChange={onLanguageChange}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder="Select a language" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>
                {lang.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsField>

      <SettingsField
        label="Anonymous Usage Data"
        description="Help improve CNCjs by sending anonymous usage statistics"
        tooltip="When enabled, anonymous usage data is collected to help improve the application. No personal information or G-code files are ever transmitted."
        horizontal
      >
        <Switch
          checked={allowAnalytics}
          onCheckedChange={handleAnalyticsChange}
        />
      </SettingsField>

      {/* Settings Management */}
      <div className="pt-4 space-y-3">
        <SettingsField
          label="Settings Backup"
          description="Import, export, or reset all application settings"
        >
          <div className="flex flex-wrap gap-2">
            {/* Import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
            >
              <Upload className="w-4 h-4" />
              Import
            </Button>

            {/* Export */}
            <Button 
              variant="outline"
              size="sm"
              onClick={onExportSettings}
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>

            {/* Restore Defaults */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <RotateCcw className="w-4 h-4" />
                  Reset All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset All Settings?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will reset all application settings to their default values. 
                    This action cannot be undone. Consider exporting your current 
                    settings first.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onRestoreDefaults}>
                    Reset All Settings
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </SettingsField>
      </div>
    </SettingsSection>
  )
}
