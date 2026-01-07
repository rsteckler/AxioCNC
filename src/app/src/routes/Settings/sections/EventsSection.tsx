import { SettingsSection } from '../SettingsSection'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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

interface EventsSectionProps {
  events: EventHandler[]
  onAdd: () => void
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
          <Button onClick={onAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Event Handler
          </Button>
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
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(event)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
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
                              <AlertDialogAction onClick={() => onDelete(event.id)}>
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

