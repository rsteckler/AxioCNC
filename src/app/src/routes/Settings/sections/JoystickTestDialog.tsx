import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { Gamepad2, CircleDot } from 'lucide-react'
import type { JoystickConfig, CncAction, AnalogMapping } from './JoystickSection'
import { CNC_ACTIONS, GAMEPAD_BUTTONS } from './JoystickSection'

interface JoystickTestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: JoystickConfig
  gamepadId: string | null
}

interface GamepadState {
  connected: boolean
  axes: number[]
  buttons: boolean[]
  timestamp: number
}

// Get the label for a CNC action
function getActionLabel(action: CncAction): string {
  return CNC_ACTIONS.find(a => a.value === action)?.label || 'None'
}

// Get the label for an analog mapping
function getAnalogLabel(mapping: AnalogMapping): string {
  switch (mapping) {
    case 'jog_x': return 'Jog X'
    case 'jog_y': return 'Jog Y'
    case 'jog_z': return 'Jog Z'
    case 'feed_rate': return 'Feed Rate'
    default: return 'None'
  }
}

// Generate command string for current input
function generateCommand(
  config: JoystickConfig,
  axes: number[],
  buttons: boolean[]
): string[] {
  const commands: string[] = []
  
  // Check buttons
  buttons.forEach((pressed, index) => {
    if (pressed) {
      const action = config.buttonMappings[index]
      if (action && action !== 'none') {
        commands.push(`Button ${index}: ${getActionLabel(action)}`)
      }
    }
  })
  
  // Check analog axes
  const deadzone = config.deadzone
  const axisValues = {
    left_x: axes[0] || 0,
    left_y: axes[1] || 0,
    right_x: axes[2] || 0,
    right_y: axes[3] || 0,
  }
  
  Object.entries(axisValues).forEach(([axis, value]) => {
    const absValue = Math.abs(value)
    if (absValue > deadzone) {
      const mapping = config.analogMappings[axis as keyof typeof config.analogMappings]
      if (mapping && mapping !== 'none') {
        const direction = value > 0 ? '+' : '-'
        const percentage = Math.round(((absValue - deadzone) / (1 - deadzone)) * 100)
        
        // Calculate speed based on axis type
        let speed = 0
        if (mapping === 'jog_z') {
          speed = Math.round((percentage / 100) * config.analogJogSpeedZ)
        } else if (mapping === 'jog_x' || mapping === 'jog_y') {
          speed = Math.round((percentage / 100) * config.analogJogSpeedXY)
        }
        
        if (speed > 0) {
          commands.push(`${getAnalogLabel(mapping)} ${direction} @ ${speed} mm/min`)
        }
      }
    }
  })
  
  return commands
}

