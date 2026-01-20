/* eslint-disable react-refresh/only-export-components */
// This file only exports constants and functions, not components.
// Fast Refresh warnings are expected for constants-only files.

import { Circle, Square, Triangle, Hexagon, CircleDot, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'

// CNC Actions that can be mapped to gamepad buttons
export type CncAction = 
  | 'none'
  | 'jog_x_pos' | 'jog_x_neg' | 'jog_y_pos' | 'jog_y_neg' | 'jog_z_pos' | 'jog_z_neg'
  | 'home_all'
  | 'zero_all' | 'zero_x' | 'zero_y' | 'zero_z'
  | 'start' | 'stop' | 'pause' | 'resume'
  | 'feed_hold'
  | 'spindle_on' | 'spindle_off'
  | 'speed_slow' | 'speed_medium' | 'speed_fast'
  | 'emergency_stop'

export const CNC_ACTIONS: { value: CncAction; label: string; category: string }[] = [
  { value: 'none', label: 'None', category: 'General' },
  // Jogging
  { value: 'jog_x_pos', label: 'Jog X+', category: 'Jogging' },
  { value: 'jog_x_neg', label: 'Jog X-', category: 'Jogging' },
  { value: 'jog_y_pos', label: 'Jog Y+', category: 'Jogging' },
  { value: 'jog_y_neg', label: 'Jog Y-', category: 'Jogging' },
  { value: 'jog_z_pos', label: 'Jog Z+', category: 'Jogging' },
  { value: 'jog_z_neg', label: 'Jog Z-', category: 'Jogging' },
  // Homing
  { value: 'home_all', label: 'Home All', category: 'Homing' },
  // Zeroing
  { value: 'zero_all', label: 'Zero All', category: 'Zeroing' },
  { value: 'zero_x', label: 'Zero X', category: 'Zeroing' },
  { value: 'zero_y', label: 'Zero Y', category: 'Zeroing' },
  { value: 'zero_z', label: 'Zero Z', category: 'Zeroing' },
  // Job Control
  { value: 'start', label: 'Start Job', category: 'Job Control' },
  { value: 'stop', label: 'Stop Job', category: 'Job Control' },
  { value: 'pause', label: 'Pause Job', category: 'Job Control' },
  { value: 'resume', label: 'Resume Job', category: 'Job Control' },
  { value: 'feed_hold', label: 'Feed Hold', category: 'Job Control' },
  // Spindle
  { value: 'spindle_on', label: 'Spindle On', category: 'Spindle' },
  { value: 'spindle_off', label: 'Spindle Off', category: 'Spindle' },
  // Speed
  { value: 'speed_slow', label: 'Jog Speed: Slow', category: 'Speed' },
  { value: 'speed_medium', label: 'Jog Speed: Medium', category: 'Speed' },
  { value: 'speed_fast', label: 'Jog Speed: Fast', category: 'Speed' },
  // Safety
  { value: 'emergency_stop', label: 'Emergency Stop', category: 'Safety' },
]

// Server-side (Linux) gamepad buttons mapping
// Note: LT/RT are axes (4 and 5), not buttons
export const SERVER_GAMEPAD_BUTTONS = [
  { index: 0, name: 'A', icon: <Circle className="w-4 h-4" /> },
  { index: 1, name: 'B', icon: <Circle className="w-4 h-4" /> },
  // Button 2 is not used on this controller
  { index: 3, name: 'X', icon: <Square className="w-4 h-4" /> },
  { index: 4, name: 'Y', icon: <Triangle className="w-4 h-4" /> },
  // Button 5 is not used on this controller
  { index: 6, name: 'LB', icon: <Hexagon className="w-4 h-4" /> },
  { index: 7, name: 'RB', icon: <Hexagon className="w-4 h-4" /> },
  // Buttons 8, 9 are not shown in UI
  { index: 10, name: 'Back', icon: <Square className="w-3 h-3" /> },
  { index: 11, name: 'Start', icon: <Square className="w-3 h-3" /> },
  { index: 13, name: 'Left Stick Click', icon: <CircleDot className="w-4 h-4" /> },
  { index: 14, name: 'Right Stick Click', icon: <CircleDot className="w-4 h-4" /> },
  { index: 12, name: 'D-Pad Up', icon: <ArrowUp className="w-4 h-4" />, isDpad: true },
  { index: 16, name: 'D-Pad Down', icon: <ArrowDown className="w-4 h-4" />, isDpad: true },
  { index: 17, name: 'D-Pad Left', icon: <ArrowLeft className="w-4 h-4" />, isDpad: true },
  { index: 15, name: 'D-Pad Right', icon: <ArrowRight className="w-4 h-4" />, isDpad: true },
  // Note: D-pad buttons (12=Up, 15=Right, 16=Down, 17=Left) map to axes 6 and 7, not buttons
]

// Client-side (browser) gamepad buttons mapping
// Note: LT/RT are buttons (6 and 7) in browser Gamepad API
export const CLIENT_GAMEPAD_BUTTONS = [
  { index: 0, name: 'A', icon: <Circle className="w-4 h-4" /> },
  { index: 1, name: 'B', icon: <Circle className="w-4 h-4" /> },
  { index: 2, name: 'X', icon: <Square className="w-4 h-4" /> },
  { index: 3, name: 'Y', icon: <Triangle className="w-4 h-4" /> },
  { index: 4, name: 'LB', icon: <Hexagon className="w-4 h-4" /> },
  { index: 5, name: 'RB', icon: <Hexagon className="w-4 h-4" /> },
  { index: 6, name: 'LT', icon: <Hexagon className="w-4 h-4" /> },
  { index: 7, name: 'RT', icon: <Hexagon className="w-4 h-4" /> },
  { index: 8, name: 'Back', icon: <Square className="w-3 h-3" /> },
  { index: 9, name: 'Start', icon: <Square className="w-3 h-3" /> },
  { index: 10, name: 'Left Stick Click', icon: <CircleDot className="w-4 h-4" /> },
  { index: 11, name: 'Right Stick Click', icon: <CircleDot className="w-4 h-4" /> },
  { index: 12, name: 'D-Pad Up', icon: <ArrowUp className="w-4 h-4" />, isDpad: true },
  { index: 13, name: 'D-Pad Down', icon: <ArrowDown className="w-4 h-4" />, isDpad: true },
  { index: 14, name: 'D-Pad Left', icon: <ArrowLeft className="w-4 h-4" />, isDpad: true },
  { index: 15, name: 'D-Pad Right', icon: <ArrowRight className="w-4 h-4" />, isDpad: true },
  // Note: D-pad buttons are actual buttons (12-15) in browser Gamepad API, not axes
]

// Legacy export for backwards compatibility (defaults to server)
export const GAMEPAD_BUTTONS = SERVER_GAMEPAD_BUTTONS

/**
 * Get the appropriate gamepad button array based on connection location
 */
export function getGamepadButtons(connectionLocation: 'server' | 'client' = 'server') {
  return connectionLocation === 'client' ? CLIENT_GAMEPAD_BUTTONS : SERVER_GAMEPAD_BUTTONS
}
