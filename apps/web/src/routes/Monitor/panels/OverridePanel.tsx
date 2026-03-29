import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useConnectedPort, useOverrideValues } from '@/store/hooks'
import { useGcodeCommand } from '@/hooks'
import type { PanelProps } from '../../Setup/types'

function OverrideSlider({
  label,
  value,
  onReset,
  onCoarseUp,
  onCoarseDown,
  onFineUp,
  onFineDown
}: {
  label: string
  value: number
  onReset: () => void
  onCoarseUp: () => void
  onCoarseDown: () => void
  onFineUp: () => void
  onFineDown: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-sm font-mono font-semibold ${value !== 100 ? 'text-primary' : ''}`}>
          {value}%
        </span>
      </div>
      {/* Progress bar */}
      <div className="relative h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all ${
            value === 100 ? 'bg-muted-foreground/40' : value > 100 ? 'bg-primary' : 'bg-orange-500'
          }`}
          style={{ width: `${Math.min(value, 200) / 2}%` }}
        />
      </div>
      {/* Controls */}
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" className="h-7 px-1.5 text-xs flex-1" onClick={onCoarseDown}>
          -10
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-1.5 text-xs flex-1" onClick={onFineDown}>
          -1
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={onReset}>
          100%
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-1.5 text-xs flex-1" onClick={onFineUp}>
          +1
        </Button>
        <Button variant="outline" size="sm" className="h-7 px-1.5 text-xs flex-1" onClick={onCoarseUp}>
          +10
        </Button>
      </div>
    </div>
  )
}

export function OverridePanel(_props: PanelProps) {
  const { t } = useTranslation()
  const connectedPort = useConnectedPort()
  const { sendCommand } = useGcodeCommand(connectedPort)
  const overrides = useOverrideValues()

  return (
    <div className="p-4 space-y-4">
      {/* Feed Rate Override */}
      <OverrideSlider
        label={t('Feed Rate')}
        value={overrides.feed}
        onReset={() => sendCommand('feedOverride', 0)}
        onCoarseUp={() => sendCommand('feedOverride', 10)}
        onCoarseDown={() => sendCommand('feedOverride', -10)}
        onFineUp={() => sendCommand('feedOverride', 1)}
        onFineDown={() => sendCommand('feedOverride', -1)}
      />

      {/* Spindle Speed Override */}
      <OverrideSlider
        label={t('Spindle Speed')}
        value={overrides.spindle}
        onReset={() => sendCommand('spindleOverride', 0)}
        onCoarseUp={() => sendCommand('spindleOverride', 10)}
        onCoarseDown={() => sendCommand('spindleOverride', -10)}
        onFineUp={() => sendCommand('spindleOverride', 1)}
        onFineDown={() => sendCommand('spindleOverride', -1)}
      />

      {/* Rapid Override */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t('Rapid')}</span>
          <span className={`text-sm font-mono font-semibold ${overrides.rapid !== 100 ? 'text-primary' : ''}`}>
            {overrides.rapid}%
          </span>
        </div>
        <div className="relative h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all ${
              overrides.rapid === 100 ? 'bg-muted-foreground/40' : 'bg-orange-500'
            }`}
            style={{ width: `${overrides.rapid}%` }}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={() => sendCommand('rapidOverride', 25)}>
            25%
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={() => sendCommand('rapidOverride', 50)}>
            50%
          </Button>
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs flex-1" onClick={() => sendCommand('rapidOverride', 100)}>
            100%
          </Button>
        </div>
      </div>
    </div>
  )
}
