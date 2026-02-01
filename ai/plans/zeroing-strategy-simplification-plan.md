---
name: Zeroing strategy simplification
overview: Simplify zeroing and tool-changing by separating hardware (capabilities) from three user decisions—Work XY zero, Work Z zero, Tool changes during job—and introducing a pre-job Setup Wizard that shows a derived plan (including the implicit BitSetter "establish tool reference" step) before running steps.
todos: []
isProject: false
---

## Progress

| Phase | Status | Notes |
| ----- | ------ | ----- |
| 1 Schema and defaults | ✅ Done | See Phase 1 implementation notes below. |
| 2 Touch plate per-axis + BitZero composable | ✅ Done | See Phase 2 implementation notes below. |
| 3 Settings UI — Default setup behavior | ✅ Done | See Phase 3 implementation notes below. |
| 4 Plan derivation + Set up job wizard | ✅ Done | See Phase 4 implementation notes below. |
| 5 Setup page entry point | ✅ Done | New "Job setup" panel above Probe; "Set up job" opens JobSetupWizard. Run (Play) opens wizard with pending job start; on completion, job starts. ProbePanel has Quick actions line. |
| 6 Mid-job tool change policy | ✅ Done | useToolChangeDetection uses toolChangePolicy; ToolChangeTab uses blocks + ToolChangeMethodSelectDialog (cards) for "ask". |
| 7 Docs and i18n | Not started | |

# Zeroing Strategy Simplification Plan

## Current state (brief)

- **Schema (Phase 1 done)**: [apps/shared/src/schemas/settings.js](apps/shared/src/schemas/settings.js) uses the new **zeroing strategies** shape: `workXYZero`, `workZZero` (arrays of method IDs; `['ask']` = ask each time), `toolChangePolicy` (method ID or `'ask'`). Old keys (`initialSetup`, `toolChange`, `afterPause`) are removed from the schema.
- **Settings UI (Phase 3 done)**: [ZeroingMethodsSection](apps/web/src/routes/Settings/sections/ZeroingMethodsSection.tsx) lists methods; [ZeroingStrategiesSection](apps/web/src/routes/Settings/sections/ZeroingStrategiesSection.tsx) is now **"Default setup behavior"** with three dropdowns (work XY zero, work Z zero, tool changes) using derived options; no old keys.
- **Pre-job**: [JobStatusBar](apps/web/src/components/JobStatusBar.tsx) "Run" uses `initialSetup` to either open [ZeroingMethodSelectDialog](apps/web/src/components/ZeroingMethodSelectDialog.tsx) (`ask`) or open [ZeroingWizardTab](apps/web/src/components/ZeroingWizardTab.tsx) with one method. No plan summary; no split of XY vs Z; no explicit "establish tool reference" step.
- **Mid-job**: [useToolChangeDetection](apps/web/src/hooks/useToolChangeDetection.ts) on M6 uses `toolChange`; [ToolChangeTab](apps/web/src/components/ToolChangeTab.tsx) runs [ZeroingWizardTab](apps/web/src/components/ZeroingWizardTab.tsx) for the chosen method. BitSetter first vs subsequent is already handled via context and extensions.
- **Touch plate**: Schema and types assume **Z only** (`axes: 'z'`). No single-axis X/Y touchplate support.

## Problem areas

1. **Schema shape vs UX**
  New model: three decisions (work XY zero, work Z zero, tool-change policy). Stored as **composite strategies**: `workXYZero` and `workZZero` are **arrays** of method/block IDs (so workXYZero might be two capabilities, e.g. `[touchplateXId, touchplateYId]`); `toolChangePolicy` is a single method ID or `ask`. Values: for XY/Z, array of IDs (e.g. `['bitzero-xy']` or `['touchplate-x', 'touchplate-y']`) or `ask`; for tool change, method ID or `ask`. Options in the UI are **derived from enabled hardware**.
2. **Dropdown options derivation**
  Work XY zero options depend on hardware: BitZero (XY), "Touchplate X then Touchplate Y" (if both exist), Manual, Ask each time. Work Z zero: BitZero (Z), Touchplate (Z), Manual, Ask each time. **Tool-change policy**: BitSetter (if enabled), **Touchplate (Z)** (if enabled), Manual re-zero Z, Ask each time. Touchplate is a valid mid-job strategy for Z. Filtering and labeling must be implemented in one place so Settings and the Setup Wizard stay in sync.
3. **Pre-job flow orchestration**
  New flow: one "Set up job" entry → **orchestrator** that (1) shows plan summary, (2) runs steps as **discrete blocks** at the right fidelity. The orchestrator does **not** compose the existing method wizards. It composes **blocks** such as: BitZero XY, BitZero Z, Touchplate X, Touchplate Y, Touchplate Z, BitSetter (establish reference), Manual XY, Manual Z. Each block is a single-purpose step (e.g. "BitZero XY" block, "Touchplate X" block). Existing wizards are not precious; we implement blocks that match the plan's steps.
