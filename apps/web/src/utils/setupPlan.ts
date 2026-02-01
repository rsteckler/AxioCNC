/**
 * Setup plan derivation for the "Set up job" wizard (Phase 4).
 * From workXYZero, workZZero, toolChangePolicy and enabled methods, computes
 * a plan summary and execution slots. Reuses zeroingStrategyOptions for
 * labels and option derivation so Settings and wizard stay in sync.
 */
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'
import {
  getWorkXYZeroOptions,
  getWorkZZeroOptions,
  getToolChangePolicyOptions,
  isBitSetterMethodId,
} from './zeroingStrategyOptions'

export type SetupSlotKind = 'work_xy' | 'work_z' | 'bitsetter'

/** One execution slot: either "ask at runtime" or resolved method IDs. */
export interface SetupSlot {
  kind: SetupSlotKind
  /** When true, wizard shows picker at this slot; methodIds may be empty. */
  ask: boolean
  /** Method IDs for this slot (one for bitsetter; one or more for work_xy/work_z). */
  methodIds: string[]
}

/** Plan summary for Screen 1 (labels + ask flags). */
export interface SetupPlanSummary {
  workXYLabel: string
  workZLabel: string
  toolChangeLabel: string
  askXY: boolean
  askZ: boolean
  showBitSetterStep: boolean
}

/** Full plan: summary for display + ordered slots for execution. */
export interface SetupPlan {
  summary: SetupPlanSummary
  slots: SetupSlot[]
}

/**
 * Derive setup plan from strategies and enabled methods.
 * Uses same option derivation as Settings so labels match.
 */
export function deriveSetupPlan(
  strategies: {
    workXYZero: string[]
    workZZero: string[]
    toolChangePolicy: string
  },
  methods: ZeroingMethod[],
  t: (key: string, options?: Record<string, string>) => string
): SetupPlan {
  const workXYOptions = getWorkXYZeroOptions(methods, t)
  const workZOptions = getWorkZZeroOptions(methods, t)
  const toolChangeOptions = getToolChangePolicyOptions(methods, t)

  const askXY = strategies.workXYZero[0] === 'ask'
  const askZ = strategies.workZZero[0] === 'ask'

  const workXYLabel =
    workXYOptions.find(
      (o) => JSON.stringify(o.value) === JSON.stringify(strategies.workXYZero)
    )?.label ?? t('Ask Each Time')
  const workZLabel =
    workZOptions.find(
      (o) => JSON.stringify(o.value) === JSON.stringify(strategies.workZZero)
    )?.label ?? t('Ask Each Time')
  const toolChangeLabel =
    toolChangeOptions.find((o) => o.value === strategies.toolChangePolicy)
      ?.label ?? t('Ask Each Time')

  const showBitSetterStep = isBitSetterMethodId(methods, strategies.toolChangePolicy)

  const slots: SetupSlot[] = []

  // Slot 1: Work XY zero
  slots.push({
    kind: 'work_xy',
    ask: askXY,
    methodIds: askXY ? [] : [...strategies.workXYZero],
  })

  // Slot 2: Work Z zero
  slots.push({
    kind: 'work_z',
    ask: askZ,
    methodIds: askZ ? [] : [...strategies.workZZero],
  })

  // Slot 3: BitSetter (establish tool reference) — only when tool-change policy is BitSetter
  if (showBitSetterStep) {
    slots.push({
      kind: 'bitsetter',
      ask: false,
      methodIds: [strategies.toolChangePolicy],
    })
  }

  return {
    summary: {
      workXYLabel,
      workZLabel,
      toolChangeLabel,
      askXY,
      askZ,
      showBitSetterStep,
    },
    slots,
  }
}

/**
 * Resolve method IDs to method configs. Returns methods in order; skips missing/disabled.
 */
export function resolveMethods(
  methodIds: string[],
  methods: ZeroingMethod[]
): ZeroingMethod[] {
  const byId = new Map(methods.map((m) => [m.id, m]))
  const result: ZeroingMethod[] = []
  for (const id of methodIds) {
    const method = byId.get(id)
    if (method?.enabled) result.push(method)
  }
  return result
}

/** Block kind for execution: one block = one UI step. */
export type SetupBlockKind =
  | 'bitzero_xy'
  | 'bitzero_z'
  | 'touchplate_x'
  | 'touchplate_y'
  | 'touchplate_z'
  | 'manual_xy'
  | 'manual_z'
  | 'bitsetter'

/** One executable block: kind + method(s). Manual uses same method for XY and Z; step context decides axes. */
export interface SetupBlock {
  kind: SetupBlockKind
  /** Single method for most blocks; two for "Touchplate X then Y" (X then Y order). */
  methods: ZeroingMethod[]
}

/**
 * Expand a slot into ordered blocks. Used after user has chosen (or we have defaults).
 */
export function slotToBlocks(
  slot: SetupSlot,
  methods: ZeroingMethod[]
): SetupBlock[] {
  const resolved = resolveMethods(slot.methodIds, methods)
  if (resolved.length === 0) return []

  const blocks: SetupBlock[] = []
  const kind = slot.kind

  if (kind === 'work_xy') {
    for (const m of resolved) {
      if (m.type === 'bitzero' && (m.axes === 'xy' || m.axes === 'xyz')) {
        blocks.push({ kind: 'bitzero_xy', methods: [m] })
      } else if (m.type === 'touchplate' && (m.axes === 'x' || m.axes === 'y')) {
        blocks.push({
          kind: m.axes === 'x' ? 'touchplate_x' : 'touchplate_y',
          methods: [m],
        })
      } else if (m.type === 'touchplate' && m.axes === 'xyz') {
        blocks.push({ kind: 'touchplate_x', methods: [m] })
        blocks.push({ kind: 'touchplate_y', methods: [m] })
      } else if (m.type === 'manual') {
        blocks.push({ kind: 'manual_xy', methods: [m] })
      }
    }
  } else if (kind === 'work_z') {
    for (const m of resolved) {
      if (m.type === 'bitzero' && (m.axes === 'z' || m.axes === 'xyz')) {
        blocks.push({ kind: 'bitzero_z', methods: [m] })
      } else if (m.type === 'touchplate' && (m.axes === 'z' || m.axes === 'xyz')) {
        blocks.push({ kind: 'touchplate_z', methods: [m] })
      } else if (m.type === 'manual') {
        blocks.push({ kind: 'manual_z', methods: [m] })
      }
    }
  } else if (kind === 'bitsetter') {
    for (const m of resolved) {
      if (m.type === 'bitsetter') {
        blocks.push({ kind: 'bitsetter', methods: [m] })
      }
    }
  }

  return blocks
}

/**
 * Map a single method to one SetupBlock for mid-job tool change.
 * Only valid for: BitSetter, Touchplate (Z), Manual (re-zero Z).
 * Used by ToolChangeTab to render the same blocks as the pre-job wizard.
 */
export function methodToToolChangeBlock(
  method: ZeroingMethod
): SetupBlock | null {
  if (!method.enabled) return null
  if (method.type === 'bitsetter') {
    return { kind: 'bitsetter', methods: [method] }
  }
  if (method.type === 'touchplate' && (method.axes === 'z' || method.axes === 'xyz')) {
    return { kind: 'touchplate_z', methods: [method] }
  }
  if (method.type === 'manual') {
    return { kind: 'manual_z', methods: [method] }
  }
  return null
}
