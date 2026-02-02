# SetupBlockLayout — Reusable template for zeroing/tool-change blocks

`SetupBlockLayout` is the shared layout for all Job Setup Wizard execution blocks (zeroing and tool-change). Use it so every block has the same structure: optional step progress bar, scrollable content, and anchored footer.

## Location

- **Component:** `apps/web/src/components/JobSetupWizard/blocks/SetupBlockLayout.tsx`
- **Exports:** `SetupBlockLayout`, `SetupBlockLayoutProps` from `./blocks` (JobSetupWizard/blocks/index.tsx)

## Props (template controls)

Blocks turn sections on/off or supply text; the template renders them consistently.

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Main content (scrollable). |
| **Title bar** | | |
| `title` | `string?` | When set, shows a title above content. |
| `subtitle` | `string?` | Optional subtitle under the title. |
| **Progress bar** | | |
| `currentStep` | `number?` | Current step (1-based). |
| `totalSteps` | `number?` | When > 0, shows step progress bar (e.g. 1 of 3). Omit or 0 to hide. |
| **Footer (hrule + buttons)** | | |
| `onBack` | `() => void?` | When set, template renders standard Back button (ghost, sm, arrow). Omit to hide Back. |
| `footerLeft` | `ReactNode?` | Custom left content (e.g. parent-injected "Back to plan"). Used when `onBack` is not set, or overrides when both provided. |
| `nextButton` | `{ onClick, disabled?, label? }?` | When set, template renders primary Next button. `label` defaults to `t('Next')`. `disabled` toggles enabled state. |
| `footerRight` | `ReactNode?` | Extra buttons on the right (e.g. Next (debug), Run probe). |

## Usage

### Single-step block (no progress, custom footer)

Omit `currentStep`/`totalSteps`, `onBack`, `nextButton`. Put main action in `footerRight`.

```tsx
<SetupBlockLayout footerRight={<Button onClick={runProbe}>Run probe</Button>}>
  <p className="text-sm text-muted-foreground">Place the touchplate and run the probe.</p>
</SetupBlockLayout>
```

### Multi-step block (title, progress, Back, Next)

Use `title`, `currentStep`/`totalSteps`, `onBack`, `nextButton`. Use `footerLeft` for step 1 (Back to plan); use `onBack` for step 2+ (Back to previous step). Use `nextButton` for primary Next (with optional `disabled`/`label`). Use `footerRight` for extra buttons (e.g. Next (debug)).

```tsx
<SetupBlockLayout
  title={stepTitles[step]}
  currentStep={step}
  totalSteps={3}
  onBack={step > 1 ? () => setStep(step - 1) : undefined}
  footerLeft={step === 1 ? footerLeftExtra : undefined}
  nextButton={step < 3 ? { onClick: () => setStep(step + 1) } : { onClick: onComplete, disabled: status !== 'complete' }}
  footerRight={debugAllowNext ? <Button variant="secondary" size="sm" onClick={...}>Next (debug)</Button> : null}
>
  {step === 1 && <Step1Content />}
  {step === 2 && <Step2Content />}
  {step === 3 && <Step3Content />}
</SetupBlockLayout>
```

## Blocks using the template

All setup blocks use `SetupBlockLayout`:

- **BitZeroXYBlock** — multi-step: `currentStep`/`totalSteps` (3 steps), merged footer (Back to plan + internal Back/Next).
- **BitZeroZBlock**, **TouchplateBlock**, **BitSetterBlock**, **ManualXYBlock**, **ManualZBlock** — single-step: scrollable content + anchored footer with block actions; no step progress bar. Each passes through `footerLeftExtra`/`footerRightExtra` when provided by the parent.

## Integration with ExecutionScreen

- **Slot progress:** ExecutionScreen renders a slot-level progress bar (Step 1 of N slots) above the block. That is separate from the block’s internal step progress.
- **Merged footer:** Blocks that use `SetupBlockLayout` and have multiple steps (e.g. BitZero XY) can opt into a “merged” footer: ExecutionScreen passes `footerLeftExtra` (Back to plan) and does not add its own footer row, so the block’s footer is the only one. See `isBlockWithMergedFooter` in ExecutionScreen.
