import React from 'react'
import { Home, Play, Pause, Square, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MachineStatusBadge, type MachineStatus } from './MachineStatusBadge'

export type { MachineStatus }

interface MachineStatusBarProps {
  machineStatus: MachineStatus
  isFlashing?: boolean
  isConnecting?: boolean
  onConnect?: () => void
  onHome?: () => void
  onResume?: () => void
  onStop?: () => void
  onUnlock?: () => void
}

export function MachineStatusBar({
  machineStatus,
  isFlashing = false,
  isConnecting = false,
  onConnect,
  onHome,
  onResume,
  onStop,
  onUnlock,
}: MachineStatusBarProps) {
  const isConnected = machineStatus !== 'not_connected'

  return (
    <>
      <span className="text-sm text-muted-foreground mr-2">Machine:</span>
      <MachineStatusBadge machineStatus={machineStatus} isFlashing={isFlashing} />
      
      {/* Action buttons - context-aware based on machine status */}
      {machineStatus === 'hold' && (
        <>
          {isConnected && (
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
          )}
          {onResume && (
            <Button variant="default" size="sm" onClick={onResume}>
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
          )}
          {onStop && (
            <Button variant="outline" size="sm" onClick={onStop}>
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          )}
        </>
      )}
      
      {machineStatus === 'not_connected' && onConnect && (
        <div className="ml-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onConnect}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
      )}
      
      {/* Connected pre-home: Yellow Ready (Run Home) - Show Disconnect and Home */}
      {machineStatus === 'connected_pre_home' && (
        <>
          {onConnect && (
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onHome || (() => {})} 
            disabled={!onHome}
            className="ml-3"
          >
            <Home className="w-4 h-4 mr-1" /> Run Home
          </Button>
        </>
      )}
      
      {/* Connected post-home: Green Ready - Show Disconnect and Home */}
      {machineStatus === 'connected_post_home' && (
        <>
          {onConnect && (
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
          )}
          {onHome && (
            <Button variant="outline" size="sm" onClick={onHome} className="ml-3">
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          )}
        </>
      )}
      
      {/* Running: Green Busy - Show Disconnect and Home */}
      {machineStatus === 'running' && (
        <>
          {onConnect && (
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
          )}
          {onHome && (
            <Button variant="outline" size="sm" onClick={onHome} disabled className="ml-3">
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          )}
        </>
      )}
      
      {/* Alarm: Red Alarm - Show Unlock and Home */}
      {machineStatus === 'alarm' && (
        <>
          {onConnect && (
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
          )}
          {onUnlock && (
            <Button variant="outline" size="sm" onClick={onUnlock} className="ml-3">
              <Unlock className="w-4 h-4 mr-1" /> Unlock
            </Button>
          )}
          {onHome && (
            <Button variant="outline" size="sm" onClick={onHome} className="ml-3">
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          )}
        </>
      )}
      
      {/* Error state - Show Disconnect and Home */}
      {machineStatus === 'error' && (
        <>
          {onConnect && (
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={onConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
          )}
          {onHome && (
            <Button variant="outline" size="sm" onClick={onHome} className="ml-3">
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          )}
        </>
      )}
    </>
  )
}
