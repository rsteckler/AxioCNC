/**
 * Shared utilities for zeroing wizard components
 */

/**
 * Get axes label (e.g., "xyz" -> "XYZ")
 */
export function getAxesLabel(axes: string): string {
  return axes.toUpperCase()
}

/**
 * Calculate total steps for a zeroing method
 */
export function getTotalSteps(method: { type: string; requireCheck?: boolean }, isToolChange = false, isFirstToolChange = true): number {
  if (method.type === 'manual') {
    return 3
  }
  if (method.type === 'touchplate') {
    // If requireCheck is false, skip the verification step (3 steps instead of 4)
    return method.requireCheck === false ? 3 : 4
  }
  if (method.type === 'bitsetter') {
    if (isToolChange && !isFirstToolChange) {
      // Subsequent tool change: Includes "Install Next Tool" step
      // Steps: Verify (if requireCheck), Navigate, Install Next Tool, Run Probe
      return method.requireCheck === false ? 3 : 4
    }
    // First tool change or initial setup: Include "Install First Tool" step
    // Steps: Verify (if requireCheck), Navigate, Install First Tool, Run Probe
    return method.requireCheck === false ? 3 : 4
  }
  if (method.type === 'bitzero') {
    // If requireCheck is false, skip the verification step (4 steps instead of 5)
    return method.requireCheck === false ? 4 : 5
  }
  if (method.type === 'custom') {
    // Custom G-code: step 1 = run G-code, step 2 = complete
    return 2
  }
  // Other methods will be implemented later
  return 1
}
