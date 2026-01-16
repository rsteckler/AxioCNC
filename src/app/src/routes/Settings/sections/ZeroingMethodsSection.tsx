import { useState } from 'react'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Move } from 'lucide-react'
import { JogPanel } from '@/routes/Setup/panels/JogPanel'
import { useMachineState, useIsConnected, useConnectedPort, useMachinePosition, useWorkPosition, useIsHomed } from '@/store/hooks'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  Plus, 
  Settings2, 
  Trash2,
  Check,
  MapPin,
  ShieldCheck,
  HelpCircle,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Available zeroing method types
export type ZeroingMethodType = 'bitsetter' | 'bitzero' | 'touchplate' | 'manual' | 'custom'

// Which axes a method can zero
export type ZeroingAxes = 'z' | 'xy' | 'xyz'

// Base configuration shared by all methods
interface BaseMethodConfig {
  id: string
  type: ZeroingMethodType
  name: string
  enabled: boolean
  axes: ZeroingAxes
}

// BitSetter - automatic tool length sensor (Z only)
export interface BitSetterConfig extends BaseMethodConfig {
  type: 'bitsetter'
  axes: 'z'
  position: { x: number; y: number; z: number }
  probeFeedrate: number
  probeDistance: number
  retractHeight: number
  requireCheck: boolean
}

// BitZero - corner/edge/center probe (XYZ)
export interface BitZeroConfig extends BaseMethodConfig {
  type: 'bitzero'
  probeThickness: number // Thickness of the probe body
  probeFeedrate: number
  probeDistance: number
  requireCheck: boolean
}

// Touch Plate - simple Z touch plate
export interface TouchPlateConfig extends BaseMethodConfig {
  type: 'touchplate'
  axes: 'z'
  plateThickness: number
  probeFeedrate: number
  probeDistance: number
  requireCheck: boolean
}

// Manual - user manually zeros (always available)
export interface ManualConfig extends BaseMethodConfig {
  type: 'manual'
  // No additional config needed - user just clicks buttons
}

// Custom - user-defined G-code sequence
export interface CustomMethodConfig extends BaseMethodConfig {
  type: 'custom'
  gcode: string
}

export type ZeroingMethod = 
  | BitSetterConfig 
  | BitZeroConfig 
  | TouchPlateConfig 
  | ManualConfig 
  | CustomMethodConfig

export interface ZeroingMethodsConfig {
  methods: ZeroingMethod[]
}

interface ZeroingMethodsSectionProps {
  config: ZeroingMethodsConfig
  onConfigChange: (config: Partial<ZeroingMethodsConfig>) => void
}

// Method type metadata
const METHOD_TYPES: Record<ZeroingMethodType, { 
  icon: React.ReactNode
  title: string 
  description: string 
  defaultAxes: ZeroingAxes
  canChangeAxes: boolean
}> = {
  'bitsetter': {
    icon: <Target className="w-5 h-5" />,
    title: 'BitSetter',
    description: 'Automatic tool length sensor mounted at a fixed position',
    defaultAxes: 'z',
    canChangeAxes: false,
  },
  'bitzero': {
    icon: <Crosshair className="w-5 h-5" />,
    title: 'BitZero',
    description: 'Corner, edge, or center probe for X, Y, and Z zeroing',
    defaultAxes: 'xyz',
    canChangeAxes: true,
  },
  'touchplate': {
    icon: <SquareDashedBottom className="w-5 h-5" />,
    title: 'Touch Plate',
    description: 'Simple touch plate for Z-axis zeroing',
    defaultAxes: 'z',
    canChangeAxes: false,
  },
  'manual': {
    icon: <Hand className="w-5 h-5" />,
    title: 'Manual',
    description: 'Manually jog to position and set zero',
    defaultAxes: 'xyz',
    canChangeAxes: true,
  },
  'custom': {
    icon: <Settings2 className="w-5 h-5" />,
    title: 'Custom',
    description: 'Custom G-code sequence for zeroing',
    defaultAxes: 'xyz',
    canChangeAxes: true,
  },
}

