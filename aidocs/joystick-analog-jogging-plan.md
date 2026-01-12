# Joystick Analog Jogging Implementation Plan

> Based on [Grbl v1.1 Jogging Documentation](https://github.com/gnea/grbl/wiki/Grbl-v1.1-Jogging)

## Overview

Implement continuous analog joystick jogging that follows Grbl's recommended methodology for low-latency, responsive control. The implementation will poll gamepad analog sticks, translate input to jog motion vectors, and send incremental `$J=` commands to keep Grbl's planner buffer full while maintaining minimal latency.

**Architecture**: Unified input translation layer that accepts mapped inputs (both analog and button actions) from any source and routes them to appropriate handlers (jog loop, button actions, etc.).

## Current State

### ✅ Completed Infrastructure

- ✅ **Joystick configuration UI** (Settings page)
  - Complete settings UI with button and analog mappings
  - Deadzone, sensitivity, inversion controls
  - Max jog speeds configuration (analogJogSpeedXY, analogJogSpeedZ)
  - Connection location selection (server/client)

- ✅ **Server-side gamepad support**
  - Linux joystick API implementation (`/dev/input/js*`)
  - Gamepad service with async I/O
  - REST API endpoints (`/api/gamepads/*`)
  - Socket.IO events for real-time state (`gamepad:state`)
  - Platform detection and diagnostics

- ✅ **Client-side gamepad support**
  - Browser Gamepad API integration
  - Gamepad detection and selection UI
  - RTK Query endpoints for server gamepads
  - Support for both server and client-side gamepads

- ✅ **Analog input utilities**
  - `useAnalogJog` hook for 60fps polling with deadzone
  - `normalizeToCircle` for circular normalization
  - `expandCircleToSquare` for gamepad sticks
  - Analog normalization utilities in `src/app/src/utils/analogNormalize.ts`

- ✅ **Visual analog controls**
  - Analog jog mode in JogPanel with mouse/touch controls
  - Circular joystick visualization (144px × 144px)
  - Z-axis lever control
  - Debug panel for normalized values
  - Document-level drag handling for extended drag area

- ✅ **Joystick test dialog**
  - Real-time gamepad state display
  - Analog stick visualization with deadzone indicators
  - Button and axis value display
  - Command preview based on mappings
  - Supports both server and client-side gamepads

- ✅ **Settings schema**
  - Complete Zod schema for joystick configuration
  - Default mappings and settings
  - Button and analog axis mappings
  - All configuration options validated

### ✅ Completed Since Last Update

- ✅ **Input mapping layer (Backend)**
  - `JoystickMapper` class in `src/server/services/joystick/mapper.js`
  - Translates raw gamepad inputs (button IDs, axis values) to mapped actions
  - Button mapping: `buttonMappings[buttonId]` → `CncAction`
  - Analog mapping: `analogMappings[axis]` → `AnalogMapping`
  - Applies settings: deadzone, sensitivity, inversion to analog values
  - Outputs mapped actions: `{ type: 'analog', x, y, z }` or `{ type: 'button', action, buttonId, pressed }`

- ✅ **Joystick orchestration service (Backend)**
  - `JoystickService` in `src/server/services/joystick/index.js`
  - Accepts inputs from all sources (server gamepad, client gamepad, client jog controls)
  - Uses `JoystickMapper` to map inputs to actions
  - Emits `actions` events for translation layer
  - Integrated into `CNCEngine.js`

- ✅ **Command dispatcher (Backend)**
  - `dispatcher.js` in `src/server/services/joystick/dispatcher.js`
  - Handles button action dispatch to controller commands
  - State checking (connected, idle, run, hold, alarm, spindle state)
  - Command mapping (button actions → controller commands)
  - Zeroing command building with current WCS detection
  - Spindle state checking (only allow M3 if stopped)
  - Integrated into joystick service actions handler

- ✅ **UI cleanup**
  - Removed individual homing actions (`home_x`, `home_y`, `home_z`) - not supported by Grbl
  - Removed `spindle_toggle` from UI
  - Removed `cycle_start` from UI/backend (redundant with `resume`)

- ✅ **Client input sending**
  - `useJoystickInput` hook sends browser gamepad state via `joystick:gamepad` Socket.IO event
  - `sendJogControlInput` function sends browser jog control input via `joystick:jog` Socket.IO event
  - Integrated into `Settings/index.tsx` and `JogPanel.tsx`

### ✅ Completed - JogLoop Service

- ✅ **JogLoop service** (`src/server/services/joystick/jogloop.js`)
  - Accepts analog jog actions from joystick service
  - Continuous jog command loop for analog input
  - Discrete jog commands for button-triggered jog (e.g., 'jog_x_pos')
  - State management (idle, jogging, cancelling)
  - Calculate motion vectors and incremental distances using Grbl's recommended formula
  - Generate and send `$J=G91 G21 X... Y... Z... F...` commands to controller
  - Handle command acknowledgements (ok/error responses)
  - Command queue management (targets 4 commands in buffer)
  - Timing calculation: `dt > v² / (2 * a * (N-1))` where N=15 planner blocks
  - Reads machine acceleration from Grbl settings ($120, $121, $122)
  - Multi-axis simultaneous movement support
  - Only jog when controller is in 'Idle' or 'Jog' state

- ✅ **Button jog actions**
  - Handle button-triggered jog actions (`jog_x_pos`, `jog_x_neg`, etc.)
  - Handled by jog loop service via `handleButtonJog(action, pressed)`
  - Supports multi-axis button combos (press X+ and Y+ simultaneously)

- ✅ **Jog cancel synchronization**
  - Send jog cancel (`\x85`) when input returns to neutral
  - Send `G4P0` for synchronization after cancel
  - State machine handles transitions gracefully
  - Timeout handling if cancel doesn't complete

- ✅ **Integration** (in `CNCEngine.js`)
  - Analog actions from joystick service routed to `jogLoop.handleAnalogInput()`
  - Button jog actions routed to `jogLoop.handleButtonJog()`
  - Config changes update jog loop settings
  - Only jog when controller is in 'Idle' or 'Jog' state

### ❌ Future Enhancements (Nice to Have)

## Architecture

```mermaid
graph TB
    subgraph frontend [Frontend - Input Sources]
        BrowserJogControls[Browser Jog Controls<br/>Mouse/Touch on JogPanel]
        BrowserGamepad[Browser Gamepad<br/>Gamepad API]
        ServerGamepad[Server Gamepad<br/>Socket.IO events]
    end
    
    subgraph mapping [Mapping Layer]
        InputMapper[Input Mapper<br/>Apply mappings & settings]
        ButtonMapper[Button Mappings<br/>buttonMappings[buttonId] → CncAction]
        AnalogMapper[Analog Mappings<br/>analogMappings[axis] + settings → normalized values]
    end
    
    subgraph translation [Translation Layer - Unified Interface]
        TranslationLayer[Gamepad/System Translation Layer<br/>Routes mapped actions to handlers]
    end
    
    subgraph handlers [Handlers]
        JogLoop[JogLoop Service<br/>Analog & discrete jog commands]
        ButtonHandlers[Button Action Handlers<br/>emergency_stop, home_all, etc.]
    end
    
    subgraph backend [Backend]
        Controller[GrblController]
        SerialPort[Serial Port]
    end
    
    BrowserJogControls -->|Raw input| InputMapper
    BrowserGamepad -->|Raw axes/buttons| InputMapper
    ServerGamepad -.->|Raw axes/buttons| InputMapper
    
    InputMapper -->|Mapped analog actions<br/>{x, y, z}| TranslationLayer
    InputMapper -->|Mapped button actions<br/>{action: CncAction}| TranslationLayer
    
    TranslationLayer -->|Analog jog actions| JogLoop
    TranslationLayer -->|Button jog actions<br/>jog_x_pos, jog_y_pos, etc.| JogLoop
    TranslationLayer -->|Other button actions<br/>emergency_stop, home_all, etc.| ButtonHandlers
    
    JogLoop -->|$J= commands| Controller
    ButtonHandlers -->|Various commands| Controller
    Controller -->|Responses| JogLoop
```

**Key Design Decisions:**

1. **Mapping happens outside translation layer**: Button IDs → `CncAction` and axis values → normalized jog values happen in the mapping layer
2. **Translation layer receives mapped actions**: Only deals with high-level actions, not raw inputs
3. **Translation layer routes to handlers**: Decides whether action goes to jog loop or button handlers
4. **Source-agnostic**: Translation layer doesn't know/care about input source

## Implementation Plan

### Phase 1: Mapping Layer ✅ COMPLETED

**1.1 Input Mapper Service** (`src/server/services/joystick/mapper.js`)
- ✅ Accepts raw gamepad state: `{ axes: number[], buttons: boolean[] }`
- ✅ Applies button mappings: `buttonMappings[buttonId]` → `CncAction`
- ✅ Applies analog mappings: `analogMappings[axis]` + settings (deadzone, sensitivity, inversion) → normalized values
- ✅ Outputs mapped actions:
  - Analog: `{ type: 'analog', x: number, y: number, z: number }`
  - Buttons: `{ type: 'button', action: CncAction, buttonId: number }`

**1.2 Browser Jog Controls Integration**
- ✅ Browser jog controls use `useAnalogJog` (normalizes + deadzone)
- ✅ Sends input via Socket.IO `joystick:jog` event
- ✅ Backend maps via `JoystickMapper.mapJogControl()`

### Phase 2: Translation Layer ✅ COMPLETED

**2.1 Translation Layer** (in `CNCEngine.js`)
- ✅ Accepts mapped actions from joystick service
- ✅ Routes actions to appropriate handlers:
  - Analog actions → jog loop (`jogLoop.handleAnalogInput()`)
  - Button jog actions → jog loop (`jogLoop.handleButtonJog()`)
  - Other button actions → dispatcher (`dispatcher.dispatchButtonAction()`)

### Phase 3: JogLoop Service ✅ COMPLETED

**3.1 JogLoop Service** (`src/server/services/joystick/jogloop.js`)
- ✅ Accepts both analog and discrete jog actions
- ✅ Continuous jog loop for analog input (timer-based)
- ✅ Discrete jog commands for button-triggered jog
- ✅ State management (idle, jogging, cancelling)
- ✅ Calculate motion vectors and incremental distances
- ✅ Generate `$J=` commands via controller
- ✅ Handle acknowledgements and errors

**3.2 Command Generation**
- ✅ Format: `$J=G91 G21 X{dx} Y{dy} Z{dz} F{feedrate}`
- ✅ Calculate incremental distances based on speed and timing
- ✅ Support multi-axis simultaneous movement

**3.3 Timing and Distance Calculation**
- ✅ Follow Grbl's recommended math: `dt > v² / (2 * a * (N-1))`
- ✅ Read acceleration from Grbl settings ($120, $121, $122)
- ✅ Target queue depth of 4 commands for low latency

### Phase 4: Button Action Handlers ✅ COMPLETED

**4.1 Command Dispatcher**
- ✅ `dispatcher.js` handles all non-jog button actions
- ✅ Maps actions to controller commands:
  - 'emergency_stop' → 'reset' command
  - 'home_all' → 'homing' command
  - 'zero_all', 'zero_x', 'zero_y', 'zero_z' → G-code commands (G10 L20)
  - 'start' → 'gcode:start' command
  - 'stop' → 'gcode:stop' command
  - 'pause' → 'gcode:pause' command
  - 'resume' → 'gcode:resume' command
  - 'feed_hold' → 'feedhold' command
  - 'spindle_on' → M3 G-code
  - 'spindle_off' → M5 G-code
- ✅ State checking for each action
- ✅ Integrated into joystick service

**4.2 UI Cleanup**
- ✅ Removed `home_x`, `home_y`, `home_z` (not supported by Grbl)
- ✅ Removed `spindle_toggle` (replaced with separate on/off actions)
- ✅ Removed `cycle_start` (redundant with `resume`)

### Phase 5: Jog Loop Integration ✅ COMPLETED

**5.1 Connect Analog Actions to Jog Loop**
- ✅ Route analog actions from joystick service to jog loop service
- ✅ Handle button jog actions (`jog_x_pos`, `jog_x_neg`, etc.) via jog loop
- ✅ All paths converge at jog loop service

**5.2 Jog Loop Service**
- ✅ Created jog loop service (continuous jogging)
- ✅ Accept analog actions from joystick service
- ✅ Generate and send `$J=` commands
- ❌ Handle command acknowledgements
- ❌ State management (idle, jogging, cancelling)
- ❌ Only jog when controller is in 'Idle' or 'Jog' state

**5.3 Error Handling**
- ✅ Basic error handling in dispatcher (state checking, controller availability)
- ❌ Error handling for jog loop (connection loss, state changes)
- ❌ Graceful degradation for jog loop

## Technical Details

### Input Mapping Examples

**Button Mapping:**
```typescript
// Raw input
buttonId: 1, pressed: true

// After mapping
{ type: 'button', action: 'emergency_stop', buttonId: 1 }

// Translation layer routes to: Button action handler
```

**Analog Mapping:**
```typescript
// Raw input
axes: [0.8, 0.6, 0, 0, 0, 0, 0, 0]
analogMappings: { left_x: 'jog_x', left_y: 'jog_y', ... }

// After mapping (with settings applied: deadzone, sensitivity, inversion)
{ type: 'analog', x: 0.75, y: 0.55, z: 0 }

// Translation layer routes to: Jog loop service
```

### Jog Command Examples

**Single axis (X+):**
```
$J=G91 G21 X0.5 F1000
```

**Multi-axis (XY diagonal):**
```
$J=G91 G21 X0.354 Y0.354 F1000
```

**Z axis:**
```
$J=G91 G21 Z0.1 F500
```

**Jog cancel:**
```
\x85 (0x85 realtime command)
```

**Synchronization after cancel:**
```
G4P0 (dwell 0 seconds - returns 'ok' when cancel complete)
```

### Timing Calculation Example

For a machine with:
- Max jog speed: 3000 mm/min = 50 mm/sec
- Acceleration: 500 mm/sec²
- Planner blocks: N = 15

Calculate `dt`:
- `dt > 10ms` ✓ (use 25ms minimum)
- `dt > v² / (2 * a * (N-1))` = `50² / (2 * 500 * 14)` = `2500 / 14000` = `0.179s`

So `dt = 0.179s` (179ms) minimum for max speed.

At this speed, incremental distance: `s = 50 * 0.179 = 8.95mm`

Total latency: `T = 0.179 * 15 = 2.7 seconds` at max speed.

At slower speeds (e.g., 500 mm/min = 8.33 mm/sec):
- `dt > 8.33² / (2 * 500 * 14)` = `69.4 / 14000` = `0.005s` (5ms)
- Use `dt = 25ms` (minimum constraint)
- `s = 8.33 * 0.025 = 0.21mm`
- Total latency: `T = 0.025 * 15 = 0.375s` (375ms) - much better!

### Deadzone and Sensitivity

**Deadzone:**
- Ignore stick values below threshold (e.g., 0.15 = 15%)
- Prevents drift from stick not returning to exact center
- Applied before sensitivity curve

**Sensitivity:**
- Apply curve to stick input (linear, exponential, etc.)
- Allows fine control near center, full speed at edges
- Default: linear (1.0x), can be adjusted for preference

## File Structure

```
src/
├── app/                    # Modern frontend
│   └── src/
│       ├── hooks/
│       │   ├── useAnalogJog.ts        # ✅ Analog input polling hook
│       │   └── useJoystickInput.ts    # ✅ Client gamepad polling and input sending
│       ├── routes/
│       │   ├── Setup/
│       │   │   └── panels/
│       │   │       └── JogPanel.tsx   # ✅ Analog jog controls with input sending
│       │   └── Settings/
│       │       └── sections/
│       │           ├── JoystickSection.tsx  # ✅ Joystick settings UI
│       │           └── JoystickTestDialog.tsx  # ✅ Gamepad test dialog
│       └── utils/
│           └── analogNormalize.ts     # ✅ Analog normalization utilities
└── server/                 # Backend
    └── services/
        ├── joystick/       # ✅ Joystick services
        │   ├── mapper.js   # ✅ Input mapping (JoystickMapper)
        │   ├── index.js    # ✅ Orchestration service (JoystickService)
        │   ├── dispatcher.js  # ✅ Command dispatcher for button actions
        │   └── jogloop.js  # ✅ Continuous jog loop service (JogLoop)
        └── gamepad/        # ✅ Server-side gamepad service
            └── index.js    # ✅ Linux joystick API integration
```

**Data Flow:**
1. Input sources → **Mapping Layer** → Mapped actions
2. Mapped actions → **Translation Layer** → Routed to handlers
3. Handlers → Execute actions (jog loop, button handlers)

## API Integration

### Current (Direct Socket.IO)
```typescript
// Send jog command
socketService.command('gcode', '$J=G91 G21 X0.5 F1000');

// Send jog cancel
socketService.command('jogCancel');

// Send button actions
socketService.command('gcode', '!'); // Emergency stop
socketService.command('gcode', '$H'); // Home all

// Listen for responses
socketService.on('serialport:read', (data) => {
  if (data === 'ok') { /* command completed */ }
  if (data.startsWith('error:')) { /* handle error */ }
});
```

### Gamepad State (Server-side)
```typescript
// Listen for gamepad state updates
socketService.on('gamepad:state', (state) => {
  // state.gamepadId, state.axes, state.buttons, state.timestamp
});
```

## Testing Strategy

1. **Unit Tests**
   - Input mapping (button and analog)
   - Translation layer routing
   - Vector calculation
   - Distance calculation with various speeds/accelerations
   - Deadzone and sensitivity application
   - Command format generation

2. **Integration Tests**
   - Full input flow: source → mapping → translation → handlers
   - Jog loop with mock socket
   - Jog cancel synchronization
   - Button action handling
   - Error handling
   - State transitions

3. **Manual Testing**
   - Test with real gamepad (browser and server-side)
   - Test browser jog controls
   - Verify latency feels responsive
   - Test jog cancel responsiveness
   - Test multi-axis simultaneous movement
   - Test button actions
   - Test at various speeds

## Configuration

The system uses existing joystick settings:
- `joystick.enabled` - Enable/disable jogging
- `joystick.connectionLocation` - 'server' or 'client'
- `joystick.selectedGamepad` - Which gamepad to use
- `joystick.buttonMappings` - Button ID → `CncAction` mapping
- `joystick.analogMappings` - Axis → `AnalogMapping` mapping
- `joystick.deadzone` - Deadzone threshold
- `joystick.sensitivity` - Sensitivity curve
- `joystick.invertX/Y/Z` - Axis inversion
- `joystick.analogJogSpeedXY` - Max XY jog speed (mm/min)
- `joystick.analogJogSpeedZ` - Max Z jog speed (mm/min)

## Safety Considerations

1. **State Checks**: Only jog when controller is in 'Idle' or 'Jog' state
2. **Emergency Stop**: Gamepad button can trigger emergency stop
3. **Soft Limits**: Grbl will reject jog commands that exceed machine travel
4. **Jog Cancel**: Always available via realtime command
5. **Connection Loss**: Stop jogging if connection lost
6. **Gamepad Disconnect**: Stop jogging if gamepad disconnected

## Future Enhancements

1. **Adaptive Timing**: Adjust `dt` based on actual machine response
2. **Inertial Feel**: Simulate momentum/decay for smoother feel
3. **Haptic Feedback**: Use gamepad rumble for tactile feedback
4. **Visual Feedback**: Show jog vector in 3D viewer
5. **Controller-Specific**: Optimize for Marlin, Smoothie, TinyG jogging
