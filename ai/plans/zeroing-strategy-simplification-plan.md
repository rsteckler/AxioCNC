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
| 3 Settings UI — Zeroing defaults | ✅ Done | See Phase 3 implementation notes below. |
| 4 Plan derivation + Set up job wizard | ✅ Done | See Phase 4 implementation notes below. |
| 5 Setup page entry point | ✅ Done | New "Job setup" panel above Probe; "Set up job" opens JobSetupWizard. Run (Play) opens wizard with pending job start; on completion, job starts. ProbePanel has Quick actions line. |
| 6 Mid-job tool change policy | ✅ Done | useToolChangeDetection uses toolChangePolicy; ToolChangeTab uses blocks + ToolChangeMethodSelectDialog (cards) for "ask". |
| 7 Docs and i18n | ✅ Done | See Phase 7 implementation notes below. |

# Zeroing Strategy Simplification Plan

## Current state (brief)

- **Schema (Phase 1 done)**: [apps/shared/src/schemas/settings.js](apps/shared/src/schemas/settings.js) uses the new **zeroing strategies** shape: `workXYZero`, `workZZero` (arrays of method IDs; `['ask']` = ask each time), `toolChangePolicy` (method ID or `'ask'`). Old keys (`initialSetup`, `toolChange`, `afterPause`) are removed from the schema.
- **Settings UI (Phase 3 done)**: [ZeroingMethodsSection](apps/web/src/routes/Settings/sections/ZeroingMethodsSection.tsx) lists **one card per hardware** (one BitZero card with axes XYZ, one Touch Plate card with axes XYZ, one BitSetter, one Manual). [ZeroingStrategiesSection](apps/web/src/routes/Settings/sections/ZeroingStrategiesSection.tsx) is **"Zeroing defaults"** with three dropdowns (work XY zero, work Z zero, tool changes) using derived options; BitSetter rule shown in a blue info box when tool changes use BitSetter.
- **Pre-job**: [JobStatusBar](apps/web/src/components/JobStatusBar.tsx) "Run" (on Setup) opens [JobSetupWizard](apps/web/src/components/JobSetupWizard/JobSetupWizard.tsx) with pending job start; plan summary then discrete blocks (BitZero XY/Z, Touchplate X/Y/Z, BitSetter, Manual XY/Z). No old `initialSetup` flow.
- **Mid-job**: [useToolChangeDetection](apps/web/src/hooks/useToolChangeDetection.ts) on M6 uses `toolChangePolicy`; [ToolChangeTab](apps/web/src/components/ToolChangeTab.tsx) reuses JobSetupWizard blocks (BitSetter, Touchplate Z, Manual Z). BitSetter first vs subsequent handled via context and extensions.
- **Touch plate**: Schema allows `axes: 'x' | 'y' | 'z' | 'xyz'`. One touch plate hardware = one card (axes xyz); strategy options derive "Touchplate X then Y" and "Touchplate (Z)" from that single method. Legacy single-axis (x, y, z) configs still supported.

## Problem areas

1. **Schema shape vs UX**
  New model: three decisions (work XY zero, work Z zero, tool-change policy). Stored as **composite strategies**: `workXYZero` and `workZZero` are **arrays** of method/block IDs (so workXYZero might be two capabilities, e.g. `[touchplateXId, touchplateYId]`); `toolChangePolicy` is a single method ID or `ask`. Values: for XY/Z, array of IDs (e.g. `['bitzero-xy']` or `['touchplate-x', 'touchplate-y']`) or `ask`; for tool change, method ID or `ask`. Options in the UI are **derived from enabled hardware**.
2. **Dropdown options derivation**
  Work XY zero options depend on hardware: BitZero (XY) — from one BitZero (axes xyz); "Touchplate X then Y" — from one touch plate (axes xyz) or legacy two touchplates (x + y); Manual, Ask each time. Work Z zero: BitZero (Z) — from one BitZero (axes xyz); Touchplate (Z) — from one touch plate (axes xyz) or legacy; Manual, Ask each time. **Tool-change policy**: BitSetter (if enabled), Touchplate (Z) (if enabled), Manual re-zero Z, Ask each time. Options are derived in [zeroingStrategyOptions.ts](apps/web/src/utils/zeroingStrategyOptions.ts) so Settings and the Setup Wizard stay in sync.
