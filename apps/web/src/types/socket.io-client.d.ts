// Type definitions for socket.io-client v2
declare module 'socket.io-client' {
  interface SocketOptions {
    query?: Record<string, string>
    transports?: string[]
    forceNew?: boolean
    reconnection?: boolean
    reconnectionAttempts?: number
    reconnectionDelay?: number
    reconnectionDelayMax?: number
    timeout?: number
  }

  interface Socket {
    id: string
    connected: boolean
    disconnected: boolean
    
    connect(): Socket
    disconnect(): Socket
    
    emit(event: string, ...args: unknown[]): Socket
    on(event: string, callback: (...args: unknown[]) => void): Socket
    off(event: string, callback?: (...args: unknown[]) => void): Socket
    once(event: string, callback: (...args: unknown[]) => void): Socket
  }

  function io(uri?: string, opts?: SocketOptions): Socket
  export default io
  export { Socket }
}

declare namespace SocketIOClient {
  interface Socket {
    id: string
    connected: boolean
    disconnected: boolean
    
    connect(): Socket
    disconnect(): Socket
    
    emit(event: string, ...args: unknown[]): Socket
    on(event: string, callback: (...args: unknown[]) => void): Socket
    off(event: string, callback?: (...args: unknown[]) => void): Socket
    once(event: string, callback: (...args: unknown[]) => void): Socket
  }
}

