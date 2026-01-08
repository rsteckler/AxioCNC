import React from 'react'
import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { 
  MachineStatus, 
  ActionRequirement, 
  canPerformAction 
} from '@/utils/machineState'

export interface MachineActionButtonProps extends Omit<ButtonProps, 'disabled' | 'onClick'> {
  /** Whether the machine is connected */
  isConnected: boolean
  /** The connected port (if any) */
  connectedPort: string | null
  /** Current machine status */
  machineStatus: MachineStatus
  /** Whether the machine is homed */
  isHomed?: boolean
  /** Callback to flash the status when action is not allowed */
  onFlashStatus: () => void
  /** Action handler - only called if action is allowed */
  onAction: () => void
  /** Requirements for this action */
  requirements?: ActionRequirement
  /** Custom disabled state (in addition to requirements) */
  customDisabled?: boolean
}

/**
 * Reusable button component that handles machine state checks and status flashing
 * 
 * This component encapsulates the pattern of:
 * - Disabling buttons based on machine state
 * - Flashing status when clicked while disabled
 * - Wrapping in a div with onMouseDown for disabled state handling
 * 
 * @example
 * ```tsx
 * <MachineActionButton
 *   isConnected={isConnected}
 *   connectedPort={connectedPort}
 *   machineStatus={machineStatus}
 *   isHomed={isHomed}
 *   onFlashStatus={flashStatus}
 *   onAction={handleJog}
 *   requirements={{ disallowAlarm: true, disallowRunning: true }}
 * >
 *   Jog
 * </MachineActionButton>
 * ```
 */
export function MachineActionButton({
  isConnected,
  connectedPort,
  machineStatus,
  isHomed = false,
  onFlashStatus,
  onAction,
  requirements = {},
  customDisabled = false,
  className,
  children,
  ...buttonProps
}: MachineActionButtonProps) {
  const isAllowed = canPerformAction(
    isConnected,
    connectedPort,
    machineStatus,
    isHomed,
    requirements
  )
  const isDisabled = !isAllowed || customDisabled

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDisabled) {
      e.preventDefault()
      e.stopPropagation()
      onFlashStatus()
      return false
    }
  }

  const handleClick = () => {
    if (!isDisabled) {
      onAction()
    }
  }

  // Extract flex-1 from className if present (needs to be on wrapper, not button)
  const hasFlex1 = className?.includes('flex-1')
  const wrapperClassName = hasFlex1 ? 'flex-1' : 'inline-block'
  const buttonClassName = hasFlex1 
    ? className.replace(/\bflex-1\b/g, '').trim() 
    : className

  return (
    <div
      onMouseDown={handleMouseDown}
      className={wrapperClassName}
    >
      <Button
        {...buttonProps}
        className={cn(buttonProps.className, buttonClassName)}
        disabled={isDisabled}
        onClick={handleClick}
      >
        {children}
      </Button>
    </div>
  )
}
