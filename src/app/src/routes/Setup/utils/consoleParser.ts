// Console line interface
export interface ConsoleLine {
  id: string
  type: 'cmd' | 'ok' | 'error' | 'info' | 'alarm' | 'status'
  timestamp: Date
  message: string
  raw?: string
}

// Parse console messages from backend
export function parseConsoleMessage(
  message: string,
  direction: 'read' | 'write'
): ConsoleLine {
  const trimmed = message.trim()
  const timestamp = new Date()
  const id = `${timestamp.getTime()}-${Math.random()}`

  // Commands sent TO Grbl
  if (direction === 'write') {
    // Check for reset character (Ctrl+X = \x18 = \u0018)
    if (message === '\x18' || message === '\u0018' || trimmed === '\x18' || trimmed === '\u0018') {
      return {
        id,
        type: 'cmd',
        timestamp,
        message: 'Reset',
        raw: message
      }
    }
    
    return {
      id,
      type: 'cmd',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Messages FROM Grbl
  // Status reports: <Idle,MPos:...>
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return {
      id,
      type: 'status',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Errors: error:5 or error:5 (message)
  if (trimmed.startsWith('error:')) {
    return {
      id,
      type: 'error',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Alarms: ALARM:1 or ALARM:1 (message)
  if (trimmed.startsWith('ALARM:')) {
    return {
      id,
      type: 'alarm',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // OK responses
  if (trimmed === 'ok') {
    return {
      id,
      type: 'ok',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Settings: $0=10
  if (trimmed.match(/^\$\d+=/)) {
    return {
      id,
      type: 'info',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Parser state: [G0 G54 G17...]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return {
      id,
      type: 'info',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // G-code lines: > G0 X0 Y0 (ln=123)
  if (trimmed.startsWith('> ')) {
    return {
      id,
      type: 'cmd',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Default: info
  return {
    id,
    type: 'info',
    timestamp,
    message: trimmed,
    raw: trimmed
  }
}
