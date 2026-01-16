import React, { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { socketService } from '@/services/socket'
import { useGetSettingsQuery } from '@/services/api'
import { parseConsoleMessage, type ConsoleLine } from '@/routes/Setup/utils/consoleParser'

interface ConsoleProps {
  isConnected: boolean
  connectedPort: string | null
  lastAlarmMessageRef?: React.MutableRefObject<string | null>
}

export function Console({ 
  isConnected, 
  connectedPort,
  lastAlarmMessageRef 
}: ConsoleProps) {
  const { data: settings } = useGetSettingsQuery()
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [commandInput, setCommandInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const consoleContainerRef = useRef<HTMLDivElement>(null)
  const consoleLinesRef = useRef<ConsoleLine[]>([])

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
  useEffect(() => {
    // Listen for messages FROM Grbl
    const handleSerialRead = (...args: unknown[]) => {
      const message = args[0] as string
      if (typeof message !== 'string') return
      
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
        consoleLinesRef.current = updated
        return updated
      })
      
      // Track alarm messages for notifications
      if (line.type === 'alarm') {
        if (lastAlarmMessageRef) {
          lastAlarmMessageRef.current = line.message
        }
      }
    }

    // Listen for messages TO Grbl
    const handleSerialWrite = (...args: unknown[]) => {
      const data = args[0] as string
      if (typeof data !== 'string') return
      
      const line = parseConsoleMessage(data, 'write')
      setConsoleLines(prev => [...prev, line])
    }

    socketService.on('serialport:read', handleSerialRead)
    socketService.on('serialport:write', handleSerialWrite)

    return () => {
      socketService.off('serialport:read', handleSerialRead)
      socketService.off('serialport:write', handleSerialWrite)
    }
  }, []) // Empty array - listeners register once, handlers check connection state internally
    
  // Clear console when disconnected (separate effect for UI state)
  useEffect(() => {
    if (!isConnected || !connectedPort) {
      setConsoleLines([])
    }
  }, [isConnected, connectedPort])

  // Handle command input
  const handleSendCommand = useCallback(() => {
    if (!commandInput.trim() || !isConnected || !connectedPort) return

    // Send via Socket.IO
    socketService.writeln(connectedPort, commandInput.trim())
    
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
  )
}
