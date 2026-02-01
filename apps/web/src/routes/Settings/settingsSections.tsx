import React from 'react'
import { useTranslation } from 'react-i18next'
import { Settings, Palette, Gamepad2, Box, Zap, Info, Camera, Target, Plug, Code, Route, Wrench, Settings2 } from 'lucide-react'

export interface SettingsSection {
  id: string
  label: string
  icon: React.ReactNode
}

export function useSettingsSections(): SettingsSection[] {
  const { t } = useTranslation()
  
  return [
    { id: 'general', label: t('General'), icon: <Settings className="w-4 h-4" /> },
    { id: 'appearance', label: t('Appearance'), icon: <Palette className="w-4 h-4" /> },
    { id: 'connection', label: t('Connection'), icon: <Plug className="w-4 h-4" /> },
    { id: 'machine', label: t('Machine'), icon: <Box className="w-4 h-4" /> },
    { id: 'zeroing-methods', label: t('Zeroing Methods'), icon: <Target className="w-4 h-4" /> },
    { id: 'zeroing-strategies', label: t('Zeroing defaults'), icon: <Route className="w-4 h-4" /> },
    { id: 'camera', label: t('Camera'), icon: <Camera className="w-4 h-4" /> },
    { id: 'joystick', label: t('Joystick'), icon: <Gamepad2 className="w-4 h-4" /> },
    { id: 'tool-library', label: t('Tool Library'), icon: <Wrench className="w-4 h-4" /> },
    { id: 'macros', label: t('Macros'), icon: <Code className="w-4 h-4" /> },
    { id: 'events', label: t('Events'), icon: <Zap className="w-4 h-4" /> },
    { id: 'advanced', label: t('Advanced'), icon: <Settings2 className="w-4 h-4" /> },
    { id: 'about', label: t('About'), icon: <Info className="w-4 h-4" /> },
  ]
}

// Legacy export for backwards compatibility (will be removed)
export const settingsSections: SettingsSection[] = []
