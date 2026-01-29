import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { 
  Target, 
  Crosshair, 
  SquareDashedBottom,
  Hand, 
  Settings2,
} from 'lucide-react'
import type { ZeroingMethod, ZeroingMethodType } from '@/routes/Settings/sections/ZeroingMethodsSection'

// Icons for method types
const METHOD_ICONS: Record<ZeroingMethodType, React.ReactNode> = {
  'bitsetter': <Target className="w-5 h-5" />,
  'bitzero': <Crosshair className="w-5 h-5" />,
  'touchplate': <SquareDashedBottom className="w-5 h-5" />,
  'manual': <Hand className="w-5 h-5" />,
  'custom': <Settings2 className="w-5 h-5" />,
}

function getMethodDescription(method: ZeroingMethod, t: (key: string, options?: Record<string, string>) => string): string {
  switch (method.type) {
    case 'bitsetter':
      return t('Automatic tool length sensor for Z-axis zeroing')
    case 'bitzero':
      return t('Corner/edge/center probe for {{axes}} zeroing', { axes: method.axes.toUpperCase() })
    case 'touchplate':
      return t('Touch plate for Z-axis zeroing')
    case 'manual':
      return t('Manually jog to position and set {{axes}} zero', { axes: method.axes.toUpperCase() })
    case 'custom':
      return t('Custom G-code sequence for zeroing')
    default:
      return t('Zeroing method')
  }
}

function AxesBadge({ axes }: { axes: string }) {
  return (
    <div className="flex gap-0.5 ml-2">
      {axes.includes('x') && (
        <span className="w-3.5 h-3.5 rounded text-[9px] font-bold flex items-center justify-center bg-red-500/20 text-red-600 dark:text-red-400">X</span>
      )}
      {axes.includes('y') && (
        <span className="w-3.5 h-3.5 rounded text-[9px] font-bold flex items-center justify-center bg-green-500/20 text-green-600 dark:text-green-400">Y</span>
      )}
      {axes.includes('z') && (
        <span className="w-3.5 h-3.5 rounded text-[9px] font-bold flex items-center justify-center bg-blue-500/20 text-blue-600 dark:text-blue-400">Z</span>
      )}
    </div>
  )
}

interface ZeroingMethodSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  methods: ZeroingMethod[]
  title?: string
  description?: string
  onSelect: (method: ZeroingMethod | 'skip') => void
}

/**
 * Dialog for selecting a zeroing method when strategy is set to "ask each time"
 */
export function ZeroingMethodSelectDialog({
  open,
  onOpenChange,
  methods,
  title = 'Select Zeroing Method',
  description = 'Choose a zeroing method to use:',
  onSelect,
}: ZeroingMethodSelectDialogProps) {
  const { t } = useTranslation()
  // Filter to only enabled methods
  const enabledMethods = methods.filter(m => m.enabled)

  const handleSelect = (method: ZeroingMethod) => {
    onSelect(method)
    onOpenChange(false)
  }

  const handleSkip = () => {
    onSelect('skip')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md [&>button]:hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 mt-4">
          {enabledMethods.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {t('No zeroing methods available. Please configure methods in Settings.')}
            </div>
          ) : (
            enabledMethods.map((method) => (
              <Button
                key={method.id}
                variant="outline"
                className="w-full justify-start h-auto p-3"
                onClick={() => handleSelect(method)}
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="flex-shrink-0">
                    {METHOD_ICONS[method.type]}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium">{method.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {getMethodDescription(method, t)}
                    </div>
                  </div>
                  <AxesBadge axes={method.axes} />
                </div>
              </Button>
            ))
          )}
        </div>
        
        <div className="mt-4 pt-4 border-t">
          <Button
            variant="ghost"
            className="w-full"
            onClick={handleSkip}
          >
            {t('Skip')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
