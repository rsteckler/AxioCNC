import concaveman from 'concaveman'
import { processGCode } from './gcodeVisualizer'
import i18n from '@/i18n'

/**
 * 2D point interface
 */
export interface Point2D {
  x: number
  y: number
}

/**
 * Options for generating outline path
 */
export interface OutlineOptions {
  zHeight?: number // Z height for outline (not used - always uses -5 in machine coordinates)
  margin?: number // Margin around hull (default: 2mm) - offset hull outward
  closePath?: boolean // Whether to close the path (default: true)
  returnToStart?: boolean // Whether to return to original position (default: true)
  concavity?: number // Concave hull detail level (1 = detailed, Infinity = convex, default: 5)
  minPointDistance?: number // Minimum distance between outline points in mm (default: 5mm)
}

/**
 * Result of outline calculation
 */
export interface OutlineResult {
  hullPoints: Point2D[]
  commands: string[]
  bounds: {
    min: Point2D
    max: Point2D
  }
}

/**
 * Extract unique XY positions from G-code toolpath
 * Projects all points to XY plane (ignores Z)
 * 
 * @param gcode - G-code string to process
 * @returns Array of unique XY points
 */
export function extractXYPositions(gcode: string | null | undefined): Point2D[] {
  if (!gcode) {
    return []
  }

  const result = processGCode(gcode)
  if (!result || !result.geometry) {
    return []
  }

  const positions = result.geometry.attributes.position.array as Float32Array
  const pointSet = new Set<string>() // Use string keys to deduplicate
  const points: Point2D[] = []

  // Extract unique XY positions (ignore Z)
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]
    const y = positions[i + 1]
    // z = positions[i + 2] (ignored)

    // Create unique key for this XY position
    const key = `${x.toFixed(6)},${y.toFixed(6)}`
    
    if (!pointSet.has(key)) {
      pointSet.add(key)
      points.push({ x, y })
    }
  }

  return points
}

/**
 * Simplify polygon by removing points that are too close together
 * Ensures minimum distance between consecutive points
 * 
 * @param points - Array of polygon points
 * @param minDistance - Minimum distance in mm between consecutive points (default: 5mm)
 * @returns Simplified array of points
 */
function simplifyPolygon(points: Point2D[], minDistance: number = 5): Point2D[] {
  if (points.length <= 2) {
    return points
  }

  const simplified: Point2D[] = [points[0]] // Always keep first point
  
  for (let i = 1; i < points.length; i++) {
    const prevPoint = simplified[simplified.length - 1]
    const currentPoint = points[i]
    
    // Calculate distance from previous point in simplified array
    const dx = currentPoint.x - prevPoint.x
    const dy = currentPoint.y - prevPoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // Only add point if it's far enough from the previous one
    if (distance >= minDistance) {
      simplified.push(currentPoint)
    }
  }
  
  // Ensure the last point is far enough from the first point (for closed polygons)
  if (simplified.length > 2) {
    const firstPoint = simplified[0]
    const lastPoint = simplified[simplified.length - 1]
    const dx = firstPoint.x - lastPoint.x
    const dy = firstPoint.y - lastPoint.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    // If last point is too close to first, remove it (first point will close the loop)
    if (distance < minDistance) {
      simplified.pop()
    }
  }
  
  return simplified
}

/**
 * Calculate concave hull (outer boundary) from a set of 2D points
 * Handles indentations in outer boundary while ignoring inner holes
 * 
 * @param points - Array of XY points
 * @param options - Options including concavity level and minimum point distance
 * @returns Ordered array of hull points forming a closed polygon
 */
export function calculateConcaveHull(
  points: Point2D[],
  options: { concavity?: number; minPointDistance?: number } = {}
): Point2D[] {
  if (points.length < 3) {
    throw new Error(i18n.t('Need at least 3 points to calculate a hull'))
  }

  const concavity = options.concavity ?? 5
  const minPointDistance = options.minPointDistance ?? 5 // Default: 5mm minimum distance

  // Convert points to format expected by concaveman: [x, y] arrays
  const pointArray = points.map(p => [p.x, p.y])

  // Calculate concave hull
  // concaveman returns array of [x, y] arrays
  const hullArray = concaveman(pointArray, concavity)

  // Convert back to Point2D format
  let hullPoints: Point2D[] = hullArray.map((point: number[]) => ({
    x: point[0],
    y: point[1],
  }))

  // Simplify by removing points that are too close together
  if (minPointDistance > 0) {
    hullPoints = simplifyPolygon(hullPoints, minPointDistance)
  }

  return hullPoints
}

/**
 * Offset a polygon outward by a given margin
 * Simple approach: scale from centroid
 * 
 * @param points - Polygon points
 * @param margin - Margin in mm
 * @returns Offset polygon points
 */
