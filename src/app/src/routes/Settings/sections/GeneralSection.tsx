import { useCallback, useRef, useState } from 'react'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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

export interface GoogleDriveStatus {
  isConnected: boolean
  isConnecting: boolean
  userEmail?: string
  error?: string
}

interface GeneralSectionProps {
  language: string
  checkForUpdates: boolean
  allowAnalytics: boolean
  watchFolders: WatchFolder[]
  googleDriveStatus: GoogleDriveStatus
  onLanguageChange: (value: string) => void
  onCheckForUpdatesChange: (value: boolean) => void
  onAnalyticsChange: (value: boolean) => void
  onImportSettings: (data: unknown) => void
  onExportSettings: () => void
  onRestoreDefaults: () => void
  onAddWatchFolder: (folder: Omit<WatchFolder, 'id'>) => void
  onRemoveWatchFolder: (id: string) => void
  onConnectGoogleDrive: () => void
  onDisconnectGoogleDrive: () => void
}

export function GeneralSection({ 
  language, 
  checkForUpdates,
  allowAnalytics,
  watchFolders,
  googleDriveStatus,
  onLanguageChange,
  onCheckForUpdatesChange,
  onAnalyticsChange,
  onImportSettings,
  onExportSettings,
  onRestoreDefaults,
  onAddWatchFolder,
  onRemoveWatchFolder,
  onConnectGoogleDrive,
  onDisconnectGoogleDrive,
}: GeneralSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [addFolderDialogOpen, setAddFolderDialogOpen] = useState(false)
  const [newFolderType, setNewFolderType] = useState<WatchFolderType>('local')
  const [newFolderPath, setNewFolderPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetConfirmText, setResetConfirmText] = useState('')

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

  const handleAddFolder = () => {
    if (!newFolderPath.trim()) return
    
    onAddWatchFolder({
      type: newFolderType,
      path: newFolderPath.trim(),
      name: newFolderName.trim() || newFolderPath.split('/').pop() || 'Watch Folder',
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
        label="Automatic Updates"
        description="Check for new versions of AxioCNC on startup"
        horizontal
      >
        <Switch
          checked={checkForUpdates}
          onCheckedChange={onCheckForUpdatesChange}
        />
      </SettingsField>

      <SettingsField
        label="Anonymous Usage Data"
        description="Help improve AxioCNC by sending anonymous usage statistics"
        tooltip="When enabled, anonymous usage data is collected to help improve the application. No personal information or G-code files are ever transmitted."
        horizontal
      >
        <Switch
          checked={allowAnalytics}
          onCheckedChange={handleAnalyticsChange}
        />
      </SettingsField>

      {/* Watch Folders */}
      <div className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-medium text-sm">Watch Folders</h4>
        </div>
        <p className="text-sm text-muted-foreground">
          Monitor folders for G-code files. Files added to these folders will appear in your file browser.
        </p>

        {/* Folder List */}
        <div className="space-y-2">
          {watchFolders.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
              <FolderOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No watch folders configured</p>
              <p className="text-xs mt-1">Add a folder to monitor for G-code files</p>
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
                          {folder.type === 'local' ? 'Local' : 'Google Drive'}
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
                        <AlertDialogTitle>Remove Watch Folder?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove "{folder.name}" from your watch folders?
                          This won't delete any files, just stop monitoring the folder.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onRemoveWatchFolder(folder.id)}>
                          Remove
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
            Add Watch Folder
          </Button>
        </div>

        {/* Add Folder Dialog */}
        <Dialog open={addFolderDialogOpen} onOpenChange={setAddFolderDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Watch Folder</DialogTitle>
              <DialogDescription>
                Add a folder to monitor for G-code files. Choose between a local folder or Google Drive.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Folder Type */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Folder Type</label>
                <Select value={newFolderType} onValueChange={(v) => setNewFolderType(v as WatchFolderType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="local">
                      <div className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4" />
                        Local Folder
                      </div>
                    </SelectItem>
                    <SelectItem value="google-drive">
                      <div className="flex items-center gap-2">
                        <Cloud className="w-4 h-4 text-blue-500" />
                        Google Drive
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Google Drive Not Available Notice */}
                {newFolderType === 'google-drive' && (
                  <div className="p-3 rounded-lg bg-muted/50 border border-muted">
                    <p className="text-sm text-muted-foreground mb-2">
                      This feature is not yet implemented. Upvote it to be included in a future release.
                    </p>
                    <a
                      href="https://github.com/rsteckler/AxioCNC/issues/1"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Upvote Google Drive support
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
                        Connecting...
                      </Badge>
                    ) : googleDriveStatus.isConnected ? (
                      <Badge variant="secondary" className="gap-1.5 bg-green-500/10 text-green-600 border-green-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1.5 bg-red-500/10 text-red-600 border-red-500/20">
                        <XCircle className="w-3 h-3" />
                        Not Connected
                      </Badge>
                    )}
                  </div>

                  {/* User Email (when connected) */}
                  {googleDriveStatus.isConnected && googleDriveStatus.userEmail && (
                    <p className="text-sm text-muted-foreground">
                      Signed in as <span className="font-medium">{googleDriveStatus.userEmail}</span>
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
                        Disconnect
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
                        {googleDriveStatus.isConnecting ? 'Connecting...' : 'Connect to Google Drive'}
                      </Button>
                    )}
                  </div>

                  {!googleDriveStatus.isConnected && !googleDriveStatus.isConnecting && (
                    <p className="text-xs text-muted-foreground">
                      Connect your Google account to access files from Google Drive
                    </p>
                  )}
                </div>
              )}

              {/* Folder Path */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {newFolderType === 'local' ? 'Folder Path' : 'Google Drive Folder Path'}
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
                    ? 'Enter the full path to the folder on your local machine'
                    : 'Feature not yet implemented'
                  }
                </p>
              </div>

              {/* Display Name */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Display Name (optional)</label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="My G-code Files"
                  disabled={newFolderType === 'google-drive'}
                />
                <p className="text-xs text-muted-foreground">
                  A friendly name to identify this folder
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddFolderDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddFolder} 
                disabled={
                  !newFolderPath.trim() || 
                  newFolderType === 'google-drive'
                }
              >
                Add Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Settings Management */}
      <div className="pt-6 space-y-3">
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
            <AlertDialog open={resetDialogOpen} onOpenChange={(open) => {
              setResetDialogOpen(open)
              if (!open) setResetConfirmText('')
            }}>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 text-destructive hover:text-destructive">
                  <RotateCcw className="w-4 h-4" />
                  Reset to Defaults
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset All Settings?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-3">
                      <p>
                        This will reset <strong>all</strong> application settings to their default values, including:
                      </p>
                      <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                        <li>Machine configuration and connection settings</li>
                        <li>All macros</li>
                        <li>All event handlers</li>
                        <li>Watch folders</li>
                        <li>Theme and appearance settings</li>
                        <li>Zeroing methods and strategies</li>
                      </ul>
                      <p className="text-destructive font-medium">
                        This action cannot be undone. Consider exporting your current settings first.
                      </p>
                      <div className="pt-2">
                        <p className="text-sm mb-2">Type <strong>reset</strong> to confirm:</p>
                        <Input 
                          value={resetConfirmText}
                          onChange={(e) => setResetConfirmText(e.target.value)}
                          placeholder="Type 'reset' to confirm"
                          className="font-mono"
                        />
                      </div>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => {
                      onRestoreDefaults()
                      setResetDialogOpen(false)
                      setResetConfirmText('')
                    }}
                    disabled={resetConfirmText.toLowerCase() !== 'reset'}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
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
