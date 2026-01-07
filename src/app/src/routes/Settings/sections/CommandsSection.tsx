import { SettingsSection } from '../SettingsSection'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
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
import { Plus, Pencil, Trash2, Terminal } from 'lucide-react'

export interface Command {
  id: string
  title: string
  commands: string
  enabled: boolean
  mtime?: number
}

interface CommandsSectionProps {
  commands: Command[]
  onAdd: () => void
  onEdit: (command: Command) => void
  onDelete: (id: string) => void
  onToggleEnabled: (id: string, enabled: boolean) => void
}

export function CommandsSection({
  commands,
  onAdd,
  onEdit,
  onDelete,
  onToggleEnabled,
}: CommandsSectionProps) {
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '–'
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const truncateCommands = (cmds: string, maxLines = 3) => {
    const lines = cmds.split('\n')
    if (lines.length <= maxLines) return cmds
    return lines.slice(0, maxLines).join('\n') + '\n...'
  }

  return (
    <SettingsSection
      id="commands"
      title="Commands"
      description="Create custom command shortcuts for quick access"
    >
      <div className="space-y-4">
        {/* Add Button */}
        <div className="flex justify-between items-center">
          <Button onClick={onAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Command
          </Button>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Enabled</TableHead>
                <TableHead className="w-40">Title</TableHead>
                <TableHead>Commands</TableHead>
                <TableHead className="w-28">Modified</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No custom commands configured</p>
                    <p className="text-xs mt-1">Add commands to create quick shortcuts for common operations</p>
                  </TableCell>
                </TableRow>
              ) : (
                commands.map((command) => (
                  <TableRow key={command.id}>
                    <TableCell>
                      <Switch
                        checked={command.enabled}
                        onCheckedChange={(checked) => onToggleEnabled(command.id, checked)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{command.title}</TableCell>
                    <TableCell>
                      <pre className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded max-w-md overflow-hidden">
                        {truncateCommands(command.commands)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(command.mtime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onEdit(command)}
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
                              <AlertDialogTitle>Delete Command?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{command.title}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onDelete(command.id)}>
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