4. **Touch plate axes**
  Supporting "X touchplate, Y touchplate, Z touchplate" means touchplate must support **one axis per method**: `axes: 'x' | 'y' | 'z'`. Schema, types, and UI (method cards, wizards) must handle single-axis touchplate. BitZero remains the only multi-axis probe in one step.
5. **No "no tool changes" policy**
  We do not add a "No tool changes" / lockout option. If the job has an M6, we always have a strategy: BitSetter, Touchplate (Z), or Manual as fallback. No special warn/lockout flow.
6. **afterPause dropped**
  We are not adding a fourth decision for "after pause". It is not in the new schema.
7. **No migration**
  Start fresh with exactly what we need. There are no existing installs with the old schema. Schema and code use only the new shape (`workXYZero`, `workZZero`, `toolChangePolicy`); no backward compatibility or migration for old keys.
8. **Backend**
  Only shared schema and settings API are involved; no changes to protected server controllers.

---

## Phase 1: Schema and defaults ✅

- **Shared schema** ([apps/shared/src/schemas/settings.js](apps/shared/src/schemas/settings.js)):
  - Replace `ZeroingStrategiesSettingsSchema` with **composite strategies**:
    - **workXYZero**: array of method IDs (e.g. `['bitzero-xy']` or `['touchplate-x-id', 'touchplate-y-id']`) or literal `'ask'`. Enables XY from one capability (BitZero XY) or multiple (Touchplate X then Touchplate Y).
    - **workZZero**: array of method IDs (e.g. `['bitzero-z']` or `['touchplate-z-id']`) or `'ask'`. Usually one element; array for consistency with workXYZero.
    - **toolChangePolicy**: single method ID or `'ask'`.
  - No old keys (`initialSetup`, `toolChange`, `afterPause`). No "no tool changes" sentinel.
- **System settings**
  Ensure `SystemSettingsSchema` (and any defaults) use the new `zeroingStrategies` shape. Defaults: `workXYZero: 'ask'`, `workZZero: 'ask'`, `toolChangePolicy: 'ask'` (use a single sentinel for "ask" for the array fields, e.g. store `'ask'` or `[]` with a separate ask flag; define clearly).
- **Frontend types**
  Use the new keys only; no backward compatibility for old schema.
- **API**
  Ensure PATCH/GET of settings accept and return the new shape.

**Deliverable**: New schema and defaults; no migration; no UI behavior change yet.

### Phase 1 implementation notes (for Phases 2–7)

- **Uniform array type for XY/Z**: `workXYZero` and `workZZero` are **always** `string[]` (array of method IDs). "Ask each time" is stored as `['ask']` — i.e. `'ask'` is the **method ID** of the ask option, not a separate union type. So the type is constant; no `string[] | 'ask'`. When deriving options (Phase 3+), treat `workXYZero[0] === 'ask'` (or array contains `'ask'`) as "ask at runtime"; for display, "Ask each time" is one option whose value is `['ask']`.
- **Defaults**: `workXYZero: ['ask']`, `workZZero: ['ask']`, `toolChangePolicy: 'ask'`. Applied via `ZeroingStrategiesSettingsSchema.default({})` and `getDefaultSettings()` in [apps/shared/src/schemas/settings.js](apps/shared/src/schemas/settings.js).
- **Option B used**: UI was **not** updated in Phase 1. The following still reference the old keys (`initialSetup`, `toolChange`, `afterPause`) and will have type errors or wrong behavior until Phase 3 (or Phase 6 for mid-job):
  - [ZeroingStrategiesSection.tsx](apps/web/src/routes/Settings/sections/ZeroingStrategiesSection.tsx) — `ZeroingStrategiesConfig`, dropdowns for initialSetup/toolChange/afterPause
  - [Settings/index.tsx](apps/web/src/routes/Settings/index.tsx) — `DEFAULT_ZEROING_STRATEGIES_CONFIG`, `zeroingStrategiesConfig` state, `handleZeroingStrategiesConfigChange`, merge of `settings.zeroingStrategies` into local state
  - [JobStatusBar.tsx](apps/web/src/components/JobStatusBar.tsx) — `settings?.zeroingStrategies?.initialSetup`
  - [useToolChangeDetection.ts](apps/web/src/hooks/useToolChangeDetection.ts) — `settings?.zeroingStrategies?.toolChange`
  - [ToolChangeTab.tsx](apps/web/src/components/ToolChangeTab.tsx), [ToolChangeContext.tsx](apps/web/src/contexts/ToolChangeContext.tsx) — `toolChangeMethod`, `'skip'` handling
