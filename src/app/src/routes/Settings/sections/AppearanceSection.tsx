import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { Sun, Moon, Monitor, Check } from 'lucide-react'

export type Theme = 'light' | 'dark' | 'system'

export type AccentColor = 'orange' | 'blue' | 'green' | 'purple' | 'red' | 'zinc'

const ACCENT_COLORS: { value: AccentColor; label: string; hsl: string; preview: string }[] = [
  { value: 'orange', label: 'Orange', hsl: '24 95% 53%', preview: 'bg-orange-500' },
  { value: 'blue', label: 'Blue', hsl: '217 91% 60%', preview: 'bg-blue-500' },
  { value: 'green', label: 'Green', hsl: '142 76% 36%', preview: 'bg-green-600' },
  { value: 'purple', label: 'Purple', hsl: '262 83% 58%', preview: 'bg-purple-500' },
  { value: 'red', label: 'Red', hsl: '0 84% 60%', preview: 'bg-red-500' },
  { value: 'zinc', label: 'Zinc', hsl: '240 5% 34%', preview: 'bg-zinc-500' },
]

interface AppearanceSectionProps {
  theme: Theme
  accentColor: AccentColor
  onThemeChange: (theme: Theme) => void
  onAccentColorChange: (color: AccentColor) => void
}

export function AppearanceSection({
  theme,
  accentColor,
  onThemeChange,
  onAccentColorChange,
}: AppearanceSectionProps) {
  return (
    <SettingsSection
      id="appearance"
      title="Appearance"
      description="Customize the look and feel of CNCjs"
    >
      {/* Theme Selection */}
      <SettingsField
        label="Theme"
        description="Select your preferred color scheme"
      >
        <div className="flex gap-2">
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => onThemeChange('light')}
          >
            <Sun className="w-4 h-4" />
            Light
          </Button>
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => onThemeChange('dark')}
          >
            <Moon className="w-4 h-4" />
            Dark
          </Button>
          <Button
            variant={theme === 'system' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => onThemeChange('system')}
          >
            <Monitor className="w-4 h-4" />
            System
          </Button>
        </div>
      </SettingsField>

      {/* Accent Color */}
      <SettingsField
        label="Accent Color"
        description="Choose the primary accent color for buttons and highlights"
      >
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color.value}
              onClick={() => onAccentColorChange(color.value)}
              className={cn(
                'group relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                accentColor === color.value
                  ? 'border-primary bg-primary/5'
                  : 'border-transparent hover:border-muted-foreground/20 hover:bg-muted/50'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full shadow-sm flex items-center justify-center',
                  color.preview
                )}
              >
                {accentColor === color.value && (
                  <Check className="w-4 h-4 text-white" />
                )}
              </div>
              <Label className="text-xs font-normal cursor-pointer">
                {color.label}
              </Label>
            </button>
          ))}
        </div>
      </SettingsField>

      {/* Theme Preview */}
      <div className="mt-6 p-4 rounded-lg border bg-card">
        <p className="text-sm text-muted-foreground mb-3">Preview</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">Primary Button</Button>
          <Button size="sm" variant="secondary">Secondary</Button>
          <Button size="sm" variant="outline">Outline</Button>
          <Button size="sm" variant="destructive">Destructive</Button>
        </div>
      </div>
    </SettingsSection>
  )
}

