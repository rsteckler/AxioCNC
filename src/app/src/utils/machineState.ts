/**
 * Machine state utilities
 * 
 * Provides type-safe utilities for checking machine state and action availability
 */

export type MachineStatus = 
  | 'not_connected'
  | 'connected_pre_home'
  | 'connected_post_home'
  | 'alarm'
  | 'running'
  | 'error'

export type ActionRequirement = {
  requiresConnected?: boolean
  requiresPort?: boolean
  requiresHomed?: boolean
  disallowAlarm?: boolean
  disallowRunning?: boolean
  disallowNotConnected?: boolean
}

/**
 * Check if an action is allowed based on machine state
 */
export function canPerformAction(
  isConnected: boolean,
  connectedPort: string | null,
  machineStatus: MachineStatus,
  isHomed: boolean,
  requirements: ActionRequirement = {}
): boolean {
  const {
    requiresConnected = true,
    requiresPort = true,
    disallowAlarm = true,
    disallowRunning = true,
    disallowNotConnected = true,
    requiresHomed = false,
  } = requirements

  // Check connection requirements
  if (requiresConnected && !isConnected) return false
  if (requiresPort && !connectedPort) return false

  // Check status restrictions
  if (disallowNotConnected && machineStatus === 'not_connected') return false
  if (disallowAlarm && machineStatus === 'alarm') return false
  if (disallowRunning && machineStatus === 'running') return false

  // Check homing requirement
  if (requiresHomed && !isHomed) return false

  return true
}

/**
 * Common action requirement presets
 */
export const ActionRequirements = {
  /** Standard action - requires connection, no alarm, no running */
  standard: {
    requiresConnected: true,
    requiresPort: true,
    disallowAlarm: true,
    disallowRunning: true,
    disallowNotConnected: true,
  } as ActionRequirement,

  /** Jogging action - requires connection, no alarm, no running */
  jog: {
    requiresConnected: true,
    requiresPort: true,
    disallowAlarm: true,
    disallowRunning: true,
    disallowNotConnected: true,
  } as ActionRequirement,

  /** Action that requires homing (e.g., jogging after connection) */
  requiresHomed: {
    requiresConnected: true,
    requiresPort: true,
    requiresHomed: true,
    disallowAlarm: true,
    disallowRunning: true,
    disallowNotConnected: true,
  } as ActionRequirement,

  /** Action allowed even when not connected (e.g., connect button) */
  connectionOnly: {
    requiresConnected: false,
    requiresPort: false,
    disallowAlarm: false,
    disallowRunning: false,
    disallowNotConnected: false,
  } as ActionRequirement,

  /** Action allowed in alarm state (e.g., unlock button) */
  allowAlarm: {
    requiresConnected: true,
    requiresPort: true,
    disallowAlarm: false,
    disallowRunning: true,
    disallowNotConnected: true,
  } as ActionRequirement,
} as const