- **API**: No server code changes were needed. [api.settings.js](apps/server/src/api/api.settings.js) uses `SystemSettingsSchema` from shared; GET/POST validate and return the new shape. Stored data with old keys is parsed and gets new keys with defaults; old keys are not in the schema so they are not returned.
- **Shared TypeScript type**: `ZeroingStrategiesSettings` in [apps/shared/src/schemas/settings.d.ts](apps/shared/src/schemas/settings.d.ts) is `z.infer<typeof ZeroingStrategiesSettingsSchema>`, so it is now `{ workXYZero: string[]; workZZero: string[]; toolChangePolicy: string }`.
- **Tests**: [apps/server/test/settings-schema.js](apps/server/test/settings-schema.js) asserts default `zeroingStrategies.workXYZero`, `workZZero`, `toolChangePolicy`. Run with: `pnpm test:test -- apps/server/test/settings-schema.js`.

---

## Phase 2: Touch plate per-axis + BitZero composable (hardware capability)

- **Touch plate**
  - **Schema**: Change touchplate from `axes: z.literal('z')` to `axes: z.enum(['x','y','z'])` in [apps/shared/src/schemas/settings.js](apps/shared/src/schemas/settings.js).
  - **Types**: Update [ZeroingMethodsSection](apps/web/src/routes/Settings/sections/ZeroingMethodsSection.tsx) (and shared type exports) so touchplate can be `axes: 'x' | 'y' | 'z'`.
  - **ZeroingMethodsSection UI**: When adding/editing a touchplate, allow user to choose axis (X, Y, or Z).
  - **Touchplate block / gcode**: Ensure touchplate logic uses the method's `axes` so it only zeros the selected axis.
  - **ProbePanel / method display**: Show which axis each touchplate is for (e.g. "Touch plate (X)").
- **BitZero: XYZ, XY, or Z**
  BitZero can be used as **XYZ** (all in one), **XY only**, or **Z only**. When someone adds a **BitZero piece of hardware**, create **all three options as methods** that can be composed: BitZero XYZ, BitZero XY, BitZero Z. So one BitZero hardware entry yields three composable methods in the methods list (or three derived "options" from one config); the UI offers them as separate selectable methods for work XY zero, work Z zero, etc.

**Deliverable**: Users can add multiple touchplates (X, Y, Z) and each probes a single axis; one BitZero hardware addition yields three composable methods (BitZero XYZ, BitZero XY, BitZero Z).

### Phase 2 implementation notes (for Phases 3–7)

- **Touch plate schema**: `TouchPlateMethodSchema` uses `axes: z.enum(['x', 'y', 'z'])`. No default in schema; UI defaults new touchplates to `'z'`. Existing configs with `axes: 'z'` remain valid.
- **BitZero schema**: `BitZeroMethodSchema` explicitly sets `axes: z.enum(['xyz', 'xy', 'z'])` (no inheritance from BaseMethodSchema for axes). One "Add BitZero" in ZeroingMethodsSection adds **three method cards** (BitZero XYZ, BitZero XY, BitZero Z) via `createDefaultBitZeroMethods()`; each card shares probe params but has its own id, name, and axes.
- **Touchplate block/gcode**: [ZeroingWizardTab.tsx](apps/web/src/components/ZeroingWizardTab.tsx) `handleTouchPlateProbe` uses `method.axes` ('x'|'y'|'z') to build probe command (`G38.2 ${axis}-${distance}`), set-zero command, and retract. Bitsetter reference is cleared only when touchplate axes is `'z'` (in handleTouchPlateProbe and handleComplete).
- **BitZero block/gcode**: `handleBitZeroProbe` branches on `bitzeroMethod.axes`: `'z'` runs Z-only sequence (probe Z, set Z zero, retract); `'xy'` runs X and Y probing + set X0 Y0, no Z; `'xyz'` runs full macro (X, Y, Z). Bitsetter reference cleared only when bitzero sets Z (axes `'z'` or `'xyz'`).
- **ZeroingMethodsSection**: Touchplate edit dialog has Axis dropdown (X, Y, Z). BitZero edit dialog has no axes selector (each card is fixed to one of xyz/xy/z). AxesBadge and getMethodSummary work for single-axis 'x'/'y'/'z' and multi-axis 'xy'/'xyz'.
- **ProbePanel**: [ProbePanel.tsx](apps/web/src/routes/Setup/panels/ProbePanel.tsx) `getMethodDescription` for touchplate shows "Touch plate ({{axis}})"; for bitzero shows "Corner/edge/center probe for {{axes}} zeroing" (XYZ, XY, or Z).
- **TouchPlateZeroingWizard**: Copy uses `method.axes` (axisLabel) for "Set {{axis}} zero", "{{axis}}-axis probe", etc., so wizard text is correct for X, Y, or Z touchplate.

