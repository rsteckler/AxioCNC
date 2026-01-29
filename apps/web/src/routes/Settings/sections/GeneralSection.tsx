import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import i18n, { loadLanguageResources, supportedLanguages } from '@/i18n'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Upload, RotateCcw, FolderOpen, Plus, Trash2, HardDrive, Cloud, CheckCircle2, XCircle, Loader2, LogIn, LogOut, ExternalLink } from 'lucide-react'

// Watch folder types
export type WatchFolderType = 'local' | 'google-drive'

export interface WatchFolder {
  id: string
  type: WatchFolderType
  path: string
  name: string
  enabled?: boolean
  mtime?: number
}

// Supported languages - only show those we have translation files for (public/i18n/<lng>/)
const SUPPORTED_LANGUAGES_ALL = [
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
  { value: 'pt', label: 'Português' },
  { value: 'pt-br', label: 'Português (Brasil)' },
  { value: 'ru', label: 'Русский' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'uk', label: 'Українська' },
  { value: 'zh-cn', label: '中文 (简体)' },
  { value: 'zh-tw', label: '中文 (繁體)' },
] as const
const SUPPORTED_LANGUAGES = SUPPORTED_LANGUAGES_ALL.filter((item) =>
  (supportedLanguages as readonly string[]).includes(item.value)
)

export interface GoogleDriveStatus {
  isConnected: boolean
  isConnecting: boolean
  userEmail?: string
  error?: string
}

interface GeneralSectionProps {
  language: string
  watchFolders: WatchFolder[]
  googleDriveStatus: GoogleDriveStatus
  onLanguageChange: (value: string) => void
  onImportSettings: (data: unknown) => void
  onExportSettings: () => void
  onRestoreDefaults: () => void
  onAddWatchFolder: (folder: Omit<WatchFolder, 'id'>) => void
  onRemoveWatchFolder: (id: string) => void
  onConnectGoogleDrive: () => void
  onDisconnectGoogleDrive: () => void
  isExporting?: boolean
  isImporting?: boolean
}

