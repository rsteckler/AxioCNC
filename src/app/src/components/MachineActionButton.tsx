import React from 'react'
import { Button, ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { MachineReadinessStatus } from '@/types/machine'
import { 
  ActionRequirement, 
  canPerformAction 
} from '@/utils/machineState'

export interface MachineActionButtonProps extends Omit<ButtonProps, 'disabled' | 'onClick'> {
  /** Whether the machine is connected */
  isConnected: boolean
  /** The connected port (if any) */
  connectedPort: string | null
  /** Current machine status */
  machineStatus: MachineReadinessStatus
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

  // Extract flex-1 and w-full from className if present (needs to be on wrapper, not button)
  const hasFlex1 = className?.includes('flex-1')
  const hasWFull = className?.includes('w-full')
  let wrapperClassName = 'inline-block'
  if (hasFlex1) {
    wrapperClassName = 'flex-1'
  } else if (hasWFull) {
    wrapperClassName = 'w-full block' // Add block to ensure it fills grid cells
  }
  // Remove w-full and flex-1 from button className, but keep w-full for button if wrapper has it
  let buttonClassName = hasFlex1 || hasWFull
    ? className.replace(/\b(flex-1|w-full)\b/g, '').trim() 
    : className
  // If wrapper has w-full or flex-1, button should also have w-full to fill the wrapper
  if (hasWFull || hasFlex1) {
    buttonClassName = cn(buttonClassName, 'w-full')
  }

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
