import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { buildSetZeroCommand } from '@/utils/gcode'
import { SetupBlockLayout } from './SetupBlockLayout'
import type { SetupBlockProps } from './types'

/**
 * Manual Z block: user positions Z, then sets Z work zero.
 * Clears BitSetter reference when Z zero is set.
 */
export function ManualZBlock({ context, onComplete, onError, debugAllowNext, footerLeftExtra, footerRightExtra }: SetupBlockProps) {
  const { t } = useTranslation()
  const { currentWCS, sendGcode, clearBitsetterReference } = context

  const handleSetZero = async () => {
    await clearBitsetterReference(currentWCS)
    const gcode = buildSetZeroCommand(currentWCS, 'z')
    if (gcode && sendGcode(gcode)) {
      onComplete()
    } else {
      onError(t('Failed to send set-zero command'))
    }
  }

  const footerRight = (
    <>
      {footerRightExtra}
      <Button onClick={handleSetZero}>{t('Set Z zero')}</Button>
      {debugAllowNext && (
        <Button variant="secondary" size="sm" onClick={onComplete}>{t('Next (debug)')}</Button>
      )}
    </>
  )

  return (
    <SetupBlockLayout footerLeft={footerLeftExtra} footerRight={footerRight}>
      <p className="text-sm text-muted-foreground">
        {t('Position the tool at Z work zero (e.g. paper test), then set Z zero.')}
      </p>
    </SetupBlockLayout>
  )
}
