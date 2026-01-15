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
}

// Socket.IO v2 client singleton with strongly-typed events
class SocketService {
  private socket: SocketIOClient.Socket | null = null
  private token: string | null = null

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
    this.socket = io('', {
      transports: ['websocket', 'polling'],
      query: { token: this.token }
    })

    this.socket.on('connect', () => {
      console.log('[SocketService] Socket connected:', this.socket?.id)
      
      // Emit a custom event to notify that socket is ready
      this.socket?.emit('socket:ready')
    })

    this.socket.on('disconnect', (reason: unknown) => {
      console.log('[SocketService] Socket disconnected:', reason)
    })

    this.socket.on('error', (error: unknown) => {
      console.error('[SocketService] Socket error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
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

    // Socket.IO expects (...args: any[]), so we cast the callback
    this.socket.on(event, callback as (...args: any[]) => void)
  }

  /**
   * Type-safe event unsubscription
   * @param event Event name from SocketEvents
   * @param callback Optional callback to remove specific listener, or undefined to remove all listeners for the event
   */
  off<E extends keyof SocketEvents>(
    event: E,
    callback?: (...args: SocketEvents[E]) => void
  ) {
    if (callback) {
      this.socket?.off(event, callback as (...args: any[]) => void)
    } else {
      this.socket?.off(event)
    }
  }

  /**
   * Type-safe one-time event subscription
   * Listens for an event once and then automatically removes the listener
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

    // Socket.IO expects (...args: any[]), so we cast the callback
    this.socket.once(event, callback as (...args: any[]) => void)
  }
}

// Export singleton instance
export const socketService = new SocketService()

