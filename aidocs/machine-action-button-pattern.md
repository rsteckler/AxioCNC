# Machine Action Button Pattern

## Problem

We have many buttons throughout the UI that need to:
1. Be disabled based on machine state (connected, alarm, running, homed, etc.)
2. Flash the machine status when clicked while disabled
3. Wrap in a div with `onMouseDown` to handle disabled state clicks

This pattern was repeated dozens of times with slight variations, making the code:
- Hard to maintain
- Error-prone (easy to miss a condition)
- Verbose (lots of boilerplate)

## Solution

We've created a reusable pattern with two parts:

### 1. Utility Functions (`src/app/src/utils/machineState.ts`)

Provides type-safe utilities for checking machine state:

```typescript
import { canPerformAction, ActionRequirements } from '@/utils/machineState'

// Check if action is allowed
const canAct = canPerformAction(
  isConnected,
  connectedPort,
  machineStatus,
  isHomed,
  ActionRequirements.jog
)
```

**Preset Requirements:**
- `ActionRequirements.standard` - Requires connection, no alarm, no running
- `ActionRequirements.jog` - Same as standard (for jogging actions)
- `ActionRequirements.requiresHomed` - Requires connection AND homing
- `ActionRequirements.connectionOnly` - Only requires connection (e.g., connect button)
- `ActionRequirements.allowAlarm` - Allows alarm state (e.g., unlock button)

### 2. MachineActionButton Component (`src/app/src/components/MachineActionButton.tsx`)

A reusable button component that encapsulates the entire pattern:

```typescript
import { MachineActionButton } from '@/components/MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'

<MachineActionButton
  isConnected={isConnected}
  connectedPort={connectedPort}
  machineStatus={machineStatus}
  isHomed={isHomed}
  onFlashStatus={flashStatus}
  onAction={handleJog}
  requirements={ActionRequirements.jog}
  variant="secondary"
  size="sm"
>
  <ChevronUp className="w-5 h-5" />
</MachineActionButton>
```

## Migration Guide

### Before (Old Pattern)

```tsx
// Check if jogging is allowed
const canJog = isConnected && machineStatus !== 'alarm' && machineStatus !== 'running' && machineStatus !== 'not_connected'

// In JSX:
<div
  onMouseDown={(e) => {
    if (!canJog || !connectedPort) {
      e.preventDefault()
      e.stopPropagation()
      onFlashStatus()
      return false
    }
  }}
>
  <Button 
    variant="secondary" 
    className="aspect-square p-0"
    onClick={() => handleJog(0, 1, 0)}
    disabled={!canJog}
  >
    <ChevronUp className="w-5 h-5" />
  </Button>
</div>
```

### After (New Pattern)

```tsx
import { MachineActionButton } from '@/components/MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'

// In JSX:
<MachineActionButton
  isConnected={isConnected}
  connectedPort={connectedPort}
  machineStatus={machineStatus}
  isHomed={isHomed}
  onFlashStatus={onFlashStatus}
  onAction={() => handleJog(0, 1, 0)}
  requirements={ActionRequirements.jog}
  variant="secondary"
  className="aspect-square p-0"
>
  <ChevronUp className="w-5 h-5" />
</MachineActionButton>
```

## Benefits

1. **DRY**: No repeated boilerplate code
2. **Type-safe**: TypeScript ensures correct usage
3. **Consistent**: All buttons behave the same way
4. **Maintainable**: Change logic in one place
5. **Flexible**: Custom requirements when needed
6. **Less error-prone**: Can't forget to check a condition

## Custom Requirements

For actions with unique requirements:

```tsx
<MachineActionButton
  // ... standard props
  requirements={{
    requiresConnected: true,
    requiresPort: true,
    requiresHomed: true, // This action requires homing
    disallowAlarm: true,
    disallowRunning: true,
  }}
>
  Custom Action
</MachineActionButton>
```

## Non-Button Elements

For custom elements (like the analog joystick), use the utility function directly:

```tsx
import { canPerformAction, ActionRequirements } from '@/utils/machineState'

const canJog = canPerformAction(
  isConnected,
  connectedPort,
  machineStatus,
  isHomed,
  ActionRequirements.jog
)

<div
  onMouseDown={(e) => {
    if (!canJog) {
      e.preventDefault()
      e.stopPropagation()
      onFlashStatus()
      return
    }
    // Handle joystick movement
  }}
>
  {/* Joystick UI */}
</div>
```

## Migration Checklist

- [ ] Replace all button wrappers with `MachineActionButton`
- [ ] Remove manual `canJog`/`canAct` calculations
- [ ] Remove manual `onMouseDown` wrappers
- [ ] Use preset requirements where possible
- [ ] Document any custom requirements
