import { useState, useRef, useMemo } from 'react'
import { SettingsSection } from '../SettingsSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import CodeMirror from '@uiw/react-codemirror'
import { gcodeLanguage, gcodeHighlightStyle } from './gcodeLanguage'
import { drawSelection, EditorView } from '@codemirror/view'
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
import { Plus, Code, Pencil, Trash2, ChevronDown, AlertCircle } from 'lucide-react'
import { macroVariables } from './macroVariables'
import { validateMacroParameters } from './macroParameters'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
  const [variablesDropdownOpen, setVariablesDropdownOpen] = useState(false)
  const [variablesDropdownAnchor, setVariablesDropdownAnchor] = useState<HTMLButtonElement | null>(null)
  
  // Form state
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formContent, setFormContent] = useState('')
  
  // Refs for CodeMirror views to insert variables
  const addEditorViewRef = useRef<EditorView | null>(null)
  const editEditorViewRef = useRef<EditorView | null>(null)
  
  // Shared CodeMirror theme - all styling in one place
  const cmTheme = useMemo(() => EditorView.theme({
    // Base editor styling - must set height for scrolling to work
    '&': {
      fontSize: '0.875rem',
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
      height: '100%',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      backgroundColor: 'hsl(var(--background))',
      overflow: 'auto !important',
    },
    '.cm-content': {
      backgroundColor: 'transparent',
      color: 'hsl(var(--foreground))',
      padding: '0.75rem',
      caretColor: 'hsl(var(--foreground))',
    },
    '.cm-cursor': {
      borderLeftColor: 'hsl(var(--foreground))',
    },
    
    // Editor border and focus
    '&.cm-editor': {
      backgroundColor: 'hsl(var(--background))',
      border: '1px solid hsl(var(--input))',
      borderRadius: 'calc(var(--radius) - 2px)',
      height: '100%',
    },
    '&.cm-editor.cm-focused': {
      borderColor: 'hsl(var(--ring))',
      boxShadow: '0 0 0 2px hsl(var(--ring) / 0.2)',
    },
    
    // Gutters (line numbers)
    '.cm-gutters': {
      backgroundColor: 'hsl(var(--background))',
      borderRight: '1px solid hsl(var(--border))',
      color: 'hsl(var(--muted-foreground))',
    },
    '.cm-gutters .cm-gutterElement': {
      padding: '0 0.75rem',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      color: 'hsl(var(--muted-foreground))',
      minWidth: '2.5rem',
      textAlign: 'right',
    },
    '.cm-foldGutter': {
      width: '1rem',
    },
    
    // Active line
    '.cm-activeLine': {
      backgroundColor: 'transparent',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'hsl(var(--foreground))',
    },
    
    // Selection - drawn selection from drawSelection()
    '.cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'hsl(var(--primary) / 0.3) !important',
    },
    '&.cm-focused .cm-selectionLayer .cm-selectionBackground': {
      backgroundColor: 'hsl(var(--primary) / 0.4) !important',
    },
    
    // Same-word highlight (when you double-click a word)
    '.cm-selectionMatch': {
      backgroundColor: 'hsl(var(--primary) / 0.15)',
    },
    
    // Scrollbar styling
    '.cm-scroller::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },
    '.cm-scroller::-webkit-scrollbar-track': {
      backgroundColor: 'transparent',
    },
    '.cm-scroller::-webkit-scrollbar-thumb': {
      backgroundColor: 'hsl(var(--muted-foreground) / 0.3)',
      borderRadius: '4px',
    },
    '.cm-scroller::-webkit-scrollbar-thumb:hover': {
      backgroundColor: 'hsl(var(--muted-foreground) / 0.5)',
    },
  }), [])

  // CodeMirror extensions for add dialog
  const addCodeMirrorExtensions = useMemo(() => [
    gcodeLanguage,
    gcodeHighlightStyle,
    drawSelection(),
    cmTheme,
    EditorView.updateListener.of((update) => {
      if (update.view) {
        addEditorViewRef.current = update.view
      }
    }),
  ], [cmTheme])
  
  // CodeMirror extensions for edit dialog
  const editCodeMirrorExtensions = useMemo(() => [
    gcodeLanguage,
    gcodeHighlightStyle,
    drawSelection(),
    cmTheme,
    EditorView.updateListener.of((update) => {
      if (update.view) {
        editEditorViewRef.current = update.view
      }
    }),
  ], [cmTheme])

  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormContent('')
    setVariablesDropdownOpen(false)
    setVariablesDropdownAnchor(null)
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

  const handleInsertVariable = (variable: string, isEdit: boolean = false) => {
    const view = isEdit ? editEditorViewRef.current : addEditorViewRef.current
    if (view) {
      const { state } = view
      const selection = state.selection.main
      const from = selection.from
      const to = selection.to
      
      // Insert the variable at cursor position
      view.dispatch({
        changes: { from, to, insert: variable },
        selection: { anchor: from + variable.length },
      })
      
      // Update form state
      const newValue = state.doc.toString()
      setFormContent(newValue)
    }
    setVariablesDropdownOpen(false)
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
            <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col overflow-hidden">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle>Add Macro</DialogTitle>
                <DialogDescription>
                  Create a new macro with G-code commands.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin py-4">
                <div className="space-y-4">
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
                {/* Parameters Display */}
                {formContent && (() => {
                  const validation = validateMacroParameters(formContent)
                  const hasParams = validation.declared.length > 0
                  const hasUndeclared = validation.undeclared.length > 0
                  const hasDuplicates = validation.duplicates.length > 0
                  const hasWarnings = hasUndeclared || hasDuplicates
                  return (hasParams || hasWarnings) ? (
                    <Card className="border-muted">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">Parameters</CardTitle>
                          {hasWarnings && (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Validation
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          Parameters declared with <code className="text-xs">; @param name:type</code>
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {validation.declared.length > 0 && (
                          <div>
                            <div className="text-xs font-medium text-muted-foreground mb-2">Declared Parameters:</div>
                            <div className="flex flex-wrap gap-2">
                              {validation.declared.map((param, index) => (
                                <Badge key={`${param.name}-${index}`} variant="secondary" className="font-mono text-xs">
                                  {param.name}:{param.type}
                                  {param.defaultValue && (
                                    <span className="text-muted-foreground ml-1">= {param.defaultValue}</span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {hasDuplicates && (
                          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-destructive mb-1">
                                  Duplicate variable names:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {validation.duplicates.map((param) => (
                                    <code key={param} className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">
                                      {param}
                                    </code>
                                  ))}
                                </div>
                                <div className="text-xs text-muted-foreground mt-2">
                                  Each variable name should only be declared once.
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                        {hasUndeclared && (
                          <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-destructive mb-1">
                                  Undeclared parameters used:
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {validation.undeclared.map((param) => (
                                    <code key={param} className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">
                                      [{param}]
                                    </code>
                                  ))}
                                </div>
                                <div className="text-xs text-muted-foreground mt-2">
                                  Add parameter declarations: <code className="text-xs">; @param {validation.undeclared[0]}:number</code>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ) : null
                })()}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="macro-content">G-code Commands</Label>
                    <div className="relative">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={(e) => {
                          setVariablesDropdownAnchor(e.currentTarget)
                          setVariablesDropdownOpen(!variablesDropdownOpen)
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Macro Variables
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      {variablesDropdownOpen && variablesDropdownAnchor && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setVariablesDropdownOpen(false)}
                          />
                          <div
                            className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-lg max-h-[400px] overflow-y-auto min-w-[320px]"
                            style={{
                              maxHeight: '400px',
                            }}
                          >
                            {macroVariables.map((item, index) => (
                              item.type === 'header' ? (
                                <div
                                  key={`header-${index}`}
                                  className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50"
                                >
                                  {item.text}
                                </div>
                              ) : (
                                <button
                                  key={`var-${index}`}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground font-mono whitespace-pre"
                                  onClick={() => handleInsertVariable(item.value || '', false)}
                                >
                                  {item.value}
                                </button>
                              )
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-[50vh] min-h-0 border rounded-md overflow-hidden">
                    <CodeMirror
                      value={formContent}
                      onChange={(value) => setFormContent(value)}
                      extensions={addCodeMirrorExtensions}
                      placeholder="$H&#10;G0 X0 Y0 Z0"
                      height="100%"
                      style={{ height: '100%' }}
                      basicSetup={{
                        lineNumbers: true,
                        foldGutter: true,
                        dropCursor: false,
                        allowMultipleSelections: false,
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter one command per line. Commands will be sent in sequence.
                  </p>
                </div>
              </div>
              </div>
              <DialogFooter className="flex-shrink-0">
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
                          <DialogContent className="max-w-[95vw] w-full h-[95vh] flex flex-col overflow-hidden">
                            <DialogHeader className="flex-shrink-0">
                              <DialogTitle>Edit Macro</DialogTitle>
                              <DialogDescription>
                                Modify the macro name or G-code commands.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin py-4">
                              <div className="space-y-4">
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
                              {/* Parameters Display */}
                              {formContent && (() => {
                                const validation = validateMacroParameters(formContent)
                                const hasParams = validation.declared.length > 0
                                const hasUndeclared = validation.undeclared.length > 0
                                const hasDuplicates = validation.duplicates.length > 0
                                const hasWarnings = hasUndeclared || hasDuplicates
                                return (hasParams || hasWarnings) ? (
                                  <Card className="border-muted">
                                    <CardHeader className="pb-3">
                                      <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-medium">Parameters</CardTitle>
                                        {hasWarnings && (
                                          <Badge variant="destructive" className="text-xs">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            Validation
                                          </Badge>
                                        )}
                                      </div>
                                      <CardDescription className="text-xs">
                                        Parameters declared with <code className="text-xs">; @param name:type</code>
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                      {validation.declared.length > 0 && (
                                        <div>
                                          <div className="text-xs font-medium text-muted-foreground mb-2">Declared Parameters:</div>
                                          <div className="flex flex-wrap gap-2">
                                            {validation.declared.map((param, index) => (
                                              <Badge key={`${param.name}-${index}`} variant="secondary" className="font-mono text-xs">
                                                {param.name}:{param.type}
                                                {param.defaultValue && (
                                                  <span className="text-muted-foreground ml-1">= {param.defaultValue}</span>
                                                )}
                                              </Badge>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {hasDuplicates && (
                                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                                          <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <div className="text-xs font-medium text-destructive mb-1">
                                                Duplicate variable names:
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {validation.duplicates.map((param) => (
                                                  <code key={param} className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">
                                                    {param}
                                                  </code>
                                                ))}
                                              </div>
                                              <div className="text-xs text-muted-foreground mt-2">
                                                Each variable name should only be declared once.
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {hasUndeclared && (
                                        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-2">
                                          <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                                            <div className="flex-1 min-w-0">
                                              <div className="text-xs font-medium text-destructive mb-1">
                                                Undeclared parameters used:
                                              </div>
                                              <div className="flex flex-wrap gap-1">
                                                {validation.undeclared.map((param) => (
                                                  <code key={param} className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">
                                                    [{param}]
                                                  </code>
                                                ))}
                                              </div>
                                              <div className="text-xs text-muted-foreground mt-2">
                                                Add parameter declarations: <code className="text-xs">; @param {validation.undeclared[0]}:number</code>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                ) : null
                              })()}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="edit-macro-content">G-code Commands</Label>
                                  <div className="relative">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="gap-2"
                                      onClick={(e) => {
                                        setVariablesDropdownAnchor(e.currentTarget)
                                        setVariablesDropdownOpen(!variablesDropdownOpen)
                                      }}
                                    >
                                      <Plus className="w-4 h-4" />
                                      Macro Variables
                                      <ChevronDown className="w-4 h-4" />
                                    </Button>
                                    {variablesDropdownOpen && variablesDropdownAnchor && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-40"
                                          onClick={() => setVariablesDropdownOpen(false)}
                                        />
                                        <div
                                          className="absolute right-0 top-full mt-1 z-50 bg-popover border rounded-md shadow-lg max-h-[400px] overflow-y-auto min-w-[320px]"
                                          style={{
                                            maxHeight: '400px',
                                          }}
                                        >
                                          {macroVariables.map((item, index) => (
                                            item.type === 'header' ? (
                                              <div
                                                key={`header-${index}`}
                                                className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase bg-muted/50"
                                              >
                                                {item.text}
                                              </div>
                                            ) : (
                                              <button
                                                key={`var-${index}`}
                                                type="button"
                                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground font-mono whitespace-pre"
                                                onClick={() => handleInsertVariable(item.value || '', true)}
                                              >
                                                {item.value}
                                              </button>
                                            )
                                          ))}
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="h-[50vh] min-h-0 border rounded-md overflow-hidden">
                                  <CodeMirror
                                    value={formContent}
                                    onChange={(value) => setFormContent(value)}
                                    extensions={editCodeMirrorExtensions}
                                    height="100%"
                                    style={{ height: '100%' }}
                                    basicSetup={{
                                      lineNumbers: true,
                                      foldGutter: true,
                                      dropCursor: false,
                                      allowMultipleSelections: false,
                                    }}
                                  />
                                </div>
                              </div>
                              </div>
                            </div>
                            <DialogFooter className="flex-shrink-0">
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
