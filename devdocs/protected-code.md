# Protected Code Areas

This document defines code areas that require **explicit permission** before modification. These are critical, safety-sensitive components where unintended changes could cause equipment damage or unsafe CNC operation.

---

## 🛑 G-code Sender & Controller System

**Status:** PROTECTED — Do not modify without explicit user permission

### Protected Directories

```
src/server/controllers/     # ALL contents
src/server/lib/             # Core streaming components (see specific files below)
```

### Protected Files in `src/server/lib/`

| File | Purpose |
|------|---------|
| `Sender.js` | G-code streaming engine with send-response & character-counting protocols |
| `Feeder.js` | Real-time command queue for jog and manual commands |
| `Workflow.js` | Workflow state machine (idle/running/paused) |
| `SerialConnection.js` | Serial port communication layer |
| `EventTrigger.js` | Event trigger system for automated responses |
| `MessageSlot.js` | Message slot handling for M0/M1 pause commands |

### Protected Controller Implementations

```
src/server/controllers/
├── Grbl/           # GRBL controller (GrblController.js, GrblRunner.js, parsers)
├── Marlin/         # Marlin firmware controller
├── Smoothie/       # Smoothieware controller
├── TinyG/          # TinyG/g2core controller
├── utils/          # Shared G-code utilities
├── constants.js    # Shared constants
└── index.js        # Controller exports
```

---

## Why These Are Protected

The G-code sender system is responsible for:

1. **Real-time machine communication** — Timing-sensitive serial protocol handling
2. **Buffer management** — Character-counting and send-response streaming protocols
3. **Safety interlocks** — Hold/unhold, pause/resume, emergency stop handling
4. **Tool change handling** — M6 command processing with various policies
5. **Error recovery** — Alarm and error state management

Bugs in this code can cause:
- Machine crashes (uncontrolled movement)
- Tool breakage
- Workpiece damage
- Personal injury

---

## Safe Boundary (OK to modify)

The following areas interact with the sender but are safe to modify:

| Path | Description |
|------|-------------|
| `src/server/api/` | REST API handlers — translates HTTP to controller commands |
| `src/server/services/cncengine/` | Socket.IO bridge — routes frontend commands to controllers |
| `src/server/services/configstore/` | Configuration persistence |
| `src/server/services/monitor/` | File system monitoring |
| `src/server/services/taskrunner/` | System command execution |

---

## Requesting Permission

If you need to modify protected code, please:

1. Clearly state **what** you want to change and **why**
2. Wait for explicit approval before proceeding
3. Make minimal, focused changes
4. Explain the change thoroughly when implementing

---

## Agent Instructions

```
⚠️ PROTECTED CODE POLICY

Before modifying ANY file in these paths:
  - src/server/controllers/**
  - src/server/lib/Sender.js
  - src/server/lib/Feeder.js
  - src/server/lib/Workflow.js
  - src/server/lib/SerialConnection.js
  - src/server/lib/EventTrigger.js
  - src/server/lib/MessageSlot.js

You MUST:
1. Stop and inform the user that this is protected code
2. Explain what change you believe is needed
3. Wait for explicit permission before proceeding
4. Do NOT make changes "while you're in there" or for cleanup/refactoring

This applies to ALL agents and ALL contexts. No exceptions.
```

