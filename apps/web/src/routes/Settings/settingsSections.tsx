import React from 'react'
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
