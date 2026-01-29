import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
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
import { cn } from '@/lib/utils'
import { Sun, Moon, Monitor, Check, Palette, Upload, Trash2, FolderOpen, RefreshCw } from 'lucide-react'
import { 
  useGetThemesQuery, 
  useGetThemesPathQuery, 
  useCreateThemeMutation,
  useDeleteThemeMutation,
  type CustomThemeMeta,
  type CustomThemeDefinition,
} from '@/services/api'
import { trackSettingsChange } from '@/services/analytics'

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
  customThemeId: string | null
  onThemeChange: (theme: Theme) => void
  onAccentColorChange: (color: AccentColor) => void
  onCustomThemeChange: (themeId: string | null) => void
}

export function AppearanceSection({
  theme,
  accentColor,
  customThemeId,
  onThemeChange,
  onAccentColorChange,
  onCustomThemeChange,
}: AppearanceSectionProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // API hooks
  const { data: themesData, refetch: refetchThemes } = useGetThemesQuery()
  const { data: themesPathData } = useGetThemesPathQuery()
  const [createTheme] = useCreateThemeMutation()
  const [deleteTheme] = useDeleteThemeMutation()

  const customThemes: CustomThemeMeta[] = themesData?.themes || []

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadError(null)

    try {
      const content = await file.text()
      const themeData = JSON.parse(content) as CustomThemeDefinition

      // Basic validation
      if (!themeData.name) {
        throw new Error(t('Theme must have a "name" property'))
      }
      if (!themeData.light || !themeData.dark) {
        throw new Error(t('Theme must have "light" and "dark" color definitions'))
      }

      // Create theme via API
      await createTheme(themeData).unwrap()
      
      setIsUploadOpen(false)
      refetchThemes()
    } catch (err) {
      if (err instanceof SyntaxError) {
        setUploadError(t('Invalid JSON file'))
      } else if (err instanceof Error) {
        setUploadError(err.message)
      } else {
        setUploadError(t('Failed to upload theme'))
      }
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleDeleteTheme = async (themeId: string) => {
    // If deleting the active theme, switch to default first
    if (customThemeId === themeId) {
      handleCustomThemeChange(null)
    }
    await deleteTheme(themeId)
    refetchThemes()
  }

  const selectedTheme = customThemes.find(t => t.id === customThemeId)

  // Wrapper functions to track analytics
  const handleThemeChange = (newTheme: Theme) => {
    trackSettingsChange('appearance', 'theme', newTheme)
    onThemeChange(newTheme)
  }

  const handleAccentColorChange = (newColor: AccentColor) => {
    trackSettingsChange('appearance', 'accentColor', newColor)
    onAccentColorChange(newColor)
  }

  const handleCustomThemeChange = (themeId: string | null) => {
    trackSettingsChange('appearance', 'customThemeId', themeId)
    onCustomThemeChange(themeId)
  }

  return (
    <SettingsSection
      id="appearance"
      title={t('Appearance')}
      description={t('Customize the look and feel of AxioCNC')}
    >
      {/* Theme Mode Selection */}
      <SettingsField
        label={t('Theme Mode')}
        description={t('Select your preferred color scheme')}
      >
        <div className="flex gap-2">
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => handleThemeChange('light')}
          >
            <Sun className="w-4 h-4" />
            {t('Light')}
          </Button>
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => handleThemeChange('dark')}
          >
            <Moon className="w-4 h-4" />
            {t('Dark')}
          </Button>
          <Button
            variant={theme === 'system' ? 'default' : 'outline'}
            className="flex-1 gap-2"
            onClick={() => handleThemeChange('system')}
          >
            <Monitor className="w-4 h-4" />
            {t('System')}
          </Button>
        </div>
      </SettingsField>

      {/* Custom Theme */}
      <SettingsField
        label={t('Custom Theme')}
        description={t('Apply a community or user-created theme')}
      >
        <div className="flex gap-2">
          <Select 
            value={customThemeId || 'none'} 
            onValueChange={(value) => handleCustomThemeChange(value === 'none' ? null : value)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder={t('Select a theme...')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-muted-foreground" />
                  {t('Default Theme')}
                </div>
              </SelectItem>
              {customThemes.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    {t('Installed Themes')}
                  </div>
                  {customThemes.map((theme) => (
                    <SelectItem key={theme.id} value={theme.id}>
                      <div className="flex items-center gap-2">
                        <Palette className="w-4 h-4" />
                        <span>{theme.name}</span>
                        {theme.author && (
                          <span className="text-xs text-muted-foreground">{t('by {{author}}', { author: theme.author })}</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={() => refetchThemes()}>
            <RefreshCw className="w-4 h-4" />
          </Button>

          {/* Upload Theme Dialog */}
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                {t('Upload')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('Upload Custom Theme')}</DialogTitle>
                <DialogDescription>
                  {t('Upload a theme JSON file to install it. Themes define colors for both light and dark modes.')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="theme-file">{t('Theme File')}</Label>
                  <Input
                    ref={fileInputRef}
                    id="theme-file"
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                  />
                  {uploadError && (
                    <p className="text-sm text-destructive">{uploadError}</p>
                  )}
                </div>
                {themesPathData && (
                  <div className="p-3 rounded-lg bg-muted/50 border">
                    <div className="flex items-center gap-2 text-sm font-medium mb-1">
                      <FolderOpen className="w-4 h-4" />
                      {t('Manual Installation')}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t('You can also drop theme files directly into:')}
                    </p>
                    <code className="text-xs font-mono block mt-1 p-2 bg-background rounded">
                      {themesPathData.path}
                    </code>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
                  {t('Cancel')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Delete Theme */}
          {selectedTheme && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive hover:text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('Delete Theme?')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('Are you sure you want to delete "{{name}}"? This will remove the theme file from disk.', { name: selectedTheme.name })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteTheme(selectedTheme.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {t('Delete')}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {customThemes.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('No custom themes installed. Upload a theme file or drop one in the themes folder.')}
          </p>
        )}
      </SettingsField>

      {/* Accent Color - only show when no custom theme is active */}
      {!customThemeId && (
        <SettingsField
          label={t('Accent Color')}
          description={t('Choose the primary accent color for buttons and highlights')}
        >
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color.value}
                onClick={() => handleAccentColorChange(color.value)}
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
                  {t(color.label)}
                </Label>
              </button>
            ))}
          </div>
        </SettingsField>
      )}

      {/* Theme Preview */}
      <div className="mt-4 p-4 rounded-lg border bg-card">
        <p className="text-sm text-muted-foreground mb-3">{t('Preview')}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm">{t('Primary Button')}</Button>
          <Button size="sm" variant="secondary">{t('Secondary')}</Button>
          <Button size="sm" variant="outline">{t('Outline')}</Button>
          <Button size="sm" variant="destructive">{t('Destructive')}</Button>
        </div>
      </div>
    </SettingsSection>
  )
}

// Re-export for backward compatibility
export type { CustomThemeMeta as CustomTheme } from '@/services/api'
