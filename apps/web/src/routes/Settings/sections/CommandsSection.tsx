import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  onAdd: (command: Omit<Command, 'id' | 'mtime'>) => void
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
  const { t } = useTranslation()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingCommand, setEditingCommand] = useState<Command | null>(null)
  
  // Form state
  const [formTitle, setFormTitle] = useState('')
  const [formCommands, setFormCommands] = useState('')
  const [formEnabled, setFormEnabled] = useState(true)

  const resetForm = () => {
    setFormTitle('')
    setFormCommands('')
    setFormEnabled(true)
  }

  const handleAdd = () => {
    if (formTitle.trim() && formCommands.trim()) {
      onAdd({
        title: formTitle.trim(),
        commands: formCommands.trim(),
        enabled: formEnabled,
      })
      resetForm()
      setIsAddOpen(false)
    }
  }

  const handleEdit = () => {
    if (editingCommand && formTitle.trim() && formCommands.trim()) {
      onEdit({
        ...editingCommand,
        title: formTitle.trim(),
        commands: formCommands.trim(),
        enabled: formEnabled,
      })
      resetForm()
      setEditingCommand(null)
    }
  }

  const openEditDialog = (command: Command) => {
    setFormTitle(command.title)
    setFormCommands(command.commands)
    setFormEnabled(command.enabled)
    setEditingCommand(command)
  }

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
      title={t('Commands')}
      description={t('Create custom command shortcuts for quick access')}
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
                {t('Add Command')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('Add Command')}</DialogTitle>
                <DialogDescription>
                  {t('Create a custom command shortcut that will appear in the command panel.')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="command-title">{t('Title')}</Label>
                  <Input
                    id="command-title"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={t('e.g., Zero All Axes')}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="command-content">{t('G-code Commands')}</Label>
                  <Textarea
                    id="command-content"
                    value={formCommands}
                    onChange={(e) => setFormCommands(e.target.value)}
                    placeholder="G10 L20 P1 X0 Y0 Z0"
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('Enter one command per line. Commands will be sent in sequence.')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="command-enabled"
                    checked={formEnabled}
                    onCheckedChange={setFormEnabled}
                  />
                  <Label htmlFor="command-enabled">{t('Enabled')}</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  {t('Cancel')}
                </Button>
                <Button onClick={handleAdd} disabled={!formTitle.trim() || !formCommands.trim()}>
                  {t('Add Command')}
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
                <TableHead className="w-20">{t('Enabled')}</TableHead>
                <TableHead className="w-40">{t('Title')}</TableHead>
                <TableHead>{t('Commands')}</TableHead>
                <TableHead className="w-28">{t('Modified')}</TableHead>
                <TableHead className="w-24 text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {commands.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('No custom commands configured')}</p>
                    <p className="text-xs mt-1">{t('Add commands to create quick shortcuts for common operations')}</p>
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
                        {/* Edit Dialog */}
                        <Dialog open={editingCommand?.id === command.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditingCommand(null)
                            resetForm()
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(command)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{t('Edit Command')}</DialogTitle>
                              <DialogDescription>
                                {t('Modify the command title or G-code commands.')}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-command-title">{t('Title')}</Label>
                                <Input
                                  id="edit-command-title"
                                  value={formTitle}
                                  onChange={(e) => setFormTitle(e.target.value)}
                                  placeholder={t('e.g., Zero All Axes')}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-command-content">{t('G-code Commands')}</Label>
                                <Textarea
                                  id="edit-command-content"
                                  value={formCommands}
                                  onChange={(e) => setFormCommands(e.target.value)}
                                  rows={5}
                                  className="font-mono text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <Switch
                                  id="edit-command-enabled"
                                  checked={formEnabled}
                                  onCheckedChange={setFormEnabled}
                                />
                                <Label htmlFor="edit-command-enabled">{t('Enabled')}</Label>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingCommand(null)}>
                                {t('Cancel')}
                              </Button>
                              <Button onClick={handleEdit} disabled={!formTitle.trim() || !formCommands.trim()}>
                                {t('Save Changes')}
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
                              <AlertDialogTitle>{t('Delete Command?')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('Are you sure you want to delete "{{title}}"? This action cannot be undone.', { title: command.title })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => onDelete(command.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t('Delete')}
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
