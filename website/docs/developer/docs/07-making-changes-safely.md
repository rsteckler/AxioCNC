---
id: 07-making-changes-safely
sidebar_position: 7
title: Making Changes Safely
---

# Making Changes Safely

Security considerations and protected code boundaries.

## Security Considerations

### Input Validation

**Server-side:**
- Validate all user input before processing
- Use Zod schemas for API request/response validation (`packages/shared/src/schemas/`)
- Sanitize file paths (avoid path traversal)
- Validate G-code before sending to machine

**Frontend:**
- Validate user input before submitting
- Don't trust client-side validation alone
- Use TypeScript for type safety

### Authentication / Authorization

**Current setup:**
- **Express:** JWT-based authentication (`express-jwt`)
- **Socket.IO:** JWT validation (`socketio-jwt`)
- **Session:** File-based sessions (`session-file-store`)
- **Config:** Secret key in `~/.axiocnc/config.json`

**Guidelines:**
- Don't expose sensitive data in API responses
- Validate tokens on every protected request
- Use HTTPS in production

:::caution Placeholder
**Placeholder:** Full authn/authz documentation needs to be written. See `apps/server/src/` for access control middleware.
:::

### Secrets Management

**Do NOT:**
- Commit API keys, passwords, or tokens to git
- Hardcode secrets in source code
- Log sensitive data (passwords, tokens)
- Expose secrets in error messages

**Do:**
- Store secrets in `~/.axiocnc/config.json` (user-specific)
- Use environment variables for CI/CD secrets
- Rotate secrets if exposed

**Config file:** `~/.axiocnc/config.json` contains:
- Session secret
- JWT secret
- Other runtime configuration

**CI/CD:** Secrets stored in GitHub Actions secrets (see [CI/CD](./10-ci-cd.md#secrets-management)).

## Protected Code

### What Is Protected?

**Status:** PROTECTED — Extra care required when modifying.

These are **safety-critical** G-code sender components. Bugs can cause:
- Machine crashes (uncontrolled movement)
- Tool breakage
- Workpiece damage
- Personal injury

### Protected Directories

```
apps/server/src/controllers/     # ALL contents
apps/server/src/lib/             # Specific files (see below)
```

### Protected Files in `apps/server/src/lib/`

| File | Purpose |
|------|---------|
| `Sender.js` | G-code streaming engine (send-response & character-counting protocols) |
| `Feeder.js` | Real-time command queue for jog and manual commands |
| `Workflow.js` | Workflow state machine (idle/running/paused/stopped) |
| `SerialConnection.js` | Serial port communication layer |
| `EventTrigger.js` | Event trigger system for automated responses |
| `MessageSlot.js` | M0/M1 pause handling |

### Protected Controller Implementations

```
apps/server/src/controllers/
├── Grbl/           # Grbl controller (GrblController.js, parsers)
├── Marlin/         # Marlin firmware controller
├── Smoothie/       # Smoothieware controller
├── TinyG/          # TinyG/g2core controller
├── utils/          # Shared G-code utilities
├── constants.js    # Shared constants
└── index.js        # Controller exports
```

### Why These Are Protected

The G-code sender system is responsible for:
1. **Real-time machine communication** — Timing-sensitive serial protocol handling
2. **Buffer management** — Character-counting and send-response streaming protocols
3. **Safety interlocks** — Hold/unhold, pause/resume, emergency stop handling
4. **Tool change handling** — M6 command processing with various policies
5. **Error recovery** — Alarm and error state management

### Safe Boundaries (OK to Modify)

| Path | Description |
|------|-------------|
| `apps/server/src/api/` | REST API handlers — translate HTTP to controller commands |
| `apps/server/src/services/` | CNCEngine, ConfigStore, Monitor, TaskRunner, etc. |
| `apps/web/src/` | Frontend — all of it |
| `packages/shared/src/` | Shared schemas and utilities |

### Modifying Protected Code

If you need to modify protected code, take extra care:

1. **State clearly** what you want to change and **why**
2. **Review existing code** thoroughly to understand safety-critical paths
3. **Make minimal, focused changes**
4. **Explain the change thoroughly** in your PR
5. **Add tests** for any new behavior
6. **Test extensively** before submitting — these changes affect real machines

### Testing Protected Code

**You may add tests** for protected code without modifying it:

- Test behavior, not implementation
- Use mocks for serial ports and hardware
- Focus on error handling and edge cases
- Do NOT change the source code

See [Testing Strategy](./06-testing-strategy.md#testing-protected-code).

## Next Steps

- **[Contributing](./08-contributing.md)** — PR process and guidelines
- **[Code Standards](./05-code-standards.md)** — Coding conventions