---

## Phase 3: Settings UI — "Default setup behavior"

- **Rename / refactor**
  Keep "Zeroing methods" as the hardware inventory (optional rename to "Zeroing hardware"). Replace current "Zeroing strategies" section with a single **"Default setup behavior"** section.
- **Three dropdowns** (options store composite arrays where applicable)
  - **Work XY zero**: options derived from enabled methods — BitZero (XY) → `[bitzero-xy-id]`, "Touchplate X then Touchplate Y" (if both exist) → `[touchplate-x-id, touchplate-y-id]`, Manual → `[manual-xy-id]`, Ask each time → `['ask']` (see Phase 1 notes: `'ask'` is the method ID).
  - **Work Z zero**: BitZero (Z) → `[bitzero-z-id]`, Touchplate (Z) → `[touchplate-z-id]`, Manual → `[manual-z-id]`, Ask each time → `['ask']`.
  - **Tool changes during job**: BitSetter (if enabled), Touchplate (Z) (if enabled), Manual re-zero Z, Ask each time. (Single method ID or `'ask'`; Manual is fallback.)
- **Derived rule when BitSetter**
  When `toolChangePolicy` is a BitSetter method ID, show a short line: "Required: After you set Z work zero, we will probe the current tool on the BitSetter to establish the job's tool reference."
- **Shared "options derivation"**
  Implement a small module or helpers that, given `zeroingMethods.methods` (enabled), return the list of valid options (and labels) for each dropdown. Use this in Settings and later in the Setup Wizard so the plan and defaults stay consistent.
- **Remove afterPause**
  Drop any UI and state for "after pause".

**Deliverable**: Settings page shows hardware + three dropdowns; options are driven by enabled hardware; BitSetter rule is visible when selected for tool changes.

### Phase 3 implementation notes (for Phases 4–7)

- **Scope**: Phase 3 updated **Settings page only**. [JobStatusBar](apps/web/src/components/JobStatusBar.tsx) and [useToolChangeDetection](apps/web/src/hooks/useToolChangeDetection.ts) still read `settings?.zeroingStrategies?.initialSetup` and `settings?.zeroingStrategies?.toolChange`. The API returns only `workXYZero`, `workZZero`, `toolChangePolicy`, so those consumers get `undefined`. Run is effectively broken until **Phase 5** wires JobStatusBar to the new keys and opens JobSetupWizard; mid-job tool change is broken until **Phase 6** updates useToolChangeDetection/ToolChangeTab to use the new keys and the same blocks.
- **Options derivation**: [apps/web/src/utils/zeroingStrategyOptions.ts](apps/web/src/utils/zeroingStrategyOptions.ts) — `getWorkXYZeroOptions(methods, t)`, `getWorkZZeroOptions(methods, t)`, `getToolChangePolicyOptions(methods, t)` return options with `value` (array for XY/Z, string for tool change) and `label`. `serializeWorkZeroValue(value)` / `parseWorkZeroValue(serialized)` convert `string[]` to/from a string for use as Select `value`. `isBitSetterMethodId(methods, methodId)` is used to show the BitSetter "Required" rule. **Phase 4** should reuse these helpers when building the setup plan and wizard options so Settings and wizard stay in sync.
- **Work XY options**: Ask each time → `['ask']`; BitZero (XY) → method with `type === 'bitzero'` and `axes === 'xy'` → `[id]`; "Touchplate X then Y" → only when both enabled touchplate with `axes === 'x'` and touchplate with `axes === 'y'` exist → `[idX, idY]` (X then Y order); Manual → first enabled `type === 'manual'` → `[id]`.
- **Work Z options**: Ask; BitZero (Z) → `axes === 'z'`; Touchplate (Z) → touchplate `axes === 'z'`; Manual.
- **Tool change options**: Ask; BitSetter (if enabled); Touchplate (Z); Manual re-zero Z. No "skip" / "no tool changes" option.
- **ZeroingStrategiesSection**: Section title is "Default setup behavior"; config type `ZeroingStrategiesConfig` is `{ workXYZero: string[]; workZZero: string[]; toolChangePolicy: string }`. Removed `ZeroingScenario`, `StrategyOption`, and all `afterPause` / `skip` UI. When the stored value is not in the derived options (e.g. method disabled), the dropdown falls back to the first option (Ask) for display; the stored value is not auto-normalized.
- **Settings/index.tsx**: `DEFAULT_ZEROING_STRATEGIES_CONFIG` is `{ workXYZero: ['ask'], workZZero: ['ask'], toolChangePolicy: 'ask' }`. Load/save merge `settings.zeroingStrategies` into local state; handler passes partial config to `debouncedSave({ zeroingStrategies: changes })`.
- **Exports**: [sections/index.ts](apps/web/src/routes/Settings/sections/index.ts) exports only `ZeroingStrategiesConfig` from ZeroingStrategiesSection (removed `ZeroingScenario`, `StrategyOption`).

