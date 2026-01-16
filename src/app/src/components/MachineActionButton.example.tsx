/**
 * Example usage of MachineActionButton
 * 
 * This file demonstrates how to use the MachineActionButton component
 * to replace the repetitive pattern of disabled buttons with flash status.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import { MachineActionButton } from './MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'
import { ChevronUp, Home } from 'lucide-react'

// Example 1: Simple jog button
function JogButtonExample({ 
  isConnected, 
  connectedPort, 
  machineStatus, 
  isHomed, 
  onFlashStatus 
}: {
  isConnected: boolean
  connectedPort: string | null
  machineStatus: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running' | 'error'
  isHomed: boolean
  onFlashStatus: () => void
}) {
  const handleJog = () => {
    // Jog logic here
    console.log('Jogging...')
  }

  return (
    <MachineActionButton
      isConnected={isConnected}
      connectedPort={connectedPort}
      machineStatus={machineStatus}
      isHomed={isHomed}
      onFlashStatus={onFlashStatus}
      onAction={handleJog}
      requirements={ActionRequirements.jog}
      variant="secondary"
      size="sm"
    >
      <ChevronUp className="w-5 h-5" />
    </MachineActionButton>
  )
}

// Example 2: Home button (allowed even when not homed)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function HomeButtonExample({ 
  isConnected, 
  connectedPort, 
  machineStatus, 
  onFlashStatus 
}: {
  isConnected: boolean
  connectedPort: string | null
  machineStatus: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running' | 'error'
  onFlashStatus: () => void
}) {
  const handleHome = () => {
    // Home logic here
    console.log('Homing...')
  }

  return (
    <MachineActionButton
      isConnected={isConnected}
      connectedPort={connectedPort}
      machineStatus={machineStatus}
      onFlashStatus={onFlashStatus}
      onAction={handleHome}
      requirements={ActionRequirements.standard}
      variant="default"
    >
      <Home className="w-4 h-4 mr-1" />
      Home
    </MachineActionButton>
  )
}

// Example 3: Custom requirements
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CustomButtonExample({ 
  isConnected, 
  connectedPort, 
  machineStatus, 
  isHomed, 
  onFlashStatus 
}: {
  isConnected: boolean
  connectedPort: string | null
  machineStatus: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running' | 'error'
  isHomed: boolean
  onFlashStatus: () => void
}) {
  const handleAction = () => {
    // Custom action logic
    console.log('Custom action...')
  }

  return (
    <MachineActionButton
      isConnected={isConnected}
      connectedPort={connectedPort}
      machineStatus={machineStatus}
      isHomed={isHomed}
      onFlashStatus={onFlashStatus}
      onAction={handleAction}
      requirements={{
        requiresConnected: true,
        requiresPort: true,
        requiresHomed: true, // This action requires homing
        disallowAlarm: true,
        disallowRunning: true,
      }}
      variant="outline"
    >
      Custom Action
    </MachineActionButton>
  )
}

// Example 4: Using the utility function directly (for non-button elements)
import { canPerformAction, ActionRequirements } from '@/utils/machineState'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function CustomElementExample({ 
  isConnected, 
  connectedPort, 
  machineStatus, 
  isHomed, 
  onFlashStatus 
}: {
  isConnected: boolean
  connectedPort: string | null
  machineStatus: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running' | 'error'
  isHomed: boolean
  onFlashStatus: () => void
}) {
  const canAct = canPerformAction(
    isConnected,
    connectedPort,
    machineStatus,
    isHomed,
    ActionRequirements.jog
  )

  const handleClick = () => {
    if (!canAct) {
      onFlashStatus()
      return
    }
    // Action logic
    console.log('Action performed')
  }

  return (
    <div
      onMouseDown={(e) => {
        if (!canAct) {
          e.preventDefault()
          e.stopPropagation()
          onFlashStatus()
          return false
        }
      }}
    >
      <button
        onClick={handleClick}
        disabled={!canAct}
        className={canAct ? 'enabled' : 'disabled'}
      >
        Custom Element
      </button>
    </div>
  )
}
