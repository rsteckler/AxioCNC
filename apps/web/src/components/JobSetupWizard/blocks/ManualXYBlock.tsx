import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { buildSetZeroCommand } from '@/utils/gcode'
import type { SetupBlockProps } from './types'

/**
 * Manual XY block: user jogs to position, then sets XY work zero.
 * Single-purpose step for the setup wizard.
 */
export function ManualXYBlock({ context, onComplete, onError }: SetupBlockProps) {
  const { t } = useTranslation()
  const { currentWCS, sendGcode } = context

  const handleSetZero = async () => {
    const gcode = buildSetZeroCommand(currentWCS, 'xy')
    if (gcode && sendGcode(gcode)) {
      onComplete()
    } else {
      onError(t('Failed to send set-zero command'))
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('Jog the tool to the XY position you want as work zero, then set XY zero.')}
      </p>
      <Button onClick={handleSetZero}>
        {t('Set XY zero')}
      </Button>
    </div>
  )
}
