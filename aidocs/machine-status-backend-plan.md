# Machine Status Backend State Management Plan

## Problem Statement

The frontend currently maintains machine status state (connection, alarm, homed, running, etc.) locally with complex state management code that's bug-ridden. This leads to:
- State getting out of sync between page navigations
- State lost on page refresh
- Bugs with stale closures and refs
- State not persisting when frontend isn't connected
- Controller alarm state changes not tracked when FE is disconnected

## Solution Overview

Create a **MachineStatusManager** class on the backend that:
- Acts as the **single source of truth** for machine status
- Tracks state per port (connection status, homed state, alarm state, workflow state, etc.)
- Reacts to controller events even when no frontend is connected
- Emits state changes via Socket.IO to connected clients
- Provides REST API endpoint to query current status
- Persists state across page refreshes and reconnections

---

## Current State Analysis

### Backend (GrblController.js)
- ✅ Already tracks `homed` flag (line 114)
- ✅ Tracks homing completion: `activeState` transitions from "Home" to "Idle" (lines 542-555)
- ✅ Resets `homed` on alarm (line 553-555)
- ✅ Emits `controller:state` events with status
- ✅ Emits `serialport:open` and `serialport:close` events
- ✅ Emits `workflow:state` events (idle/running/paused)
- ✅ Has `status` getter that returns current state including `homed` (line 1045-1064)
- ✅ Controllers stored in in-memory `store` (via CNCEngine)

### Frontend (Setup.tsx)
- ❌ Complex local state: `isConnected`, `connectedPort`, `machineStatus`, `isHomed`, `isJobRunning`, etc.
- ❌ Many refs to avoid stale closures: `machineStatusRef`, `isConnectedRef`, `isHomedRef`, etc.
- ❌ Manual state restoration from `/api/controllers` on mount
- ❌ State gets out of sync between pages/navigations
- ❌ State lost on page refresh until reconnection

---

## Proposed Architecture

### New Backend Class: MachineStatusManager

**Location:** `src/server/services/machinestatus/MachineStatusManager.js`

**Responsibilities:**
1. Track machine status per port (in-memory, keyed by port string)
2. Listen to controller events (via CNCEngine or controller instances)
3. Compute derived machine status from controller state
4. Emit state changes via Socket.IO
5. Expose REST API endpoint for status queries

**State Structure:**

```typescript
interface MachineStatus {
  port: string
  connected: boolean
  controllerType: string | null
  machineStatus: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running'
  isHomed: boolean
  isJobRunning: boolean
  homingInProgress: boolean
  controllerState: {
    activeState: string  // 'Idle', 'Run', 'Alarm', 'Home', 'Hold', etc.
    mpos: { x, y, z }
    wpos: { x, y, z }
  } | null
  workflowState: 'idle' | 'running' | 'paused' | null
  lastUpdate: number  // timestamp
}
```

**Status Computation Logic:**

```javascript
computeMachineStatus(status) {
  // Priority order:
  // 1. Alarm (highest priority)
  // 2. Running (workflow:state === 'running')
  // 3. Connected + Homed (post-home)
  // 4. Connected + Not Homed (pre-home)
  // 5. Not Connected

  if (!status.connected) {
    return 'not_connected'
  }

  if (status.controllerState?.activeState === 'Alarm') {
    return 'alarm'
  }

  if (status.workflowState === 'running') {
    return 'running'
  }

  if (status.isHomed) {
    return 'connected_post_home'
  }

  return 'connected_pre_home'
}
```

---

## Implementation Plan

### Phase 1: Create MachineStatusManager Class

**1.1 Core Class Structure**

```javascript
// src/server/services/machinestatus/MachineStatusManager.js
class MachineStatusManager extends EventEmitter {
  constructor() {
    super()
    this.statusByPort = new Map()  // Map<port, MachineStatus>
  }

  // Get status for a port
  getStatus(port) {
    return this.statusByPort.get(port) || this.getDefaultStatus(port)
  }

  // Update status from controller events
  updateStatus(port, updates) { ... }

  // Compute derived machineStatus
  computeMachineStatus(status) { ... }

  // Emit state change to all connected sockets
  emitStatusChange(port, status) { ... }
}
```

**1.2 Integration with CNCEngine**

- Hook into controller events in `CNCEngine.js`
- Listen to:
  - `serialport:open` → Set `connected: true`
  - `serialport:close` → Set `connected: false`, reset homed state
  - `controller:state` → Update `controllerState`, detect alarm, detect homing completion
  - `workflow:state` → Update `workflowState`

**1.3 Socket.IO Integration**

- When status changes, emit to all sockets:
  ```javascript
  this.io.emit('machine:status', port, status)
  ```
- When new socket connects, send current status:
  ```javascript
  socket.emit('machine:status', port, this.getStatus(port))
  ```

---

### Phase 2: REST API Endpoint

**2.1 GET /api/machine/status**

Query current machine status for all ports or a specific port.

**Request:**
```
GET /api/machine/status?port=/dev/ttyUSB0
GET /api/machine/status  (all ports)
```

**Response:**
```json
{
  "status": {
    "port": "/dev/ttyUSB0",
    "connected": true,
    "controllerType": "Grbl",
    "machineStatus": "connected_post_home",
    "isHomed": true,
    "isJobRunning": false,
    "homingInProgress": false,
    "controllerState": {
      "activeState": "Idle",
      "mpos": { "x": "0.000", "y": "0.000", "z": "0.000" },
      "wpos": { "x": "0.000", "y": "0.000", "z": "0.000" }
    },
    "workflowState": "idle",
    "lastUpdate": 1704067200000
  }
}
```

**Files:**
- `src/server/api/api.machine.js` - New API endpoint
- `src/server/api/index.js` - Register route

