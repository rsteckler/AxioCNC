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

const DROPDOWN_WIDTH = 'min-w-[14rem] w-full max-w-[18rem]'

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
  /** When true, rendered inside tab (no dialog header/footer layout). */
  embedded?: boolean
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
  embedded = false,
}: PlanSummaryScreenProps) {
  const { t } = useTranslation()
  const workXYOptions = getWorkXYZeroOptions(methods, t)
  const workZOptions = getWorkZZeroOptions(methods, t)
  const toolChangeOptions = getToolChangePolicyOptions(methods, t)

  const workXYValue = serializeWorkZeroValue(overrides.workXYZero)
  const workZValue = serializeWorkZeroValue(overrides.workZZero)

  const body = (
    <>
      <section className="space-y-4 mb-6">
        <p className="text-sm text-muted-foreground">
          {t('Review and adjust how you will set XY zero, Z zero, and what to do for tool changes. Then click Continue to run the steps.')}
        </p>

        <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <label htmlFor="work-xy-zero" className="text-sm text-muted-foreground sm:min-w-[6rem]">
            {t('Set XY zero:')}
          </label>
          <Select
            value={workXYValue}
            onValueChange={(v) => onOverrideChange({ workXYZero: parseWorkZeroValue(v) })}
          >
            <SelectTrigger id="work-xy-zero" className={DROPDOWN_WIDTH}>
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

          <label htmlFor="work-z-zero" className="text-sm text-muted-foreground sm:min-w-[6rem]">
            {t('Set Z zero:')}
          </label>
          <Select
            value={workZValue}
            onValueChange={(v) => onOverrideChange({ workZZero: parseWorkZeroValue(v) })}
          >
            <SelectTrigger id="work-z-zero" className={DROPDOWN_WIDTH}>
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

          <label htmlFor="tool-changes" className="text-sm text-muted-foreground sm:min-w-[6rem]">
            {t('Tool changes:')}
          </label>
          <Select
            value={overrides.toolChangePolicy}
            onValueChange={(v) => onOverrideChange({ toolChangePolicy: v })}
          >
            <SelectTrigger id="tool-changes" className={DROPDOWN_WIDTH}>
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
      </section>

      {summary.showBitSetterStep && (
        <div className="flex flex-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 mt-2">
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
    </>
  )

  const footer = (
    <div className="flex w-full justify-end gap-2 pt-4 border-t shrink-0">
      <Button onClick={onContinue}>
        {t('Continue')}
      </Button>
    </div>
  )

  if (embedded) {
    return (
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-auto py-2 -mx-1 px-1">
          {body}
        </div>
        {footer}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      <div className="flex-1 overflow-auto py-2 -mx-1 px-1">
        {body}
      </div>
      {footer}
    </div>
  )
}
