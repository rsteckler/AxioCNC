# CNCjs Frontend Feature Inventory

This document catalogs all features in the legacy frontend (`src/app-legacy`) to track parity during the new frontend build.

---

## Widgets

### Core Widgets

| Widget | Status | Description |
|--------|--------|-------------|
| `connection` | [ ] | Serial port selection, baud rate, controller type (Grbl/Marlin/Smoothie/TinyG), connect/disconnect, auto-reconnect |
| `console` | [ ] | Serial terminal - send commands, view responses, command history |
| `visualizer` | [ ] | 3D G-code toolpath visualization (three.js), camera controls (pan/rotate), orthographic/perspective projection |
| `axes` | [ ] | 6-axis DRO, jog controls, homing, work coordinate systems (G54-G59), zero setting |
| `gcode` | [ ] | G-code file info, line-by-line view, progress display |
| `macro` | [ ] | User-defined macros, create/edit/delete/run macros |
| `probe` | [ ] | Z-probe wizard, touch plate configuration, probe commands (G38.2) |
| `spindle` | [ ] | Spindle on/off, speed control (RPM) |
| `laser` | [ ] | Laser test fire, power control, duration settings |
| `tool` | [ ] | Tool change support, tool length offset (TLO) |
| `webcam` | [ ] | Camera feed (local device or MJPEG stream), crosshair overlay, rotation/flip |
| `custom` | [ ] | Embed external URL in iframe widget |

### Controller-Specific Widgets

| Widget | Status | Description |
|--------|--------|-------------|
| `grbl` | [ ] | Grbl status reports, queue reports, modal groups, settings |
| `marlin` | [ ] | Marlin status, heater control (extruder/bed temperature) |
| `smoothie` | [ ] | Smoothie status reports, modal groups |
| `tinyg` | [ ] | TinyG/g2core status, power management, queue reports |

---

## Pages / Containers

### Workspace
- [ ] Main workspace layout with resizable widget panels
- [ ] Primary sidebar (left) - collapsible
- [ ] Secondary sidebar (right) - collapsible
- [ ] Drag-and-drop file upload
- [ ] Widget arrangement persistence

### Login
- [ ] Token-based authentication
- [ ] Username/password login
- [ ] Session management

### Settings
- [ ] **General** - Language selection, check for updates
- [ ] **Workspace** - Widget configuration, layout reset
- [ ] **Machine Profiles** - Create/edit/delete machine profiles
- [ ] **User Accounts** - Multi-user management (create/edit/delete users)
- [ ] **Controller** - Controller-specific settings, exception handling
- [ ] **Commands** - Custom shell commands (e.g., update, reboot)
- [ ] **Events** - Event triggers (startup, port open/close, G-code events)
- [ ] **About** - Version info, licenses

### Header
- [ ] Quick access toolbar (feedhold, cyclestart, homing, unlock, reset)
- [ ] Connection status indicator
- [ ] Settings navigation
- [ ] User menu

### Sidebar
- [ ] Navigation between workspace and settings

---

## G-code Workflow

- [ ] **Upload** - File picker, drag-and-drop, watch directory
- [ ] **Load** - Parse and validate G-code
- [ ] **Visualize** - 3D toolpath rendering
- [ ] **Run** - Start job execution
- [ ] **Pause** - Pause/feedhold job
- [ ] **Resume** - Resume from pause
- [ ] **Stop** - Abort job with confirmation
- [ ] **Progress** - Line count, percentage, elapsed time

---

## Axes / DRO Features

- [ ] Machine position display (MPos)
- [ ] Work position display (WPos)
- [ ] 6-axis support (X, Y, Z, A, B, C)
- [ ] Jog controls (X/Y/Z buttons, distance presets)
- [ ] Jog distance selection (imperial/metric steps)
- [ ] Keyboard jog (arrow keys with modifiers)
- [ ] Shuttle/pendant support (ShuttleXpress)
- [ ] Home all / home individual axes
- [ ] Go to zero (work position)
- [ ] Set zero (current position as work origin)
- [ ] Go to position (MDI)
- [ ] Coordinate system selection (G54-G59)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `!` | Feed hold |
| `~` | Cycle start |
| `Ctrl+Alt+Cmd+H` | Homing |
| `Ctrl+Alt+Cmd+U` | Unlock |
| `Ctrl+Alt+Cmd+R` | Reset |
| `Ctrl+Alt+Cmd+-/+` | Jog distance selection |
| `Ctrl+Alt+Cmd+Arrows` | Jog X/Y axes |
| `Ctrl+Alt+Cmd+PgUp/PgDn` | Jog Z axis |
| `Ctrl+Alt+Cmd+[/]` | Jog forward/backward |
| `Shift` modifier | 10x overshoot |
| `Alt` modifier | 0.1x undershoot |