3. **Pre-job flow orchestration**
  New flow: one "Set up job" entry → **orchestrator** that (1) shows plan summary, (2) runs steps as **discrete blocks** at the right fidelity. The orchestrator does **not** compose the existing method wizards. It composes **blocks** such as: BitZero XY, BitZero Z, Touchplate X, Touchplate Y, Touchplate Z, BitSetter (establish reference), Manual XY, Manual Z. Each block is a single-purpose step (e.g. "BitZero XY" block, "Touchplate X" block). Existing wizards are not precious; we implement blocks that match the plan's steps.
4. **Touch plate and BitZero: one card per hardware**
  **BitZero**: One hardware entry = one card (axes xyz). Strategy dropdowns derive "BitZero (XY)" and "BitZero (Z)" from that single method; slot/block determines which sequence runs (BitZero XY block vs BitZero Z block). **Touch plate**: One hardware entry = one card (axes xyz). No axis selector in the edit dialog; strategy dropdowns derive "Touchplate X then Y" (two blocks: touchplate_x, touchplate_y) and "Touchplate (Z)" from that single method. Legacy touchplate configs with `axes: 'x' | 'y' | 'z'` remain valid. Schema: touchplate `axes: 'x' | 'y' | 'z' | 'xyz'`.
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
  - **Schema**: Touchplate supports `axes: z.enum(['x', 'y', 'z', 'xyz'])` in [apps/shared/src/schemas/settings.js](apps/shared/src/schemas/settings.js). One touch plate hardware = one card (axes xyz).
  - **Types**: [ZeroingMethodsSection](apps/web/src/routes/Settings/sections/ZeroingMethodsSection.tsx) `TouchPlateConfig.axes` is `'x' | 'y' | 'z' | 'xyz'`.
  - **ZeroingMethodsSection UI**: No axis selector for touch plate (like BitZero). New touch plates default to `axes: 'xyz'`. Add-dialog shows XYZ badge. Legacy configs with single-axis (x, y, z) remain valid.
  - **Touchplate block / gcode**: [TouchplateBlock](apps/web/src/components/JobSetupWizard/blocks/TouchplateBlock.tsx) receives `blockKind` (touchplate_x, touchplate_y, touchplate_z); when `method.axes === 'xyz'`, the axis to probe is derived from `blockKind`. Legacy single-axis methods use `method.axes` directly.
  - **ProbePanel / method display**: Touch plate with axes xyz shows "Touch plate (X, Y, Z)"; single-axis shows "Touch plate ({{axis}})".
- **BitZero: one card per hardware**
  One BitZero hardware entry = **one method card** (axes xyz). Strategy dropdowns derive "BitZero (XY)" and "BitZero (Z)" from that single method; [slotToBlocks](apps/web/src/utils/setupPlan.ts) and blocks (BitZeroXYBlock, BitZeroZBlock) accept `method.axes === 'xyz'` and run the appropriate XY or Z sequence. Legacy configs with separate BitZero (xy), (z), (xyz) methods still work.

**Deliverable**: One BitZero = one card (XYZ); one Touch Plate = one card (XYZ). Methods match 1:1 hardware. Strategy options and blocks derive XY/Z or X/Y/Z from those single methods.

### Phase 2 implementation notes (for Phases 3–7)

- **Touch plate schema**: `TouchPlateMethodSchema` uses `axes: z.enum(['x', 'y', 'z', 'xyz'])`. New touch plates are created with `axes: 'xyz'`. Legacy configs with `axes: 'x' | 'y' | 'z'` remain valid.
- **BitZero**: One "Add BitZero" adds **one method** via `createDefaultMethod('bitzero', ...)` with `axes: 'xyz'`. No `createDefaultBitZeroMethods()`. Options derivation and slotToBlocks treat BitZero with axes xyz as providing both "BitZero (XY)" and "BitZero (Z)" (same method id; slot determines block).
- **Touchplate block**: TouchplateBlock gets `blockKind` from [SetupBlockProps](apps/web/src/components/JobSetupWizard/blocks/types.ts); when `method.axes === 'xyz'`, axis is derived from blockKind (touchplate_x → x, etc.). [setupPlan.slotToBlocks](apps/web/src/utils/setupPlan.ts): for work_xy with one touchplate (xyz), pushes two blocks (touchplate_x [m], touchplate_y [m]); for work_z, touchplate (z or xyz) → touchplate_z block.
- **BitZero blocks**: [BitZeroXYBlock](apps/web/src/components/JobSetupWizard/blocks/BitZeroXYBlock.tsx) and [BitZeroZBlock](apps/web/src/components/JobSetupWizard/blocks/BitZeroZBlock.tsx) accept `method.axes === 'xy' | 'xyz'` and `method.axes === 'z' | 'xyz'` respectively.
- **ZeroingMethodsSection**: No axis dropdown for touch plate or BitZero. Add dialog shows XYZ badge for both. AxesBadge and getMethodSummary support 'xyz' (displays X, Y, Z pills).
- **ProbePanel**: getMethodDescription for touchplate with axes xyz shows "Touch plate (X, Y, Z)".
- **ZeroingWizardTab**: Touch plate with axes xyz defaults to Z probe when "Run" from ProbePanel; bitsetter reference cleared when touchplate axes is 'z' or 'xyz'.

