import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Target, 
  Crosshair, 
  SquareDashedBottom,
  Hand, 
  Settings2, 
  HelpCircle,
  Play,
  RefreshCw,
  PauseCircle,
} from 'lucide-react'
import type { ZeroingMethod, ZeroingMethodType } from './ZeroingMethodsSection'

// Strategy scenarios
export type ZeroingScenario = 'initial-setup' | 'tool-change' | 'after-pause'

// Strategy option: a specific method or "ask each time"
export type StrategyOption = string | 'ask' | 'skip'

export interface ZeroingStrategiesConfig {
  initialSetup: StrategyOption
  toolChange: StrategyOption
  afterPause: StrategyOption
}

interface ZeroingStrategiesSectionProps {
  config: ZeroingStrategiesConfig
  availableMethods: ZeroingMethod[]
  onConfigChange: (config: Partial<ZeroingStrategiesConfig>) => void
}

// Icons for method types
const METHOD_ICONS: Record<ZeroingMethodType, React.ReactNode> = {
  'bitsetter': <Target className="w-4 h-4" />,
  'bitzero': <Crosshair className="w-4 h-4" />,
  'touchplate': <SquareDashedBottom className="w-4 h-4" />,
  'manual': <Hand className="w-4 h-4" />,
  'custom': <Settings2 className="w-4 h-4" />,
}

// Scenario metadata
const SCENARIOS: Record<ZeroingScenario, {
  label: string
  description: string
  icon: React.ReactNode
  tooltip: string
}> = {
  'initial-setup': {
    label: 'Initial Job Setup',
    description: 'When starting a new job',
    icon: <Play className="w-5 h-5" />,
    tooltip: 'The zeroing method used when you first set up a job before running. This typically includes X, Y, and Z zeroing.',
  },
  'tool-change': {
    label: 'Mid-job Tool Change',
    description: 'When M6 is encountered',
    icon: <RefreshCw className="w-5 h-5" />,
    tooltip: 'The zeroing method used when a tool change (M6) command is encountered during a job. Usually only Z needs to be re-zeroed.',
  },
  'after-pause': {
    label: 'After Pause/Resume',
    description: 'When resuming after a pause',
    icon: <PauseCircle className="w-5 h-5" />,
    tooltip: 'The zeroing method used when resuming a job after a pause or interruption. Useful if the machine may have moved.',
  },
}

// Axes badge
function AxesBadge({ axes }: { axes: string }) {
  return (
    <div className="flex gap-0.5 ml-2">
      {axes.includes('x') && (
        <span className="w-3.5 h-3.5 rounded text-[9px] font-bold flex items-center justify-center bg-red-500/20 text-red-600 dark:text-red-400">X</span>
      )}
      {axes.includes('y') && (
        <span className="w-3.5 h-3.5 rounded text-[9px] font-bold flex items-center justify-center bg-green-500/20 text-green-600 dark:text-green-400">Y</span>
      )}
      {axes.includes('z') && (
        <span className="w-3.5 h-3.5 rounded text-[9px] font-bold flex items-center justify-center bg-blue-500/20 text-blue-600 dark:text-blue-400">Z</span>
      )}
    </div>
  )
}

// Strategy select dropdown
function StrategySelect({
  value,
  methods,
  onChange,
}: {
  value: StrategyOption
  methods: ZeroingMethod[]
  onChange: (value: StrategyOption) => void
  scenario: ZeroingScenario
}) {
  // Filter to only enabled methods
  const enabledMethods = methods.filter(m => m.enabled)
  
  // Find the selected method (if any)
  const selectedMethod = enabledMethods.find(m => m.id === value)
  
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-64">
        <SelectValue>
          {value === 'ask' && (
            <span className="flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
              Ask Each Time
            </span>
          )}
          {value === 'skip' && (
            <span className="flex items-center gap-2 text-muted-foreground">
              Skip (No Zeroing)
            </span>
          )}
          {selectedMethod && (
            <span className="flex items-center gap-2">
              {METHOD_ICONS[selectedMethod.type]}
              {selectedMethod.name}
              <AxesBadge axes={selectedMethod.axes} />
            </span>
          )}
          {!value && (
            <span className="text-muted-foreground">Select a method...</span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Special options */}
        <SelectItem value="ask">
          <span className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-muted-foreground" />
            Ask Each Time
          </span>
        </SelectItem>
        
        {/* Skip option - most relevant for after-pause */}
        <SelectItem value="skip">
          <span className="flex items-center gap-2 text-muted-foreground">
            Skip (No Zeroing)
          </span>
        </SelectItem>
        
        {/* Divider */}
        {enabledMethods.length > 0 && (
          <div className="h-px bg-border my-1" />
        )}
        
        {/* Available methods */}
        {enabledMethods.map(method => (
          <SelectItem key={method.id} value={method.id}>
            <span className="flex items-center gap-2">
              {METHOD_ICONS[method.type]}
              {method.name}
              <AxesBadge axes={method.axes} />
            </span>
          </SelectItem>
        ))}
        
        {/* Empty state */}
        {enabledMethods.length === 0 && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            No zeroing methods configured.
            <br />
            Add methods in the section above.
          </div>
        )}
      </SelectContent>
    </Select>
  )
}

export function ZeroingStrategiesSection({
  config,
  availableMethods,
  onConfigChange,
}: ZeroingStrategiesSectionProps) {
  return (
    <SettingsSection
      id="zeroing-strategies"
      title="Zeroing Strategies"
      description="Choose which zeroing method to use for different scenarios"
    >
      {/* Initial Setup */}
      <SettingsField
        label={SCENARIOS['initial-setup'].label}
        description={SCENARIOS['initial-setup'].description}
        tooltip={SCENARIOS['initial-setup'].tooltip}
      >
        <StrategySelect
          value={config.initialSetup}
          methods={availableMethods}
          onChange={(value) => onConfigChange({ initialSetup: value })}
          scenario="initial-setup"
        />
      </SettingsField>

      {/* Tool Change */}
      <SettingsField
        label={SCENARIOS['tool-change'].label}
        description={SCENARIOS['tool-change'].description}
        tooltip={SCENARIOS['tool-change'].tooltip}
      >
        <StrategySelect
          value={config.toolChange}
          methods={availableMethods}
          onChange={(value) => onConfigChange({ toolChange: value })}
          scenario="tool-change"
        />
      </SettingsField>

      {/* After Pause */}
      <SettingsField
        label={SCENARIOS['after-pause'].label}
        description={SCENARIOS['after-pause'].description}
        tooltip={SCENARIOS['after-pause'].tooltip}
      >
        <StrategySelect
          value={config.afterPause}
          methods={availableMethods}
          onChange={(value) => onConfigChange({ afterPause: value })}
          scenario="after-pause"
        />
      </SettingsField>

      {/* Helper text */}
      <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
        <p>
          <strong>Tip:</strong> For most setups, use a full XYZ probe (like BitZero) for initial setup, 
          and a Z-only probe (like BitSetter or touch plate) for tool changes.
        </p>
      </div>
    </SettingsSection>
  )
}

