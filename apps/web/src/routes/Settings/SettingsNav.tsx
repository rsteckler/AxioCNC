import { cn } from '@/lib/utils'
import { Settings, Palette, Gamepad2, Box, Zap, Info, Camera, Target, Plug, Code, Route, Wrench, Settings2 } from 'lucide-react'

export interface SettingsSection {
  id: string
  label: string
  icon: React.ReactNode
}

export const settingsSections: SettingsSection[] = [
  { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
  { id: 'connection', label: 'Connection', icon: <Plug className="w-4 h-4" /> },
  { id: 'machine', label: 'Machine', icon: <Box className="w-4 h-4" /> },
  { id: 'zeroing-methods', label: 'Zeroing Methods', icon: <Target className="w-4 h-4" /> },
  { id: 'zeroing-strategies', label: 'Zeroing Strategies', icon: <Route className="w-4 h-4" /> },
  { id: 'camera', label: 'Camera', icon: <Camera className="w-4 h-4" /> },
  { id: 'joystick', label: 'Joystick', icon: <Gamepad2 className="w-4 h-4" /> },
  { id: 'tool-library', label: 'Tool Library', icon: <Wrench className="w-4 h-4" /> },
  { id: 'macros', label: 'Macros', icon: <Code className="w-4 h-4" /> },
  { id: 'events', label: 'Events', icon: <Zap className="w-4 h-4" /> },
  { id: 'advanced', label: 'Advanced', icon: <Settings2 className="w-4 h-4" /> },
  { id: 'about', label: 'About', icon: <Info className="w-4 h-4" /> },
]

interface SettingsNavProps {
  activeId: string
  onNavigate: (id: string) => void
  showAdvanced?: boolean
}

export function SettingsNav({ activeId, onNavigate, showAdvanced = false }: SettingsNavProps) {
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

