import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface SetupTutorialDialogProps {
  open: boolean
  dontShowAgain: boolean
  onOpenChange: (open: boolean) => void
  onDontShowAgainChange: (value: boolean) => void
}

export function SetupTutorialDialog({
  open,
  dontShowAgain,
  onOpenChange,
  onDontShowAgainChange,
}: SetupTutorialDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Setup Tutorial</DialogTitle>
        </DialogHeader>

        <div className="min-h-[160px]" />

        <div className="flex items-center gap-2">
          <input
            id="setup-tutorial-hide"
            type="checkbox"
            checked={dontShowAgain}
            onChange={(event) => onDontShowAgainChange(event.target.checked)}
            className="h-4 w-4 rounded border border-input bg-background text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          <Label htmlFor="setup-tutorial-hide">Don&apos;t show this again</Label>
        </div>

        <DialogFooter>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
