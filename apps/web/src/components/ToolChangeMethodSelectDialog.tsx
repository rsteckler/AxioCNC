import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Target, SquareDashedBottom, Hand } from 'lucide-react'
import { getToolChangePolicyOptions } from '@/utils/zeroingStrategyOptions'
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'

const METHOD_ICONS: Record<string, React.ReactNode> = {
  bitsetter: <Target className="w-6 h-6" />,
  touchplate: <SquareDashedBottom className="w-6 h-6" />,
  manual: <Hand className="w-6 h-6" />,
}

function getMethodDescription(
  method: ZeroingMethod,
  t: (key: string, options?: Record<string, string>) => string
): string {
  switch (method.type) {
    case 'bitsetter':
      return t('Automatic tool length sensor for Z-axis zeroing')
    case 'touchplate':
      return t('Touch plate for Z-axis zeroing')
    case 'manual':
      return t('Manually jog to position and set Z zero')
    default:
      return t('Zeroing method')
  }
}

interface ToolChangeMethodSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  methods: ZeroingMethod[]
  onSelect: (method: ZeroingMethod) => void
}

/**
 * Dialog for choosing a tool-change method when policy is "ask each time".
 * Shows relevant method cards (BitSetter, Touchplate Z, Manual re-zero Z).
 */
export function ToolChangeMethodSelectDialog({
  open,
  onOpenChange,
  methods,
  onSelect,
}: ToolChangeMethodSelectDialogProps) {
  const { t } = useTranslation()

  const options = getToolChangePolicyOptions(methods, t).filter((opt) => opt.value !== 'ask')
  const methodsById = new Map(methods.filter((m) => m.enabled).map((m) => [m.id, m]))

  const handleSelect = (method: ZeroingMethod) => {
    onSelect(method)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{t('Tool change: choose method')}</DialogTitle>
          <DialogDescription>
            {t('Choose how to re-zero or set tool reference for this tool change.')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-2">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {t('No tool change methods available. Please configure methods in Settings.')}
            </p>
          ) : (
            options.map((opt) => {
              const method = methodsById.get(opt.value) as ZeroingMethod | undefined
              if (!method) return null
              const icon = METHOD_ICONS[method.type] ?? null
              const isBitSetter = method.type === 'bitsetter'

              return (
                <Card
                  key={method.id}
                  className="cursor-pointer transition-colors hover:bg-muted/50 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  tabIndex={0}
                  role="button"
                  onClick={() => handleSelect(method)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleSelect(method)
                    }
                  }}
                >
                  <CardHeader className="flex flex-row items-start gap-3 pb-2">
                    <div className="flex-shrink-0 mt-0.5 text-muted-foreground">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{method.name || opt.label}</CardTitle>
                      <CardDescription className="mt-1">
                        {getMethodDescription(method, t)}
                      </CardDescription>
                      {isBitSetter && (
                        <p className="text-xs text-muted-foreground mt-2 italic">
                          {t('Why: We need a reference measurement for the tool currently in the spindle.')}
                        </p>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