export function JoystickTestDialog({
  open,
  onOpenChange,
  config,
  gamepadId,
}: JoystickTestDialogProps) {
  const [gamepadState, setGamepadState] = useState<GamepadState>({
    connected: false,
    axes: [0, 0, 0, 0],
    buttons: Array(16).fill(false),
    timestamp: 0,
  })
  
  const animationRef = useRef<number | null>(null)
  const lastGamepadIndex = useRef<number | null>(null)

  // Find the gamepad by ID
  const findGamepad = useCallback((): Gamepad | null => {
    const gamepads = navigator.getGamepads?.() || []
    for (const gp of gamepads) {
      if (gp && gp.id === gamepadId) {
        lastGamepadIndex.current = gp.index
        return gp
      }
    }
    // Fallback to last known index
    if (lastGamepadIndex.current !== null) {
      return gamepads[lastGamepadIndex.current] || null
    }
    return null
  }, [gamepadId])

  // Poll gamepad state
  const pollGamepad = useCallback(() => {
    const gamepad = findGamepad()
    
    if (gamepad) {
      setGamepadState({
        connected: true,
        axes: Array.from(gamepad.axes),
        buttons: gamepad.buttons.map(b => b.pressed),
        timestamp: gamepad.timestamp,
      })
    } else {
      setGamepadState(prev => ({
        ...prev,
        connected: false,
      }))
    }
    
    if (open) {
      animationRef.current = requestAnimationFrame(pollGamepad)
    }
  }, [open, findGamepad])

  // Start/stop polling when dialog opens/closes
  useEffect(() => {
    if (open) {
      pollGamepad()
    } else {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [open, pollGamepad])

  // Get axis value with deadzone applied (for display)
  const getAxisDisplay = (value: number): number => {
    const absValue = Math.abs(value)
    if (absValue < config.deadzone) return 0
    return value
  }

  // Convert axis value to percentage for progress bar
  const axisToProgress = (value: number): number => {
    return ((value + 1) / 2) * 100
  }

  const commands = generateCommand(config, gamepadState.axes, gamepadState.buttons)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5" />
            Gamepad Test Mode
          </DialogTitle>
          <DialogDescription>
            Press buttons and move sticks to see real-time input
          </DialogDescription>
        </DialogHeader>

        {/* Connection Status */}
        <div className="flex items-center gap-2 mb-4">
          <div className={cn(
            'w-3 h-3 rounded-full',
            gamepadState.connected ? 'bg-green-500' : 'bg-red-500'
          )} />
          <span className="text-sm">
            {gamepadState.connected ? 'Connected' : 'Disconnected - Press any button'}
          </span>
          {gamepadState.connected && (
            <Badge variant="secondary" className="ml-auto">
              {gamepadId?.split('(')[0].trim()}
            </Badge>
          )}
        </div>

        {/* Analog Sticks */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left Stick */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <CircleDot className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Left Stick</span>
            </div>
            
            {/* Visual stick representation */}
            <div className="relative w-32 h-32 mx-auto mb-4 rounded-full border-2 border-muted bg-muted/20">
              <div 
                className="absolute w-6 h-6 rounded-full bg-primary shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                style={{
                  left: `${50 + (getAxisDisplay(gamepadState.axes[0]) * 40)}%`,
                  top: `${50 + (getAxisDisplay(gamepadState.axes[1]) * 40)}%`,
                }}
              />
              {/* Deadzone indicator */}
              <div 
                className="absolute rounded-full border border-dashed border-muted-foreground/30 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: '50%',
                  top: '50%',
                  width: `${config.deadzone * 80}%`,
                  height: `${config.deadzone * 80}%`,
                }}
              />
            </div>
            
            {/* Axis values */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-8 text-muted-foreground">X:</span>
                <Progress value={axisToProgress(gamepadState.axes[0])} className="flex-1 h-2" />
                <span className="w-16 text-right font-mono">
                  {gamepadState.axes[0]?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 text-muted-foreground">Y:</span>
                <Progress value={axisToProgress(gamepadState.axes[1])} className="flex-1 h-2" />
                <span className="w-16 text-right font-mono">
                  {gamepadState.axes[1]?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Maps to: {getAnalogLabel(config.analogMappings.left_x)} / {getAnalogLabel(config.analogMappings.left_y)}
              </div>
            </div>
          </div>

          {/* Right Stick */}
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 mb-4">
              <CircleDot className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Right Stick</span>
            </div>
            
            {/* Visual stick representation */}
            <div className="relative w-32 h-32 mx-auto mb-4 rounded-full border-2 border-muted bg-muted/20">
              <div 
                className="absolute w-6 h-6 rounded-full bg-primary shadow-lg transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                style={{
                  left: `${50 + (getAxisDisplay(gamepadState.axes[2]) * 40)}%`,
                  top: `${50 + (getAxisDisplay(gamepadState.axes[3]) * 40)}%`,
                }}
              />
              {/* Deadzone indicator */}
              <div 
                className="absolute rounded-full border border-dashed border-muted-foreground/30 transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: '50%',
                  top: '50%',
                  width: `${config.deadzone * 80}%`,
                  height: `${config.deadzone * 80}%`,
                }}
              />
            </div>
            
            {/* Axis values */}
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="w-8 text-muted-foreground">X:</span>
                <Progress value={axisToProgress(gamepadState.axes[2])} className="flex-1 h-2" />
                <span className="w-16 text-right font-mono">
                  {gamepadState.axes[2]?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 text-muted-foreground">Y:</span>
                <Progress value={axisToProgress(gamepadState.axes[3])} className="flex-1 h-2" />
                <span className="w-16 text-right font-mono">
                  {gamepadState.axes[3]?.toFixed(2) || '0.00'}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Maps to: {getAnalogLabel(config.analogMappings.right_x)} / {getAnalogLabel(config.analogMappings.right_y)}
              </div>
            </div>
          </div>
        </div>

        {/* Triggers */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">LT / L2</span>
              <span className="text-xs text-muted-foreground">
                {getActionLabel(config.buttonMappings[6] || 'none')}
              </span>
            </div>
            <Progress 
              value={gamepadState.buttons[6] ? 100 : 0} 
              className={cn('h-3', gamepadState.buttons[6] && 'bg-primary/20')}
            />
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">RT / R2</span>
              <span className="text-xs text-muted-foreground">
                {getActionLabel(config.buttonMappings[7] || 'none')}
              </span>
            </div>
            <Progress 
              value={gamepadState.buttons[7] ? 100 : 0} 
              className={cn('h-3', gamepadState.buttons[7] && 'bg-primary/20')}
            />
          </div>
        </div>

        {/* Buttons Grid */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3">Buttons</h4>
          <div className="grid grid-cols-4 gap-2">
            {GAMEPAD_BUTTONS.map((button) => {
              const isPressed = gamepadState.buttons[button.index]
              const action = config.buttonMappings[button.index]
              
              return (
                <div
                  key={button.index}
                  className={cn(
                    'p-2 rounded-lg border text-center transition-all',
                    isPressed 
                      ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-105' 
                      : 'bg-card'
                  )}
                >
                  <div className="flex items-center justify-center gap-1 mb-1">
                    {button.icon}
                    <span className="text-xs font-medium">{button.index}</span>
                  </div>
                  <div className="text-[10px] truncate">
                    {button.name.split('/')[0].trim()}
                  </div>
                  {action && action !== 'none' && (
                    <div className={cn(
                      'text-[9px] mt-1 truncate',
                      isPressed ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    )}>
                      {getActionLabel(action)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Active Commands */}
        <div className="p-4 rounded-lg border bg-muted/30">
          <h4 className="text-sm font-medium mb-2">Active Commands</h4>
          {commands.length > 0 ? (
            <div className="space-y-1">
              {commands.map((cmd, i) => (
                <div key={i} className="text-sm font-mono text-primary">
                  → {cmd}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No input detected. Press buttons or move sticks...
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

