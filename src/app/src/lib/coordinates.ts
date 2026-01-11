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
 *    - Origin at right-top-highest corner of work envelope
 *    - Machine (0,0,0) is the home position
 *    - Values are typically 0 or negative within work envelope
 *    - Range: (-xSize, -ySize, -zSize) to (0, 0, 0)
 * 
 * 3. Work Coordinates (WPos / WCS):
 *    - User-defined offset from machine coordinates
 *    - WPos = MPos - WorkOffset
 *    - Set via G54-G59 coordinate systems
 */

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

// =============================================================================
// Three.js ↔ Machine Coordinate Conversions
// =============================================================================

/**
 * Convert Three.js scene coordinates to Machine coordinates
 * 
 * Three.js (0,0,0) → Machine (-xSize, -ySize, -zSize)
 * Three.js (xSize, ySize, zSize) → Machine (0, 0, 0)
 */
export function threeToMachine(
  three: Coordinate,
  limits: MachineLimits
): Coordinate {
  const { xSize, ySize, zSize } = getEnvelopeDimensions(limits)
  return {
    x: three.x - xSize,
    y: three.y - ySize,
    z: three.z - zSize,
  }
}

/**
 * Convert Machine coordinates to Three.js scene coordinates
 * 
 * Machine (0, 0, 0) → Three.js (xSize, ySize, zSize)
 * Machine (-xSize, -ySize, -zSize) → Three.js (0, 0, 0)
 */
export function machineToThree(
  machine: Coordinate,
  limits: MachineLimits
): Coordinate {
  const { xSize, ySize, zSize } = getEnvelopeDimensions(limits)
  return {
    x: machine.x + xSize,
    y: machine.y + ySize,
    z: machine.z + zSize,
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
  workOffset: Coordinate
): Coordinate {
  const machine = threeToMachine(three, limits)
  return machineToWork(machine, workOffset)
}

/**
 * Convert Work coordinates (WCS) to Three.js scene coordinates
 */
export function workToThree(
  work: Coordinate,
  limits: MachineLimits,
  workOffset: Coordinate
): Coordinate {
  const machine = workToMachine(work, workOffset)
  return machineToThree(machine, limits)
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
  limits: MachineLimits
): CoordTuple {
  return coordToTuple(machineToThree(machine, limits))
}

/**
 * Convert Work coordinates to Three.js tuple [x, y, z]
 */
export function workToThreeTuple(
  work: Coordinate,
  limits: MachineLimits,
  workOffset: Coordinate
): CoordTuple {
  return coordToTuple(workToThree(work, limits, workOffset))
}
