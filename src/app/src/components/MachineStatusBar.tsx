import { useCallback, useRef } from 'react'
import { Home, Play, Square, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MachineStatusBadge, type MachineStatus } from './MachineStatusBadge'
import { useAppSelector, useAppDispatch } from '@/store/hooks'
import { useGetSettingsQuery } from '@/services/api'
import { useGcodeCommand } from '@/hooks'
import { socketService } from '@/services/socket'
import {
  setConnecting,
  setFlashing,
  setConnectionState,
  setMachineStatus,
  setHomed,
  setSpindleState,
  setSpindleSpeed,
} from '@/store/machineSlice'

export type { MachineStatus }

interface MachineStatusBarProps {
  onError?: (title: string, message: string) => void
}

export function MachineStatusBar({ onError }: MachineStatusBarProps) {
  const dispatch = useAppDispatch()
  
  // Only select the specific properties we need - this prevents re-renders
  // when position updates come in during jogging
  const isConnected = useAppSelector((state) => state.machine.isConnected)
  const isConnecting = useAppSelector((state) => state.machine.isConnecting)
  const connectedPort = useAppSelector((state) => state.machine.connectedPort)
  const machineStatus = useAppSelector((state) => state.machine.machineStatus)
  const isFlashing = useAppSelector((state) => state.machine.isFlashing)
  const isHomed = useAppSelector((state) => state.machine.isHomed)
  
  const { data: settings } = useGetSettingsQuery()
  
  // Get G-code command hook
  const { sendCommand } = useGcodeCommand(connectedPort)
  
  // Refs to track state in event handlers
  const isHomedRef = useRef(isHomed)
  isHomedRef.current = isHomed
  
  // Error notification helper
  const showError = useCallback((title: string, message: string) => {
    if (onError) {
      onError(title, message)
    } else {
      console.error(`[MachineStatusBar] ${title}: ${message}`)
    }
  }, [onError])
  
  // Flash status when action attempted while disconnected
  const flashStatus = useCallback(() => {
    dispatch(setFlashing(true))
    setTimeout(() => {
      dispatch(setFlashing(false))
    }, 450)
  }, [dispatch])
  
  // Handle Connect/Disconnect
  const handleConnect = useCallback(() => {
    // Prevent double-clicking while connecting
    if (isConnecting) {
      return
    }
    
    // Check if settings are loaded
    if (!settings) {
      showError('Settings Not Loaded', 'Please wait for settings to load, or check your connection to the server')
      return
    }
    
    // Check if port is configured
    if (!settings.connection?.port) {
      showError('No Port Configured', 'Please configure a serial port in Settings before connecting')
      return
    }
    
    // Validate connection settings
    const { port, baudRate, controllerType } = settings.connection
    
    if (!port || port.trim() === '') {
      showError('Invalid Port', 'Serial port is empty. Please configure a valid port in Settings')
      return
    }
    
    if (!baudRate || baudRate <= 0) {
      showError('Invalid Baud Rate', `Baud rate must be greater than 0. Current: ${baudRate}`)
      return
    }
    
    // This handler is called when the button is pushed.  The button changes between connect and disconnect, so
    // we need to handle both cases here.
    if (isConnected && connectedPort) {
      // Disconnect
      // Update UI optimistically (will be confirmed by serialport:close event)
      dispatch(setConnectionState({ isConnected: false, connectedPort: null }))
      dispatch(setMachineStatus('not_connected'))
      isHomedRef.current = false
      dispatch(setHomed(false))
      dispatch(setSpindleState('M5'))
      dispatch(setSpindleSpeed(0))
      
      // Request disconnect from backend
      socketService.close(connectedPort, (err: Error | null) => {
        if (err) {
          console.error('Disconnect error:', err)
          // If already disconnected, that's fine - UI is already updated
          // Only show error if it's a real error (not "already disconnected")
          const errorMessage = err.message || (typeof err === 'string' ? err : 'Failed to disconnect from machine')
          if (!errorMessage.toLowerCase().includes('not connected') && 
              !errorMessage.toLowerCase().includes('already') &&
              !errorMessage.toLowerCase().includes('not found')) {
            showError('Disconnect Failed', errorMessage)
          }
        }
      })
    } else {
      // Connect
      dispatch(setConnecting(true))
      
      // Set a timeout for connection attempts (10 seconds)
      const connectionTimeout = setTimeout(() => {
        dispatch(setConnecting(false))
        showError('Connection Timeout', 'Connection attempt timed out. Please check that the port is available and the machine is powered on.')
      }, 10000)
      
      
      // Wait a moment for socket to be ready if it was just connected
      const attemptConnection = () => {
       
        socketService.open(port, {
          baudrate: baudRate,
          controllerType: controllerType || 'Grbl'
        }, (err: Error | null) => {
          clearTimeout(connectionTimeout)
          dispatch(setConnecting(false))
          if (err) {
            console.error('Connection error:', err)
            const errorMessage = err.message || (typeof err === 'string' ? err : 'Failed to connect to machine')
            showError('Connection Failed', errorMessage)
          } else {
            dispatch(setConnectionState({ isConnected: true, connectedPort: port }))
            dispatch(setMachineStatus('connected_pre_home'))
            isHomedRef.current = false
            dispatch(setHomed(false)) // Reset homing state on new connection
          }
        })
      }
      
      // If socket was just connected, give it a moment to initialize
      if (!socketService.isConnected()) {
        setTimeout(attemptConnection, 100)
      } else {
        attemptConnection()
      }
    }
  }, [settings, isConnected, isConnecting, connectedPort, showError, dispatch])
  
  // Handle Home button
  const handleHome = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot home: not connected')
      flashStatus()
      return
    }
    sendCommand('homing')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Resume button
  const handleResume = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot resume: not connected')
      flashStatus()
      return
    }
    sendCommand('gcode:resume')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Stop button
  const handleStop = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot stop: not connected')
      flashStatus()
      return
    }
    sendCommand('gcode:stop')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Unlock button
  const handleUnlock = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot unlock: not connected')
      flashStatus()
      return
    }
    sendCommand('unlock')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  const isConnectedStatus = machineStatus !== 'not_connected'

  return (
    <>
      <span className="text-sm text-muted-foreground mr-2">Machine:</span>
      <MachineStatusBadge machineStatus={machineStatus} isFlashing={isFlashing} />
      
      {/* Action buttons - context-aware based on machine status */}
      {machineStatus === 'hold' && (
        <>
          {isConnectedStatus && (
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
          )}
          <Button variant="default" size="sm" onClick={handleResume}>
            <Play className="w-4 h-4 mr-1" /> Resume
          </Button>
          <Button variant="outline" size="sm" onClick={handleStop}>
            <Square className="w-4 h-4 mr-1" /> Stop
          </Button>
        </>
      )}
      
      {machineStatus === 'not_connected' && (
        <div className="ml-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      )}
      
      {/* Connected pre-home: Yellow Ready (Run Home) - Show Disconnect and Home */}
      {machineStatus === 'connected_pre_home' && (
        <>
          <div className="ml-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              Disconnect
            </Button>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleHome}
            className="ml-3"
          >
            <Home className="w-4 h-4 mr-1" /> Run Home
          </Button>
        </>
      )}
      
      {/* Connected post-home: Green Ready - Show Disconnect and Home */}
      {machineStatus === 'connected_post_home' && (
        <>
          <div className="ml-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              Disconnect
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleHome} className="ml-3">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
        </>
      )}
      
      {/* Running: Green Busy - Show Disconnect and Home */}
      {machineStatus === 'running' && (
        <>
          <div className="ml-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              Disconnect
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleHome} disabled className="ml-3">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
        </>
      )}
      
      {/* Alarm: Red Alarm - Show Unlock and Home */}
      {machineStatus === 'alarm' && (
        <>
          <div className="ml-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              Disconnect
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleUnlock} className="ml-3">
            <Unlock className="w-4 h-4 mr-1" /> Unlock
          </Button>
          <Button variant="outline" size="sm" onClick={handleHome} className="ml-3">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
        </>
      )}
      
      {/* Error state - Show Disconnect and Home */}
      {machineStatus === 'error' && (
        <>
          <div className="ml-3">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              Disconnect
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={handleHome} className="ml-3">
            <Home className="w-4 h-4 mr-1" /> Home
          </Button>
        </>
      )}
    </>
  )
}