---

## Phase 3: Settings UI — "Zeroing defaults"

- **Rename / refactor**
  Keep "Zeroing methods" as the hardware inventory. The strategies section is **"Zeroing defaults"** (section title and Settings nav label in [settingsSections.tsx](apps/web/src/routes/Settings/settingsSections.tsx)).
- **Three dropdowns** (options store composite arrays where applicable)
  - **Work XY zero**: options derived from enabled methods — BitZero (XY) from one BitZero (axes xy or xyz) → `[id]`; "Touchplate X then Y" from one touch plate (axes xyz) → `[id]` or legacy two touchplates (x + y) → `[idX, idY]`; Manual → `[id]`; Ask each time → `['ask']`.
  - **Work Z zero**: BitZero (Z) from one BitZero (axes z or xyz) → `[id]`; Touchplate (Z) from one touch plate (axes z or xyz) → `[id]`; Manual → `[id]`; Ask each time → `['ask']`.
  - **Tool changes during job**: BitSetter (if enabled), Touchplate (Z) (if enabled), Manual re-zero Z, Ask each time. (Single method ID or `'ask'`; Manual is fallback.)
- **Derived rule when BitSetter**
  When `toolChangePolicy` is a BitSetter method ID, show a **blue info box**: "Required: Because you chose BitSetter for tool changes, after you set Z work zero we will probe the current tool on the BitSetter to establish the job's tool reference." No separate "Tip" / helper box below.
- **Shared "options derivation"**
  [zeroingStrategyOptions.ts](apps/web/src/utils/zeroingStrategyOptions.ts): given `zeroingMethods.methods` (enabled), returns options for each dropdown. Reused by Settings and JobSetupWizard so plan and defaults stay consistent.
- **Remove afterPause**
  No UI or state for "after pause".

**Deliverable**: Settings page shows hardware (one card per method type) + "Zeroing defaults" section with three dropdowns; BitSetter rule in blue box when tool changes use BitSetter.

### Phase 3 implementation notes (for Phases 4–7)

- **Options derivation**: `getWorkXYZeroOptions`: BitZero (XY) when method has `type === 'bitzero'` and `(axes === 'xy' || axes === 'xyz')`; "Touchplate X then Y" when one touchplate with `axes === 'xyz'` (value `[id]`) or legacy when both touchplate x and touchplate y exist. `getWorkZZeroOptions`: BitZero (Z) when `axes === 'z' || axes === 'xyz'`; Touchplate (Z) when `axes === 'z' || axes === 'xyz'`. `getToolChangePolicyOptions`: Touchplate (Z) when `axes === 'z' || axes === 'xyz'`. `isBitSetterMethodId` used to show the BitSetter rule.
- **ZeroingStrategiesSection**: Section title is **"Zeroing defaults"** (`t('Zeroing defaults')`). Config type `ZeroingStrategiesConfig` is `{ workXYZero: string[]; workZZero: string[]; toolChangePolicy: string }`. BitSetter rule rendered in a blue box (`bg-blue-500/10`, `border-blue-500/30`, `text-blue-900 dark:text-blue-100`). No "Tip: For most setups..." helper below the dropdowns.
- **Settings/index.tsx**: `DEFAULT_ZEROING_STRATEGIES_CONFIG` is `{ workXYZero: ['ask'], workZZero: ['ask'], toolChangePolicy: 'ask' }`. Load/save merge `settings.zeroingStrategies` into local state; handler passes partial config to `debouncedSave({ zeroingStrategies: changes })`.
- **Exports**: [sections/index.ts](apps/web/src/routes/Settings/sections/index.ts) exports `ZeroingStrategiesConfig` from ZeroingStrategiesSection.

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
  - **Screen 1 — Plan summary**: Show "Plan for this job" with: Set XY zero using &lt;method/label&gt;, Set Z zero using &lt;method/label&gt;, Tool changes: &lt;policy&gt;. If tool-change policy is BitSetter, show a **blue info box**: "After Z zero, we'll probe the current tool on the BitSetter to set the reference." and "Why: Because you chose BitSetter for tool changes, we need a reference measurement for the tool currently in the spindle." Add "Change" links next to XY, Z, and tool-change policy (picker or link to settings).
  - **Screen 2+ — Execution**: One step per plan step. For each step, render the **block** for that step (e.g. BitZero XY block, then Touchplate Z block, then BitSetter block). If step is "ask", show picker for available options then run the chosen block(s). On completion of each block, advance; when all done, show "Ready to run."
