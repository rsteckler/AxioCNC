/**
 * One-off probe flow from the Probe panel (Run button).
 * Uses the same block-based execution as Job Setup: singleMethodToBlocks + RenderSetupBlock.
 */
import { useState, useCallback, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { singleMethodToBlocks } from '@/utils/setupPlan'
import { RenderSetupBlock, SetupBlockBackButton } from '@/components/JobSetupWizard/blocks'
import type { BlockRunContext } from '@/components/JobSetupWizard/blocks'
import { useGcodeCommand, useBitsetterReference } from '@/hooks'
import { useSetExtensionsMutation } from '@/services/api'
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'

export interface SingleMethodProbeFlowProps {
  method: ZeroingMethod
  onClose: () => void
  isConnected: boolean
  connectedPort: string | null
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  currentWCS?: string
}

export function SingleMethodProbeFlow({
  method,
  onClose,
  connectedPort,
  machinePosition = { x: 0, y: 0, z: 0 },
  workPosition = { x: 0, y: 0, z: 0 },
  probeContact = false,
  currentWCS = 'G54',
}: SingleMethodProbeFlowProps) {
  const { t } = useTranslation()
  const { sendGcode } = useGcodeCommand(connectedPort)
  const { clearBitsetterReference } = useBitsetterReference()
  const [setExtensions] = useSetExtensionsMutation()

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
      machinePosition,
      workPosition,
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

  const blocks = useMemo(() => singleMethodToBlocks(method), [method])
  const [blockIndex, setBlockIndex] = useState(0)
  const currentBlock = blocks[blockIndex]

  useEffect(() => {
    setBlockIndex(0)
  }, [method.id])

  const [debugAllowNext, setDebugAllowNext] = useState(
    () => localStorage.getItem('debug.allowNextToolchangeScreen') === 'true'
  )
  useEffect(() => {
    const handle = () => setDebugAllowNext(localStorage.getItem('debug.allowNextToolchangeScreen') === 'true')
    window.addEventListener('debug.allowNextToolchangeScreen.changed', handle)
    return () => window.removeEventListener('debug.allowNextToolchangeScreen.changed', handle)
  }, [])

  const handleBlockComplete = useCallback(() => {
    if (blockIndex < blocks.length - 1) {
      setBlockIndex((i) => i + 1)
    } else {
      onClose()
    }
  }, [blockIndex, blocks.length, onClose])

  if (blocks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6">
        <p className="text-sm text-muted-foreground mb-4">
          {t('This method cannot be run as a one-off probe.')}
        </p>
        <Button onClick={onClose} variant="outline">
          {t('Close')}
        </Button>
      </div>
    )
  }

  const canGoBack = blockIndex > 0
  const onBack = canGoBack ? () => setBlockIndex((i) => i - 1) : undefined
  const isBlockWithMergedFooter =
    currentBlock.kind === 'bitzero_xy' ||
    currentBlock.kind === 'bitzero_z' ||
    currentBlock.kind === 'bitzero_xyz' ||
    currentBlock.kind === 'bitsetter' ||
    currentBlock.kind === 'manual_xy' ||
    currentBlock.kind === 'manual_z' ||
    currentBlock.kind.startsWith('touchplate_') ||
    currentBlock.kind === 'custom_z'

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex shrink-0 items-center justify-between gap-2 py-2 px-2 border-b">
        <span className="text-sm font-medium truncate">
          {method.name}
          {blocks.length > 1 && (
            <span className="text-muted-foreground ml-1">
              ({t('step {{current}} of {{total}}', { current: blockIndex + 1, total: blocks.length })})
            </span>
          )}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('Close')}
        </Button>
      </div>
      <div
        className="flex flex-1 flex-col min-h-0 overflow-auto"
        key={`block-${blockIndex}-${currentBlock?.kind ?? ''}`}
      >
        {RenderSetupBlock(currentBlock, {
          context,
          onComplete: handleBlockComplete,
          onError: (msg) => console.error(msg),
          debugAllowNext,
          ...(isBlockWithMergedFooter && onBack && {
            footerLeftExtra: <SetupBlockBackButton onClick={onBack}>{t('Back')}</SetupBlockBackButton>,
          }),
        })}
      </div>
    </div>
  )
}
