import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Download } from 'lucide-react'

interface UpdateNotificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentVersion: string
  latestVersion: string
  releaseUrl?: string | null
}

export function UpdateNotificationDialog({
  open,
  onOpenChange,
  currentVersion,
  latestVersion,
  releaseUrl,
}: UpdateNotificationDialogProps) {
  const defaultReleaseUrl = `https://github.com/rsteckler/AxioCNC/releases/tag/v${latestVersion}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Available</DialogTitle>
          <DialogDescription>
            A new version of AxioCNC is available for download.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
            <div className="space-y-1">
              <div className="text-sm font-medium text-muted-foreground">Current Version</div>
              <Badge variant="secondary" className="text-base">
                {currentVersion}
              </Badge>
            </div>
            <div className="space-y-1 text-right">
              <div className="text-sm font-medium text-muted-foreground">New Version</div>
              <Badge variant="default" className="text-base">
                {latestVersion}
              </Badge>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Visit the release page to download the latest version and view release notes.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Later
          </Button>
          <Button
            variant="default"
            onClick={() => {
              window.open(releaseUrl || defaultReleaseUrl, '_blank', 'noopener,noreferrer')
              onOpenChange(false)
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            View Release
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
