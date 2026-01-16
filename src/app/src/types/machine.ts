/**
 * Shared machine status types
 * 
 * These types are used across the frontend for machine state management.
 * They should stay in sync with the backend API.
 */

/**
 * Machine readiness status - indicates the overall readiness state of the machine
 * This is a high-level status that combines connection state, homing state, and operational state
 */
export type MachineReadinessStatus = 
  | 'not_connected'
  | 'connected_pre_home'
  | 'connected_post_home'
  | 'alarm'
  | 'running'
  | 'hold'
  | 'error'
