# Machine Status Implementation

## Backend State Events

### Socket.IO Events from Backend

1. **`serialport:open`** - Emitted when serial port opens
   - Payload: `{ port: string, baudrate: number, controllerType: string, inuse: boolean }`

2. **`serialport:close`** - Emitted when serial port closes
   - No payload

3. **`controller:state`** - Emitted when controller state changes
   - Payload: `(controllerType: string, state: object)`
   - State structure:
     ```typescript
     {
       status: {
         activeState: 'Idle' | 'Run' | 'Alarm' | 'Home' | 'Hold' | 'Jog' | 'Door' | 'Check' | 'Sleep',
         mpos: { x: string, y: string, z: string },
         wpos: { x: string, y: string, z: string },
         ov: number[]
       },
       parserstate: { ... }
     }
     ```

4. **`workflow:state`** - Emitted when workflow state changes
   - Payload: `'idle' | 'running' | 'paused'`
   - Used to detect when a G-code job is actively running

## Frontend Machine Status States

### Status Types

1. **`not_connected`** - Machine is not connected
   - Status badge: Gray "Not connected"
   - Buttons: Connect only

2. **`connected_pre_home`** - Connected but not homed
   - Status badge: Yellow "Ready (Run Home)"
   - Buttons: Disconnect, Home (labeled "Run Home")

3. **`connected_post_home`** - Connected and homed
   - Status badge: Green "Ready"
   - Buttons: Disconnect, Home

4. **`alarm`** - Machine is in alarm state
   - Status badge: Red "Alarm"
   - Buttons: Disconnect, Unlock, Home
   - After unlock: transitions to `connected_pre_home` (position not trusted)

5. **`running`** - Active G-code job is running
   - Status badge: Green "Busy"
   - Buttons: Disconnect, Home (disabled)

### State Transitions

- **Connect** → `connected_pre_home` (homed state reset)
- **Disconnect** → `not_connected` (all state reset)
- **Home** (from pre-home) → `connected_post_home` (when homing completes)
- **Reset** → `connected_pre_home` (homed state reset)
- **Unlock** (from alarm) → `connected_pre_home` (homed state reset, position not trusted)
- **Start Job** → `running` (when workflow:state becomes 'running')
- **Stop Job** → `connected_post_home` or `connected_pre_home` (based on homed state)
- **Alarm** → `alarm` (when controller:state.status.activeState === 'Alarm')

## Implementation Details

### State Priority

1. **Alarm** - Highest priority (overrides everything)
2. **Running** - From workflow:state (overrides idle states)
3. **Idle + Homed** - Post-home ready
4. **Idle + Not Homed** - Pre-home ready
5. **Homing** - Pre-home (stays in pre-home until complete)

### Homing Detection

Homing is detected when:
- `activeState` transitions from 'Home' to 'Idle'
- `homingInProgress` flag is true
- Machine is connected

After homing completes:
- `isHomed` is set to `true`
- Status transitions to `connected_post_home`

### Workflow State Handling

- `workflow:state === 'running'` → Set status to `running`
- `workflow:state === 'idle'` or `'paused'` → Let controller state determine status

### Reset Behavior

When Reset button is clicked:
- Sends `reset` command to controller
- Immediately sets status to `connected_pre_home`
- Resets `isHomed` to `false`
- Resets `isJobRunning` to `false`