---

## Phase 4: Plan derivation and "Set up job" wizard (orchestrator + blocks)

- **Plan derivation**
  From `workXYZero`, `workZZero`, `toolChangePolicy` and enabled methods, compute a **setup plan** object: e.g. `{ steps: [ ... ], blockPerStep }` where each step maps to a **block** (not an existing wizard). If **XY, Z, or tool-change policy** is `ask`, plan marks that step (or tool-change behavior) as "ask at runtime" — e.g. work XY ask, work Z ask, or tool change ask each time.
- **Blocks (right fidelity)**
  The orchestrator composes **blocks**, not the existing method wizards. Each block is a single-purpose step. Examples:
  - **BitZero XY** — probe XY only (one block).
  - **BitZero Z** — probe Z only (one block).
  - **Touchplate X** / **Touchplate Y** / **Touchplate Z** — one block per axis.
  - **BitSetter** — establish tool reference (one block).
  - **Manual XY** — set current position as XY zero (one block).
  - **Manual Z** — set current position as Z zero (one block).
  Sequences like "Touchplate X then Touchplate Y" are two blocks in order. Implement these blocks as dedicated step components (or small flows); do not wrap or compose [ZeroingWizardTab](apps/web/src/components/ZeroingWizardTab.tsx) / BitZeroZeroingWizard / etc. Existing wizards are not precious; we build blocks at the right fidelity.
- **JobSetupWizard (orchestrator) component**
  New component (e.g. under [apps/web/src/components/](apps/web/src/components/) or `wizards/`):
  - **Screen 1 — Plan summary**: Show "Plan for this job" with: Set XY zero using &lt;method/label&gt;, Set Z zero using &lt;method/label&gt;, Tool changes: &lt;policy&gt;. If tool-change policy is BitSetter, show: "After Z zero, we'll probe the current tool on the BitSetter to set the reference." and "Why: You enabled tool changes with the BitSetter. We need a reference measurement for the tool currently in the spindle." Add "Change" links next to XY, Z, and tool-change policy (picker or link to settings).
  - **Screen 2+ — Execution**: One step per plan step. For each step, render the **block** for that step (e.g. BitZero XY block, then Touchplate Z block, then BitSetter block). If step is "ask", show picker for available options then run the chosen block(s). On completion of each block, advance; when all done, show "Ready to run."
- **"Ask each time"**
  For any decision that is `ask` (work XY, work Z, or **tool change**), at that step (or at tool-change time) prompt with only the installed/available options; then run the selected block(s). Tool change can be ask too: at mid-job M6, if policy is `ask`, show method picker then run the chosen block.

**Deliverable**: "Set up job" opens the orchestrator; user sees the plan then runs discrete blocks in order (no composition of existing wizards).

### Phase 4 implementation notes (for Phases 5–7)

