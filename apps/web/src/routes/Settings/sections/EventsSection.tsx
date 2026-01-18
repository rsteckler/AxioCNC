import { useState } from 'react'
import { SettingsSection } from '../SettingsSection'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Zap } from 'lucide-react'

export type EventType = 
  | 'startup'
  | 'port:open'
  | 'port:close'
  | 'controller:ready'
  | 'gcode:load'
  | 'gcode:unload'
  | 'gcode:start'
  | 'gcode:stop'
  | 'gcode:pause'
  | 'gcode:resume'
  | 'feedhold'
  | 'cyclestart'
  | 'homing'
  | 'sleep'
  | 'macro:run'
  | 'macro:load'

export type TriggerType = 'system' | 'gcode'

export interface EventHandler {
  id: string
  event: EventType
  trigger: TriggerType
  commands: string
  enabled: boolean
  mtime?: number
}

const EVENT_LABELS: Record<EventType, string> = {
  'startup': 'Startup',
  'port:open': 'Port Open',
  'port:close': 'Port Close',
  'controller:ready': 'Ready to Start',
  'gcode:load': 'G-code: Load',
  'gcode:unload': 'G-code: Unload',
  'gcode:start': 'G-code: Start',
  'gcode:stop': 'G-code: Stop',
  'gcode:pause': 'G-code: Pause',
  'gcode:resume': 'G-code: Resume',
  'feedhold': 'Feed Hold',
  'cyclestart': 'Cycle Start',
  'homing': 'Homing',
  'sleep': 'Sleep',
  'macro:run': 'Run Macro',
  'macro:load': 'Load Macro',
}

const EVENT_OPTIONS = Object.entries(EVENT_LABELS).map(([value, label]) => ({
  value: value as EventType,
  label,
}))

interface EventsSectionProps {
  events: EventHandler[]
  onAdd: (event: Omit<EventHandler, 'id' | 'mtime'>) => void
  onEdit: (event: EventHandler) => void
  onDelete: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
}

export function EventsSection({
  events,
  onAdd,
  onEdit,
  onDelete,
  onToggleEnabled,
}: EventsSectionProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<EventHandler | null>(null)
  
  // Form state
  const [formEvent, setFormEvent] = useState<EventType>('startup')
  const [formTrigger, setFormTrigger] = useState<TriggerType>('gcode')
  const [formCommands, setFormCommands] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)

  const resetForm = () => {
    setFormEvent('startup')
    setFormTrigger('gcode')
    setFormCommands('')
    setFormEnabled(true)
  }

  const handleAdd = () => {
    if (formCommands.trim()) {
      onAdd({
        event: formEvent,
        trigger: formTrigger,
        commands: formCommands.trim(),
        enabled: formEnabled,
      })
      resetForm()
      setIsAddOpen(false)
    }
  }

  const handleEdit = () => {
    if (editingEvent && formCommands.trim()) {
      onEdit({
        ...editingEvent,
        event: formEvent,
        trigger: formTrigger,
        commands: formCommands.trim(),
        enabled: formEnabled,
      })
      resetForm()
      setEditingEvent(null)
    }
  }

  const openEditDialog = (event: EventHandler) => {
    setFormEvent(event.event)
    setFormTrigger(event.trigger)
    setFormCommands(event.commands)
    setFormEnabled(event.enabled)
    setEditingEvent(event)
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '–'
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const truncateCommands = (cmds: string, maxLines = 2) => {
    const lines = cmds.split('\n')
    if (lines.length <= maxLines) return cmds
    return lines.slice(0, maxLines).join('\n') + '\n...'
  }

  return (
    <SettingsSection
      id="events"
      title="Events"
      description="Trigger actions when specific events occur during operation"
    >
      <div className="space-y-4">
        {/* Add Button */}
        <div className="flex justify-between items-center">
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Event Handler
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Event Handler</DialogTitle>
                <DialogDescription>
                  Create a handler that runs commands when a specific event occurs.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="event-type">Event</Label>
                  <Select value={formEvent} onValueChange={(v) => setFormEvent(v as EventType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trigger Type</Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="trigger"
                        checked={formTrigger === 'gcode'}
                        onChange={() => setFormTrigger('gcode')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">G-code Commands</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="trigger"
                        checked={formTrigger === 'system'}
                        onChange={() => setFormTrigger('system')}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">System Command</span>
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formTrigger === 'gcode' 
                      ? 'Commands will be sent to the CNC controller'
                      : 'Commands will be executed as shell commands on the server'
                    }
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-commands">Commands</Label>
                  <Textarea
                    id="event-commands"
                    value={formCommands}
                    onChange={(e) => setFormCommands(e.target.value)}
                    placeholder={formTrigger === 'gcode' ? 'M3 S1000' : '/path/to/script.sh'}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="event-enabled"
                    checked={formEnabled}
                    onCheckedChange={setFormEnabled}
                  />
                  <Label htmlFor="event-enabled">Enabled</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={!formCommands.trim()}>
                  Add Handler
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Enabled</TableHead>
                <TableHead className="w-36">Event</TableHead>
                <TableHead className="w-24">Trigger</TableHead>
                <TableHead>Commands</TableHead>
                <TableHead className="w-28">Modified</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No event handlers configured</p>
                    <p className="text-xs mt-1">Add handlers to trigger actions on specific events</p>
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Switch
                        checked={event.enabled}
                        onCheckedChange={(checked) => onToggleEnabled(event.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {EVENT_LABELS[event.event] || event.event}
                    </TableCell>
                    <TableCell>
                      <Badge variant={event.trigger === 'system' ? 'secondary' : 'outline'}>
                        {event.trigger === 'system' ? 'System' : 'G-code'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <pre className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded max-w-xs overflow-hidden">
                        {truncateCommands(event.commands)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(event.mtime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Edit Dialog */}
                        <Dialog open={editingEvent?.id === event.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditingEvent(null)
                            resetForm()
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(event)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Event Handler</DialogTitle>
                              <DialogDescription>
                                Modify the event handler settings.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-event-type">Event</Label>
                                <Select value={formEvent} onValueChange={(v) => setFormEvent(v as EventType)}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {EVENT_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Trigger Type</Label>
                                <div className="flex gap-4">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="edit-trigger"
                                      checked={formTrigger === 'gcode'}
                                      onChange={() => setFormTrigger('gcode')}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">G-code Commands</span>
                                  </label>
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="edit-trigger"
                                      checked={formTrigger === 'system'}
                                      onChange={() => setFormTrigger('system')}
                                      className="w-4 h-4"
                                    />
                                    <span className="text-sm">System Command</span>
                                  </label>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-event-commands">Commands</Label>
                                <Textarea
                                  id="edit-event-commands"
                                  value={formCommands}
                                  onChange={(e) => setFormCommands(e.target.value)}
                                  rows={4}
                                  className="font-mono text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  id="edit-event-enabled"
                                  checked={formEnabled}
                                  onCheckedChange={setFormEnabled}
                                />
                                <Label htmlFor="edit-event-enabled">Enabled</Label>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingEvent(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleEdit} disabled={!formCommands.trim()}>
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Event Handler?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this "{EVENT_LABELS[event.event]}" handler? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => onDelete(event.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </SettingsSection>
  )
}
