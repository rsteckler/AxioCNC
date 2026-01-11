/**
 * Normalize XY analog inputs to a circle (for square inputs like mouse drag)
 * 
 * Formula:
 *   mag = sqrt(x_raw² + y_raw²)
 *   if (mag > 1.0) mag = 1.0
 *   x = x_raw / mag
 *   y = y_raw / mag
 * 
 * This ensures:
 * - right (1.0, 0.0) stays (1.0, 0.0)
 * - down-right (1.0, 1.0) becomes (1.0, 1.0) after clamping
 * 
 * Use this for mouse/touch input where the raw values can exceed 1.0 at diagonals.
 * 
 * @param xRaw Raw X input value (can exceed -1 to 1 at diagonals)
 * @param yRaw Raw Y input value (can exceed -1 to 1 at diagonals)
 * @returns Normalized { x, y } values (-1 to 1)
 */
export function normalizeToCircle(xRaw: number, yRaw: number): { x: number; y: number } {
  // Calculate magnitude
  let mag = Math.sqrt(xRaw * xRaw + yRaw * yRaw)
  
  // Clamp magnitude to 1.0
  if (mag > 1.0) {
    mag = 1.0
  }
  
  // Normalize: divide by magnitude
  if (mag > 0) {
    const x = Math.max(-1, Math.min(1, xRaw / mag))
    const y = Math.max(-1, Math.min(1, yRaw / mag))
    return { x, y }
  }
  
  return { x: 0, y: 0 }
}

/**
 * Expand circular input to fill a square (for gamepad sticks)
 * 
 * Gamepads often have circular gates that limit diagonal movement to ~0.707.
 * This function expands that circular input to fill a square, so:
 * - right (1.0, 0.0) stays (1.0, 0.0)
 * - down-right at circle edge (0.707, 0.707) becomes (1.0, 1.0)
 * 
 * The magnitude (how far the stick is pushed) is preserved proportionally.
 * 
 * @param xRaw Raw X input value (-1 to 1, constrained to circle)
 * @param yRaw Raw Y input value (-1 to 1, constrained to circle)
 * @returns Expanded { x, y } values (-1 to 1, filling square)
 */
export function expandCircleToSquare(xRaw: number, yRaw: number): { x: number; y: number } {
  const mag = Math.sqrt(xRaw * xRaw + yRaw * yRaw)
  
  if (mag < 0.001) {
    return { x: 0, y: 0 }
  }
  
  // Get unit direction vector
  const dirX = xRaw / mag
  const dirY = yRaw / mag
  
  // Find the max component to determine how much to scale
  // At 45 degrees, max component is 0.707, and we want to scale up to 1.0
  // At 0 degrees (right), max component is 1.0, no scaling needed
  const maxComponent = Math.max(Math.abs(dirX), Math.abs(dirY))
  
  if (maxComponent < 0.001) {
    return { x: 0, y: 0 }
  }
  
  // Scale factor to expand circle to square edge
  const scale = 1.0 / maxComponent
  
  // Clamp input magnitude to 1.0 (circle edge)
  const clampedMag = Math.min(mag, 1.0)
  
  // Apply expansion: direction * magnitude * scale
  const x = dirX * clampedMag * scale
  const y = dirY * clampedMag * scale
  
  return { 
    x: Math.max(-1, Math.min(1, x)), 
    y: Math.max(-1, Math.min(1, y)) 
  }
}
