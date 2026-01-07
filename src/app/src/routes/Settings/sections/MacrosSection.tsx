import { useState } from 'react'
import { SettingsSection } from '../SettingsSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, Code, Pencil, Trash2 } from 'lucide-react'

export interface Macro {
  id: string
  name: string
  description?: string
  content: string
  mtime?: number
}

interface MacrosSectionProps {
  macros: Macro[]
  onAdd: (macro: Omit<Macro, 'id' | 'mtime'>) => void
  onEdit: (macro: Macro) => void
  onDelete: (id: string) => void
}

export function MacrosSection({
  macros,
  onAdd,
  onEdit,
  onDelete,
}: MacrosSectionProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingMacro, setEditingMacro] = useState<Macro | null>(null)
  
  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formContent, setFormContent] = useState('')

  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormContent('')
  }

  const handleAdd = () => {
    if (formName.trim() && formContent.trim()) {
      onAdd({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        content: formContent.trim(),
      })
      resetForm()
      setIsAddOpen(false)
    }
  }

  const handleEdit = () => {
    if (editingMacro && formName.trim() && formContent.trim()) {
      onEdit({
        ...editingMacro,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        content: formContent.trim(),
      })
      resetForm()
      setEditingMacro(null)
    }
  }

  const openEditDialog = (macro: Macro) => {
    setFormName(macro.name)
    setFormDescription(macro.description || '')
    setFormContent(macro.content)
    setEditingMacro(macro)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const truncateContent = (content: string, maxLines = 3) => {
    const lines = content.split('\n')
    if (lines.length <= maxLines) return content
    return lines.slice(0, maxLines).join('\n') + '\n...'
  }

  return (
    <SettingsSection
      id="macros"
      title="Macros"
      description="Create reusable G-code sequences for common operations"
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
                Add Macro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Macro</DialogTitle>
                <DialogDescription>
                  Create a new macro with G-code commands.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="macro-name">Name</Label>
                  <Input
                    id="macro-name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Home All Axes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="macro-description">Description</Label>
                  <Input
                    id="macro-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Optional description of what this macro does"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="macro-content">G-code Commands</Label>
                  <Textarea
                    id="macro-content"
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder="$H&#10;G0 X0 Y0 Z0"
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one command per line. Commands will be sent in sequence.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAdd} disabled={!formName.trim() || !formContent.trim()}>
                  Add Macro
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
                <TableHead className="w-40">Name</TableHead>
                <TableHead>Commands</TableHead>
                <TableHead className="w-28">Modified</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {macros.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    <Code className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>No macros configured</p>
                    <p className="text-xs mt-1">Add macros to quickly run common G-code sequences</p>
                  </TableCell>
                </TableRow>
              ) : (
                macros.map((macro) => (
                  <TableRow key={macro.id}>
                    <TableCell>
                      <div className="font-medium">{macro.name}</div>
                      {macro.description && (
                        <div className="text-xs text-muted-foreground mt-0.5">{macro.description}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <pre className="text-xs font-mono text-muted-foreground bg-muted/30 px-2 py-1 rounded max-w-md overflow-hidden">
                        {truncateContent(macro.content)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {macro.mtime ? formatDate(macro.mtime) : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Edit Dialog */}
                        <Dialog open={editingMacro?.id === macro.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditingMacro(null)
                            resetForm()
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(macro)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Macro</DialogTitle>
                              <DialogDescription>
                                Modify the macro name or G-code commands.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-macro-name">Name</Label>
                                <Input
                                  id="edit-macro-name"
                                  value={formName}
                                  onChange={(e) => setFormName(e.target.value)}
                                  placeholder="e.g., Home All Axes"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-macro-description">Description</Label>
                                <Input
                                  id="edit-macro-description"
                                  value={formDescription}
                                  onChange={(e) => setFormDescription(e.target.value)}
                                  placeholder="Optional description"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-macro-content">G-code Commands</Label>
                                <Textarea
                                  id="edit-macro-content"
                                  value={formContent}
                                  onChange={(e) => setFormContent(e.target.value)}
                                  rows={5}
                                  className="font-mono text-sm"
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingMacro(null)}>
                                Cancel
                              </Button>
                              <Button onClick={handleEdit} disabled={!formName.trim() || !formContent.trim()}>
                                Save Changes
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>

                        {/* Delete confirmation */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Macro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{macro.name}"? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(macro.id)}
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
