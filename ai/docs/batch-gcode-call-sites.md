# Batch G-code execution: call sites for runGcodeBatch

The primitive **runGcodeBatch** is implemented in `apps/web/src/utils/runGcodeBatch.ts`. A thin hook wrapper is available in `apps/web/src/hooks/useRunGcodeBatch.ts` (exported from `apps/web/src/hooks/index.ts`). Use this document when refactoring call sites or adding new “run G-code and wait for completion” flows.

---

## ZeroingWizardTab

| | |
|--|--|
| **File** | `apps/web/src/components/ZeroingWizardTab.tsx` |
| **Component** | ZeroingWizardTab |
| **Description** | Probe flows: bitsetter first-tool, bitsetter subsequent tool, bitzero, touch plate, custom G-code. Builds macro string and runs it, then sets probe status (capturing/complete/error). |
| **Current method** | `sendGcode(macro)`; listens to `feeder:status` + `serialport:read`; 5 min safety timeout. |
| **Target method** | Call `runGcodeBatch({ gcode: processedMacro, port })`, then set probe status (capturing/complete); handle errors via promise rejection. Remove or keep safety timeout only as last-resort with a clear comment. |

---

## BitZeroZBlock

| | |
|--|--|
| **File** | `apps/web/src/components/JobSetupWizard/blocks/BitZeroZBlock.tsx` |
| **Component** | BitZeroZBlock |
| **Description** | BitZero Z probe in Job Setup wizard: run Z probe macro, then call `onComplete` or `onError`. |
| **Current method** | `sendGcode(macroString)`; `feeder:status` listener → `onComplete()`. |
| **Target method** | `runGcodeBatch({ gcode: macroString, port }).then(onComplete).catch(onError)`. |

---

## BitZeroXYBlock

| | |
|--|--|
| **File** | `apps/web/src/components/JobSetupWizard/blocks/BitZeroXYBlock.tsx` |
| **Component** | BitZeroXYBlock |
| **Description** | BitZero XY probe in Job Setup wizard: run XY probe macro, then `onComplete` or `onError`. |
| **Current method** | Same as BitZeroZBlock: `sendGcode(macroString)`; `feeder:status` → `onComplete()`. |
| **Target method** | Same as BitZeroZBlock: `runGcodeBatch({ gcode: macroString, port }).then(onComplete).catch(onError)`. |

---

## TouchplateBlock

| | |
|--|--|
| **File** | `apps/web/src/components/JobSetupWizard/blocks/TouchplateBlock.tsx` |
| **Component** | TouchplateBlock |
| **Description** | Touchplate probe in Job Setup wizard: send multiple G-code commands, then complete. |
| **Current method** | Multiple `sendGcode(cmd)` with `setTimeout(..., index * 100)`; `feeder:status` for completion. |
| **Target method** | Single batch: `runGcodeBatch({ gcode: commands.join('\n'), port })` then `onComplete`. Eliminates staggered timeouts. |

---

## BitSetterBlock

| | |
|--|--|
| **File** | `apps/web/src/components/JobSetupWizard/blocks/BitSetterBlock.tsx` |
| **Component** | BitSetterBlock |
| **Description** | Bitsetter probe in Job Setup wizard: **Navigate** (move to probe XY), then **Probe** (run macro, read Z, store reference, retract). |
| **Current method** | **Navigate:** fixed delays only (`setTimeout` per command, then `setTimeout(..., commands.length * 300 + 500)` for phase); no feeder wait. **Probe:** macro + `feeder:status` for completion. |
| **Target method** | **Navigate:** `runGcodeBatch({ gcode: navigateCommands.join('\n'), port }).then(() => setPhase('idle')).catch(...)`. **Probe:** `runGcodeBatch({ gcode: macroString, port })` then storing/complete; on catch set phase error and `onError`. |

---

## FilePanel (outline)

| | |
|--|--|
| **File** | `apps/web/src/routes/Setup/panels/FilePanel.tsx` |
| **Component** | FilePanel |
| **Description** | Outline loaded G-code on the machine: send outline G-code, wait for motion to finish, then show “Outline Complete”. |
| **Current method** | `sendGcode(outlineGcode)`; machine status (running→idle) + feeder:status; estimated-time fallback timeout. |
| **Target method** | `runGcodeBatch({ gcode: outlineGcode, port, waitForIdle: true })`. In `.then()`: set isOutlining false, show “Outline Complete”. In `.catch()`: set isOutlining false, show error. Remove or minimize fallback timeout. |

---

## MacrosPanel

| | |
|--|--|
| **File** | `apps/web/src/routes/Setup/panels/MacrosPanel.tsx` |
| **Component** | MacrosPanel |
| **Description** | Run macro via `sendCommand('macro:run', id, context)`; show “Done” when feeder is empty. |
| **Current method** | After `sendCommand('macro:run', id, context)`, call `waitForFeederEmpty({ port: connectedPort })`. On resolve: `showInfoNotification(t('Macro complete'), t('Done'))`. On reject: `showErrorNotification(t('Macro error'), err?.message ?? ...)`. |
| **Implementation** | `waitForFeederEmpty(port, signal?)` lives in `apps/web/src/utils/runGcodeBatch.ts`; it only subscribes to feeder:status (and disconnect, serialport:read, abort) and resolves when queue === 0 && !pending && !hold. Does not send G-code (macro:run sends via backend). |

---

## SpindlePanel warmup (no change)

| | |
|--|--|
| **File** | `apps/web/src/routes/Setup/panels/SpindlePanel.tsx` |
| **Component** | SpindlePanel |
| **Description** | Spindle warmup: step through RPMs with time-based delays; runtime is deterministic (steps × warmupTimeSeconds). |
| **Current method** | Time-based: `setTimeout` per RPM step at `i * warmupTimeSeconds`; countdown from total seconds. |
| **Decision** | Left as-is. Runtime is calculated up front; no refactor to runGcodeBatch per step. |

---

## Other references (no change)

- **Setup/index.tsx** – `feeder:status` used for homing-related handling; homing uses `controller:homing` / `grbl:homing`. Do not change homing; ensure shared “wait for feeder” logic does not conflict.
- **useToolChangeDetection** (`apps/web/src/hooks/useToolChangeDetection.ts`) – Uses `feeder:status` for hold/holdReason (M6). Stays as-is; tool-change detection, not batch completion.