// Default configurations for each method type
function createDefaultMethod(type: ZeroingMethodType, existingMethods: ZeroingMethod[]): ZeroingMethod {
  const baseId = `${type}-${Date.now()}`
  const typeInfo = METHOD_TYPES[type]
  
  // Count existing methods of this type for naming
  const count = existingMethods.filter(m => m.type === type).length
  const suffix = count > 0 ? ` ${count + 1}` : ''
  
  const base = {
    id: baseId,
    name: `${typeInfo.title}${suffix}`,
    enabled: true,
    axes: typeInfo.defaultAxes,
  }

  switch (type) {
    case 'bitsetter':
      return {
        ...base,
        type: 'bitsetter',
        axes: 'z',
        position: { x: 0, y: 0, z: -50 },
        probeFeedrate: 100,
        probeDistance: 50,
        retractHeight: 10,
        requireCheck: true,
      }
    case 'bitzero':
      return {
        ...base,
        type: 'bitzero',
        axes: 'xyz',
        probeThickness: 12.7, // 0.5" is common
        probeFeedrate: 100,
        probeDistance: 25,
        requireCheck: true,
      }
    case 'touchplate':
      return {
        ...base,
        type: 'touchplate',
        axes: 'z',
        plateThickness: 3.175, // 1/8" is common
        probeFeedrate: 100,
        probeDistance: 50,
        requireCheck: false,
      }
    case 'manual':
      return {
        ...base,
        type: 'manual',
        axes: 'xyz',
      }
    case 'custom':
      return {
        ...base,
        type: 'custom',
        axes: 'xyz',
        gcode: '; Enter your custom zeroing G-code here\n',
      }
  }
}

// Axes badge component
function AxesBadge({ axes }: { axes: ZeroingAxes }) {
  return (
    <div className="flex gap-0.5">
      {axes.includes('x') && (
        <span className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-red-500/20 text-red-600 dark:text-red-400">X</span>
      )}
      {axes.includes('y') && (
        <span className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-green-500/20 text-green-600 dark:text-green-400">Y</span>
      )}
      {axes.includes('z') && (
        <span className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center bg-blue-500/20 text-blue-600 dark:text-blue-400">Z</span>
      )}
    </div>
  )
}

