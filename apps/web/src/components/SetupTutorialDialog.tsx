import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'

interface SetupTutorialDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SetupTutorialDialog({
  open,
  onOpenChange,
}: SetupTutorialDialogProps) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('Welcome to AxioCNC')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              {t('You can always find the latest documentation at')}{' '}
              <a
                href="https://axiocnc.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                axiocnc.com/docs
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <div>
            <p className="text-sm mb-2">
              {t('AxioCNC is built around the workflows most people use:')}
            </p>
            <ul className="text-sm space-y-1 ml-4 list-disc">
              <li><strong>{t('Setup')}</strong> {t('the job')}</li>
              <li><strong>{t('Monitor')}</strong> {t('the job')}</li>
              <li><strong>{t('Review')}</strong> {t('job stats')}</li>
            </ul>
            <p className="text-sm mt-3">
              {t('You can find these three phases at the top of the screen. For now, go to')}{' '}
              <strong>{t('Settings')}</strong> {t('to setup your machine.')}
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          {t('This tutorial can always be run again from the Settings → About section.')}
        </p>

        <DialogFooter>
          <Button variant="default" onClick={() => onOpenChange(false)}>
            {t('Close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
