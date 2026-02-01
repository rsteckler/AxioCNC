import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Info, HelpCircle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { SetupPlanSummary } from '@/utils/setupPlan'
import {
  getWorkXYZeroOptions,
  getWorkZZeroOptions,
  getToolChangePolicyOptions,
  serializeWorkZeroValue,
  parseWorkZeroValue,
} from '@/utils/zeroingStrategyOptions'
import type { ZeroingMethod } from '@/routes/Settings/sections/ZeroingMethodsSection'

export interface PlanSummaryScreenProps {
  summary: SetupPlanSummary
  /** Overrides for this job only (from "Change" pickers). */
  overrides: {
    workXYZero: string[]
    workZZero: string[]
    toolChangePolicy: string
  }
  methods: ZeroingMethod[]
  onOverrideChange: (overrides: Partial<PlanSummaryScreenProps['overrides']>) => void
  onContinue: () => void
  onClose: () => void
}

/**
 * Screen 1: Plan summary with "Change" pickers for this job only.
 */
export function PlanSummaryScreen({
  summary,
  overrides,
  methods,
  onOverrideChange,
  onContinue,
  onClose,
}: PlanSummaryScreenProps) {
  const { t } = useTranslation()
  const workXYOptions = getWorkXYZeroOptions(methods, t)
  const workZOptions = getWorkZZeroOptions(methods, t)
  const toolChangeOptions = getToolChangePolicyOptions(methods, t)

  const workXYValue = serializeWorkZeroValue(overrides.workXYZero)
  const workZValue = serializeWorkZeroValue(overrides.workZZero)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t('Plan for this job')}</h2>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('Set XY zero:')}</span>
          <Select
            value={workXYValue}
            onValueChange={(v) => onOverrideChange({ workXYZero: parseWorkZeroValue(v) })}
          >
            <SelectTrigger className="w-56">
              <SelectValue>
                {overrides.workXYZero[0] === 'ask' ? (
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    {t('Ask Each Time')}
                  </span>
                ) : (
                  workXYOptions.find((o) => serializeWorkZeroValue(o.value) === workXYValue)?.label ?? t('Select…')
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
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('Set Z zero:')}</span>
          <Select
            value={workZValue}
            onValueChange={(v) => onOverrideChange({ workZZero: parseWorkZeroValue(v) })}
          >
            <SelectTrigger className="w-56">
              <SelectValue>
                {overrides.workZZero[0] === 'ask' ? (
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    {t('Ask Each Time')}
                  </span>
                ) : (
                  workZOptions.find((o) => serializeWorkZeroValue(o.value) === workZValue)?.label ?? t('Select…')
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
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('Tool changes:')}</span>
          <Select
            value={overrides.toolChangePolicy}
            onValueChange={(v) => onOverrideChange({ toolChangePolicy: v })}
          >
            <SelectTrigger className="w-56">
              <SelectValue>
                {overrides.toolChangePolicy === 'ask' ? (
                  <span className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                    {t('Ask Each Time')}
                  </span>
                ) : (
                  toolChangeOptions.find((o) => o.value === overrides.toolChangePolicy)?.label ?? t('Select…')
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
            </SelectContent>
          </Select>
        </div>
      </div>

      {summary.showBitSetterStep && (
        <div className="flex flex-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
            <p>
              <strong>{t('After Z zero, we\'ll probe the current tool on the BitSetter to set the reference.')}</strong>
            </p>
            <p>
              {t('Why: Because you chose BitSetter for tool changes, we need a reference measurement for the tool currently in the spindle.')}
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          {t('Cancel')}
        </Button>
        <Button onClick={onContinue}>
          {t('Continue')}
        </Button>
      </div>
    </div>
  )
}
