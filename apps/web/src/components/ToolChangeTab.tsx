import { useTranslation } from 'react-i18next'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { ToolChangeMethodSelectDialog } from './ToolChangeMethodSelectDialog'
import { useToolChange } from '@/contexts/ToolChangeContext'
import { useGetSettingsQuery, useSetExtensionsMutation } from '@/services/api'
import { useGcodeCommand, useBitsetterReference } from '@/hooks'
import { methodToToolChangeBlock } from '@/utils/setupPlan'
import { RenderToolChangeBlock } from './ToolChangeBlocks'
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
 * Tool Change tab: uses toolChangePolicy (BitSetter, Touchplate Z, Manual, Custom Z, or ask).
 * When policy is a method, shows the corresponding tool-change block (separate from job setup blocks).
 */
export function ToolChangeTab({
  connectedPort,
  machinePosition,
  workPosition,
  currentWCS = 'G54',
  probeContact = false,
}: ToolChangeTabProps) {
  const { t } = useTranslation()
  const { toolChangeMethod, completeToolChange, triggerToolChange } = useToolChange()
  const { data: settings } = useGetSettingsQuery()

  // Debug: allow advancing tool change flow without completing the step (from DebugPanel toggle)
  const [debugAllowNext, setDebugAllowNext] = useState(() => localStorage.getItem('debug.allowNextToolchangeScreen') === 'true')
  useEffect(() => {
    const handle = () => setDebugAllowNext(localStorage.getItem('debug.allowNextToolchangeScreen') === 'true')
    window.addEventListener('debug.allowNextToolchangeScreen.changed', handle)
    return () => window.removeEventListener('debug.allowNextToolchangeScreen.changed', handle)
  }, [])
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
      probeContact,
    }),
    [
      connectedPort,
      currentWCS,
      sendGcode,
      clearBitsetterReference,
      machinePosition,
      workPosition,
      storeBitsetterReference,
      probeContact,
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

  const headerTitle =
    toolChangeMethod.type === 'bitsetter'
      ? t('Tool change — set reference for new tool')
      : t('Tool change — re-zero Z for new tool')
  const headerSubtitle =
    toolChangeMethod.type === 'bitsetter'
      ? t('Measure the new tool on the BitSetter, then resume the job.')
      : t('Set Z zero for the new tool, then resume the job.')

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <header className="flex items-start justify-between gap-4 bg-gradient-to-r from-primary/15 via-primary/10 to-primary/5 px-4 py-4 text-foreground shrink-0">
        <div className="min-w-0 space-y-1.5">
          <h2 className="text-xl font-semibold tracking-tight">{headerTitle}</h2>
          <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
        </div>
      </header>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden p-4">
        {RenderToolChangeBlock(block, {
          context,
          onComplete: completeToolChange,
          onError: (msg) => console.error(msg),
          debugAllowNext,
        })}
      </div>
    </div>
  )
}