---

### Phase 3: Event Listening Implementation

**3.1 Listen to Controller Events**

In `CNCEngine.js`, wire up MachineStatusManager:

```javascript
import MachineStatusManager from '../services/machinestatus/MachineStatusManager'

class CNCEngine {
  constructor() {
    this.statusManager = new MachineStatusManager()
    // ...
  }

  start(server, controller = '') {
    // ... existing code ...

    // Wire up status manager to controller events
    this.setupStatusManager()
  }

  setupStatusManager() {
    // Listen to controller state changes
    // Hook into addConnection to emit status on new socket
    // Hook into controller events
  }
}
```

**3.2 Listen to GrblController Events**

In `GrblController.js`, emit events that MachineStatusManager can listen to:

```javascript
// Already emits:
// - serialport:open
// - serialport:close  
// - controller:state
// - workflow:state

// MachineStatusManager listens to these via CNCEngine
```

**3.3 Homing Detection**

Track homing state transitions:
- When `activeState` changes from "Home" to "Idle" → Set `isHomed: true`
- When `activeState` becomes "Alarm" → Set `isHomed: false`
- When port closes → Set `isHomed: false`
- When reset command → Set `isHomed: false`
- When unlock command → Set `isHomed: false`

**3.4 Workflow State Tracking**

Track job running state:
- When `workflow:state` becomes 'running' → Set `isJobRunning: true`
- When `workflow:state` becomes 'idle' or 'paused' → Set `isJobRunning: false`

---

### Phase 4: Frontend Simplification

**4.1 Remove Complex State Management**

Remove from `Setup.tsx`:
- ❌ `useState` for `isConnected`, `connectedPort`, `machineStatus`, `isHomed`, `isJobRunning`
- ❌ All refs: `machineStatusRef`, `isConnectedRef`, `isHomedRef`, `homingInProgressRef`
- ❌ Manual state restoration from `/api/controllers`
- ❌ Complex state transition logic

**4.2 Replace with Simple Socket.IO Listener**

```typescript
// In Setup.tsx
const [machineStatus, setMachineStatus] = useState<MachineStatus | null>(null)

useEffect(() => {
  const socket = socketService.getSocket()
  if (!socket) return

  // Listen for status updates
  const handleStatusUpdate = (port: string, status: MachineStatus) => {
    if (port === settings?.connection?.port) {
      setMachineStatus(status)
    }
  }

  socket.on('machine:status', handleStatusUpdate)

  // Request current status on mount
  socket.emit('machine:status:request', settings?.connection?.port)

  return () => {
    socket.off('machine:status', handleStatusUpdate)
  }
}, [settings?.connection?.port])
```

**4.3 Use Backend Status as Source of Truth**

All UI decisions use `machineStatus` from backend:
```typescript
const isConnected = machineStatus?.connected ?? false
const connectedPort = machineStatus?.port ?? null
const isHomed = machineStatus?.isHomed ?? false
const isJobRunning = machineStatus?.isJobRunning ?? false
const status = machineStatus?.machineStatus ?? 'not_connected'
```

---

### Phase 5: Cleanup and Testing

**5.1 Remove Frontend State Management Code**

- Remove all manual state management from `Setup.tsx`
- Remove state restoration logic
- Remove refs and stale closure workarounds
- Simplify component props (pass `machineStatus` object instead of many booleans)

**5.2 Add Socket.IO Event Handlers**

In `CNCEngine.js`, handle status requests:
```javascript
socket.on('machine:status:request', (port) => {
  const status = this.statusManager.getStatus(port)
  socket.emit('machine:status', port, status)
})
```

**5.3 Testing**

- ✅ Test state persists across page refresh
- ✅ Test state syncs between multiple browser tabs
- ✅ Test alarm state detected when FE disconnected
- ✅ Test homing state tracked correctly
- ✅ Test state restoration on reconnection

---

## File Structure

```
src/server/
├── services/
│   └── machinestatus/
│       └── MachineStatusManager.js    # New: Status manager class
├── api/
│   ├── api.machine.js                 # New: REST API endpoint
│   └── index.js                       # Modified: Register route
└── services/
    └── cncengine/
        └── CNCEngine.js               # Modified: Wire up status manager

src/app/src/
└── routes/
    └── Setup.tsx                      # Simplified: Remove state management
```

---

## Migration Strategy

1. **Phase 1-2**: Build backend MachineStatusManager alongside existing code (non-breaking)
2. **Phase 3**: Wire up event listeners, test with existing frontend
3. **Phase 4**: Gradually simplify frontend to use backend status
4. **Phase 5**: Remove all old frontend state management code

---

## Benefits

1. **Single Source of Truth**: Backend maintains authoritative state
2. **Persistent**: State survives page refreshes and FE disconnections
3. **Reactive**: Reacts to controller events even when FE is disconnected
4. **Simpler Frontend**: No complex state management, refs, or stale closures
5. **Multi-client Sync**: All browser tabs automatically stay in sync
6. **Better Reliability**: No state sync bugs between pages/navigations

---

## Open Questions

1. **Persistence**: Should status persist across server restarts? (Probably not - machine state is volatile)
2. **Status History**: Should we track history of state changes? (Probably not needed initially)
3. **Multiple Ports**: How to handle multiple simultaneous connections? (Status manager already supports Map<port, status>)
4. **Controller Types**: How to handle Grbl vs Marlin vs Smoothie differences? (Status structure is generic, controllerType field identifies type)

---

## Next Steps

1. Create `MachineStatusManager.js` class with basic structure
2. Wire up event listeners in `CNCEngine.js`
3. Implement REST API endpoint
4. Test with existing frontend to ensure no regressions
5. Gradually simplify frontend state management
6. Remove old buggy code
