import io from 'socket.io-client'

// Socket.IO v2 client singleton
class SocketService {
  private socket: SocketIOClient.Socket | null = null
  private token: string | null = null

  connect(token?: string) {
    if (this.socket?.connected) {
      console.log('Socket already connected')
      return this.socket
    }

    this.token = token || localStorage.getItem('cncjs-token')

    if (!this.token) {
      console.warn('No token available for socket connection - call signIn first')
      return null
    }

    // Socket.IO v2 connection with JWT auth in query string
    this.socket = io('', {
      transports: ['websocket', 'polling'],
      query: { token: this.token }
    })

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id)
    })

    this.socket.on('disconnect', (reason: unknown) => {
      console.log('Socket disconnected:', reason)
    })

    this.socket.on('error', (error: unknown) => {
      console.error('Socket error:', error)
    })

    return this.socket
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  getSocket() {
    return this.socket
  }

  isConnected() {
    return this.socket?.connected ?? false
  }

  // Send a command to the controller
  command(cmd: string, ...args: unknown[]) {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot send command')
      return
    }
    this.socket.emit('command', cmd, ...args)
  }

  // Subscribe to events
  on(event: string, callback: (...args: unknown[]) => void) {
    this.socket?.on(event, callback)
  }

  // Unsubscribe from events
  off(event: string, callback?: (...args: unknown[]) => void) {
    if (callback) {
      this.socket?.off(event, callback)
    } else {
      this.socket?.off(event)
    }
  }
}

// Export singleton instance
export const socketService = new SocketService()

