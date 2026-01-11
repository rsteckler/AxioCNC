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
import { expandCircleToSquare } from '@/utils/analogNormalize'
import { socketService } from '@/services/socket'
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
  
  // Check D-pad buttons (map to axes 6 and 7)
  // D-pad Up (button 12) = axis 7 < -0.5
  if (axes[7] < -0.5) {
    const action = config.buttonMappings[12]
    if (action && action !== 'none') {
      commands.push(`D-Pad Up: ${getActionLabel(action)}`)
    }
  }
  // D-pad Down (button 16) = axis 7 > 0.5
  if (axes[7] > 0.5) {
    const action = config.buttonMappings[16]
    if (action && action !== 'none') {
      commands.push(`D-Pad Down: ${getActionLabel(action)}`)
    }
  }
  // D-pad Left (button 17) = axis 6 < -0.5
  if (axes[6] < -0.5) {
    const action = config.buttonMappings[17]
    if (action && action !== 'none') {
      commands.push(`D-Pad Left: ${getActionLabel(action)}`)
    }
  }
  // D-pad Right (button 15) = axis 6 > 0.5
  if (axes[6] > 0.5) {
    const action = config.buttonMappings[15]
    if (action && action !== 'none') {
      commands.push(`D-Pad Right: ${getActionLabel(action)}`)
    }
  }
  
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
    axes: [0, 0, 0, 0, 0, 0, 0, 0], // All axes start at 0 (LT/RT are axes 4 and 5)
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

  // Poll gamepad state (browser-side)
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

  // Handle server-side gamepad state updates (Socket.IO)
  useEffect(() => {
    if (!open || config.connectionLocation !== 'server') {
      console.log('[GamepadTestDialog] Skipping server-side setup:', { open, connectionLocation: config.connectionLocation })
      return
    }

    console.log('[GamepadTestDialog] Setting up server-side gamepad listener:', { gamepadId, socketConnected: socketService.isConnected() })

    const handleGamepadState = (state: {
      gamepadId: string
      connected: boolean
      axes: number[]
      buttons: boolean[]
      timestamp: number
    }) => {
      console.log('[GamepadTestDialog] Received gamepad:state event:', state)
      // Only update if it's the selected gamepad
      if (state.gamepadId === gamepadId) {
        console.log('[GamepadTestDialog] Updating gamepad state:', state)
        setGamepadState({
          connected: state.connected,
          axes: state.axes,
          buttons: state.buttons,
          timestamp: state.timestamp,
        })
      } else {
        console.log('[GamepadTestDialog] Ignoring state - gamepadId mismatch:', { received: state.gamepadId, expected: gamepadId })
      }
    }

    // Listen for gamepad state updates from server
    socketService.on('gamepad:state', handleGamepadState)
    console.log('[GamepadTestDialog] Registered gamepad:state listener')

    return () => {
      console.log('[GamepadTestDialog] Cleaning up gamepad:state listener')
      socketService.off('gamepad:state', handleGamepadState)
    }
  }, [open, config.connectionLocation, gamepadId])

  // Start/stop polling when dialog opens/closes (browser-side only)
  useEffect(() => {
    if (config.connectionLocation !== 'client') {
      return // Server-side uses Socket.IO, not polling
    }

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
  }, [open, pollGamepad, config.connectionLocation])

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

  // Expand circular gamepad input to fill a square for both sticks
  // Both sticks have circular physical limits, so always expand to square
  const leftXY = expandCircleToSquare(
    gamepadState.axes[0] || 0,
    gamepadState.axes[1] || 0
  )

  const rightXY = expandCircleToSquare(
    gamepadState.axes[2] || 0,
    gamepadState.axes[3] || 0
  )

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
                  left: `${50 + (getAxisDisplay(leftXY.x) * 40)}%`,
                  top: `${50 + (getAxisDisplay(leftXY.y) * 40)}%`,
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
                <Progress value={axisToProgress(leftXY.x)} className="flex-1 h-2" />
                <span className="w-16 text-right font-mono">
                  {leftXY.x.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 text-muted-foreground">Y:</span>
                <Progress value={axisToProgress(leftXY.y)} className="flex-1 h-2" />
                <span className="w-16 text-right font-mono">
                  {leftXY.y.toFixed(2)}
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
                  left: `${50 + (getAxisDisplay(rightXY.x) * 40)}%`,
                  top: `${50 + (getAxisDisplay(rightXY.y) * 40)}%`,
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
                <Progress value={axisToProgress(rightXY.x)} className="flex-1 h-2" />
                <span className="w-16 text-right font-mono">
                  {rightXY.x.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 text-muted-foreground">Y:</span>
                <Progress value={axisToProgress(rightXY.y)} className="flex-1 h-2" />
                <span className="w-16 text-right font-mono">
                  {rightXY.y.toFixed(2)}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Maps to: {getAnalogLabel(config.analogMappings.right_x)} / {getAnalogLabel(config.analogMappings.right_y)}
              </div>
            </div>
          </div>
        </div>

        {/* Triggers (Axes 4 and 5) */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">LT</span>
              <span className="text-xs text-muted-foreground">
                Axis 5
              </span>
            </div>
            <Progress 
              value={Math.max(0, (gamepadState.axes[5] || 0) * 50 + 50)} 
              className="h-3"
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {(gamepadState.axes[5] || 0).toFixed(2)}
            </div>
          </div>
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">RT</span>
              <span className="text-xs text-muted-foreground">
                Axis 4
              </span>
            </div>
            <Progress 
              value={Math.max(0, (gamepadState.axes[4] || 0) * 50 + 50)} 
              className="h-3"
            />
            <div className="text-xs text-muted-foreground mt-1 text-right">
              {(gamepadState.axes[4] || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Buttons Grid */}
        <div className="mb-6">
          <h4 className="text-sm font-medium mb-3">Buttons</h4>
          <div className="grid grid-cols-4 gap-2">
            {GAMEPAD_BUTTONS.filter(b => !(b as any).isDpad).map((button) => {
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
          
          {/* D-pad buttons on a single row */}
          <div className="mt-4">
            <h5 className="text-xs font-medium text-muted-foreground mb-2">D-Pad</h5>
            <div className="grid grid-cols-4 gap-2">
              {GAMEPAD_BUTTONS.filter(b => (b as any).isDpad).map((button) => {
                // D-pad buttons map to axes 6 and 7 instead of buttons
                let isPressed = false
                if (button.index === 12) {
                  // D-pad Up = axis 7 < -0.5
                  isPressed = (gamepadState.axes[7] || 0) < -0.5
                } else if (button.index === 16) {
                  // D-pad Down = axis 7 > 0.5
                  isPressed = (gamepadState.axes[7] || 0) > 0.5
                } else if (button.index === 17) {
                  // D-pad Left = axis 6 < -0.5
                  isPressed = (gamepadState.axes[6] || 0) < -0.5
                } else if (button.index === 15) {
                  // D-pad Right = axis 6 > 0.5
                  isPressed = (gamepadState.axes[6] || 0) > 0.5
                }
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
                    <div className="flex items-center justify-center mb-1">
                      {button.icon}
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