- **Scope**: Phase 4 implemented **plan derivation + JobSetupWizard only**. No entry point was added: the wizard is not opened from anywhere yet. **Phase 5** must (1) add the left-column "Job setup" panel on the Setup page with a **"Set up job"** button that opens `JobSetupWizard` (e.g. `<JobSetupWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />`), and (2) optionally wire [JobStatusBar](apps/web/src/components/JobStatusBar.tsx) "Run" to use the new strategy keys (`workXYZero`, `workZZero`, `toolChangePolicy`) and open `JobSetupWizard` instead of the old `initialSetup` / ZeroingMethodSelectDialog flow. Until Phase 5, Run still reads `initialSetup` (undefined) and will not open any wizard.
- **Plan derivation**: [apps/web/src/utils/setupPlan.ts](apps/web/src/utils/setupPlan.ts) — `deriveSetupPlan(strategies, methods, t)` returns `{ summary, slots }`. Summary has labels and ask flags; slots are ordered: work_xy, work_z, bitsetter (only if toolChangePolicy is a BitSetter method ID). `slotToBlocks(slot, methods)` expands a slot into `SetupBlock[]` (e.g. Touchplate X then Y → two blocks). Reuses [zeroingStrategyOptions.ts](apps/web/src/utils/zeroingStrategyOptions.ts) for labels so Settings and wizard stay in sync.
- **JobSetupWizard**: [apps/web/src/components/JobSetupWizard/JobSetupWizard.tsx](apps/web/src/components/JobSetupWizard/JobSetupWizard.tsx) — Dialog with two screens. **Screen 1 (PlanSummaryScreen)**: "Plan for this job" with dropdowns for Work XY zero, Work Z zero, Tool changes (this job only; overrides are not saved to settings). BitSetter "Required" / "Why" copy when tool-change policy is BitSetter. Continue → Screen 2. **Screen 2 (ExecutionScreen)**: For each slot in order, if slot is "ask" show picker (Work XY or Work Z options); on select, expand to blocks and run them one by one. Each block is rendered via `RenderSetupBlock(block, props)`. On completion of all slots, show "Ready to run" + Close.
- **Blocks**: New composable blocks under [apps/web/src/components/JobSetupWizard/blocks/](apps/web/src/components/JobSetupWizard/blocks/) — **ManualXYBlock**, **ManualZBlock** (set zero via G10; Manual Z clears BitSetter reference), **TouchplateBlock** (single axis X/Y/Z: probe + set zero + retract; completion via feeder:status), **BitZeroXYBlock**, **BitZeroZBlock** (macro sequences; completion via feeder:status), **BitSetterBlock** (navigate → probe first-tool macro → capture Z, store reference via `storeBitsetterReference`, retract). Blocks receive `BlockRunContext` (connectedPort, currentWCS, sendGcode, clearBitsetterReference, machinePosition, workPosition, storeBitsetterReference) and onComplete/onError. Existing [ZeroingWizardTab](apps/web/src/components/ZeroingWizardTab.tsx) and method wizards were **not** composed; blocks are new, minimal implementations. Phase 6 (mid-job) should reuse these same block components for tool-change flow.
- **Manual XY vs Manual Z**: Settings use a **single** Manual method (one id) for both Work XY and Work Z options. The **slot** (work_xy vs work_z) determines which block runs: Manual XY block sets XY zero only; Manual Z block sets Z zero only. Same method config; block kind differs by step.

---

## Phase 5: Setup page entry point and quick actions

- **New panel: Job setup (left column)**
  Add a **new panel on the left column** of the Setup page that contains the **"Set up job"** button. This panel is the primary entry point for pre-job setup: one clear CTA that opens the JobSetupWizard. Place it in the left column so it's visible before Run (e.g. above or alongside DRO / Jog).
- **Primary CTA**
  The new panel's **"Set up job"** button opens the JobSetupWizard. [JobStatusBar](apps/web/src/components/JobStatusBar.tsx) "Run" can still trigger the wizard when the user hasn't set up yet (optional: prompt "Set up job first?" or open wizard). Main entry is the new panel.
- **When to show wizard**
  From the new panel: user clicks "Set up job" → wizard opens. From Run: interpret strategy from the new model; if either work XY or work Z is not "skip", open JobSetupWizard when appropriate. For "ask", the wizard's first screen or step will collect the choice.
- **ProbePanel**
  Keep [ProbePanel](apps/web/src/routes/Setup/panels/ProbePanel.tsx) but treat it as **Advanced / Manual controls**: per-method "Run" buttons (BitZero XY/Z/XYZ, Touchplate X/Y/Z, Manual, BitSetter, etc.) for power users. Optionally label or collapse as "Quick actions" or "Advanced" so the primary path is the new "Set up job" panel.
- **Use new strategy keys only**
  All code uses `workXYZero`/`workZZero`/`toolChangePolicy` (composite arrays where defined) and the new plan derivation. No references to old keys.

**Deliverable**: New left-column "Job setup" panel with "Set up job" button; ProbePanel remains for direct per-method probing.

### Phase 5 implementation notes (for Phases 6–7)

