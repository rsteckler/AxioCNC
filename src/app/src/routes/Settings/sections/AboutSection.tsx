import { useRef, useCallback } from 'react'
import { SettingsSection } from '../SettingsSection'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Github, Heart } from 'lucide-react'

interface AboutSectionProps {
  version: string
  latestVersion?: string
  onEnableAdvancedSettings?: () => void
}

export function AboutSection({ version, latestVersion, onEnableAdvancedSettings }: AboutSectionProps) {
  const isUpdateAvailable = latestVersion && version !== latestVersion
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
              Update available: {latestVersion}
            </Badge>
          )}
        </div>

        {/* Links */}
        <div className="grid gap-3">
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