function offsetPolygon(points: Point2D[], margin: number): Point2D[] {
  if (points.length === 0 || margin === 0) {
    return points
  }

  // Calculate centroid
  const centroid = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 }
  )
  centroid.x /= points.length
  centroid.y /= points.length

  // Offset each point outward from centroid
  return points.map(p => {
    const dx = p.x - centroid.x
    const dy = p.y - centroid.y
    const distance = Math.sqrt(dx * dx + dy * dy)
    
    if (distance === 0) {
      return p // Point is at centroid, can't offset
    }

    const scale = 1 + (margin / distance)
    return {
      x: centroid.x + dx * scale,
      y: centroid.y + dy * scale,
    }
  })
}

/**
 * Generate G-code commands to trace the outline path
 * 
 * @param hullPoints - Ordered array of hull points
 * @param currentPosition - Current machine position { x, y, z }
 * @param options - Outline options
 * @returns Array of G-code command strings
 */
export function generateOutlinePath(
  hullPoints: Point2D[],
  currentPosition: { x: number; y: number; z: number },
  options: OutlineOptions = {}
): string[] {
  if (hullPoints.length === 0) {
    return []
  }

  const {
    margin = 2, // Default: 2mm margin
    closePath = true,
    returnToStart = true,
  } = options

  // Fixed Z height for outline tracing
  const outlineZ = -5

  const commands: string[] = []

  // Apply margin if specified
  const outlinePoints = margin > 0 
    ? offsetPolygon(hullPoints, margin)
    : hullPoints

  if (outlinePoints.length === 0) {
    return []
  }

  const firstPoint = outlinePoints[0]
  const startX = currentPosition.x
  const startY = currentPosition.y
  const startZ = currentPosition.z

  // 1. Save current position (implicit - we have it)
  // 2. Move Z to -5 in machine coordinates (G53 is one-shot, non-modal)
  commands.push(`G53 G0 Z${outlineZ.toFixed(3)}`)

  // 3. Rapid move to first outline point in work coordinates (Z stays at -5)
  commands.push(`G0 X${firstPoint.x.toFixed(3)} Y${firstPoint.y.toFixed(3)}`)

  // 4. Trace outline points with G0 (rapid moves) in work coordinates (Z stays at -5)
  for (let i = 1; i < outlinePoints.length; i++) {
    const point = outlinePoints[i]
    commands.push(`G0 X${point.x.toFixed(3)} Y${point.y.toFixed(3)}`)
  }

  // 5. Close path (return to first point if closePath=true) in work coordinates
  if (closePath && outlinePoints.length > 1) {
    commands.push(`G0 X${firstPoint.x.toFixed(3)} Y${firstPoint.y.toFixed(3)}`)
  }

  // 6. Return to original position (if returnToStart=true)
  if (returnToStart) {
    // Return to original position in machine coordinates (since currentPosition is in machine coordinates)
    // Move XY first, then Z to avoid collisions
    if (startZ > outlineZ) {
      // Original Z was above -5, lift Z first
      commands.push(`G53 G0 Z${startZ.toFixed(3)}`)
      commands.push(`G53 G0 X${startX.toFixed(3)} Y${startY.toFixed(3)}`)
    } else {
      // Original Z was at or below -5, move XY first, then Z
      commands.push(`G53 G0 X${startX.toFixed(3)} Y${startY.toFixed(3)}`)
      commands.push(`G53 G0 Z${startZ.toFixed(3)}`)
    }
  }

  return commands
}

/**
 * Calculate outline from G-code and generate path
 * Main entry point for outline functionality
 * 
 * @param gcode - G-code string
 * @param currentPosition - Current machine position
 * @param options - Outline options
 * @returns Outline result with hull points and commands
 */
export function calculateOutline(
  gcode: string | null | undefined,
  currentPosition: { x: number; y: number; z: number },
  options: OutlineOptions = {}
): OutlineResult | null {
  // Extract XY positions
  const points = extractXYPositions(gcode)
  
  if (points.length < 3) {
    return null // Not enough points for a hull
  }

  // Calculate concave hull
  let hullPoints: Point2D[]
  try {
    hullPoints = calculateConcaveHull(points, { 
      concavity: options.concavity,
      minPointDistance: options.minPointDistance,
    })
  } catch (error) {
    console.error('Failed to calculate concave hull:', error)
    return null
  }

  if (hullPoints.length === 0) {
    return null
  }

  // Calculate bounds
  const bounds = {
    min: { x: Infinity, y: Infinity },
    max: { x: -Infinity, y: -Infinity },
  }

  for (const point of hullPoints) {
    bounds.min.x = Math.min(bounds.min.x, point.x)
    bounds.min.y = Math.min(bounds.min.y, point.y)
    bounds.max.x = Math.max(bounds.max.x, point.x)
    bounds.max.y = Math.max(bounds.max.y, point.y)
  }

  // Generate G-code commands
  const commands = generateOutlinePath(hullPoints, currentPosition, options)

  return {
    hullPoints,
    commands,
    bounds,
  }
}
