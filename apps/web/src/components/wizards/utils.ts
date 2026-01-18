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
export function getTotalSteps(method: { type: string; requireCheck?: boolean }, isToolChange = false, isFirstToolChange = true, isJobPaused = false): number {
  if (method.type === 'manual') {
    // Manual: 3 steps normally, add 1 if job is paused (Complete step)
    return isJobPaused ? 4 : 3
  }
  if (method.type === 'touchplate') {
    // If requireCheck is false, skip the verification step (3 steps instead of 4)
    return method.requireCheck === false ? 3 : 4
  }
  if (method.type === 'bitsetter') {
    if (isToolChange && !isFirstToolChange) {
      // Subsequent tool change: Includes "Install Next Tool" step
      // Steps: Verify (if requireCheck), Navigate, Install Next Tool, Run Probe, Complete (if job paused)
      return method.requireCheck === false ? (isJobPaused ? 4 : 3) : (isJobPaused ? 5 : 4)
    }
    if (isToolChange && isFirstToolChange) {
      // First tool change: Include "Install First Tool" step
      // Steps: Verify (if requireCheck), Navigate, Install First Tool, Run Probe, Complete (if job paused)
      return method.requireCheck === false ? (isJobPaused ? 4 : 3) : (isJobPaused ? 5 : 4)
    }
    // Initial setup (not a tool change): Include "Install First Tool" step
    // Steps: Verify (if requireCheck), Navigate, Install First Tool, Run Probe
    return method.requireCheck === false ? 3 : 4
  }
  if (method.type === 'bitzero') {
    // If requireCheck is false, skip the verification step (4 steps instead of 5)
    // Add 1 step if job is paused (Complete step)
    const baseSteps = method.requireCheck === false ? 4 : 5
    return isJobPaused ? baseSteps + 1 : baseSteps
  }
  if (method.type === 'custom') {
    // Custom G-code: step 1 = run G-code, step 2 = complete
    // Add 1 step if job is paused (Complete step after G-code complete step)
    return isJobPaused ? 3 : 2
  }
  // Other methods will be implemented later
  return 1
}
