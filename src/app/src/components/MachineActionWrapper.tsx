import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Simple wrapper component that flashes status when clicked while disabled
 * 
 * Use this for non-button components (sliders, custom controls, etc.) that need
 * the same disabled + flash pattern as MachineActionButton.
 * 
 * @example
 * ```tsx
 * <MachineActionWrapper
 *   isDisabled={!canJog}
 *   onFlashStatus={flashStatus}
 *   className="space-y-2"
 * >
 *   <Slider value={[value]} onValueChange={handleChange} disabled={!canJog} />
 * </MachineActionWrapper>
 * ```
 */
export interface MachineActionWrapperProps {
  /** Whether the wrapped component is disabled */
  isDisabled: boolean
  /** Callback to flash the status when clicked while disabled */
  onFlashStatus: () => void
  /** Additional className for the wrapper div */
  className?: string
  /** Child components to wrap */
  children: React.ReactNode
}

export function MachineActionWrapper({
  isDisabled,
  onFlashStatus,
  className,
  children
}: MachineActionWrapperProps) {
  const handleInteraction = (e: React.MouseEvent | React.PointerEvent | React.TouchEvent) => {
    if (isDisabled) {
      e.preventDefault()
      e.stopPropagation()
      onFlashStatus()
      return false
    }
  }

  // Use ref to attach capture phase listener for better event catching
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper || !isDisabled) return

    const handleCapture = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      onFlashStatus()
    }

    // Use capture phase to catch events before they reach the slider
    wrapper.addEventListener('mousedown', handleCapture, true)
    wrapper.addEventListener('pointerdown', handleCapture, true)
    wrapper.addEventListener('touchstart', handleCapture, true)
    wrapper.addEventListener('click', handleCapture, true)

    return () => {
      wrapper.removeEventListener('mousedown', handleCapture, true)
      wrapper.removeEventListener('pointerdown', handleCapture, true)
      wrapper.removeEventListener('touchstart', handleCapture, true)
      wrapper.removeEventListener('click', handleCapture, true)
    }
  }, [isDisabled, onFlashStatus])

  return (
    <div
      ref={wrapperRef}
      className={cn(className)}
    >
      {children}
    </div>
  )
}
