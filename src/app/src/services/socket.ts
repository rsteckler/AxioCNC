import io from 'socket.io-client'

/**
 * Strongly-typed Socket.IO event map
 * Maps event names to their argument tuples
 */
export type SocketEvents = {
  // G-code events
  'gcode:load': [name: string, gcode: string, context: unknown]
  'gcode:unload': []
  
  // Serial port events
  'serialport:open': [data: { port: string; baudrate?: number; controllerType?: string; inuse?: boolean }]
  'serialport:close': []
  'serialport:list': [ports: unknown[]]
  'serialport:read': [data: string]
  'serialport:write': [data: string]
  
  // Controller state events
  'controller:state': [controllerType: string, state: {
    status?: {
      activeState?: string
      mpos?: { x?: string; y?: string; z?: string }
      wpos?: { x?: string; y?: string; z?: string }
      buf?: {
        planner?: number
        rx?: number
      }
    }
    parserstate?: {
      modal?: {
        spindle?: string
      }
      spindle?: string
      tool?: string
      feedrate?: string
    }
  }]
  'machine:status': [port: string, status: unknown]
  
  // Workflow and job events
  'workflow:state': [state: 'idle' | 'running' | 'paused']
  'sender:status': [state: {
    name?: string
    size?: number
    total?: number
    sent?: number
    received?: number
    elapsedTime?: number
    remainingTime?: number
    nextM6ToolNumber?: number
    remainingTimeToNextM6?: number
    [key: string]: unknown
  }]
  'feeder:status': [status: unknown]
  
  // Homing events
  'controller:homing': []
  'grbl:homing': []
  'marlin:homing': []
  
  // Joystick/Gamepad events
  'joystick:flashStatus': []
  'gamepad:state': [state: unknown]
  
  // Socket.IO built-in events
  'connect': []
  'disconnect': [reason: unknown]
  'error': [error: unknown]
  'socket:ready': []
  'reconnect': [attemptNumber: number]
}

// Socket.IO v2 client singleton with strongly-typed events
class SocketService {
  private socket: SocketIOClient.Socket | null = null
  private token: string | null = null
  
  // Store all registered listeners so we can re-apply them after reconnection
  // Map<eventName, Set<callback>>
  private listenerRegistry = new Map<string, Set<(...args: unknown[]) => void>>()

  connect(token?: string) {
    if (this.socket?.connected) {
      console.log('[SocketService] Socket already connected:', this.socket.id)
      return this.socket
    }

    // If socket exists but not connected, don't create a new one
    // Just wait for the existing connection attempt to complete
    if (this.socket) {
      console.log('[SocketService] Socket connection already in progress, reusing existing socket')
      return this.socket
    }

    this.token = token || localStorage.getItem('axiocnc-token')

    if (!this.token) {
      console.warn('[SocketService] No token available for socket connection - call signIn first')
      return null
    }

    console.log('[SocketService] Creating new socket connection...')
    // Socket.IO v2 connection with JWT auth in query string
    // Enable automatic reconnection (default behavior)
    this.socket = io('', {
      transports: ['websocket', 'polling'],
      query: { token: this.token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    })

    this.socket.on('connect', () => {
      console.log('[SocketService] Socket connected:', this.socket?.id)
      
      // Re-apply all registered listeners after connection/reconnection
      this.reapplyListeners()
      
      // Emit a custom event to notify that socket is ready
      this.socket?.emit('socket:ready')
    })

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('[SocketService] Socket reconnected after', attemptNumber, 'attempts')
      // Re-apply all registered listeners after reconnection
      this.reapplyListeners()
    })

    this.socket.on('disconnect', (reason: unknown) => {
      console.log('[SocketService] Socket disconnected:', reason)
    })

    this.socket.on('error', (error: unknown) => {
      console.error('[SocketService] Socket error:', error)
    })

