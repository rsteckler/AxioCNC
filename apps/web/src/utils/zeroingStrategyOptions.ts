/**
 * Zeroing strategy options derivation.
 * Given enabled zeroing methods, returns dropdown options for:
 * - Work XY zero (composite: array of method IDs or ['ask'])
 * - Work Z zero (array of method IDs or ['ask'])
 * - Tool change policy (single method ID or 'ask')
 *
 * Used by Settings "Default setup behavior" and later by the Setup Wizard (Phase 4)
 * so plan and defaults stay consistent.
 */
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'

export type WorkXYZeroOption = { value: string[]; labelKey: string; label: string }
export type WorkZZeroOption = { value: string[]; labelKey: string; label: string }
export type ToolChangePolicyOption = { value: string; labelKey: string; label: string }

/** Serialize option value for use as Select value (string). */
export function serializeWorkZeroValue(value: string[]): string {
  return JSON.stringify(value)
}

/** Parse Select value back to work zero array. */
export function parseWorkZeroValue(serialized: string): string[] {
  try {
    const parsed = JSON.parse(serialized) as unknown
    return Array.isArray(parsed) && parsed.every((x): x is string => typeof x === 'string')
      ? parsed
      : ['ask']
  } catch {
    return ['ask']
  }
}

/**
 * Work XY zero options derived from enabled methods.
 * Order: Ask each time, BitZero (XY), Touchplate X then Y (if both exist), Manual.
 */
export function getWorkXYZeroOptions(
  methods: ZeroingMethod[],
  t: (key: string) => string
): WorkXYZeroOption[] {
  const enabled = methods.filter((m) => m.enabled)
  const options: WorkXYZeroOption[] = []

  options.push({
    value: ['ask'],
    labelKey: 'Ask Each Time',
    label: t('Ask Each Time'),
  })

  const bitzeroXY = enabled.find((m) => m.type === 'bitzero' && m.axes === 'xy')
  if (bitzeroXY) {
    options.push({
      value: [bitzeroXY.id],
      labelKey: 'BitZero (XY)',
      label: bitzeroXY.name || t('BitZero (XY)'),
    })
  }

  const touchplateX = enabled.find((m) => m.type === 'touchplate' && m.axes === 'x')
  const touchplateY = enabled.find((m) => m.type === 'touchplate' && m.axes === 'y')
  if (touchplateX && touchplateY) {
    options.push({
      value: [touchplateX.id, touchplateY.id],
      labelKey: 'Touchplate X then Y',
      label: t('Touchplate X then Y'),
    })
  }

  const manual = enabled.find((m) => m.type === 'manual')
  if (manual) {
    options.push({
      value: [manual.id],
      labelKey: 'Manual',
      label: manual.name || t('Manual'),
    })
  }

  return options
}

/**
 * Work Z zero options derived from enabled methods.
 * Order: Ask each time, BitZero (Z), Touchplate (Z), Manual.
 */
export function getWorkZZeroOptions(
  methods: ZeroingMethod[],
  t: (key: string) => string
): WorkZZeroOption[] {
  const enabled = methods.filter((m) => m.enabled)
  const options: WorkZZeroOption[] = []

  options.push({
    value: ['ask'],
    labelKey: 'Ask Each Time',
    label: t('Ask Each Time'),
  })

  const bitzeroZ = enabled.find((m) => m.type === 'bitzero' && m.axes === 'z')
  if (bitzeroZ) {
    options.push({
      value: [bitzeroZ.id],
      labelKey: 'BitZero (Z)',
      label: bitzeroZ.name || t('BitZero (Z)'),
    })
  }

  const touchplateZ = enabled.find((m) => m.type === 'touchplate' && m.axes === 'z')
  if (touchplateZ) {
    options.push({
      value: [touchplateZ.id],
      labelKey: 'Touchplate (Z)',
      label: touchplateZ.name || t('Touchplate (Z)'),
    })
  }

  const manual = enabled.find((m) => m.type === 'manual')
  if (manual) {
    options.push({
      value: [manual.id],
      labelKey: 'Manual',
      label: manual.name || t('Manual'),
    })
  }

  return options
}

/**
 * Tool change policy options derived from enabled methods.
 * Order: Ask each time, BitSetter (if enabled), Touchplate (Z), Manual re-zero Z.
 */
export function getToolChangePolicyOptions(
  methods: ZeroingMethod[],
  t: (key: string) => string
): ToolChangePolicyOption[] {
  const enabled = methods.filter((m) => m.enabled)
  const options: ToolChangePolicyOption[] = []

  options.push({
    value: 'ask',
    labelKey: 'Ask Each Time',
    label: t('Ask Each Time'),
  })

  const bitsetter = enabled.find((m) => m.type === 'bitsetter')
  if (bitsetter) {
    options.push({
      value: bitsetter.id,
      labelKey: 'BitSetter',
      label: bitsetter.name || t('BitSetter'),
    })
  }

  const touchplateZ = enabled.find((m) => m.type === 'touchplate' && m.axes === 'z')
  if (touchplateZ) {
    options.push({
      value: touchplateZ.id,
      labelKey: 'Touchplate (Z)',
      label: touchplateZ.name || t('Touchplate (Z)'),
    })
  }

  const manual = enabled.find((m) => m.type === 'manual')
  if (manual) {
    options.push({
      value: manual.id,
      labelKey: 'Manual re-zero Z',
      label: t('Manual re-zero Z'),
    })
  }

  return options
}

/** True if the given method ID refers to a BitSetter (for showing "Required" rule). */
export function isBitSetterMethodId(methods: ZeroingMethod[], methodId: string): boolean {
  return methods.some((m) => m.enabled && m.type === 'bitsetter' && m.id === methodId)
}
