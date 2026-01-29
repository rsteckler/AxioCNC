import { cn } from '@/lib/utils'
import { useSettingsSections } from './settingsSections'
export type { SettingsSection } from './settingsSections'

interface SettingsNavProps {
  activeId: string
  onNavigate: (id: string) => void
  showAdvanced?: boolean
}

export function SettingsNav({ activeId, onNavigate, showAdvanced = false }: SettingsNavProps) {
  const settingsSections = useSettingsSections()
  const visibleSections = settingsSections.filter(
    section => section.id !== 'advanced' || showAdvanced
  )

  return (
    <nav className="space-y-1">
      {visibleSections.map((section) => (
        <button
          key={section.id}
          onClick={() => onNavigate(section.id)}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
            'hover:bg-accent hover:text-accent-foreground',
            activeId === section.id
              ? 'bg-primary/10 text-primary border-l-2 border-primary'
              : 'text-muted-foreground'
          )}
        >
          {section.icon}
          {section.label}
        </button>
      ))}
    </nav>
  )
}