---

## API Endpoints Used

### Authentication
- `POST /api/signin` - Login with token or credentials

### State
- `GET /api/state` - Get app state
- `POST /api/state` - Set app state
- `DELETE /api/state` - Unset state key

### G-code
- `POST /api/gcode` - Upload/load G-code
- `GET /api/gcode` - Fetch loaded G-code
- `POST /api/gcode/download` - Download G-code file

### Controllers
- `GET /api/controllers` - List active controllers

### Version
- `GET /api/version/latest` - Check for updates

### Tool Config
- `GET /api/tool` - Get tool configuration
- `POST /api/tool` - Set tool configuration

### Watch Directory
- `POST /api/watch/files` - List files in watch directory
- `POST /api/watch/file` - Read file from watch directory

### CRUD Resources
- **Users**: `GET/POST/PUT/DELETE /api/users/:id`
- **Macros**: `GET/POST/PUT/DELETE /api/macros/:id`
- **Commands**: `GET/POST/PUT/DELETE /api/commands/:id`, `POST /api/commands/run/:id`
- **Events**: `GET/POST/PUT/DELETE /api/events/:id`
- **MDI**: `GET/POST/PUT/DELETE /api/mdi/:id`, `PUT /api/mdi` (bulk)
- **Machines**: `GET/POST/PUT/DELETE /api/machines/:id`

---

## Socket.IO Events

### Emitted by Client (via cncjs-controller)
- `open` - Open serial port connection
- `close` - Close serial port connection
- `command` - Send command to controller (gcode, gcode:load, gcode:start, gcode:pause, gcode:resume, gcode:stop, feedhold, cyclestart, homing, unlock, reset, etc.)
- `write` - Write raw data to serial port

### Received by Client
- `serialport:open` - Port opened
- `serialport:close` - Port closed
- `serialport:read` - Data received from serial
- `serialport:write` - Data sent to serial
- `serialport:error` - Serial port error
- `gcode:load` - G-code loaded
- `gcode:unload` - G-code unloaded
- `sender:status` - Sender state (hold, sent, received, total, etc.)
- `workflow:state` - Workflow state changes (idle, running, paused)
- `controller:settings` - Controller settings
- `controller:state` - Controller state (position, status, modal groups)
- `feeder:status` - Feeder state
- `config:change` - Configuration changed
- `task:start` - Background task started
- `task:finish` - Background task completed
- `task:error` - Background task error

---

## Internationalization (i18n)

Supported languages:
- English (en)
- Czech (cs)
- German (de)
- Spanish (es)
- French (fr)
- Hungarian (hu)
- Italian (it)
- Japanese (ja)
- Norwegian Bokmål (nb)
- Dutch (nl)
- Portuguese (pt)
- Portuguese - Brazil (pt-br)
- Russian (ru)
- Turkish (tr)
- Ukrainian (uk)
- Chinese Simplified (zh-cn)
- Chinese Traditional (zh-tw)

---

## Visualizer Features

- [ ] Three.js WebGL rendering
- [ ] G-code toolpath display
- [ ] Cutting tool visualization
- [ ] Work coordinate system grid
- [ ] Grid line numbers
- [ ] Machine limits visualization
- [ ] Camera modes (pan, rotate)
- [ ] Projection modes (orthographic, perspective)
- [ ] Zoom to fit
- [ ] Animation during job execution
- [ ] Progress highlighting (completed vs pending lines)

---

## Notifications

- [ ] M0 Program Pause
- [ ] M1 Optional Program Pause
- [ ] M2 Program End
- [ ] M30 Program End
- [ ] M6 Tool Change
- [ ] M109 Set Extruder Temperature (Marlin)
- [ ] M190 Set Heated Bed Temperature (Marlin)
- [ ] Program Error alerts
- [ ] Desktop push notifications

---

## Responsive Design

- [ ] Responsive layout for small screens (< 720px width)
- [ ] Mobile-friendly touch controls

---

## Miscellaneous

- [ ] Widget minimize/maximize
- [ ] Widget configuration persistence (localStorage)
- [ ] Dark theme (partial - via Stylus variables)
- [ ] Connection auto-reconnect
- [ ] Units toggle (imperial/metric)
- [ ] Expression evaluation in G-code (variables)

