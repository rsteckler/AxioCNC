import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Config for the primary Next button in the footer (template renders it). */
export interface SetupBlockNextButtonConfig {
  onClick: () => void
  disabled?: boolean
  /** Default: t('Next') */
  label?: string
}

export interface SetupBlockLayoutProps {
  /** Main content (scrollable). */
  children: ReactNode
  /** Optional title bar: title and subtitle. When set, shown above progress/content. */
  title?: string
  subtitle?: string
  /** Optional progress bar: when totalSteps > 0, show step progress (currentStep of totalSteps). */
  currentStep?: number
  totalSteps?: number
  /** Footer left: when onBack is set, template renders standard Back button. Else use footerLeft slot (e.g. parent-injected "Back to plan"). */
  onBack?: () => void
  /** Footer left slot (custom content). Used when onBack is not set, or overrides when both provided. */
  footerLeft?: ReactNode
  /** Footer right: primary Next button (template renders it with optional disabled/label). */
  nextButton?: SetupBlockNextButtonConfig
  /** Footer right slot (extra buttons, e.g. Run probe, Next (debug)). */
  footerRight?: ReactNode
}

/** Standard Back button for setup block footer (ghost, sm, arrow). Use for "Back to plan" or "Back to previous step". */
export function SetupBlockBackButton({ onClick, children }: { onClick: () => void; children?: ReactNode }) {
  const { t } = useTranslation()
  return (
    <Button variant="ghost" size="sm" onClick={onClick}>
      <ArrowLeft className="w-4 h-4 mr-1" />
      {children ?? t('Back')}
    </Button>
  )
}

/**
 * Reusable layout for setup wizard blocks (zeroing / tool change).
 * Use for both single-step and multi-step blocks so UX is consistent.
 *
 * - Optional step progress bar (dots + lines) when currentStep/totalSteps are set.
 * - Scrollable content area.
 * - Anchored footer with left (Back) and right (actions) slots.
 *
 * @example Single-step block (no progress bar)
 *   <SetupBlockLayout footerRight={<Button>Run probe</Button>}>
 *     <p>Instructions...</p>
 *   </SetupBlockLayout>
 *
 * @example Multi-step block (with progress)
 *   <SetupBlockLayout currentStep={step} totalSteps={3} footerLeft={...} footerRight={...}>
 *     {step === 1 && <Step1Content />}
 *     {step === 2 && <Step2Content />}
 *     {step === 3 && <Step3Content />}
 *   </SetupBlockLayout>
 */
export function SetupBlockLayout({
  children,
  title,
  subtitle,
  currentStep = 0,
  totalSteps = 0,
  onBack,
  footerLeft,
  nextButton,
  footerRight,
}: SetupBlockLayoutProps) {
  const { t } = useTranslation()
  const showStepProgress = totalSteps > 0 && currentStep >= 1 && currentStep <= totalSteps

  const titleBar = title != null && title !== '' && (
    <div className="space-y-1 pb-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      {subtitle != null && subtitle !== '' && (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      )}
    </div>
  )

  const stepProgress = showStepProgress && (
    <div
      className="flex w-full items-center gap-0 py-2 px-2 mb-4"
      role="progressbar"
      aria-valuenow={currentStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
    >
      {Array.from({ length: totalSteps * 2 + 1 }, (_, i) => {
        if (i % 2 === 0) {
          const lineIndex = i / 2
          const segmentComplete = currentStep > lineIndex
          const isFirstLine = i === 0
          const isLastLine = i === totalSteps * 2
          const lineFlex = isFirstLine || isLastLine ? 'flex-none w-0' : 'min-w-0 flex-1'
          return (
            <div
              key={`line-${i}`}
              className={`h-0.5 ${lineFlex} ${segmentComplete ? 'bg-primary/60' : 'bg-muted-foreground/30'}`}
              aria-hidden
            />
          )
        }
        const stepNum = (i + 1) / 2
        const isActive = stepNum === currentStep
        const isComplete = stepNum < currentStep
        return (
          <div key={stepNum} className="flex shrink-0 items-center">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background'
                  : isComplete
                    ? 'bg-primary/80 text-primary-foreground'
                    : 'border-2 border-muted-foreground/40 bg-background text-muted-foreground'
              }`}
            >
              {isComplete ? (
                <span className="text-xs" aria-hidden>✓</span>
              ) : (
                stepNum
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  const footerLeftContent = footerLeft ?? (onBack ? <SetupBlockBackButton onClick={onBack} /> : null)
  const footerRightContent = (
    <>
      {footerRight}
      {nextButton != null && (
        <Button
          onClick={nextButton.onClick}
          disabled={nextButton.disabled}
        >
          {nextButton.label ?? t('Next')}
        </Button>
      )}
    </>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {titleBar}
      {stepProgress}
      <div className="flex-1 overflow-auto min-h-0 pb-6">
        {children}
      </div>
      <div className="flex w-full shrink-0 items-center justify-between gap-2 border-t pt-4">
        <div>{footerLeftContent}</div>
        <div className="flex gap-2">{footerRightContent}</div>
      </div>
    </div>
  )
}