export function GeneralSection({ 
  language, 
  watchFolders,
  googleDriveStatus,
  onLanguageChange,
  onImportSettings,
  onExportSettings,
  onRestoreDefaults,
  onAddWatchFolder,
  onRemoveWatchFolder,
  onConnectGoogleDrive,
  onDisconnectGoogleDrive,
  isExporting = false,
  isImporting = false,
}: GeneralSectionProps) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [addFolderDialogOpen, setAddFolderDialogOpen] = useState(false)
  const [newFolderType, setNewFolderType] = useState<WatchFolderType>('local')
  const [newFolderPath, setNewFolderPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

  const handleLanguageChange = async (value: string) => {
    // Explicitly load translations for non-English so they load in Electron
    // (lazy backend read() is not always called on changeLanguage there)
    await loadLanguageResources(value)
    i18n.changeLanguage(value).then(() => {
      return i18n.reloadResources(value, ['resource', 'controller', 'gcode'])
    }).catch((error) => {
      console.error('Error changing language:', error)
    })
    onLanguageChange(value)
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Check file extension
    if (!file.name.toLowerCase().endsWith('.json')) {
      console.error('Invalid file type. Please select a JSON file.')
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        if (!text) {
          throw new Error('File is empty')
        }
        const data = JSON.parse(text)
        onImportSettings(data)
      } catch (error) {
        console.error('Failed to parse JSON file:', error)
        // Error notification will be shown by the parent component
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }
    reader.onerror = () => {
      console.error('Failed to read file')
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
    
    // Reset input after a short delay to allow processing
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }, 100)
  }

  const handleAddFolder = () => {
    if (!newFolderPath.trim()) return
    
    onAddWatchFolder({
      type: newFolderType,
      path: newFolderPath.trim(),
      name: newFolderName.trim() || newFolderPath.split('/').pop() || t('Watch Folders'),
    })
    
    // Reset and close
    setNewFolderType('local')
    setNewFolderPath('')
    setNewFolderName('')
    setAddFolderDialogOpen(false)
  }

  return (
    <SettingsSection 
      id="general" 
      title={t('General')}
      description={t('Basic application settings and preferences')}
    >
      <SettingsField
        label={t('Language')}
        description={t('Choose your preferred display language')}
      >
        <Select value={language} onValueChange={handleLanguageChange}>
          <SelectTrigger className="w-[240px]">
            <SelectValue placeholder={t('Select a language')} />
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

      {/* Watch Folders */}
      <div className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-medium text-sm">{t('Watch Folders')}</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          {t('Monitor folders for G-code files. Files added to these folders will appear in your file browser.')}
        </p>

        {/* Folder List */}
        <div className="space-y-2">
          {watchFolders.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('No watch folders configured')}</p>
              <p className="text-xs mt-1">{t('Add a folder to monitor for G-code files')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {watchFolders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {folder.type === 'local' ? (
                      <HardDrive className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Cloud className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{folder.name}</span>
                        <Badge variant="secondary" className="text-xs flex-shrink-0">
                          {folder.type === 'local' ? t('Local') : t('Google Drive')}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate font-mono">
                        {folder.path}
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t('Remove Watch Folder?')}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t('Are you sure you want to remove "{{name}}" from your watch folders? This won\'t delete any files, just stop monitoring the folder.', { name: folder.name })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRemoveWatchFolder(folder.id)}>
                          {t('Remove')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}

          {/* Add Folder Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddFolderDialogOpen(true)}
            className="gap-2 mt-2"
          >
            <Plus className="w-4 h-4" />
            {t('Add Watch Folder')}
          </Button>
        </div>

        {/* Add Folder Dialog */}
        <Dialog open={addFolderDialogOpen} onOpenChange={setAddFolderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('Add Watch Folder')}</DialogTitle>
              <DialogDescription>
                {t('Add a folder to monitor for G-code files. Choose between a local folder or Google Drive.')}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Folder Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('Folder Type')}</label>
                <Select value={newFolderType} onValueChange={(v) => setNewFolderType(v as WatchFolderType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        {t('Local Folder')}
                      </div>
                    </SelectItem>
                    <SelectItem value="google-drive">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-blue-500" />
                        {t('Google Drive')}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Google Drive Not Available Notice */}
                {newFolderType === 'google-drive' && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-muted">
                    <p className="text-sm text-muted-foreground mb-2">
                      {t('This feature is not yet implemented. Upvote it to be included in a future release.')}
                    </p>
                    <a
                      href="https://github.com/rsteckler/AxioCNC/issues/1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {t('Upvote Google Drive support')}
                    </a>
                  </div>
                )}
              </div>

              {/* Google Drive Connection Status - Disabled */}
              {newFolderType === 'google-drive' && (
                <div className="p-4 rounded-lg border bg-muted/30 space-y-3 opacity-50 pointer-events-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cloud className="w-5 h-5 text-blue-500" />
                      <span className="font-medium text-sm">Google Drive</span>
                    </div>
                    
                    {/* Connection Status Badge */}
                    {googleDriveStatus.isConnecting ? (
                      <Badge variant="secondary" className="gap-1.5">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {t('Connecting...')}
                      </Badge>
                    ) : googleDriveStatus.isConnected ? (
                      <Badge variant="secondary" className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        {t('Connected')}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1.5 bg-red-500/10 text-red-600 border-red-500/20">
                        <XCircle className="w-3 h-3" />
                        {t('Not Connected')}
                      </Badge>
                    )}
                  </div>

                  {/* User Email (when connected) */}
                  {googleDriveStatus.isConnected && googleDriveStatus.userEmail && (
                    <p className="text-sm text-muted-foreground">
                      {t('Signed in as {{email}}', { email: googleDriveStatus.userEmail })}
                    </p>
                  )}

                  {/* Error Message */}
                  {googleDriveStatus.error && (
                    <p className="text-sm text-destructive">
                      {googleDriveStatus.error}
                    </p>
                  )}

                  {/* Connect/Disconnect Buttons */}
                  <div className="flex gap-2">
                    {googleDriveStatus.isConnected ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onDisconnectGoogleDrive}
                        className="gap-2"
                        disabled={true}
                      >
                        <LogOut className="w-4 h-4" />
                        {t('Disconnect')}
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={onConnectGoogleDrive}
                        className="gap-2"
                        disabled={true}
                      >
                        {googleDriveStatus.isConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <LogIn className="w-4 h-4" />
                        )}
                        {googleDriveStatus.isConnecting ? t('Connecting...') : t('Connect to Google Drive')}
                      </Button>
                    )}
                  </div>

                  {!googleDriveStatus.isConnected && !googleDriveStatus.isConnecting && (
                    <p className="text-xs text-muted-foreground">
                      {t('Connect your Google account to access files from Google Drive')}
                    </p>
                  )}
                </div>
              )}

              {/* Folder Path */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {newFolderType === 'local' ? t('Folder Path') : t('Google Drive Folder Path')}
                </label>
                <Input
                  value={newFolderPath}
                  onChange={(e) => setNewFolderPath(e.target.value)}
                  placeholder={newFolderType === 'local' 
                    ? '/home/user/gcode-files' 
                    : 'My Drive/CNC Projects'
                  }
                  className="font-mono text-sm"
                  disabled={newFolderType === 'google-drive'}
                />
                <p className="text-xs text-muted-foreground">
                  {newFolderType === 'local' 
                    ? t('Enter the full path to the folder on your local machine')
                    : t('Feature not yet implemented')
                  }
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('Display Name (optional)')}</label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="My G-code Files"
                  disabled={newFolderType === 'google-drive'}
                />
                <p className="text-xs text-muted-foreground">
                  {t('A friendly name to identify this folder')}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddFolderDialogOpen(false)}>
                {t('Cancel')}
              </Button>
              <Button 
                onClick={handleAddFolder} 
                disabled={
                  !newFolderPath.trim() || 
                  newFolderType === 'google-drive'
                }
              >
                {t('Add Folder')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Settings Management */}
      <div className="pt-6 space-y-3">
        <SettingsField
          label={t('Settings Backup')}
          description={t('Import, export, or reset all application settings')}
        >
          <div className="flex flex-wrap gap-2">
            {/* Import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
              disabled={isImporting || isExporting}
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
              disabled={isImporting || isExporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('Importing...')}
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {t('Import')}
                </>
              )}
            </Button>

            {/* Export */}
            <Button 
              variant="outline"
              size="sm"
              onClick={onExportSettings}
              className="gap-2"
              disabled={isImporting || isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('Exporting...')}
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {t('Export')}
                </>
              )}
            </Button>

            {/* Restore Defaults */}
            <AlertDialog open={resetDialogOpen} onOpenChange={(open) => {
              setResetDialogOpen(open)
              if (!open) setResetConfirmText('')
            }}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <RotateCcw className="w-4 h-4" />
                  {t('Reset to Defaults')}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('Reset All Settings?')}</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p dangerouslySetInnerHTML={{ __html: t('This will reset <strong>all</strong> application settings to their default values, including:') }} />
                      <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                        <li>{t('Machine configuration and connection settings')}</li>
                        <li>{t('All macros')}</li>
                        <li>{t('All event handlers')}</li>
                        <li>{t('Watch folders')}</li>
                        <li>{t('Theme and appearance settings')}</li>
                        <li>{t('Zeroing methods and strategies')}</li>
                      </ul>
                      <p className="text-destructive font-medium">
                        {t('This action cannot be undone. Consider exporting your current settings first.')}
                      </p>
                      <div className="pt-2">
                        <p className="text-sm mb-2" dangerouslySetInnerHTML={{ __html: t('Type <strong>reset</strong> to confirm:') }} />
                        <Input 
                          value={resetConfirmText}
                          onChange={(e) => setResetConfirmText(e.target.value)}
                          placeholder={t('Type \'reset\' to confirm')}
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      onRestoreDefaults()
                      setResetDialogOpen(false)
                      setResetConfirmText('')
                    }}
                    disabled={resetConfirmText.toLowerCase() !== 'reset'}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    {t('Reset All Settings')}
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
