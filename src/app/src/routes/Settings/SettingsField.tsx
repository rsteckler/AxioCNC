import { ReactNode } from 'react'
import { 
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger 
} from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'

interface SettingsFieldProps {
  label: string
  description?: string
  tooltip?: string
  /** For advanced settings, show the technical reference (e.g., EEPROM field) */
  technicalRef?: string
  children: ReactNode
  horizontal?: boolean
}

export function SettingsField({ 
  label, 
  description, 
  tooltip,
  technicalRef,
  children,
  horizontal = false
}: SettingsFieldProps) {
  const labelContent = (
    <div className="flex items-center gap-2">
      <span className="font-medium text-sm">{label}</span>
      {(tooltip || technicalRef) && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              {tooltip && <p>{tooltip}</p>}
              {technicalRef && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Reference: {technicalRef}
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  )

  if (horizontal) {
    return (
      <div className="flex items-center justify-between py-3">
        <div className="space-y-0.5">
          {labelContent}
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        <div>{children}</div>
      </div>
    )
  }

  return (
    <div className="space-y-2 py-3">
      {labelContent}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <div className="pt-1">{children}</div>
    </div>
  )
}

