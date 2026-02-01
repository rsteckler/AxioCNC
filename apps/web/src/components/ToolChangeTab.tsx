import { useTranslation } from 'react-i18next'
import { useCallback, useMemo } from 'react'
import { ToolChangeMethodSelectDialog } from './ToolChangeMethodSelectDialog'
import { useToolChange } from '@/contexts/ToolChangeContext'
import { useGetSettingsQuery, useSetExtensionsMutation } from '@/services/api'
import { useGcodeCommand, useBitsetterReference } from '@/hooks'
import { methodToToolChangeBlock } from '@/utils/setupPlan'
import { RenderSetupBlock } from './JobSetupWizard/blocks'
import type { BlockRunContext } from './JobSetupWizard/blocks'
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'

interface ToolChangeTabProps {
  isConnected: boolean
  connectedPort: string | null
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  currentWCS?: string
}

/**
 * Tool Change tab: uses toolChangePolicy (BitSetter, Touchplate Z, Manual, or ask).
 * When policy is a method, shows the corresponding block; when "ask", shows a dialog
 * with method cards, then runs the chosen block. Reuses JobSetupWizard blocks.
 */
export function ToolChangeTab({
  connectedPort,
  machinePosition,
  workPosition,
  currentWCS = 'G54',
}: ToolChangeTabProps) {
  const { t } = useTranslation()
  const { toolChangeMethod, completeToolChange, triggerToolChange } = useToolChange()
  const { data: settings } = useGetSettingsQuery()
  const { sendGcode } = useGcodeCommand(connectedPort)
  const { clearBitsetterReference } = useBitsetterReference()
  const [setExtensions] = useSetExtensionsMutation()

  const methods: ZeroingMethod[] = settings?.zeroingMethods?.methods?.filter((m: ZeroingMethod) => m.enabled) ?? []

  const storeBitsetterReference = useCallback(
    async (wcs: string, value: number) => {
      const key = `bitsetter.toolReference.${wcs}`
      await setExtensions({
        key,
        data: { value, wcs, timestamp: new Date().toISOString() },
      }).unwrap()
    },
    [setExtensions]
  )

  const context: BlockRunContext = useMemo(
    () => ({
      connectedPort,
      currentWCS,
      sendGcode,
      clearBitsetterReference,
      machinePosition: machinePosition ?? { x: 0, y: 0, z: 0 },
      workPosition: workPosition ?? { x: 0, y: 0, z: 0 },
      storeBitsetterReference,
    }),
    [
      connectedPort,
      currentWCS,
      sendGcode,
      clearBitsetterReference,
      machinePosition,
      workPosition,
      storeBitsetterReference,
    ]
  )

  const showDialog = toolChangeMethod === 'ask'

  const handleMethodSelect = (method: ZeroingMethod) => {
    triggerToolChange(method)
  }

  // Policy is "ask": show placeholder and card dialog
  if (toolChangeMethod === 'ask') {
    return (
      <>
        <div className="flex-1 flex items-center justify-center bg-muted/30">
          <div className="text-sm text-muted-foreground text-center py-8">
            {t('Please select a zeroing method')}
          </div>
        </div>
        <ToolChangeMethodSelectDialog
          open={showDialog}
          onOpenChange={() => {}}
          methods={methods}
          onSelect={handleMethodSelect}
        />
      </>
    )
  }

  // No method (shouldn't happen when pending)
  if (!toolChangeMethod) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground text-center py-8">
          {t('No tool change method configured')}
        </div>
      </div>
    )
  }

  // Policy is a method: run the corresponding block
  const block = methodToToolChangeBlock(toolChangeMethod)
  if (!block) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground text-center py-8">
          {t('This method is not available for tool change.')}
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 p-4">
      <h2 className="text-lg font-semibold mb-4">
        {toolChangeMethod.type === 'bitsetter'
          ? t('Establish tool reference')
          : t('Re-zero Z for tool change')}
      </h2>
      {RenderSetupBlock(block, {
        context,
        onComplete: completeToolChange,
        onError: (msg) => console.error(msg),
      })}
    </div>
  )
}