// Method card component
function MethodCard({ 
  method, 
  onEdit, 
  onDelete, 
  onToggle,
  isManual,
}: { 
  method: ZeroingMethod
  onEdit: () => void
  onDelete: () => void
  onToggle: (enabled: boolean) => void
  isManual: boolean
}) {
  const typeInfo = METHOD_TYPES[method.type]
  
  return (
    <Card className={cn(
      'transition-opacity',
      !method.enabled && 'opacity-50'
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-2 rounded-lg',
              method.enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
            )}>
              {typeInfo.icon}
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {method.name}
                <AxesBadge axes={method.axes} />
              </CardTitle>
              <CardDescription className="text-xs">
                {typeInfo.title}
              </CardDescription>
            </div>
          </div>
          <Switch 
            checked={method.enabled} 
            onCheckedChange={onToggle}
            disabled={isManual}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground line-clamp-1">
            {getMethodSummary(method)}
          </p>
          {!isManual && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={onEdit}>
                <Settings2 className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Get a summary string for a method
function getMethodSummary(method: ZeroingMethod): string {
  switch (method.type) {
    case 'bitsetter':
      return `Position: (${method.position.x}, ${method.position.y}, ${method.position.z})`
    case 'bitzero':
      return `Probe thickness: ${method.probeThickness}mm`
    case 'touchplate':
      return `Plate thickness: ${method.plateThickness}mm`
    case 'manual':
      return 'Jog to position and set zero manually'
    case 'custom':
      return method.gcode.split('\n')[0] || 'Custom G-code sequence'
  }
}

// Add method button card
function AddMethodCard({ onClick }: { onClick: () => void }) {
  return (
    <Card 
      className="border-dashed cursor-pointer hover:border-primary hover:bg-accent/50 transition-colors"
      onClick={onClick}
    >
      <CardContent className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Plus className="w-8 h-8 mb-2" />
        <span className="text-sm font-medium">Add Zeroing Method</span>
      </CardContent>
    </Card>
  )
}

export function ZeroingMethodsSection({
  config,
  onConfigChange,
}: ZeroingMethodsSectionProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editingMethod, setEditingMethod] = useState<ZeroingMethod | null>(null)
  const [isNewMethod, setIsNewMethod] = useState(false) // Track if we're adding vs editing
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Ensure Manual method always exists
  const methods = config.methods
  const hasManual = methods.some(m => m.type === 'manual')
  
  // Handle selecting a method type to add (doesn't save yet)
  const handleSelectMethodType = (type: ZeroingMethodType) => {
    const newMethod = createDefaultMethod(type, methods)
    setAddDialogOpen(false)
    setIsNewMethod(true)
    setEditingMethod(newMethod)
  }

  // Handle saving a method (both new and edited)
  const handleSaveMethod = (method: ZeroingMethod) => {
    if (isNewMethod) {
      // Adding a new method
      onConfigChange({
        methods: [...methods, method],
      })
    } else {
      // Updating an existing method
      onConfigChange({
        methods: methods.map(m => m.id === method.id ? method : m),
      })
    }
    setEditingMethod(null)
    setIsNewMethod(false)
  }

  // Handle closing the edit dialog without saving
  const handleCloseEditDialog = () => {
    setEditingMethod(null)
    setIsNewMethod(false)
  }

  // Handle deleting a method
  const handleDeleteMethod = (id: string) => {
    onConfigChange({
      methods: methods.filter(m => m.id !== id),
    })
    setDeleteConfirm(null)
  }

  // Handle toggling method enabled state
  const handleToggleMethod = (id: string, enabled: boolean) => {
    onConfigChange({
      methods: methods.map(m => m.id === id ? { ...m, enabled } : m),
    })
  }

  return (
    <SettingsSection
      id="zeroing-methods"
      title="Zeroing Methods"
      description="Configure the zeroing tools and methods available on your machine"
    >
      {/* Method cards grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Always show Manual first if it exists */}
        {hasManual && methods.filter(m => m.type === 'manual').map(method => (
          <MethodCard
            key={method.id}
            method={method}
            onEdit={() => { setIsNewMethod(false); setEditingMethod(method) }}
            onDelete={() => {}} // Manual can't be deleted
            onToggle={() => {}} // Manual can't be disabled
            isManual={true}
          />
        ))}
        
        {/* Other methods */}
        {methods.filter(m => m.type !== 'manual').map(method => (
          <MethodCard
            key={method.id}
            method={method}
            onEdit={() => { setIsNewMethod(false); setEditingMethod(method) }}
            onDelete={() => setDeleteConfirm(method.id)}
            onToggle={(enabled) => handleToggleMethod(method.id, enabled)}
            isManual={false}
          />
        ))}
        
        {/* Add button */}
        <AddMethodCard onClick={() => setAddDialogOpen(true)} />
      </div>

      {/* Add Method Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Zeroing Method</DialogTitle>
            <DialogDescription>
              Choose a type of zeroing method to add to your machine
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {(Object.entries(METHOD_TYPES) as [ZeroingMethodType, typeof METHOD_TYPES[ZeroingMethodType]][])
              .filter(([type]) => type !== 'manual') // Can't add another Manual
              .map(([type, info]) => (
                <button
                  key={type}
                  onClick={() => handleSelectMethodType(type)}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent text-left transition-colors"
                >
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    {info.icon}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {info.title}
                      <AxesBadge axes={info.defaultAxes} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {info.description}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Method Dialog */}
      <MethodEditDialog
        method={editingMethod}
        onSave={handleSaveMethod}
        onClose={handleCloseEditDialog}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Zeroing Method</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this zeroing method? Any strategies using this method will need to be reconfigured.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteConfirm && handleDeleteMethod(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}

// Method Edit Dialog
function MethodEditDialog({
  method,
  onSave,
  onClose,
}: {
  method: ZeroingMethod | null
  onSave: (method: ZeroingMethod) => void
  onClose: () => void
}) {
  const [editedMethod, setEditedMethod] = useState<ZeroingMethod | null>(null)

  // Update local state when method changes
  useState(() => {
    if (method) {
      setEditedMethod({ ...method })
    }
  })

  // Reset when dialog opens/closes
  if (method && !editedMethod) {
    setEditedMethod({ ...method })
  }
  if (!method && editedMethod) {
    setEditedMethod(null)
  }

  const handleSave = () => {
    if (editedMethod) {
      onSave(editedMethod)
      setEditedMethod(null)
    }
  }

  const handleClose = () => {
    setEditedMethod(null)
    onClose()
  }

  if (!method || !editedMethod) return null

  const typeInfo = METHOD_TYPES[editedMethod.type]

  return (
    <Dialog open={!!method} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {typeInfo.icon}
            Configure {typeInfo.title}
          </DialogTitle>
          <DialogDescription>
            {typeInfo.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <SettingsField label="Name" description="A friendly name for this method">
            <Input
              value={editedMethod.name}
              onChange={(e) => setEditedMethod({ ...editedMethod, name: e.target.value })}
              className="max-w-xs"
            />
          </SettingsField>

          {/* Axes selection (if changeable) */}
          {typeInfo.canChangeAxes && editedMethod.type !== 'manual' && (
            <SettingsField label="Axes" description="Which axes this method zeros">
              <Select
                value={editedMethod.axes}
                onValueChange={(value: ZeroingAxes) => setEditedMethod({ ...editedMethod, axes: value } as ZeroingMethod)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="z">Z only</SelectItem>
                  <SelectItem value="xy">X and Y</SelectItem>
                  <SelectItem value="xyz">X, Y, and Z</SelectItem>
                </SelectContent>
              </Select>
            </SettingsField>
          )}

          {/* Type-specific settings */}
          {editedMethod.type === 'bitsetter' && (
            <BitSetterSettings 
              config={editedMethod} 
              onChange={(changes) => setEditedMethod({ ...editedMethod, ...changes })}
              onSetFromCurrentPosition={undefined}
            />
          )}
          {editedMethod.type === 'bitzero' && (
            <BitZeroSettings 
              config={editedMethod} 
              onChange={(changes) => setEditedMethod({ ...editedMethod, ...changes })} 
            />
          )}
          {editedMethod.type === 'touchplate' && (
            <TouchPlateSettings 
              config={editedMethod} 
              onChange={(changes) => setEditedMethod({ ...editedMethod, ...changes })} 
            />
          )}
          {editedMethod.type === 'custom' && (
            <CustomMethodSettings 
              config={editedMethod} 
              onChange={(changes) => setEditedMethod({ ...editedMethod, ...changes })} 
            />
          )}
          {editedMethod.type === 'manual' && (
            <p className="text-sm text-muted-foreground">
              Manual zeroing requires no configuration. Use the jog controls and zero buttons in the main interface.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={editedMethod.type === 'bitsetter' && editedMethod.position.x === 0 && editedMethod.position.y === 0 && editedMethod.position.z === -50}
          >
            <Check className="w-4 h-4 mr-2" />
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// BitSetter specific settings
function BitSetterSettings({ 
  config, 
  onChange,
  onSetFromCurrentPosition,
}: { 
  config: BitSetterConfig
  onChange: (changes: Partial<BitSetterConfig>) => void
  onSetFromCurrentPosition?: () => void
}) {
  const [jogDialogOpen, setJogDialogOpen] = useState(false)
  const machineState = useMachineState()
  const isConnected = useIsConnected()
  const connectedPort = useConnectedPort()
  const machinePosition = useMachinePosition()
  const workPosition = useWorkPosition()
  const isHomed = useIsHomed()
  
  // Determine machine status from backend status
  const machineStatus = machineState.backendStatus?.machineStatus || (isConnected ? 'connected_post_home' : 'not_connected')
  
  // Check if machine is connected and homed
  const isConnectedAndHomed = isConnected && isHomed
  
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div>
          <Label className="text-sm font-medium">BitSetter Position (Machine Coordinates)</Label>
          <p className="text-xs text-muted-foreground">
            The fixed position of the BitSetter on your machine bed
          </p>
        </div>
        <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-blue-900 dark:text-blue-100">
            Open Jog Controls and move the tool to the BitSetter location. Once positioned, press "Set from Current" to capture the machine coordinates.
          </p>
        </div>
        {!isConnectedAndHomed && (
          <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-red-900 dark:text-red-100">
              <strong>Critical:</strong> The machine must be connected and homed before setting the BitSetter location. This ensures accurate machine coordinates.
            </p>
          </div>
        )}
        <div className="flex items-center justify-start gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setJogDialogOpen(true)}
            className="gap-2"
            disabled={!isConnectedAndHomed}
          >
            <Move className="w-4 h-4" />
            Jog Controls
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              onChange({ position: { x: machinePosition.x, y: machinePosition.y, z: machinePosition.z } })
            }}
            className="gap-1.5"
            disabled={!isConnectedAndHomed}
          >
            <MapPin className="w-3.5 h-3.5" />
            Set from Current
          </Button>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Stored BitSetter Position:</div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">X: </span>
              <span className="font-mono">
                {config.position.x === 0 && config.position.y === 0 && config.position.z === -50 ? '--' : config.position.x.toFixed(3)}
              </span>
              <span className="text-muted-foreground text-xs ml-1">{config.position.x === 0 && config.position.y === 0 && config.position.z === -50 ? '' : 'mm'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Y: </span>
              <span className="font-mono">
                {config.position.x === 0 && config.position.y === 0 && config.position.z === -50 ? '--' : config.position.y.toFixed(3)}
              </span>
              <span className="text-muted-foreground text-xs ml-1">{config.position.x === 0 && config.position.y === 0 && config.position.z === -50 ? '' : 'mm'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Z: </span>
              <span className="font-mono">
                {config.position.x === 0 && config.position.y === 0 && config.position.z === -50 ? '--' : config.position.z.toFixed(3)}
              </span>
              <span className="text-muted-foreground text-xs ml-1">{config.position.x === 0 && config.position.y === 0 && config.position.z === -50 ? '' : 'mm'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <SettingsField label="Probe Distance" tooltip="Maximum distance to probe before failing">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.probeDistance}
              onChange={(e) => onChange({ probeDistance: parseFloat(e.target.value) || 0 })}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">mm</span>
          </div>
        </SettingsField>

        <SettingsField label="Probe Feedrate" tooltip="Speed during probing">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.probeFeedrate}
              onChange={(e) => onChange({ probeFeedrate: parseFloat(e.target.value) || 0 })}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">mm/min</span>
          </div>
        </SettingsField>
      </div>

      {/* Require Check Before Running */}
      <div className="pt-2 border-t">
        <div className="flex items-start gap-3">
          <Switch
            checked={config.requireCheck}
            onCheckedChange={(checked) => onChange({ requireCheck: checked })}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              Require Check Before Running
            </Label>
            <p className="text-xs text-muted-foreground">
              Before probing, you'll be asked to touch the probe to verify the circuit is working. 
              This prevents crashes if the probe wire is disconnected or the sensor has failed.
            </p>
          </div>
        </div>
      </div>

      {/* Jog Controls Dialog */}
      <Dialog open={jogDialogOpen} onOpenChange={setJogDialogOpen}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Jog Controls</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            <JogPanel
              isConnected={isConnected}
              connectedPort={connectedPort}
              machineStatus={machineStatus}
              onFlashStatus={() => {}}
              machinePosition={machinePosition}
              workPosition={workPosition}
            />
          </div>
          <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg mt-4">
            <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Jog your machine to the location of the BitSetter, then close this dialog and click "Set from Current".
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// BitZero specific settings
function BitZeroSettings({ 
  config, 
  onChange 
}: { 
  config: BitZeroConfig
  onChange: (changes: Partial<BitZeroConfig>) => void 
}) {
  return (
    <div className="space-y-4">
      <SettingsField 
        label="Probe Body Thickness" 
        description="The thickness of the BitZero probe body"
        tooltip="This is subtracted from probe results to account for the probe's physical size"
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.01"
            value={config.probeThickness}
            onChange={(e) => onChange({ probeThickness: parseFloat(e.target.value) || 0 })}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">mm</span>
        </div>
      </SettingsField>

      <div className="grid grid-cols-2 gap-4">
        <SettingsField label="Probe Distance" tooltip="Maximum distance to probe">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.probeDistance}
              onChange={(e) => onChange({ probeDistance: parseFloat(e.target.value) || 0 })}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">mm</span>
          </div>
        </SettingsField>

        <SettingsField label="Probe Feedrate" tooltip="Speed during probing">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.probeFeedrate}
              onChange={(e) => onChange({ probeFeedrate: parseFloat(e.target.value) || 0 })}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">mm/min</span>
          </div>
        </SettingsField>
      </div>

      {/* Require Check Before Running */}
      <div className="pt-2 border-t">
        <div className="flex items-start gap-3">
          <Switch
            checked={config.requireCheck}
            onCheckedChange={(checked) => onChange({ requireCheck: checked })}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              Require Check Before Running
            </Label>
            <p className="text-xs text-muted-foreground">
              Before probing, you'll be asked to touch the probe to verify the circuit is working. 
              This prevents crashes if the probe wire is disconnected or the sensor has failed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Touch Plate specific settings
function TouchPlateSettings({ 
  config, 
  onChange 
}: { 
  config: TouchPlateConfig
  onChange: (changes: Partial<TouchPlateConfig>) => void 
}) {
  return (
    <div className="space-y-4">
      <SettingsField 
        label="Plate Thickness" 
        description="The thickness of your touch plate"
        tooltip="This is subtracted from the Z probe result"
      >
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.001"
            value={config.plateThickness}
            onChange={(e) => onChange({ plateThickness: parseFloat(e.target.value) || 0 })}
            className="w-24"
          />
          <span className="text-xs text-muted-foreground">mm</span>
        </div>
      </SettingsField>

      <div className="grid grid-cols-2 gap-4">
        <SettingsField label="Probe Distance" tooltip="Maximum distance to probe">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.probeDistance}
              onChange={(e) => onChange({ probeDistance: parseFloat(e.target.value) || 0 })}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">mm</span>
          </div>
        </SettingsField>

        <SettingsField label="Probe Feedrate" tooltip="Speed during probing">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={config.probeFeedrate}
              onChange={(e) => onChange({ probeFeedrate: parseFloat(e.target.value) || 0 })}
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">mm/min</span>
          </div>
        </SettingsField>
      </div>

      {/* Require Check Before Running */}
      <div className="pt-2 border-t">
        <div className="flex items-start gap-3">
          <Switch
            checked={config.requireCheck}
            onCheckedChange={(checked) => onChange({ requireCheck: checked })}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label className="text-sm font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" />
              Require Check Before Running
            </Label>
            <p className="text-xs text-muted-foreground">
              Before probing, you'll be asked to touch the probe to verify the circuit is working. 
              This prevents crashes if the probe wire is disconnected or the sensor has failed.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Custom method settings
function CustomMethodSettings({ 
  config, 
  onChange 
}: { 
  config: CustomMethodConfig
  onChange: (changes: Partial<CustomMethodConfig>) => void 
}) {
  return (
    <div className="space-y-4">
      <SettingsField 
        label="G-code Sequence" 
        description="Custom G-code to execute for zeroing"
        tooltip="This G-code will be executed when this zeroing method is used"
      >
        <textarea
          value={config.gcode}
          onChange={(e) => onChange({ gcode: e.target.value })}
          className="w-full h-32 px-3 py-2 text-sm font-mono border rounded-md bg-background resize-none"
          placeholder="; Enter your custom zeroing G-code"
        />
      </SettingsField>
    </div>
  )
}