- **"Ask each time"**
  For any decision that is `ask` (work XY, work Z, or **tool change**), at that step (or at tool-change time) prompt with only the installed/available options; then run the selected block(s). Tool change can be ask too: at mid-job M6, if policy is `ask`, show method picker then run the chosen block.

**Deliverable**: "Set up job" opens the orchestrator; user sees the plan then runs discrete blocks in order (no composition of existing wizards).

### Phase 4 implementation notes (for Phases 5–7)

- **Scope**: Phase 4 implemented **plan derivation + JobSetupWizard only**. No entry point was added: the wizard is not opened from anywhere yet. **Phase 5** must (1) add the left-column "Job setup" panel on the Setup page with a **"Set up job"** button that opens `JobSetupWizard` (e.g. `<JobSetupWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />`), and (2) optionally wire [JobStatusBar](apps/web/src/components/JobStatusBar.tsx) "Run" to use the new strategy keys (`workXYZero`, `workZZero`, `toolChangePolicy`) and open `JobSetupWizard` instead of the old `initialSetup` / ZeroingMethodSelectDialog flow. Until Phase 5, Run still reads `initialSetup` (undefined) and will not open any wizard.
- **Plan derivation**: [apps/web/src/utils/setupPlan.ts](apps/web/src/utils/setupPlan.ts) — `deriveSetupPlan(strategies, methods, t)` returns `{ summary, slots }`. Summary has labels and ask flags; slots are ordered: work_xy, work_z, bitsetter (only if toolChangePolicy is a BitSetter method ID). `slotToBlocks(slot, methods)` expands a slot into `SetupBlock[]`: BitZero with axes xy or xyz → bitzero_xy block; BitZero with axes z or xyz → bitzero_z block; touchplate with axes xyz for work_xy → two blocks (touchplate_x [m], touchplate_y [m]); touchplate with axes z or xyz for work_z → touchplate_z block; legacy single-axis touchplates unchanged. Reuses [zeroingStrategyOptions.ts](apps/web/src/utils/zeroingStrategyOptions.ts) for labels.
- **JobSetupWizard**: [apps/web/src/components/JobSetupWizard/JobSetupWizard.tsx](apps/web/src/components/JobSetupWizard/JobSetupWizard.tsx) — Dialog with two screens. **Screen 1 (PlanSummaryScreen)**: "Plan for this job" with dropdowns for Work XY zero, Work Z zero, Tool changes (this job only; overrides are not saved to settings). When tool-change policy is BitSetter, a **blue info box** shows "After Z zero, we'll probe..." and "Why: Because you chose BitSetter for tool changes, we need a reference measurement...". Continue → Screen 2. **Screen 2 (ExecutionScreen)**: For each slot in order, if slot is "ask" show picker (Work XY or Work Z options); on select, expand to blocks and run them one by one. Each block is rendered via `RenderSetupBlock(block, props)`. On completion of all slots, show "Ready to run" + Close.
- **Blocks**: New composable blocks under [apps/web/src/components/JobSetupWizard/blocks/](apps/web/src/components/JobSetupWizard/blocks/) — **ManualXYBlock**, **ManualZBlock** (set zero via G10; Manual Z clears BitSetter reference), **TouchplateBlock** (single axis X/Y/Z: receives `blockKind` in [SetupBlockProps](apps/web/src/components/JobSetupWizard/blocks/types.ts); when `method.axes === 'xyz'`, axis is derived from blockKind; probe + set zero + retract; completion via feeder:status), **BitZeroXYBlock**, **BitZeroZBlock** (accept `method.axes === 'xy' | 'xyz'` and `'z' | 'xyz'` respectively; macro sequences; completion via feeder:status), **BitSetterBlock** (navigate → probe first-tool macro → capture Z, store reference via `storeBitsetterReference`, retract). Blocks receive `BlockRunContext` and optional `blockKind` (for TouchplateBlock). Phase 6 (mid-job) reuses these same block components for tool-change flow.
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
- **setupPlan**: `methodToToolChangeBlock(method)` returns a single `SetupBlock` for bitsetter, touchplate (z or xyz), or manual (manual_z). Used by ToolChangeTab to map selected method to block.

