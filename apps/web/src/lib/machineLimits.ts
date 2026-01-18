/**
 * Machine Limits Conversion Utilities
 * 
 * Converts between dimensions + homing corner format (UI) 
 * and min/max limits format (backend/storage)
 */

export type HomingCorner = 'back-left' | 'back-right' | 'front-left' | 'front-right'

export interface MachineDimensions {
  width: number   // X dimension
  depth: number   // Y dimension
  height: number  // Z dimension
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
 * Convert dimensions + homing corner to min/max limits
 * 
 * @param dimensions - Machine dimensions (width, depth, height)
 * @param corner - Which corner is the home position
 * @param zTopAtHome - Z maximum value when homed (typically 0)
 * @returns Machine limits in min/max format
 */
export function dimensionsToLimits(
  dimensions: MachineDimensions,
  corner: HomingCorner,
  zTopAtHome: number = 0
): MachineLimits {
  const { width, depth, height } = dimensions
  
  // Determine X min/max based on homing corner
  let xmin: number, xmax: number
  if (corner === 'back-left' || corner === 'front-left') {
    // Home is on left (X min)
    xmin = 0
    xmax = width
  } else {
    // Home is on right (X max)
    xmin = -width
    xmax = 0
  }
  
  // Determine Y min/max based on homing corner
  let ymin: number, ymax: number
  if (corner === 'front-left' || corner === 'front-right') {
    // Home is at front (Y min)
    ymin = 0
    ymax = depth
  } else {
    // Home is at back (Y max)
    ymin = -depth
    ymax = 0
  }
  
  // Z is always: home at top (zmax), bottom at zmin
  const zmax = zTopAtHome
  const zmin = zTopAtHome - height
  
  return { xmin, xmax, ymin, ymax, zmin, zmax }
}

/**
 * Convert min/max limits to dimensions + inferred homing corner
 * 
 * @param limits - Machine limits in min/max format
 * @returns Dimensions and inferred homing corner
 */
export function limitsToDimensions(limits: MachineLimits): {
  dimensions: MachineDimensions
  corner: HomingCorner
} {
  const width = Math.abs(limits.xmax - limits.xmin)
  const depth = Math.abs(limits.ymax - limits.ymin)
  const height = Math.abs(limits.zmax - limits.zmin)
  
  // Infer homing corner from limits
  // Home position is typically where x and y are at their "home" values (often 0)
  // Z home is typically at zmax (top position)
  
  // Check if X home is at min or max
  const xHomeAtMin = Math.abs(limits.xmin) < Math.abs(limits.xmax)
  
  // Check if Y home is at min or max
  const yHomeAtMin = Math.abs(limits.ymin) < Math.abs(limits.ymax)
  
  // Determine corner
  let corner: HomingCorner
  if (xHomeAtMin && !yHomeAtMin) {
    corner = 'back-left'  // X min, Y max
  } else if (!xHomeAtMin && !yHomeAtMin) {
    corner = 'back-right'  // X max, Y max
  } else if (xHomeAtMin && yHomeAtMin) {
    corner = 'front-left'  // X min, Y min
  } else {
    corner = 'front-right'  // X max, Y min
  }
  
  // If limits don't clearly indicate, default to front-left (most common)
  // This happens when limits are symmetric or unusual
  if (limits.xmin === 0 && limits.ymin === 0 && limits.zmax === 0) {
    corner = 'front-left'
  }
  
  return {
    dimensions: { width, depth, height },
    corner,
  }
}

/**
 * Get homing position coordinates for a given corner
 */
export function getHomingPosition(
  limits: MachineLimits,
  corner: HomingCorner
): { x: number; y: number; z: number } {
  switch (corner) {
    case 'back-left':
      return { x: limits.xmin, y: limits.ymax, z: limits.zmax }
    case 'back-right':
      return { x: limits.xmax, y: limits.ymax, z: limits.zmax }
    case 'front-left':
      return { x: limits.xmin, y: limits.ymin, z: limits.zmax }
    case 'front-right':
      return { x: limits.xmax, y: limits.ymin, z: limits.zmax }
  }
}
