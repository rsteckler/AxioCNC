import { useRef, useCallback } from 'react'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ExternalLink, Github, Heart, PlayCircle, Loader2 } from 'lucide-react'
import { useGitHubVersion, compareVersions } from '@/hooks/useGitHubVersion'

interface AboutSectionProps {
  version: string
  checkForUpdates: boolean
  allowAnalytics: boolean
  onCheckForUpdatesChange: (value: boolean) => void
  onAnalyticsChange: (value: boolean) => void
  onEnableAdvancedSettings?: () => void
  onShowSetupTutorial?: () => void
}

export function AboutSection({ 
  version, 
  checkForUpdates,
  allowAnalytics,
  onCheckForUpdatesChange,
  onAnalyticsChange,
  onEnableAdvancedSettings,
  onShowSetupTutorial
}: AboutSectionProps) {
  // Fetch latest version from GitHub if automatic updates are enabled
  const { latestVersion: gitHubLatestVersion, isLoading: isLoadingVersion, releaseUrl } = useGitHubVersion()
  
  // Use GitHub version if available
  const availableVersion = gitHubLatestVersion || null
  const isUpdateAvailable = availableVersion && compareVersions(version, availableVersion) < 0
  
  // Build release page URL
  const releasePageUrl = availableVersion
    ? (releaseUrl || `https://github.com/rsteckler/AxioCNC/releases/tag/v${availableVersion}`)
    : null
  
  const clickTimesRef = useRef<number[]>([])

  const handleTitleClick = useCallback(() => {
    if (!onEnableAdvancedSettings) return

    const now = Date.now()
    const fiveSecondsAgo = now - 5000

    // Remove clicks older than 5 seconds
    clickTimesRef.current = clickTimesRef.current.filter(time => time > fiveSecondsAgo)

    // Add current click
    clickTimesRef.current.push(now)

    // If we have 10 clicks within 5 seconds, enable advanced settings
    if (clickTimesRef.current.length >= 10) {
      onEnableAdvancedSettings()
      clickTimesRef.current = [] // Reset after triggering
    }
  }, [onEnableAdvancedSettings])

  return (
    <SettingsSection 
      id="about" 
      title="About"
      description="Information about AxioCNC"
      isLast
      onTitleClick={handleTitleClick}
    >
      <div className="space-y-6">
        {/* Version Info */}
        <div className="flex items-center justify-between p-4 rounded-lg bg-card border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-lg">AxioCNC</span>
              <Badge variant="secondary">{version}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              A full-featured web-based interface for CNC controllers
            </p>
          </div>
          {isUpdateAvailable && (
            <Badge className="bg-primary text-primary-foreground">
              Update available: {availableVersion}
            </Badge>
          )}
        </div>

        {/* Update and Privacy Settings */}
        <div className="space-y-4 pt-2">
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
          
          {/* Version Information */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Current Version:</span>
              <Badge variant="secondary">{version}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Available Version:</span>
              {isLoadingVersion ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : availableVersion ? (
                <Badge variant={isUpdateAvailable ? "default" : "secondary"}>
                  {availableVersion}
                </Badge>
              ) : (
                <span className="text-muted-foreground">Unknown</span>
              )}
            </div>
            {/* Update Status Text */}
            {!isLoadingVersion && availableVersion && releasePageUrl && (
              <div className="pt-1 text-right">
                {isUpdateAvailable ? (
                  <a
                    href={releasePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-green-600 dark:text-green-400 hover:underline"
                  >
                    A new version is available
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                ) : (
                  <a
                    href={releasePageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
                  >
                    You are running the latest version
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </div>
            )}
          </div>

          <SettingsField
            label="Anonymous Usage Data"
            description="Help improve AxioCNC by sending anonymous usage statistics"
            tooltip="When enabled, anonymous usage data is collected to help improve the application. No personal information or G-code files are ever transmitted."
            horizontal
          >
            <Switch
              checked={allowAnalytics}
              onCheckedChange={onAnalyticsChange}
            />
          </SettingsField>
        </div>

        {/* Links */}
        <div className="grid gap-3">
          {onShowSetupTutorial && (
            <button
              type="button"
              onClick={onShowSetupTutorial}
              className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors group w-full text-left"
            >
              <div className="flex items-center gap-3 flex-1">
                <PlayCircle className="w-5 h-5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium">Show Setup Tutorial</p>
                  <p className="text-sm text-muted-foreground">
                    Open the setup walkthrough again
                  </p>
                </div>
              </div>
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 ml-2" />
            </button>
          )}
          <a
            href="https://github.com/rsteckler/axiocnc"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Github className="w-5 h-5" />
              <div>
                <p className="font-medium">GitHub Repository</p>
                <p className="text-sm text-muted-foreground">
                  View source code, report issues, and contribute
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </a>

          <a
            href="https://github.com/rsteckler/axiocnc#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors group"
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="w-5 h-5" />
              <div>
                <p className="font-medium">Documentation</p>
                <p className="text-sm text-muted-foreground">
                  Guides, API reference, and community resources
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </a>

          <a
            href="https://github.com/sponsors/rsteckler"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors group"
          >
            <div className="flex items-center gap-3">
              <Heart className="w-5 h-5 text-red-500" />
              <div>
                <p className="font-medium">Support the Project</p>
                <p className="text-sm text-muted-foreground">
                  Help fund development via GitHub Sponsors
                </p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </a>
        </div>

        {/* License */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground text-center">
            AxioCNC is open source software licensed under the{' '}
            <a
              href="https://github.com/rsteckler/axiocnc/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              MIT License
            </a>
          </p>
        </div>
      </div>
    </SettingsSection>
  )
}