    return this.socket
  }

  /**
   * Re-apply all registered listeners to the current socket
   * This is called after connection or reconnection to ensure
   * all event handlers are still active
   */
  private reapplyListeners() {
    if (!this.socket) {
      return
    }

    console.log('[SocketService] Re-applying', this.listenerRegistry.size, 'event listener(s)')
    
    for (const [eventName, callbacks] of this.listenerRegistry.entries()) {
      for (const callback of callbacks) {
        // Re-register the listener
        this.socket.on(eventName, callback)
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    // Clear listener registry on explicit disconnect
    this.listenerRegistry.clear()
  }

  isConnected() {
    return this.socket?.connected ?? false
  }

  // Send a command to the controller
  // Format: socket.emit('command', port, cmd, ...args)
  command(port: string, cmd: string, ...args: unknown[]) {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot send command')
      return
    }
    this.socket.emit('command', port, cmd, ...args)
  }

  // Open a serial port
  // Format: socket.emit('open', port, options, callback)
  open(
    port: string,
    options: { baudrate?: number; controllerType?: string; rtscts?: boolean; pin?: string },
    callback?: (err: Error | null) => void
  ) {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot open port')
      if (callback) callback(new Error('Socket not connected'))
      return
    }
    this.socket.emit('open', port, options, callback || (() => {}))
  }

  // Close a serial port
  // Format: socket.emit('close', port, callback)
  close(port: string, callback?: (err: Error | null) => void) {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot close port')
      if (callback) callback(new Error('Socket not connected'))
      return
    }
    this.socket.emit('close', port, callback || (() => {}))
  }

  // List available serial ports
  // Format: socket.emit('list')
  list() {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot list ports')
      return
    }
    this.socket.emit('list')
  }

  // Write a line to the serial port
  // Format: socket.emit('writeln', port, data, context)
  writeln(port: string, data: string, context?: Record<string, unknown>) {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot write to port')
      return
    }
    this.socket.emit('writeln', port, data, context || {})
  }

  // Send joystick gamepad input
  // Format: socket.emit('joystick:gamepad', axes, buttons, timestamp)
  joystickGamepad(axes: number[], buttons: boolean[], timestamp: number) {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot send joystick gamepad input')
      return
    }
    this.socket.emit('joystick:gamepad', axes, buttons, timestamp)
  }

  // Send joystick jog control input
  // Format: socket.emit('joystick:jog', x, y, z, timestamp)
  joystickJog(x: number, y: number, z: number, timestamp: number) {
    if (!this.socket?.connected) {
      console.error('Socket not connected, cannot send joystick jog input')
      return
    }
    this.socket.emit('joystick:jog', x, y, z, timestamp)
  }

  /**
   * Type-safe event subscription
   * Stores the listener so it can be re-applied after reconnection
   * @param event Event name from SocketEvents
   * @param callback Callback function with typed arguments matching the event
   */
  on<E extends keyof SocketEvents>(
    event: E,
    callback: (...args: SocketEvents[E]) => void
  ) {
    if (!this.socket) {
      console.error(`[SocketService] Cannot subscribe to ${event}: socket not initialized`)
      return
    }

    // Store the listener in our registry
    if (!this.listenerRegistry.has(event)) {
      this.listenerRegistry.set(event, new Set())
    }
    // Type assertion needed for Socket.IO compatibility - events have typed args but Socket.IO uses any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.listenerRegistry.get(event)!.add(callback as (...args: any[]) => void)

    // Register with Socket.IO
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.socket.on(event, callback as (...args: any[]) => void)
  }

  /**
   * Type-safe event unsubscription
   * Removes the listener from both Socket.IO and our registry
   * @param event Event name from SocketEvents
   * @param callback Optional callback to remove specific listener, or undefined to remove all listeners for the event
   */
  off<E extends keyof SocketEvents>(
    event: E,
    callback?: (...args: SocketEvents[E]) => void
  ) {
    if (callback) {
      // Remove specific listener from registry
      const callbacks = this.listenerRegistry.get(event)
      if (callbacks) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        callbacks.delete(callback as (...args: any[]) => void)
        if (callbacks.size === 0) {
          this.listenerRegistry.delete(event)
        }
      }
      
      // Remove from Socket.IO
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.socket?.off(event, callback as (...args: any[]) => void)
    } else {
      // Remove all listeners for this event
      this.listenerRegistry.delete(event)
      this.socket?.off(event)
    }
  }

  /**
   * Type-safe one-time event subscription
   * Listens for an event once and then automatically removes the listener
   * Note: one-time listeners are NOT stored in the registry and will NOT be re-applied after reconnection
   * @param event Event name from SocketEvents
   * @param callback Callback function with typed arguments matching the event
   */
  once<E extends keyof SocketEvents>(
    event: E,
    callback: (...args: SocketEvents[E]) => void
  ) {
    if (!this.socket) {
      console.error(`[SocketService] Cannot subscribe to ${event}: socket not initialized`)
      return
    }

    // Don't store one-time listeners - they're meant to fire once
    // Socket.IO will handle cleanup automatically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.socket.once(event, callback as (...args: any[]) => void)
  }
}

// Export singleton instance
export const socketService = new SocketService()