- **Job setup panel**: [apps/web/src/routes/Setup/panels/JobSetupPanel.tsx](apps/web/src/routes/Setup/panels/JobSetupPanel.tsx) — Single CTA "Set up job" that calls `onSetUpJob` (opens JobSetupWizard with no pending job start). Panel id is `jobSetup`; added to `createPanelConfig` in [Setup/index.tsx](apps/web/src/routes/Setup/index.tsx) with title "Job setup" and ClipboardList icon. Default panel order places `jobSetup` **just above** `probe`: `['dro', 'rapid', 'jog', 'file', 'jobSetup', 'probe', 'macros', 'spindle', 'camera']`. Valid panels list includes `jobSetup`. **Migration**: When loading saved panel order from localStorage, if the order does not include `jobSetup`, it is inserted just before `probe` so existing users see the new panel without losing their order.
- **SortablePanel**: When `id === 'jobSetup'` and `onOpenJobSetupPanel` is provided, [Setup/index.tsx](apps/web/src/routes/Setup/index.tsx) renders `JobSetupPanel` with `onSetUpJob={onOpenJobSetupPanel}`. The callback passed from Setup opens the wizard with `setJobSetupWizardOpen(true)` and `setJobSetupPendingJobStart(false)` (panel entry = no pending job start).
- **Run (Play) flow**: [JobStatusBar](apps/web/src/components/JobStatusBar.tsx) no longer reads `initialSetup`. When Play is clicked (after homing confirmation when needed), if `onOpenJobSetupWizard` is provided it is called with `{ pendingJobStart: true }`; otherwise `startJobWithNavigation()` runs. [PageStatusBar](apps/web/src/components/PageStatusBar.tsx) accepts optional `onOpenJobSetupWizard?: (options: { pendingJobStart: boolean }) => void` and passes it to JobStatusBar. **Setup** passes `handleOpenJobSetupWizard` so Play on Setup always opens JobSetupWizard with pending job start. **Monitor** does not pass `onOpenJobSetupWizard`, so Play on Monitor starts the job directly.
- **JobSetupWizard completion**: [JobSetupWizard](apps/web/src/components/JobSetupWizard/JobSetupWizard.tsx) has optional `onSetupComplete?: () => void`. It is invoked when the user **completes the last block** (ExecutionScreen calls `onComplete()` in `handleBlockComplete` when the final slot’s last block finishes), not when the user clicks Close on "Ready to run". Setup passes `handleJobSetupComplete`: when `jobSetupPendingJobStart` is true, it closes the wizard, then navigates to Monitor (if `autoSwitchToMonitor`) and sends `gcode:start`, or sends `gcode:start` in place. Phase 6 (mid-job) does not use `onSetupComplete`; it reuses the same block components for tool-change flow.
- **State in Setup**: `jobSetupWizardOpen`, `jobSetupPendingJobStart`; `handleOpenJobSetupWizard({ pendingJobStart })`, `handleJobSetupWizardClose`, `handleJobSetupComplete`. JobSetupWizard is rendered once with `open={jobSetupWizardOpen}`, `onClose={handleJobSetupWizardClose}`, `onSetupComplete={handleJobSetupComplete}`.
- **ProbePanel**: Single line added above the method list: "Quick actions: run individual zeroing methods." ([ProbePanel.tsx](apps/web/src/routes/Setup/panels/ProbePanel.tsx)). Probe panel still uses the **single-method** flow: each "Run" button calls `onStartWizard(method)`, which opens [ZeroingWizardTab](apps/web/src/components/ZeroingWizardTab.tsx) in the Visualizer (old wizard). The **Job setup** panel and **Run** use JobSetupWizard only; no composition of the old wizards.
- **Old keys**: All references to `settings?.zeroingStrategies?.initialSetup`, `strategy === 'skip'`, `strategy === 'ask'`, and method-by-ID lookup for pre-job flow have been removed from JobStatusBar. Run now uses only `onOpenJobSetupWizard` when provided.

---

## Phase 6: Mid-job tool change policy ✅

- **Tool-change policy values**
  Ensure `toolChangePolicy` supports: a BitSetter method ID, a **Touchplate (Z)** method ID, a Manual method ID (fallback for "Manual re-zero Z each tool change"), and `ask`. No "no tool changes" option; Manual is the fallback when user does not have BitSetter or touchplate.
- **useToolChangeDetection**
  On M6, use the selected policy: if method ID, trigger that method's **block** (BitSetter block, Touchplate Z block, or Manual Z block); if `ask`, show method picker then run the chosen block.
- **ToolChangeTab**
  When policy is a method, show the corresponding block (not the old method wizard). When `ask`, show picker then run the chosen block. Reuse the same block components as the pre-job orchestrator so mid-job and pre-job stay consistent.
- **Copy**
  Add "Why" style copy where helpful (e.g. when probing on BitSetter: "We need a reference measurement for the tool currently in the spindle.").

**Deliverable**: Mid-job tool change uses BitSetter, Touchplate (Z), or Manual (fallback); same blocks as pre-job.

### Phase 6 implementation notes (for Phase 7)

