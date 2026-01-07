# NextCNC Backend API Documentation

This document provides a complete reference for the NextCNC backend REST API. All endpoints require JWT authentication unless otherwise specified.

---

## Table of Contents

- [Authentication](#authentication)
- [Version](#version)
- [System Settings](#system-settings) *(Zod-validated)*
- [Extensions](#extensions) *(schemaless, for widgets/plugins)*
- [Tool Configuration](#tool-configuration)
- [G-code Operations](#g-code-operations)
- [Controllers](#controllers)
- [Commands](#commands)
- [Events](#events)
- [Machine Profiles](#machine-profiles)
- [Macros](#macros)
- [MDI (Manual Data Input)](#mdi-manual-data-input)
- [Users](#users)
- [File Watch](#file-watch)
- [Error Codes](#error-codes)

---

## Authentication

Authentication is handled via JSON Web Tokens (JWT). The token must be included in requests either via the `Authorization` header or as a `token` parameter in the request body/query.

### Sign In

Authenticates a user and returns a JWT access token.

**Endpoint:** `POST /api/signin`  
**Access:** Public (no authentication required)

#### Request Body

| Parameter  | Type   | Required | Description                                      |
|------------|--------|----------|--------------------------------------------------|
| `name`     | string | Yes*     | Username for authentication                      |
| `password` | string | Yes*     | User password                                    |
| `token`    | string | No       | Existing JWT token for session validation        |

*Required when not providing an existing token

#### Response

```json
{
  "enabled": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "name": "admin"
}
```

| Field     | Type    | Description                                           |
|-----------|---------|-------------------------------------------------------|
| `enabled` | boolean | Whether authentication sessions are enabled           |
| `token`   | string  | JWT access token for subsequent API calls             |
| `name`    | string  | The authenticated user's name                         |

#### Notes
- If no users are configured, the API returns `enabled: false` with a valid token
- Existing tokens can be validated by passing them in the `token` field

---

## Version

### Get Latest Version

Retrieves the latest available version information from the npm registry.

**Endpoint:** `GET /api/version/latest`  
**Access:** Authenticated

#### Response

```json
{
  "time": "2024-01-15T10:30:00.000Z",
  "name": "cncjs",
  "version": "1.10.0",
  "description": "A web-based interface for CNC milling controllers",
  "homepage": "https://github.com/cncjs/cncjs"
}
```

| Field         | Type   | Description                          |
|---------------|--------|--------------------------------------|
| `time`        | string | ISO timestamp of the latest release  |
| `name`        | string | Package name                         |
| `version`     | string | Latest version number                |
| `description` | string | Package description                  |
| `homepage`    | string | Project homepage URL                 |

---

## System Settings

The Settings API provides **validated system configuration** using Zod schemas. All settings are type-checked and unknown keys are rejected. This ensures data integrity for core application settings.

For widget/plugin data that needs flexibility, use the [Extensions API](#extensions) instead.

### Settings Schema

The system settings are organized into these categories:

| Category | Key | Description |
|----------|-----|-------------|
| General | `lang` | UI language code (default: `"en"`) |
| General | `checkForUpdates` | Check for app updates (default: `true`) |
| General | `allowAnonymousUsageDataCollection` | Send anonymous stats (default: `false`) |
| Controller | `controller.exception.ignoreErrors` | Continue on errors (default: `false`) |
| Machine | `machine.name` | Machine name (default: `"My CNC Machine"`) |
| Machine | `machine.limits` | Work envelope `{xmin, xmax, ymin, ymax, zmin, zmax}` |
| Connection | `connection.*` | Serial port settings (port, baudRate, etc.) |
| Camera | `camera.*` | Camera configuration |
| Tool Change | `toolChange.*` | Tool change policy and positions |
| Joystick | `joystick.*` | Gamepad configuration |

### Get Settings

Retrieves all system settings with defaults applied.

**Endpoint:** `GET /api/settings`  
**Access:** Authenticated

#### Response

```json
{
  "lang": "en",
  "checkForUpdates": true,
  "allowAnonymousUsageDataCollection": false,
  "controller": {
    "exception": {
      "ignoreErrors": false
    }
  },
  "machine": {
    "name": "My CNC Machine",
    "limits": {
      "xmin": 0, "xmax": 300,
      "ymin": 0, "ymax": 300,
      "zmin": -50, "zmax": 0
    }
  },
  "connection": {
    "port": "",
    "baudRate": 115200,
    "controllerType": "Grbl"
  },
  "camera": { ... },
  "toolChange": { ... },
  "joystick": { ... }
}
```

---

### Update Settings

Updates system settings. Supports partial updates — only send the fields you want to change.

**Endpoint:** `POST /api/settings`  
**Access:** Authenticated

#### Request Body

Partial settings object. Validates against Zod schema and rejects unknown keys.

#### Examples

Update language:
```json
{
  "lang": "de"
}
```

Update nested values:
```json
{
  "controller": {
    "exception": {
      "ignoreErrors": true
    }
  }
}
```

Update machine limits:
```json
{
  "machine": {
    "limits": {
      "xmax": 500,
      "ymax": 500
    }
  }
}
```

#### Response

```json
{
  "err": false
}
```

#### Errors
- `400 Bad Request` - Invalid settings or unknown keys

```json
{
  "msg": "Invalid settings",
  "errors": [
    { "path": "unknownKey", "message": "Unrecognized key" }
  ]
}
```

---

### Reset Settings

Resets all settings to defaults.

**Endpoint:** `DELETE /api/settings`  
**Access:** Authenticated

#### Response

```json
{
  "err": false,
  "settings": { /* default settings */ }
}
```

---

## Extensions

The Extensions API provides **schemaless storage** for widgets, plugins, and custom data. Unlike the Settings API, extensions accept any valid JSON without validation.

Use this for:
- Widget state and preferences
- Plugin configuration
- Third-party extension data
- Custom user data

### Get Extensions

Retrieves extension data.

**Endpoint:** `GET /api/extensions`  
**Access:** Authenticated

#### Query Parameters

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `key`     | string | No       | Dot-notation path to retrieve specific data |

#### Examples

```
GET /api/extensions                           # Get all extension data
GET /api/extensions?key=widgets.visualizer    # Get visualizer widget data
```

#### Response

```json
{
  "widgets": {
    "visualizer": {
      "showGrid": true,
      "cameraPosition": [0, 0, 100]
    },
    "console": {
      "fontSize": 14
    }
  },
  "plugins": {
    "custom-probe": { ... }
  }
}
```

#### Errors
- `404 Not Found` - The specified key does not exist

---

### Set Extensions

Stores extension data. Accepts any valid JSON.

**Endpoint:** `POST /api/extensions`  
**Access:** Authenticated

#### Query Parameters

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `key`     | string | No       | Dot-notation path to set specific data   |

#### Examples

Set widget data using key:
```
POST /api/extensions?key=widgets.visualizer
Body: { "showGrid": true, "cameraPosition": [0, 0, 100] }
```

Set multiple values:
```json
{
  "widgets": {
    "visualizer": { "showGrid": true }
  }
}
```

#### Response

```json
{
  "err": false
}
```

---

### Delete Extensions

Removes extension data by key.

**Endpoint:** `DELETE /api/extensions`  
**Access:** Authenticated

#### Query Parameters

| Parameter | Type   | Required | Description                           |
|-----------|--------|----------|---------------------------------------|
| `key`     | string | Yes      | Dot-notation path of data to delete   |

#### Response

```json
{
  "err": false
}
```

#### Errors
- `404 Not Found` - The specified key does not exist

---

## Tool Configuration

Manages tool change and probing configuration settings.

### Get Tool Configuration

Retrieves the current tool configuration.

**Endpoint:** `GET /api/tool`  
**Access:** Authenticated

#### Response

```json
{
  "toolChangePolicy": "Ignore",
  "toolChangeX": 0,
  "toolChangeY": 0,
  "toolChangeZ": 0,
  "toolProbeX": 0,
  "toolProbeY": 0,
  "toolProbeZ": 0,
  "toolProbeCustomCommands": "",
  "toolProbeCommand": "G38.2",
  "toolProbeDistance": 50,
  "toolProbeFeedrate": 100,
  "touchPlateHeight": 3.175
}
```

---

### Set Tool Configuration

Updates tool configuration settings.

**Endpoint:** `POST /api/tool`  
**Access:** Authenticated

#### Request Body

| Parameter               | Type   | Description                                         |
|-------------------------|--------|-----------------------------------------------------|
| `toolChangePolicy`      | string | Policy for handling tool changes                    |
| `toolChangeX`           | number | X position for tool change                          |
| `toolChangeY`           | number | Y position for tool change                          |
| `toolChangeZ`           | number | Z position for tool change                          |
| `toolProbeX`            | number | X position for tool probing                         |
| `toolProbeY`            | number | Y position for tool probing                         |
| `toolProbeZ`            | number | Z position for tool probing                         |
| `toolProbeCustomCommands` | string | Custom G-code commands for probing               |
| `toolProbeCommand`      | string | G-code command for probing (e.g., `G38.2`)          |
| `toolProbeDistance`     | number | Maximum probe travel distance (mm)                  |
| `toolProbeFeedrate`     | number | Probe feedrate (mm/min)                             |
| `touchPlateHeight`      | number | Height of the touch plate (mm)                      |

#### Response

```json
{
  "err": false
}
```

#### Errors
- `400 Bad Request` - Invalid keys specified

---

## G-code Operations

Manages G-code file upload, retrieval, and download for connected controllers.

### Upload G-code

Uploads G-code to a connected controller.

**Endpoint:** `POST /api/gcode`  
**Access:** Authenticated

#### Request Body

| Parameter  | Type   | Required | Description                                      |
|------------|--------|----------|--------------------------------------------------|
| `port`     | string | Yes      | Serial port of the connected controller          |
| `name`     | string | No       | Name/filename for the G-code                     |
| `gcode`    | string | Yes      | The G-code content to upload                     |
| `context`  | object | No       | Additional context data for macro evaluation     |

#### Response

Returns the controller's sender state after loading.

#### Errors
- `400 Bad Request` - No port specified, empty G-code, or controller not found
- `500 Internal Server Error` - Failed to load G-code

---

### Fetch G-code

Retrieves the currently loaded G-code from a controller.

**Endpoint:** `GET /api/gcode`  
**Access:** Authenticated

#### Query Parameters

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `port`    | string | Yes      | Serial port of the connected controller  |

#### Response

```json
{
  "name": "example.nc",
  "size": 1024,
  "total": 150,
  "sent": 0,
  "received": 0,
  "data": "G21\nG90\n..."
}
```

| Field      | Type   | Description                          |
|------------|--------|--------------------------------------|
| `name`     | string | Filename of the loaded G-code        |
| `size`     | number | Size of the G-code in bytes          |
| `total`    | number | Total number of lines                |
| `sent`     | number | Number of lines sent to controller   |
| `received` | number | Number of acknowledgments received   |
| `data`     | string | The G-code content                   |

---

### Download G-code

Downloads the currently loaded G-code as a file.

**Endpoint:** `GET /api/gcode/download`  
**Alias:** `POST /api/gcode/download`  
**Access:** Authenticated

#### Query/Body Parameters

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `port`    | string | Yes      | Serial port of the connected controller  |

#### Response

Returns the G-code file as a downloadable attachment.

---

## Controllers

### Get Controllers

Retrieves the status of all connected controllers.

**Endpoint:** `GET /api/controllers`  
**Access:** Authenticated

#### Response

```json
[
  {
    "port": "/dev/ttyUSB0",
    "type": "Grbl",
    "state": "Idle",
    "settings": { ... }
  }
]
```

Returns an array of controller status objects.

---

## Commands

System commands that can be executed on the server.

### List Commands

Retrieves all configured commands.

**Endpoint:** `GET /api/commands`  
**Access:** Authenticated

#### Query Parameters

| Parameter    | Type    | Required | Default | Description                    |
|--------------|---------|----------|---------|--------------------------------|
| `paging`     | boolean | No       | false   | Enable pagination              |
| `page`       | number  | No       | 1       | Page number (if paging)        |
| `pageLength` | number  | No       | 10      | Items per page (if paging)     |

#### Response

```json
{
  "pagination": {
    "page": 1,
    "pageLength": 10,
    "totalRecords": 5
  },
  "records": [
    {
      "id": "uuid-string",
      "mtime": 1704067200000,
      "enabled": true,
      "title": "Backup Config",
      "commands": "cp ~/.cncrc ~/.cncrc.backup"
    }
  ]
}
```

---

### Create Command

Creates a new system command.

**Endpoint:** `POST /api/commands`  
**Access:** Authenticated

#### Request Body

| Parameter  | Type    | Required | Default | Description                     |
|------------|---------|----------|---------|---------------------------------|
| `enabled`  | boolean | No       | true    | Whether the command is enabled  |
| `title`    | string  | Yes      | -       | Display title for the command   |
| `commands` | string  | Yes      | -       | Shell command(s) to execute     |

#### Response

```json
{
  "id": "uuid-string",
  "mtime": 1704067200000
}
```

#### Errors
- `400 Bad Request` - Missing title or commands

---

### Get Command

Retrieves a specific command by ID.

**Endpoint:** `GET /api/commands/:id`  
**Access:** Authenticated

#### URL Parameters

| Parameter | Type   | Description          |
|-----------|--------|----------------------|
| `id`      | string | The command UUID     |

#### Response

```json
{
  "id": "uuid-string",
  "mtime": 1704067200000,
  "enabled": true,
  "title": "Backup Config",
  "commands": "cp ~/.cncrc ~/.cncrc.backup"
}
```

---

### Update Command

Updates an existing command.

**Endpoint:** `PUT /api/commands/:id`  
**Access:** Authenticated

#### URL Parameters

| Parameter | Type   | Description          |
|-----------|--------|----------------------|
| `id`      | string | The command UUID     |

#### Request Body

| Parameter  | Type    | Required | Description                     |
|------------|---------|----------|---------------------------------|
| `enabled`  | boolean | No       | Whether the command is enabled  |
| `title`    | string  | No       | Display title for the command   |
| `commands` | string  | No       | Shell command(s) to execute     |

#### Response

```json
{
  "id": "uuid-string",
  "mtime": 1704067200000
}
```

---

### Delete Command

Deletes a command.

**Endpoint:** `DELETE /api/commands/:id`  
**Access:** Authenticated

#### Response

```json
{
  "id": "uuid-string"
}
```

---

### Run Command

Executes a command immediately.

**Endpoint:** `POST /api/commands/run/:id`  
**Access:** Authenticated

#### URL Parameters

| Parameter | Type   | Description          |
|-----------|--------|----------------------|
| `id`      | string | The command UUID     |

#### Response

```json
{
  "taskId": "task-uuid-string"
}
```

| Field    | Type   | Description                          |
|----------|--------|--------------------------------------|
| `taskId` | string | ID of the spawned task for tracking  |

---

## Events

Event triggers that execute commands based on system events.

### List Events

Retrieves all configured events.

**Endpoint:** `GET /api/events`  
**Access:** Authenticated

#### Query Parameters

| Parameter    | Type    | Required | Default | Description                    |
|--------------|---------|----------|---------|--------------------------------|
| `paging`     | boolean | No       | false   | Enable pagination              |
| `page`       | number  | No       | 1       | Page number (if paging)        |
| `pageLength` | number  | No       | 10      | Items per page (if paging)     |

#### Response

```json
{
  "records": [
    {
      "id": "uuid-string",
      "mtime": 1704067200000,
      "enabled": true,
      "event": "gcode:load",
      "trigger": "system",
      "commands": "echo 'G-code loaded'"
    }
  ]
}
```

---

### Create Event

Creates a new event trigger.

**Endpoint:** `POST /api/events`  
**Access:** Authenticated

#### Request Body

| Parameter  | Type    | Required | Default | Description                       |
|------------|---------|----------|---------|-----------------------------------|
| `enabled`  | boolean | No       | true    | Whether the event is enabled      |
| `event`    | string  | Yes      | -       | Event name to listen for          |
| `trigger`  | string  | Yes      | -       | Trigger type                      |
| `commands` | string  | Yes      | -       | Shell command(s) to execute       |

#### Response

```json
{
  "id": "uuid-string",
  "mtime": 1704067200000
}
```

---

### Get Event

Retrieves a specific event by ID.

**Endpoint:** `GET /api/events/:id`  
**Access:** Authenticated

---

### Update Event

Updates an existing event.

**Endpoint:** `PUT /api/events/:id`  
**Access:** Authenticated

#### Request Body

| Parameter  | Type    | Required | Description                       |
|------------|---------|----------|-----------------------------------|
| `enabled`  | boolean | No       | Whether the event is enabled      |
| `event`    | string  | No       | Event name to listen for          |
| `trigger`  | string  | No       | Trigger type                      |
| `commands` | string  | No       | Shell command(s) to execute       |

---

### Delete Event

Deletes an event.

**Endpoint:** `DELETE /api/events/:id`  
**Access:** Authenticated

---

## Machine Profiles

Machine profile definitions with work envelope limits.

### List Machine Profiles

Retrieves all configured machine profiles.

**Endpoint:** `GET /api/machines`  
**Access:** Authenticated

#### Query Parameters

| Parameter    | Type    | Required | Default | Description                    |
|--------------|---------|----------|---------|--------------------------------|
| `paging`     | boolean | No       | false   | Enable pagination              |
| `page`       | number  | No       | 1       | Page number (if paging)        |
| `pageLength` | number  | No       | 10      | Items per page (if paging)     |

#### Response

```json
{
  "records": [
    {
      "id": "uuid-string",
      "name": "Shapeoko 3",
      "limits": {
        "xmin": 0,
        "xmax": 400,
        "ymin": 0,
        "ymax": 400,
        "zmin": -75,
        "zmax": 0
      }
    }
  ]
}
```

---

### Create Machine Profile

Creates a new machine profile.

**Endpoint:** `POST /api/machines`  
**Access:** Authenticated

#### Request Body

| Parameter     | Type   | Required | Description                              |
|---------------|--------|----------|------------------------------------------|
| `name`        | string | Yes      | Display name for the machine profile     |
| `limits`      | object | No       | Work envelope limits                     |
| `limits.xmin` | number | No       | Minimum X coordinate (default: 0)        |
| `limits.xmax` | number | No       | Maximum X coordinate (default: 0)        |
| `limits.ymin` | number | No       | Minimum Y coordinate (default: 0)        |
| `limits.ymax` | number | No       | Maximum Y coordinate (default: 0)        |
| `limits.zmin` | number | No       | Minimum Z coordinate (default: 0)        |
| `limits.zmax` | number | No       | Maximum Z coordinate (default: 0)        |

#### Response

```json
{
  "id": "uuid-string"
}
```

---

### Get Machine Profile

Retrieves a specific machine profile by ID.

**Endpoint:** `GET /api/machines/:id`  
**Access:** Authenticated

---

### Update Machine Profile

Updates an existing machine profile.

**Endpoint:** `PUT /api/machines/:id`  
**Access:** Authenticated

#### Request Body

| Parameter     | Type   | Required | Description                        |
|---------------|--------|----------|------------------------------------|
| `name`        | string | No       | Display name for the machine       |
| `limits.xmin` | number | No       | Minimum X coordinate               |
| `limits.xmax` | number | No       | Maximum X coordinate               |
| `limits.ymin` | number | No       | Minimum Y coordinate               |
| `limits.ymax` | number | No       | Maximum Y coordinate               |
| `limits.zmin` | number | No       | Minimum Z coordinate               |
| `limits.zmax` | number | No       | Maximum Z coordinate               |

---

### Delete Machine Profile

Deletes a machine profile.

**Endpoint:** `DELETE /api/machines/:id`  
**Access:** Authenticated

---

## Macros

G-code macros that can be executed on the CNC controller.

### List Macros

Retrieves all configured macros.

**Endpoint:** `GET /api/macros`  
**Access:** Authenticated

#### Query Parameters

| Parameter    | Type    | Required | Default | Description                    |
|--------------|---------|----------|---------|--------------------------------|
| `paging`     | boolean | No       | false   | Enable pagination              |
| `page`       | number  | No       | 1       | Page number (if paging)        |
| `pageLength` | number  | No       | 10      | Items per page (if paging)     |

#### Response

```json
{
  "records": [
    {
      "id": "uuid-string",
      "mtime": 1704067200000,
      "name": "Home All Axes",
      "content": "$H"
    }
  ]
}
```

---

### Create Macro

Creates a new macro.

**Endpoint:** `POST /api/macros`  
**Access:** Authenticated

#### Request Body

| Parameter | Type   | Required | Description                        |
|-----------|--------|----------|------------------------------------|
| `name`    | string | Yes      | Display name for the macro         |
| `content` | string | Yes      | G-code content of the macro        |

#### Response

```json
{
  "err": null
}
```

---

### Get Macro

Retrieves a specific macro by ID.

**Endpoint:** `GET /api/macros/:id`  
**Access:** Authenticated

#### Response

```json
{
  "id": "uuid-string",
  "mtime": 1704067200000,
  "name": "Home All Axes",
  "content": "$H"
}
```

---

### Update Macro

Updates an existing macro.

**Endpoint:** `PUT /api/macros/:id`  
**Access:** Authenticated

#### Request Body

| Parameter | Type   | Required | Description                        |
|-----------|--------|----------|------------------------------------|
| `name`    | string | No       | Display name for the macro         |
| `content` | string | No       | G-code content of the macro        |

---

### Delete Macro

Deletes a macro.

**Endpoint:** `DELETE /api/macros/:id`  
**Access:** Authenticated

---

## MDI (Manual Data Input)

MDI commands are quick-access G-code commands that can be arranged in a grid layout.

### List MDI Commands

Retrieves all configured MDI commands.

**Endpoint:** `GET /api/mdi`  
**Access:** Authenticated

#### Query Parameters

| Parameter    | Type    | Required | Default | Description                    |
|--------------|---------|----------|---------|--------------------------------|
| `paging`     | boolean | No       | false   | Enable pagination              |
| `page`       | number  | No       | 1       | Page number (if paging)        |
| `pageLength` | number  | No       | 10      | Items per page (if paging)     |

#### Response

```json
{
  "records": [
    {
      "id": "uuid-string",
      "name": "Zero X",
      "command": "G10 L20 P1 X0",
      "grid": {
        "xs": 6,
        "sm": 4,
        "md": 3,
        "lg": 2,
        "xl": 1
      }
    }
  ]
}
```

| Field   | Type   | Description                                    |
|---------|--------|------------------------------------------------|
| `id`    | string | Unique identifier                              |
| `name`  | string | Button display name                            |
| `command` | string | G-code command to execute                    |
| `grid`  | object | Responsive grid sizing (Bootstrap breakpoints) |

---

### Create MDI Command

Creates a new MDI command.

**Endpoint:** `POST /api/mdi`  
**Access:** Authenticated

#### Request Body

| Parameter | Type   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| `name`    | string | Yes      | Button display name                    |
| `command` | string | Yes      | G-code command to execute              |
| `grid`    | object | No       | Responsive grid sizing configuration   |

---

### Get MDI Command

Retrieves a specific MDI command by ID.

**Endpoint:** `GET /api/mdi/:id`  
**Access:** Authenticated

---

### Update MDI Command

Updates an existing MDI command.

**Endpoint:** `PUT /api/mdi/:id`  
**Access:** Authenticated

#### Request Body

| Parameter | Type   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| `name`    | string | No       | Button display name                    |
| `command` | string | No       | G-code command to execute              |
| `grid`    | object | No       | Responsive grid sizing configuration   |

---

### Bulk Update MDI Commands

Replaces all MDI commands with a new set.

**Endpoint:** `PUT /api/mdi`  
**Access:** Authenticated

#### Request Body

| Parameter | Type  | Required | Description                    |
|-----------|-------|----------|--------------------------------|
| `records` | array | Yes      | Array of MDI command objects   |

Each record in the array:

| Parameter | Type   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| `id`      | string | No       | UUID (auto-generated if not provided)  |
| `name`    | string | No       | Button display name                    |
| `command` | string | No       | G-code command to execute              |
| `grid`    | object | No       | Responsive grid sizing configuration   |

---

### Delete MDI Command

Deletes an MDI command.

**Endpoint:** `DELETE /api/mdi/:id`  
**Access:** Authenticated

---

## Users

User management for authentication.

### List Users

Retrieves all configured users.

**Endpoint:** `GET /api/users`  
**Access:** Authenticated

#### Query Parameters

| Parameter    | Type    | Required | Default | Description                    |
|--------------|---------|----------|---------|--------------------------------|
| `paging`     | boolean | No       | false   | Enable pagination              |
| `page`       | number  | No       | 1       | Page number (if paging)        |
| `pageLength` | number  | No       | 10      | Items per page (if paging)     |

#### Response

```json
{
  "records": [
    {
      "id": "uuid-string",
      "mtime": 1704067200000,
      "enabled": true,
      "name": "admin"
    }
  ]
}
```

> **Note:** Password hashes are never returned in API responses.

---

### Create User

Creates a new user.

**Endpoint:** `POST /api/users`  
**Access:** Authenticated

#### Request Body

| Parameter  | Type    | Required | Default | Description                     |
|------------|---------|----------|---------|---------------------------------|
| `enabled`  | boolean | No       | true    | Whether the user account is active |
| `name`     | string  | Yes      | -       | Username (must be unique)       |
| `password` | string  | Yes      | -       | User password                   |

#### Response

```json
{
  "id": "uuid-string",
  "mtime": 1704067200000
}
```

#### Errors
- `400 Bad Request` - Missing name or password
- `409 Conflict` - Username already exists

---

### Get User

Retrieves a specific user by ID.

**Endpoint:** `GET /api/users/:id`  
**Access:** Authenticated

#### Response

```json
{
  "id": "uuid-string",
  "mtime": 1704067200000,
  "enabled": true,
  "name": "admin"
}
```

---

### Update User

Updates an existing user.

**Endpoint:** `PUT /api/users/:id`  
**Access:** Authenticated

#### Request Body

| Parameter     | Type    | Required | Description                              |
|---------------|---------|----------|------------------------------------------|
| `enabled`     | boolean | No       | Whether the user account is active       |
| `name`        | string  | No       | Username (must be unique)                |
| `oldPassword` | string  | No*      | Current password (required for password change) |
| `newPassword` | string  | No*      | New password                             |

*Both `oldPassword` and `newPassword` are required together to change password

#### Response

```json
{
  "id": "uuid-string",
  "mtime": 1704067200000
}
```

#### Errors
- `409 Conflict` - Username already exists
- `412 Precondition Failed` - Incorrect old password

---

### Delete User

Deletes a user.

**Endpoint:** `DELETE /api/users/:id`  
**Access:** Authenticated

#### Response

```json
{
  "id": "uuid-string"
}
```

---

## File Watch

Monitors and accesses files in the configured watch directory.

### List Files

Lists files in the watch directory.

**Endpoint:** `GET /api/watch/files`  
**Alias:** `POST /api/watch/files`  
**Access:** Authenticated

#### Query/Body Parameters

| Parameter | Type   | Required | Default | Description                           |
|-----------|--------|----------|---------|---------------------------------------|
| `path`    | string | No       | ""      | Subdirectory path within watch folder |

#### Response

```json
{
  "path": "projects",
  "files": [
    {
      "name": "part.nc",
      "type": "f",
      "size": 2048,
      "mtime": 1704067200000
    },
    {
      "name": "toolpaths",
      "type": "d"
    }
  ]
}
```

| Field  | Type   | Description                            |
|--------|--------|----------------------------------------|
| `name` | string | File or directory name                 |
| `type` | string | `"f"` for file, `"d"` for directory    |
| `size` | number | File size in bytes (files only)        |
| `mtime`| number | Last modified timestamp (files only)   |

---

### Read File

Reads the contents of a file from the watch directory.

**Endpoint:** `GET /api/watch/file`  
**Alias:** `POST /api/watch/file`  
**Access:** Authenticated

#### Query/Body Parameters

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `file`    | string | Yes      | File path relative to the watch directory |

#### Response

```json
{
  "file": "projects/part.nc",
  "data": "G21\nG90\nG0 X0 Y0\n..."
}
```

#### Errors
- `404 Not Found` - File does not exist
- `500 Internal Server Error` - Failed to read file

---

## Error Codes

The API uses standard HTTP status codes:

| Code | Name                   | Description                                      |
|------|------------------------|--------------------------------------------------|
| 400  | Bad Request            | Invalid parameters or missing required fields    |
| 401  | Unauthorized           | Authentication failed or token invalid           |
| 403  | Forbidden              | Access denied (IP restriction or invalid token)  |
| 404  | Not Found              | Resource does not exist                          |
| 409  | Conflict               | Resource already exists (e.g., duplicate name)   |
| 412  | Precondition Failed    | Validation failed (e.g., incorrect password)     |
| 500  | Internal Server Error  | Server-side error                                |

### Error Response Format

```json
{
  "msg": "Human-readable error message"
}
```

---

## Pagination

Endpoints that support pagination accept these common parameters:

| Parameter    | Type    | Default | Description                    |
|--------------|---------|---------|--------------------------------|
| `paging`     | boolean | false   | Enable pagination              |
| `page`       | number  | 1       | Page number (1-indexed)        |
| `pageLength` | number  | 10      | Number of items per page       |

### Paginated Response Format

```json
{
  "pagination": {
    "page": 1,
    "pageLength": 10,
    "totalRecords": 45
  },
  "records": [ ... ]
}
```

---

## Common Fields

Many resource types share common fields:

| Field   | Type   | Description                                      |
|---------|--------|--------------------------------------------------|
| `id`    | string | UUID v4 identifier (auto-generated on creation)  |
| `mtime` | number | Last modification timestamp (Unix ms)            |
| `enabled` | boolean | Whether the resource is active                 |

