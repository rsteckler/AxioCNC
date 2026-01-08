# Console Panel Implementation Plan

## Overview
Hook up the Console panel in `SetupMockup.tsx` to display real serial communication between the backend and Grbl controller.

## Backend Event Flow

### How Console Messages Are Streamed

1. **Serial Data Received (FROM Grbl)**:
   - `SerialConnection` receives data → emits `'data'` event
   - `GrblController.connectionEventListener.data` → calls `this.runner.parse(data)`
   - `GrblRunner.parse()` parses the line and emits events like `'status'`, `'ok'`, `'error'`, etc.
   - `GrblController` listens to runner events and emits `'serialport:read'` with formatted messages
   - `GrblController.emit()` (line 1230) forwards to all Socket.IO clients

2. **Serial Data Sent (TO Grbl)**:
   - `GrblController.write()` or `writeln()` → emits `'serialport:write'` event
   - `GrblController.emit()` forwards to all Socket.IO clients

### Socket.IO Events

**Client receives:**
- `serialport:read` - Messages FROM Grbl (responses, status, errors, etc.)
- `serialport:write` - Messages TO Grbl (commands sent)

**Event payloads:**
- `serialport:read`: String message (e.g., `"<Idle,MPos:...>"`, `"ok"`, `"error:5"`)
- `serialport:write`: String data + context object

### Example Events from GrblController.js

**Read events (FROM Grbl):**
```javascript
this.emit('serialport:read', res.raw);                    // Status reports
this.emit('serialport:read', `> ${line} (ln=${ln})`);     // G-code lines sent
this.emit('serialport:read', `error:${code} (${error.message})`); // Errors
this.emit('serialport:read', `ALARM:${code} (${alarm.message})`);  // Alarms
this.emit('serialport:read', res.raw);                    // Settings, parser state, etc.
```

**Write events (TO Grbl):**
```javascript
this.emit('serialport:write', data, { source: WRITE_SOURCE_CLIENT });
```

## Frontend Implementation Plan

### Step 1: Replace Mock Data with Real State

**Current state:**
```typescript
const mockConsoleLines = [
  { type: 'info', time: '10:23:45', msg: 'Grbl 1.1h [\'$\' for help]' },
  // ...
]
```

**New state:**
```typescript
interface ConsoleLine {
  id: string
  type: 'cmd' | 'ok' | 'error' | 'info' | 'alarm' | 'status'
  timestamp: Date
  message: string
  raw?: string  // Original raw message
}

const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
```

### Step 2: Listen to Socket.IO Events

**In `SetupMockup.tsx` component:**

```typescript
useEffect(() => {
  if (!isConnected || !connectedPort) return

  const socket = socketService.getSocket()
  if (!socket) return

  // Listen for messages FROM Grbl
  const handleSerialRead = (message: string) => {
    const line = parseConsoleMessage(message, 'read')
    setConsoleLines(prev => [...prev, line])
  }

  // Listen for messages TO Grbl  
  const handleSerialWrite = (data: string, context?: unknown) => {
    const line = parseConsoleMessage(data, 'write')
    setConsoleLines(prev => [...prev, line])
  }

  socket.on('serialport:read', handleSerialRead)
  socket.on('serialport:write', handleSerialWrite)

  return () => {
    socket.off('serialport:read', handleSerialRead)
    socket.off('serialport:write', handleSerialWrite)
  }
}, [isConnected, connectedPort])
```

### Step 3: Parse Console Messages

**Function to parse and categorize messages:**

```typescript
function parseConsoleMessage(
  message: string, 
  direction: 'read' | 'write'
): ConsoleLine {
  const trimmed = message.trim()
  const timestamp = new Date()
  const id = `${timestamp.getTime()}-${Math.random()}`

  // Commands sent TO Grbl
  if (direction === 'write') {
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
```

### Step 4: Update Console Display

**Replace mock data rendering:**

```typescript
// Instead of:
{mockConsoleLines.map((line, i) => (...))}

// Use:
{consoleLines.map((line) => (
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
))}
```

### Step 5: Implement Command Input

**Handle command sending:**

```typescript
const [commandInput, setCommandInput] = useState('')

const handleSendCommand = useCallback(() => {
  if (!commandInput.trim() || !isConnected || !connectedPort) return

  // Send via Socket.IO
  socketService.getSocket()?.emit('writeln', connectedPort, commandInput.trim())
  
  // Clear input
  setCommandInput('')
}, [commandInput, isConnected, connectedPort])

// Handle Enter key
const handleKeyPress = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleSendCommand()
  }
}
```

**Update input:**
```typescript
<input 
  type="text"
  value={commandInput}
  onChange={(e) => setCommandInput(e.target.value)}
  onKeyPress={handleKeyPress}
  placeholder="Enter command..."
  className="..."
/>
<Button 
  onClick={handleSendCommand}
  disabled={!commandInput.trim() || !isConnected}
>
  Send
</Button>
```

### Step 6: Auto-scroll and Performance

**Auto-scroll to bottom:**
```typescript
const consoleRef = useRef<HTMLDivElement>(null)

useEffect(() => {
  if (consoleRef.current) {
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight
  }
}, [consoleLines])
```

**Limit console history (optional):**
```typescript
// Keep last 1000 lines to prevent memory issues
const MAX_LINES = 1000

useEffect(() => {
  setConsoleLines(prev => {
    if (prev.length > MAX_LINES) {
      return prev.slice(-MAX_LINES)
    }
    return prev
  })
}, [consoleLines.length])
```

## Implementation Checklist

- [ ] Replace `mockConsoleLines` with `consoleLines` state
- [ ] Add `parseConsoleMessage()` function
- [ ] Set up Socket.IO listeners for `serialport:read` and `serialport:write`
- [ ] Update console rendering to use real data
- [ ] Implement command input handler
- [ ] Add auto-scroll functionality
- [ ] Add line limit to prevent memory issues
- [ ] Test with grbl-sim
- [ ] Handle edge cases (disconnect, reconnect, etc.)

## Testing

1. Connect to `/dev/ttyFAKE` (grbl-sim)
2. Verify console shows:
   - Startup message: `Grbl 0.9j ['$' for help]`
   - Status reports: `<Idle,MPos:...>`
   - Parser state: `[G0 G54 G17...]`
   - OK responses: `ok`
3. Send commands via input:
   - `$$` - Should show settings
   - `?` - Should show status
   - `$G` - Should show parser state
4. Verify commands appear with `>` prefix
5. Verify responses appear with appropriate colors

## Notes

- The backend already emits these events - no backend changes needed
- Messages are already formatted by the backend
- We just need to listen and display them
- Command input uses existing `writeln` Socket.IO event
