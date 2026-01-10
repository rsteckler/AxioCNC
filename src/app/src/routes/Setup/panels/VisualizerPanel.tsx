import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Maximize2, Terminal, Target, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { socketService } from '@/services/socket'
import { useGetSettingsQuery } from '@/services/api'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'
import { VisualizerScene } from '../components/VisualizerScene'
import { parseConsoleMessage, type ConsoleLine } from '../utils/consoleParser'
import { ZeroingWizardTab } from './ZeroingWizardTab'

interface VisualizerPanelProps {
  isConnected: boolean
  connectedPort: string | null
  wizardMethod?: ZeroingMethod | null
  onWizardClose?: () => void
  machinePosition?: { x: number; y: number; z: number }
  workPosition?: { x: number; y: number; z: number }
  probeContact?: boolean
  lastAlarmMessageRef?: React.MutableRefObject<string | null>
  currentWCS?: string
}

export function VisualizerPanel({ 
  isConnected, 
  connectedPort,
  wizardMethod,
  onWizardClose,
  machinePosition = { x: 0, y: 0, z: 0 },
  workPosition = { x: 0, y: 0, z: 0 },
  probeContact = false,
  lastAlarmMessageRef,
  currentWCS = 'G54'
}: VisualizerPanelProps) {
  // Get settings for connection options (needed for joining port room)
  const { data: settings } = useGetSettingsQuery()
  
  const [tab, setTab] = useState<'3d' | 'console' | 'wizard'>('3d')
  
  // Switch to wizard tab when wizard method is set
  useEffect(() => {
    if (wizardMethod) {
      setTab('wizard')
    }
  }, [wizardMethod])
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [commandInput, setCommandInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const consoleContainerRef = useRef<HTMLDivElement>(null)
  const consoleLinesRef = useRef<ConsoleLine[]>([]) // Track console lines for alarm message lookup
  const scrollToBottom = useCallback(() => {
    if (!consoleContainerRef.current) return
    
    // Find the OverlayScrollbars viewport element within the container
    const viewport = consoleContainerRef.current.querySelector('[data-overlayscrollbars-viewport]') as HTMLElement
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
      return
    }
    
    // Fallback: try to find any scrollable element
    const scrollable = consoleContainerRef.current.querySelector('.os-viewport') as HTMLElement
    if (scrollable) {
      scrollable.scrollTop = scrollable.scrollHeight
    }
  }, [])
  
  const MAX_LINES = 1000
  
  // Auto-scroll to bottom when new lines are added (only if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll && consoleLines.length > 0) {
      // Use requestAnimationFrame for immediate attempt, then setTimeout for delayed attempt
      // This handles cases where OverlayScrollbars hasn't initialized yet
      requestAnimationFrame(() => {
        scrollToBottom()
      })
      
      const timeoutId = setTimeout(() => {
        scrollToBottom()
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [consoleLines, autoScroll, scrollToBottom])
  
  // Limit console history to prevent memory issues
  useEffect(() => {
    setConsoleLines(prev => {
      if (prev.length > MAX_LINES) {
        return prev.slice(-MAX_LINES)
      }
      return prev
    })
  }, [consoleLines.length])
  
  // Listen to Socket.IO events for console messages
  // IMPORTANT: Must wait for socket to be connected AND added to controller.sockets via addConnection
  // The controller's emit method only sends to sockets in this.sockets, so we need to ensure
  // the socket is connected first, then added to controller.sockets
  useEffect(() => {
    if (!isConnected || !connectedPort) {
      // Clear console when disconnected
      setConsoleLines([])
      return
    }

    const socket = socketService.getSocket()
    if (!socket) {
      return
    }

    // Helper function to set up console listeners
    const setupConsoleListeners = () => {

      // Listen for messages FROM Grbl
      // Backend emits: this.emit('serialport:read', res.raw) or this.emit('serialport:read', message)
      // Controller's emit method forwards to all sockets: socket.emit('serialport:read', ...args)
      // So we receive: (message: string) directly
      const handleSerialRead = (...args: unknown[]) => {
        const message = args[0] as string
        if (typeof message !== 'string') return
        
        // Backend emits serialport:read with just the message string
        // The controller's emit method forwards to all sockets in this.sockets
        // So we just receive the message string directly
        
        // Check for alarm messages BEFORE parsing - capture the raw message
        const trimmed = message.trim()
        if (trimmed.startsWith('ALARM:')) {
          if (lastAlarmMessageRef) {
            lastAlarmMessageRef.current = trimmed
          }
        }
        
        const line = parseConsoleMessage(message, 'read')
        setConsoleLines(prev => {
          const updated = [...prev, line]
          consoleLinesRef.current = updated // Keep ref in sync
          return updated
        })
        
        // Track alarm messages for notifications (also after parsing in case format differs)
        if (line.type === 'alarm') {
          if (lastAlarmMessageRef) {
            lastAlarmMessageRef.current = line.message
          }
        }
      }

      // Listen for messages TO Grbl
      // Backend emits: this.emit('serialport:write', data, context)
      // So we receive: (data: string, context?: object)
      const handleSerialWrite = (...args: unknown[]) => {
        const data = args[0] as string
        if (typeof data !== 'string') return
        
        // Backend emits serialport:write with (data, context) where context is an object
        // Not (port, data) - the controller's emit method forwards to all sockets in this.sockets
        // So we just receive the data string directly
        const line = parseConsoleMessage(data, 'write')
        setConsoleLines(prev => [...prev, line])
      }

      // Set up listeners - they'll receive events once the socket is added to controller.sockets
      // (which happens when we call socket.emit('open', ...))
      socket.on('serialport:read', handleSerialRead)
      socket.on('serialport:write', handleSerialWrite)

      return () => {
        socket.off('serialport:read', handleSerialRead)
        socket.off('serialport:write', handleSerialWrite)
      }
    }

    // CRITICAL: Only set up listeners when socket is actually connected
    // If socket is not connected yet, wait for it to connect
    if (!socket.connected) {
      const cleanupRef = { current: null as (() => void) | null }
      
      const handleConnect = () => {
        // Set up listeners after socket connects
        cleanupRef.current = setupConsoleListeners()
        // Also ensure we join the port room (if we're restoring state)
        if (settings?.connection?.port && settings.connection.port === connectedPort) {
          const connectionOptions = settings.connection ? {
            controllerType: settings.connection.controllerType || 'Grbl',
            baudrate: settings.connection.baudRate || 115200,
            rtscts: settings.connection.rtscts || false,
          } : {
            controllerType: 'Grbl',
            baudrate: 115200,
            rtscts: false,
          }
          socket.emit('open', connectedPort, connectionOptions, (err: Error | null) => {
            if (err) {
              console.error('[Setup] Error joining port room after socket connect:', err)
            }
          })
        }
      }
      socket.once('connect', handleConnect)
      
      return () => {
        socket.off('connect', handleConnect)
        if (cleanupRef.current) {
          cleanupRef.current()
        }
      }
    }

    // Socket is connected, set up listeners immediately
    // Also ensure we join the port room if not already joined
    const cleanup = setupConsoleListeners()
    
    // Join port room if we're connected but haven't joined yet
    if (settings?.connection?.port && settings.connection.port === connectedPort) {
      const connectionOptions = settings.connection ? {
        controllerType: settings.connection.controllerType || 'Grbl',
        baudrate: settings.connection.baudRate || 115200,
        rtscts: settings.connection.rtscts || false,
      } : {
        controllerType: 'Grbl',
        baudrate: 115200,
        rtscts: false,
      }
      socket.emit('open', connectedPort, connectionOptions, (err: Error | null) => {
        if (err) {
          console.error('[Setup] Error joining port room:', err)
        }
      })
    }
    
    return cleanup
  }, [isConnected, connectedPort, settings?.connection?.port, lastAlarmMessageRef])
  
  // Handle command input
  const handleSendCommand = useCallback(() => {
    if (!commandInput.trim() || !isConnected || !connectedPort) return

    // Send via Socket.IO (writeln is for console commands, different from gcode)
    const socket = socketService.getSocket()
    if (socket) {
      socket.emit('writeln', connectedPort, commandInput.trim())
    }
    
    // Clear input
    setCommandInput('')
  }, [commandInput, isConnected, connectedPort])
  
  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendCommand()
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab header */}
      <div className="flex items-center border-b border-border bg-muted/30 px-2">
        <button
          onClick={() => setTab('3d')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === '3d' 
              ? 'border-primary text-foreground' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Maximize2 className="w-4 h-4 inline mr-1.5" />
          3D View
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          onClick={() => setTab('console')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'console' 
              ? 'border-primary text-foreground' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-4 h-4 inline mr-1.5" />
          Console
        </button>
        {wizardMethod && (
          <>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => setTab('wizard')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'wizard' 
                  ? 'border-primary text-foreground' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="w-4 h-4 inline mr-1.5" />
              {wizardMethod.name}
            </button>
          </>
        )}
      </div>
      
      {tab === 'wizard' && wizardMethod ? (
        <ZeroingWizardTab
          method={wizardMethod}
          onClose={onWizardClose || (() => {})}
          isConnected={isConnected}
          connectedPort={connectedPort}
          machinePosition={machinePosition}
          workPosition={workPosition}
          probeContact={probeContact}
          currentWCS={currentWCS}
        />
      ) : tab === '3d' ? (
        <div className="flex-1 relative">
          <VisualizerScene />
          
          {/* View controls overlay */}
          <div className="absolute bottom-3 left-3 flex gap-1">
            <Button variant="secondary" size="sm" className="h-7 text-xs">Top</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs">Front</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs">Iso</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs">Fit</Button>
          </div>
          
          {/* File info overlay */}
          <div className="absolute top-3 right-3 bg-background/80 backdrop-blur rounded px-2 py-1 text-xs">
            <span className="text-muted-foreground">Bounds:</span>{' '}
            <span className="font-mono">450 × 180 × 30 mm</span>
          </div>
        </div>
      ) : (
        <div ref={consoleContainerRef} className="flex-1 flex flex-col bg-zinc-950 min-h-0 relative">
          <OverlayScrollbarsComponent 
            className="flex-1 min-h-0"
            options={{ 
              scrollbars: { autoHide: 'scroll', autoHideDelay: 400 },
              overflow: { x: 'hidden', y: 'scroll' }
            }}
          >
            <div className="p-2 font-mono text-xs">
              {consoleLines.length === 0 ? (
                <div className="text-zinc-500 text-center py-8">
                  {isConnected 
                    ? 'Console ready. Messages will appear here...'
                    : 'Not connected. Connect to a serial port to see console messages.'}
                </div>
              ) : (
                consoleLines.map((line) => (
                  <div key={line.id} className="py-0.5">
                    <span className="text-zinc-500">
                      {line.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`ml-2 ${
                      line.type === 'cmd' ? 'text-blue-400' :
                      line.type === 'ok' ? 'text-green-400' :
                      line.type === 'error' ? 'text-red-400' :
                      line.type === 'alarm' ? 'text-orange-400' :
                      line.type === 'status' ? 'text-cyan-400' :
                      'text-zinc-300'
                    }`}>
                      {line.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </OverlayScrollbarsComponent>
          {/* Auto-scroll toggle button */}
          <div className="absolute bottom-14 right-2 z-10">
            <Button
              size="sm"
              variant={autoScroll ? "default" : "outline"}
              className="h-7 w-7 p-0"
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
            >
              <ArrowDown className={`w-4 h-4 ${autoScroll ? '' : 'opacity-50'}`} />
            </Button>
          </div>
          {/* Command input */}
          <div className="border-t border-zinc-800 p-2 flex items-center gap-2">
            <span className="text-blue-400 font-mono text-sm leading-none">&gt;</span>
            <input 
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter command..."
              disabled={!isConnected}
              className="flex-1 bg-transparent text-zinc-100 font-mono text-sm outline-none placeholder:text-zinc-600 leading-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button 
              size="sm" 
              variant="secondary" 
              className="h-7 text-xs"
              onClick={handleSendCommand}
              disabled={!commandInput.trim() || !isConnected}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