- **useToolChangeDetection**: Reads `settings?.zeroingStrategies?.toolChangePolicy` (no `toolChange`). No "skip" path: policy is method ID or `'ask'`. Triggers `triggerToolChange(method, isFirstToolChange)` with the method object when policy is a method ID, or `triggerToolChange('ask', isFirstToolChange)` when policy is `'ask'`. Fallback to `'ask'` if method not found or disabled.
- **ToolChangeContext**: `toolChangeMethod` is `ZeroingMethod | 'ask' | null` (removed `'skip'`). `triggerToolChange(method: ZeroingMethod | 'ask', isFirstToolChange?: boolean)`.
- **ToolChangeTab**: Builds `BlockRunContext` (connectedPort, currentWCS, sendGcode, clearBitsetterReference, machinePosition, workPosition, storeBitsetterReference) and reuses [JobSetupWizard blocks](apps/web/src/components/JobSetupWizard/blocks/) via `RenderSetupBlock`. When policy is `'ask'`, shows [ToolChangeMethodSelectDialog](apps/web/src/components/ToolChangeMethodSelectDialog.tsx) (card-based); on select, calls `triggerToolChange(selectedMethod)` and then renders that method's block. When policy is a method, resolves block with `methodToToolChangeBlock(method)` from [setupPlan.ts](apps/web/src/utils/setupPlan.ts) and renders it. No ZeroingWizardTab; no "skip" handling.
- **ToolChangeMethodSelectDialog**: New dialog showing **method cards** for tool-change options only (BitSetter, Touchplate Z, Manual re-zero Z). Uses `getToolChangePolicyOptions` filtered to exclude `'ask'`. Each card shows icon, name, description; BitSetter cards include "Why: We need a reference measurement for the tool currently in the spindle." `onSelect(method: ZeroingMethod)`.
- **setupPlan**: `methodToToolChangeBlock(method)` returns a single `SetupBlock` for bitsetter, touchplate (z), or manual (manual_z). Used by ToolChangeTab to map selected method to block.

---

## Phase 7: Docs and i18n

- **Docs**
  Update [website/docs/user/docs/settings/zeroing-methods.md](website/docs/user/docs/settings/zeroing-methods.md) and [website/docs/user/docs/settings/zeroing-strategies.md](website/docs/user/docs/settings/zeroing-strategies.md) (or merge into one "Zeroing and tool changes" doc): describe hardware vs default behavior, the three dropdowns, and the "Set up job" flow with plan summary and BitSetter step. Update [website/docs/user/docs/machine-control/zeroing-methods.md](website/docs/user/docs/machine-control/zeroing-methods.md) if it references old strategy names.
- **i18n**
  Add/update keys in [apps/web/src/i18n/en/resource.json](apps/web/src/i18n/en/resource.json) (and other locales) for: "Work XY zero", "Work Z zero", "Tool changes during job", "Set up job", "Plan for this job", the BitSetter "Required" and "Why" lines, and any new block/step labels.
- **Tooltips**
  Ensure tooltips in Settings and the wizard use the new terminology (work zero, tool reference, etc.).

**Deliverable**: Documentation and all user-facing strings aligned with the new model.

---

## Dependency order

- Phase 1 first (schema and defaults).
- Phase 2 can run in parallel with Phase 3 after Phase 1; both feed Phase 4.
- Phase 4 (plan derivation + JobSetupWizard) depends on 1, 2, 3.
- Phase 5 (entry point) after Phase 4.
- Phase 6 (mid-job) after 1 and 3; can overlap with 4/5.
- Phase 7 (docs/i18n) after 5 and 6.

---

## Files to touch (summary)

| Area           | Files                                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema / types | `apps/shared/src/schemas/settings.js`, frontend types importing zeroing strategies                                                                                     |
| Settings UI    | `ZeroingStrategiesSection.tsx`, `ZeroingMethodsSection.tsx`, `Settings/index.tsx` (state/defaults)                                                                     |
| Touch plate    | Schema, `ZeroingMethodsSection`, touchplate block / gcode helpers                                                                                                      |
| Plan + wizard  | New `JobSetupWizard` (orchestrator), plan-derivation helper, **blocks** (BitZero XY/Z, Touchplate X/Y/Z, BitSetter, Manual XY/Z) — not composition of existing wizards |
| Entry point    | **New left-column Job setup panel** (Setup page), `JobStatusBar.tsx`, `Setup/index.tsx`, `ProbePanel.tsx`                                                               |
| Mid-job        | `useToolChangeDetection.ts`, `ToolChangeTab.tsx`, `ToolChangeContext.tsx`                                                                                             |
| Docs / i18n    | `website/docs/...`, `apps/web/src/i18n/...`                                                                                                                            |

---

## Risks / open points

- **Composite "Touchplate X then Y"**: Implement as two sequential blocks (Touchplate X, then Touchplate Y) with a single logical "Work XY zero" option in the dropdown when two touchplates (X and Y) exist.
- **Block reuse**: Pre-job orchestrator and mid-job ToolChangeTab should use the same block components (BitSetter block, Touchplate Z block, Manual Z block, etc.) so behavior and copy stay consistent.
- **First-time experience**: When all three dropdowns are "Ask each time", the Setup Wizard will prompt at each step; consider a short first-time hint so users understand they're choosing for this job only.
