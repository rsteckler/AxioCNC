import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpCircle, Info } from 'lucide-react'
import type { ZeroingMethod } from './ZeroingMethodsSection'
import {
  getWorkXYZeroOptions,
  getWorkZZeroOptions,
  getToolChangePolicyOptions,
  isBitSetterMethodId,
  serializeWorkZeroValue,
  parseWorkZeroValue,
} from '@/utils/zeroingStrategyOptions'

/** Matches ZeroingStrategiesSettings: workXYZero/workZZero are string[]; toolChangePolicy is string. */
export interface ZeroingStrategiesConfig {
  workXYZero: string[]
  workZZero: string[]
  toolChangePolicy: string
}

interface ZeroingStrategiesSectionProps {
  config: ZeroingStrategiesConfig
  availableMethods: ZeroingMethod[]
  onConfigChange: (config: Partial<ZeroingStrategiesConfig>) => void
}

export function ZeroingStrategiesSection({
  config,
  availableMethods,
  onConfigChange,
}: ZeroingStrategiesSectionProps) {
  const { t } = useTranslation()

  const workXYOptions = getWorkXYZeroOptions(availableMethods, t)
  const workZOptions = getWorkZZeroOptions(availableMethods, t)
  const toolChangeOptions = getToolChangePolicyOptions(availableMethods, t)

  const workXYSerialized = serializeWorkZeroValue(config.workXYZero)
  const workZZeroSerialized = serializeWorkZeroValue(config.workZZero)
  const workXYValue = workXYOptions.some((o) => serializeWorkZeroValue(o.value) === workXYSerialized)
    ? workXYSerialized
    : serializeWorkZeroValue(workXYOptions[0]?.value ?? ['ask'])
  const workZZeroValue = workZOptions.some((o) => serializeWorkZeroValue(o.value) === workZZeroSerialized)
    ? workZZeroSerialized
    : serializeWorkZeroValue(workZOptions[0]?.value ?? ['ask'])
  const toolChangeValue = toolChangeOptions.some((o) => o.value === config.toolChangePolicy)
    ? config.toolChangePolicy
    : (toolChangeOptions[0]?.value ?? 'ask')

  const showBitSetterRule = isBitSetterMethodId(availableMethods, config.toolChangePolicy)

  return (
    <SettingsSection
      id="zeroing-strategies"
      title={t('Default setup behavior')}
      description={t('Default choices for work XY zero, work Z zero, and tool changes during a job. You can change these when setting up a job.')}
    >
      {/* Work XY zero */}
      <SettingsField
        label={t('Work XY zero')}
        description={t('How to set X and Y work zero before running a job')}
        tooltip={t('Choose a method for establishing X and Y zero (e.g. BitZero XY, touchplate X then Y, or manual).')}
      >
        <Select
          value={workXYValue}
          onValueChange={(value) => onConfigChange({ workXYZero: parseWorkZeroValue(value) })}
        >
          <SelectTrigger className="w-64">
            <SelectValue>
              {config.workXYZero[0] === 'ask' ? (
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  {t('Ask Each Time')}
                </span>
              ) : (
                workXYOptions.find((o) => serializeWorkZeroValue(o.value) === workXYValue)?.label ?? t('Select...')
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workXYOptions.map((opt) => (
              <SelectItem key={serializeWorkZeroValue(opt.value)} value={serializeWorkZeroValue(opt.value)}>
                {opt.value[0] === 'ask' ? (
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    {opt.label}
                  </span>
                ) : (
                  opt.label
                )}
              </SelectItem>
            ))}
            {workXYOptions.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                {t('No options. Add zeroing methods above.')}
              </div>
            )}
          </SelectContent>
        </Select>
      </SettingsField>

      {/* Work Z zero */}
      <SettingsField
        label={t('Work Z zero')}
        description={t('How to set Z work zero before running a job')}
        tooltip={t('Choose a method for establishing Z zero (e.g. BitZero Z, touchplate Z, or manual).')}
      >
        <Select
          value={workZZeroValue}
          onValueChange={(value) => onConfigChange({ workZZero: parseWorkZeroValue(value) })}
        >
          <SelectTrigger className="w-64">
            <SelectValue>
              {config.workZZero[0] === 'ask' ? (
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  {t('Ask Each Time')}
                </span>
              ) : (
                workZOptions.find((o) => serializeWorkZeroValue(o.value) === workZZeroValue)?.label ?? t('Select...')
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {workZOptions.map((opt) => (
              <SelectItem key={serializeWorkZeroValue(opt.value)} value={serializeWorkZeroValue(opt.value)}>
                {opt.value[0] === 'ask' ? (
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    {opt.label}
                  </span>
                ) : (
                  opt.label
                )}
              </SelectItem>
            ))}
            {workZOptions.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                {t('No options. Add zeroing methods above.')}
              </div>
            )}
          </SelectContent>
        </Select>
      </SettingsField>

      {/* Tool changes during job */}
      <SettingsField
        label={t('Tool changes during job')}
        description={t('What to do when M6 (tool change) is encountered')}
        tooltip={t('Choose how to re-zero or establish tool reference when the job requests a tool change.')}
      >
        <div className="space-y-2">
          <Select
            value={toolChangeValue}
            onValueChange={(value) => onConfigChange({ toolChangePolicy: value })}
          >
            <SelectTrigger className="w-64">
              <SelectValue>
                {config.toolChangePolicy === 'ask' ? (
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    {t('Ask Each Time')}
                  </span>
                ) : (
                  toolChangeOptions.find((o) => o.value === config.toolChangePolicy)?.label ?? t('Select...')
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {toolChangeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.value === 'ask' ? (
                    <span className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-muted-foreground" />
                      {opt.label}
                    </span>
                  ) : (
                    opt.label
                  )}
                </SelectItem>
              ))}
              {toolChangeOptions.length === 0 && (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  {t('No options. Add zeroing methods above.')}
                </div>
              )}
            </SelectContent>
          </Select>

          {showBitSetterRule && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground">
                <strong>{t('Required:')}</strong>{' '}
                {t('After you set Z work zero, we will probe the current tool on the BitSetter to establish the job\'s tool reference.')}
              </p>
            </div>
          )}
        </div>
      </SettingsField>

      {/* Helper text */}
      <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p>
          <strong>{t('Tip:')}</strong>{' '}
          {t('For most setups, use a full XYZ or XY+Z probe (e.g. BitZero) for work zero, and BitSetter or touch plate for tool changes.')}
        </p>
      </div>
    </SettingsSection>
  )
}