---

## Phase 7: Docs and i18n

- **Docs**
  Update [website/docs/user/docs/settings/zeroing-methods.md](website/docs/user/docs/settings/zeroing-methods.md) and [website/docs/user/docs/settings/zeroing-strategies.md](website/docs/user/docs/settings/zeroing-strategies.md) (or merge into one "Zeroing and tool changes" doc): describe hardware vs default behavior, the three dropdowns, and the "Set up job" flow with plan summary and BitSetter step. Update [website/docs/user/docs/machine-control/zeroing-methods.md](website/docs/user/docs/machine-control/zeroing-methods.md) if it references old strategy names.
- **i18n**
  Add/update keys in [apps/web/src/i18n/en/resource.json](apps/web/src/i18n/en/resource.json) (and other locales) for: "Work XY zero", "Work Z zero", "Tool changes during job", "Set up job", "Plan for this job", the BitSetter "Required" and "Why" lines, and any new block/step labels.
- **Tooltips**
  Ensure tooltips in Settings and the wizard use the new terminology (work zero, tool reference, etc.).

**Deliverable**: Documentation and all user-facing strings aligned with the new model.

### Phase 7 implementation notes

- **Docs**: Merged [zeroing-methods.md](website/docs/user/docs/settings/zeroing-methods.md) and [zeroing-strategies.md](website/docs/user/docs/settings/zeroing-strategies.md) into a single doc [zeroing-and-tool-changes.md](website/docs/user/docs/settings/zeroing-and-tool-changes.md). Describes hardware (zeroing methods, one card per hardware), **Zeroing defaults** (three dropdowns: Work XY zero, Work Z zero, Tool changes during job), and the Set up job flow (plan summary, BitSetter step). Sidebar and internal links reference **Settings → Zeroing defaults**.
- **Machine-control doc**: [machine-control/zeroing-methods.md](website/docs/user/docs/machine-control/zeroing-methods.md) updated to reference **Settings → Zeroing and Tool Changes** and **Tool changes during job**. Touch plate: one hardware = one card (axes xyz); strategy options derive X/Y/Z from that method.
- **i18n**: Keys in [apps/web/src/i18n/en/resource.json](apps/web/src/i18n/en/resource.json) and [apps/web/public/i18n/*/resource.json](apps/web/public/i18n/) include: **Zeroing defaults**, Work XY zero, Work Z zero, Tool changes during job, Plan for this job, Set up job, BitSetter "Required" / "Because you chose BitSetter for tool changes..." and "Why: Because you chose BitSetter for tool changes...", Set XY zero:/Set Z zero:/Tool changes:, Ask Each Time, option labels (BitZero (XY), BitZero (Z), Touchplate X then Y, Touchplate (Z), Manual re-zero Z), tooltip for Set up job button.
- **Settings nav**: [settingsSections.tsx](apps/web/src/routes/Settings/settingsSections.tsx) zeroing-strategies nav label is **"Zeroing defaults"** (`t('Zeroing defaults')`) to match section title.
- **Tooltips**: Tooltips on the three Zeroing defaults dropdowns (work zero, tool reference terminology). Tooltip on **Set up job** button: "Opens the setup wizard to set work XY zero, work Z zero, and optionally establish tool reference."

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

- **Composite "Touchplate X then Y"**: Implemented as two sequential blocks (Touchplate X, then Touchplate Y). When one touch plate (axes xyz) is enabled, "Touchplate X then Y" is one option (value = that method id); slotToBlocks expands to two blocks (touchplate_x [m], touchplate_y [m]). Legacy: when two touchplates (axes x and y) exist, option value is [idX, idY] and slotToBlocks produces two blocks with the two methods.
- **Block reuse**: Pre-job orchestrator and mid-job ToolChangeTab use the same block components (BitSetter block, Touchplate Z block, Manual Z block, etc.) so behavior and copy stay consistent.
- **First-time experience**: When all three dropdowns are "Ask each time", the Setup Wizard prompts at each step; consider a short first-time hint so users understand they're choosing for this job only.
