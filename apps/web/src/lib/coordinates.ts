/**
 * Coordinate System Conversions
 * 
 * Three coordinate systems are used:
 * 
 * 1. Three.js (Scene) Coordinates:
 *    - Origin at left-bottom-lowest corner of work envelope
 *    - X increases right, Y increases up (toward top of table), Z increases up
 *    - Range: (0, 0, 0) to (xSize, ySize, zSize)
 * 
 * 2. Machine Coordinates (MPos):
 *    - Origin (0,0,0) is at the homing corner at maximum Z
 *    - Machine (0,0,0) is the home position
 *    - The homing corner can be any of the four corners: back-left, back-right, front-left, front-right
 *    - Machine limits determine where (0,0,0) is located within the work envelope
 * 
 * 3. Work Coordinates (WPos / WCS):
 *    - User-defined offset from machine coordinates
 *    - WPos = MPos - WorkOffset
 *    - Set via G54-G59 coordinate systems
 */

import type { HomingCorner } from './machineLimits'
import { getHomingPosition } from './machineLimits'

export interface Coordinate {
  x: number
  y: number
  z: number
}

export interface MachineLimits {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
  zmin: number
  zmax: number
}

/**
 * Get work envelope dimensions from machine limits
 */
export function getEnvelopeDimensions(limits: MachineLimits) {
  return {
    xSize: limits.xmax - limits.xmin,
    ySize: limits.ymax - limits.ymin,
    zSize: limits.zmax - limits.zmin,
  }
}

/**
 * Get the Three.js coordinates for the machine home position (0,0,0)
 * 
 * Three.js origin is always at (0, 0, 0) which is the left-bottom-lowest corner.
 * Machine home (0,0,0) can be at any of the four corners at max Z, depending on homingCorner.
 */
function getMachineHomeInThreeSpace(
  limits: MachineLimits,
  homingCorner: HomingCorner
): Coordinate {
  // xSize, ySize, zSize not currently used but may be needed for future calculations
  // const { xSize, ySize, zSize } = getEnvelopeDimensions(limits)
  const machineHome = getHomingPosition(limits, homingCorner)
  
  // Machine home position in machine coordinates is (0, 0, 0)
  // But limits tell us where that (0,0,0) is in the envelope
  // Three.js origin is at (0, 0, 0) which is always the left-bottom-lowest
  
  // Convert machine home position to Three.js coordinates
  // Three.js x = machine x - xmin (shifts to make xmin = 0)
  // Three.js y = machine y - ymin (shifts to make ymin = 0)
  // Three.js z = machine z - zmin (shifts to make zmin = 0)
  return {
    x: machineHome.x - limits.xmin,
    y: machineHome.y - limits.ymin,
    z: machineHome.z - limits.zmin,
  }
}

// =============================================================================
// Three.js ↔ Machine Coordinate Conversions
// =============================================================================

/**
 * Convert Three.js scene coordinates to Machine coordinates
 * 
 * @param three - Three.js coordinate
 * @param limits - Machine limits
 * @param homingCorner - Which corner is the home position (defaults to 'back-right' for backward compatibility)
 */
export function threeToMachine(
  three: Coordinate,
  limits: MachineLimits,
  homingCorner: HomingCorner = 'back-right'
): Coordinate {
  const threeHome = getMachineHomeInThreeSpace(limits, homingCorner)
  
  // Relative to Three.js home position
  // machineCoord = machineHome + (threeCoord - threeHome)
  // But machineHome in machine coords is (0,0,0), so:
  // machineCoord = threeCoord - threeHome
  return {
    x: three.x - threeHome.x,
    y: three.y - threeHome.y,
    z: three.z - threeHome.z,
  }
}

/**
 * Convert Machine coordinates to Three.js scene coordinates
 * 
 * @param machine - Machine coordinate
 * @param limits - Machine limits
 * @param homingCorner - Which corner is the home position (defaults to 'back-right' for backward compatibility)
 */
export function machineToThree(
  machine: Coordinate,
  limits: MachineLimits,
  homingCorner: HomingCorner = 'back-right'
): Coordinate {
  const threeHome = getMachineHomeInThreeSpace(limits, homingCorner)
  
  // Machine (0,0,0) maps to threeHome
  // So: threeCoord = threeHome + machineCoord
  return {
    x: threeHome.x + machine.x,
    y: threeHome.y + machine.y,
    z: threeHome.z + machine.z,
  }
}

// =============================================================================
// Machine ↔ Work Coordinate Conversions
// =============================================================================

/**
 * Convert Machine coordinates to Work coordinates (WCS)
 * 
 * WPos = MPos - WorkOffset
 */
export function machineToWork(
  machine: Coordinate,
  workOffset: Coordinate
): Coordinate {
  return {
    x: machine.x - workOffset.x,
    y: machine.y - workOffset.y,
    z: machine.z - workOffset.z,
  }
}

/**
 * Convert Work coordinates (WCS) to Machine coordinates
 * 
 * MPos = WPos + WorkOffset
 */
export function workToMachine(
  work: Coordinate,
  workOffset: Coordinate
): Coordinate {
  return {
    x: work.x + workOffset.x,
    y: work.y + workOffset.y,
    z: work.z + workOffset.z,
  }
}

// =============================================================================
// Three.js ↔ Work Coordinate Conversions (convenience)
// =============================================================================

/**
 * Convert Three.js scene coordinates to Work coordinates (WCS)
 */
export function threeToWork(
  three: Coordinate,
  limits: MachineLimits,
  workOffset: Coordinate,
  homingCorner: HomingCorner = 'back-right'
): Coordinate {
  const machine = threeToMachine(three, limits, homingCorner)
  return machineToWork(machine, workOffset)
}

/**
 * Convert Work coordinates (WCS) to Three.js scene coordinates
 */
export function workToThree(
  work: Coordinate,
  limits: MachineLimits,
  workOffset: Coordinate,
  homingCorner: HomingCorner = 'back-right'
): Coordinate {
  const machine = workToMachine(work, workOffset)
  return machineToThree(machine, limits, homingCorner)
}

// =============================================================================
// Tuple helpers for Three.js compatibility
// =============================================================================

export type CoordTuple = [number, number, number]

export function coordToTuple(coord: Coordinate): CoordTuple {
  return [coord.x, coord.y, coord.z]
}

export function tupleToCoord(tuple: CoordTuple): Coordinate {
  return { x: tuple[0], y: tuple[1], z: tuple[2] }
}

/**
 * Convert Machine coordinates to Three.js tuple [x, y, z]
 */
export function machineToThreeTuple(
  machine: Coordinate,
  limits: MachineLimits,
  homingCorner: HomingCorner = 'back-right'
): CoordTuple {
  return coordToTuple(machineToThree(machine, limits, homingCorner))
}

/**
 * Convert Work coordinates to Three.js tuple [x, y, z]
 */
export function workToThreeTuple(
  work: Coordinate,
  limits: MachineLimits,
  workOffset: Coordinate,
  homingCorner: HomingCorner = 'back-right'
): CoordTuple {
  return coordToTuple(workToThree(work, limits, workOffset, homingCorner))
}
