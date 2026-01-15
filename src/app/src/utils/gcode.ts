/**
 * G-code utilities
 * 
 * Provides utilities for building G-code commands and working with coordinate systems
 */

/**
 * Convert WCS (Work Coordinate System) string to P number for G10 commands
 * G54 = P1, G55 = P2, etc.
 */
export function getWCSPNumber(wcs: string): number {
  const map: Record<string, number> = {
    'G54': 1,
    'G55': 2,
    'G56': 3,
    'G57': 4,
    'G58': 5,
    'G59': 6,
  }
  return map[wcs] || 1
}

/**
 * Build G10 L20 command to set work coordinate system zero
 * G10 L20 P<wcs_number> <axes>0
 * 
 * @example
 * buildSetZeroCommand('G54', 'X') // 'G10 L20 P1 X0'
 * buildSetZeroCommand('G54', 'xy') // 'G10 L20 P1 X0 Y0'
 * buildSetZeroCommand('G54', 'xyz') // 'G10 L20 P1 X0 Y0 Z0'
 */
export function buildSetZeroCommand(
  wcs: string,
  axes: 'x' | 'y' | 'z' | 'xy' | 'xz' | 'yz' | 'xyz'
): string {
  const p = getWCSPNumber(wcs)
  const axisParts: string[] = []
  
  if (axes.includes('x')) axisParts.push('X0')
  if (axes.includes('y')) axisParts.push('Y0')
  if (axes.includes('z')) axisParts.push('Z0')
  
  return `G10 L20 P${p} ${axisParts.join(' ')}`
}

/**
 * Build G10 L20 command to set work coordinate system zero with offset
 * G10 L20 P<wcs_number> <axis><value>
 * 
 * @example
 * buildSetZeroWithOffsetCommand('G54', 'Z', 5.0) // 'G10 L20 P1 Z5.0'
 */
export function buildSetZeroWithOffsetCommand(
  wcs: string,
  axis: 'X' | 'Y' | 'Z',
  value: number
): string {
  const p = getWCSPNumber(wcs)
  return `G10 L20 P${p} ${axis}${value}`
}

/**
 * Build G0 (rapid move) command
 * 
 * @example
 * buildRapidMoveCommand({ x: 100, y: 50 }) // 'G0 X100 Y50'
 * buildRapidMoveCommand({ z: 10 }) // 'G0 Z10'
 */
export function buildRapidMoveCommand(
  position: Partial<{ x: number; y: number; z: number }>
): string {
  const parts: string[] = []
  if (position.x !== undefined) parts.push(`X${position.x}`)
  if (position.y !== undefined) parts.push(`Y${position.y}`)
  if (position.z !== undefined) parts.push(`Z${position.z}`)
  
  if (parts.length === 0) return ''
  return `G0 ${parts.join(' ')}`
}

/**
 * Build G0 command to go to work zero
 * 
 * @example
 * buildGoToZeroCommand('X') // 'G0 X0'
 * buildGoToZeroCommand('xy') // 'G0 X0 Y0'
 */
export function buildGoToZeroCommand(axes: 'X' | 'Y' | 'Z' | 'XY' | 'XYZ'): string {
  const parts: string[] = []
  if (axes.includes('X')) parts.push('X0')
  if (axes.includes('Y')) parts.push('Y0')
  if (axes.includes('Z')) parts.push('Z0')
  
  return `G0 ${parts.join(' ')}`
}

/**
 * Parse T commands from G-code to extract tool IDs
 * Looks for patterns like: T1, T2, M6 T1, T1 M6, etc.
 * 
 * @param gcode - The G-code string to parse
 * @returns Set of tool IDs found in the G-code
 * 
 * @example
 * parseToolsFromGcode('T1 M6\nG0 X0\nT2 M6') // Set([1, 2])
 * parseToolsFromGcode('T 5 M6') // Set([5])
 */
export function parseToolsFromGcode(gcode: string): Set<number> {
  const toolIds = new Set<number>()
  if (!gcode) return toolIds
  
  // Match T commands followed by numbers
  // Pattern: T followed by optional whitespace and a number
  // Examples: T1, T2, T 1, M6 T1, T1 M6, etc.
  const toolPattern = /\bT\s*(\d+)\b/gi
  let match
  
  while ((match = toolPattern.exec(gcode)) !== null) {
    const toolId = parseInt(match[1], 10)
    if (!isNaN(toolId) && toolId >= 0) {
      toolIds.add(toolId)
    }
  }
  
  return toolIds
}
