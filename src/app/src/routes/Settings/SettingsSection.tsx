import { ReactNode } from 'react'
import { Separator } from '@/components/ui/separator'

interface SettingsSectionProps {
  id: string
  title: string
  description?: string
  children: ReactNode
  isLast?: boolean
}

export function SettingsSection({ 
  id, 
  title, 
  description, 
  children, 
  isLast = false 
}: SettingsSectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="mb-6 pl-4 border-l-4 border-primary">
        <h2 className="text-2xl font-bold text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      <div className="space-y-6">
        {children}
      </div>
      {!isLast && <Separator className="mt-10 mb-8" />}
    </section>
  )
}
