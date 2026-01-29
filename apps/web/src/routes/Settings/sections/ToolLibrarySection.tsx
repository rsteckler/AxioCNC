import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SettingsSection } from '../SettingsSection'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Plus, Pencil, Trash2, Wrench } from 'lucide-react'
import { mmToInches, inchesToMm } from '@/utils/units'

export interface Tool {
  id: string
  toolId: number  // Tool number (T0, T1, T2...Tn) - matches CAM software IDs
  name: string
  description?: string
  diameter?: number | null  // Diameter value (null if not specified)
  diameterUnit?: 'mm' | 'in'  // Unit for diameter (defaults to 'mm' if not specified)
  type?: string  // Tool type (ballnose, straight, vbit, engraver, drill, chamfer, etc.)
  mtime?: number
}

// Tool type options for quick selection
const TOOL_TYPE_OPTIONS = [
  'ballnose',
  'straight',
  'vbit',
  'engraver',
  'drill',
  'chamfer',
  'other',
] as const

type ToolTypeOption = typeof TOOL_TYPE_OPTIONS[number]

interface ToolLibrarySectionProps {
  tools: Tool[]
  onAdd: (tool: Omit<Tool, 'id' | 'mtime'>) => void
  onEdit: (tool: Tool) => void
  onDelete: (id: string) => void
}

export function ToolLibrarySection({
  tools,
  onAdd,
  onEdit,
  onDelete,
}: ToolLibrarySectionProps) {
  const { t } = useTranslation()
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  
  // Form state
  const [formToolId, setFormToolId] = useState('')
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDiameter, setFormDiameter] = useState('')
  const [formDiameterUnit, setFormDiameterUnit] = useState<'mm' | 'in'>('mm')
  const [formType, setFormType] = useState<string>('')
  const [isTypeCustom, setIsTypeCustom] = useState(false)

  const resetForm = () => {
    setFormToolId('')
    setFormName('')
    setFormDescription('')
    setFormDiameter('')
    setFormDiameterUnit('mm')
    setFormType('')
    setIsTypeCustom(false)
  }

  const handleAdd = () => {
    const toolIdNum = parseInt(formToolId, 10)
    if (isNaN(toolIdNum) || toolIdNum < 0 || !formName.trim()) {
      return
    }

    // Store diameter in the selected unit (don't convert)
    let diameterValue: number | null = null
    if (formDiameter.trim()) {
      const parsed = parseFloat(formDiameter)
      if (!isNaN(parsed)) {
        diameterValue = parsed
      }
    }

    onAdd({
      toolId: toolIdNum,
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      diameter: diameterValue,
      diameterUnit: diameterValue != null ? formDiameterUnit : undefined,
      type: formType.trim() || undefined,
    })
    resetForm()
    setIsAddOpen(false)
  }

  const handleEdit = () => {
    if (editingTool && formName.trim()) {
      const toolIdNum = parseInt(formToolId, 10)
      if (isNaN(toolIdNum) || toolIdNum < 0) {
        return
      }

      // Store diameter in the selected unit (don't convert)
      let diameterValue: number | null = null
      if (formDiameter.trim()) {
        const parsed = parseFloat(formDiameter)
        if (!isNaN(parsed)) {
          diameterValue = parsed
        }
      }

      onEdit({
        ...editingTool,
        toolId: toolIdNum,
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        diameter: diameterValue,
        diameterUnit: diameterValue != null ? formDiameterUnit : undefined,
        type: formType.trim() || undefined,
      })
      resetForm()
      setEditingTool(null)
    }
  }

  const openEditDialog = (tool: Tool) => {
    setFormToolId(tool.toolId.toString())
    setFormName(tool.name)
    setFormDescription(tool.description || '')
    // When editing, use the stored unit (don't convert)
    setFormDiameter(tool.diameter?.toString() || '')
    setFormDiameterUnit(tool.diameterUnit || 'mm')  // Use stored unit, default to mm
    const toolType = tool.type || ''
    setFormType(toolType)
    setIsTypeCustom(!TOOL_TYPE_OPTIONS.includes(toolType as ToolTypeOption))
    setEditingTool(tool)
  }

  const handleTypeChange = (value: string) => {
    if (value === 'other') {
      setIsTypeCustom(true)
      setFormType('')  // Clear so user can type
    } else {
      setIsTypeCustom(false)
      setFormType(value)
    }
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '–'
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  // Sort tools by toolId
  const sortedTools = [...tools].sort((a, b) => a.toolId - b.toolId)

  return (
    <SettingsSection
      id="tool-library"
      title={t('Tool Library')}
      description={t('Manage your tool library. Tool IDs (T0, T1, T2...) should match your CAM software')}
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
                Add Tool
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Add Tool</DialogTitle>
                <DialogDescription>
                  Create a new tool entry. The Tool ID should match your CAM software (T0, T1, T2...).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tool-id">Tool ID *</Label>
                    <Input
                      id="tool-id"
                      type="number"
                      min="0"
                      value={formToolId}
                      onChange={(e) => setFormToolId(e.target.value)}
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground">
                      Tool number (T0, T1, T2...)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tool-name">Name *</Label>
                    <Input
                      id="tool-name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder={t('e.g., 1/4" End Mill')}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tool-description">Description</Label>
                  <Textarea
                    id="tool-description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder={t('Optional description')}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tool-diameter">Diameter</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tool-diameter"
                        type="number"
                        min="0"
                        step="0.001"
                        value={formDiameter}
                        onChange={(e) => setFormDiameter(e.target.value)}
                        placeholder={formDiameterUnit === 'mm' ? '6.35' : '0.25'}
                        className="flex-1"
                      />
                      <Select value={formDiameterUnit} onValueChange={(value: 'mm' | 'in') => {
                        // Convert existing value from current unit to new unit
                        if (formDiameter.trim()) {
                          const numValue = parseFloat(formDiameter)
                          if (!isNaN(numValue)) {
                            if (formDiameterUnit === 'mm' && value === 'in') {
                              // Converting from mm to in
                              setFormDiameter((numValue / 25.4).toFixed(4).replace(/\.?0+$/, ''))
                            } else if (formDiameterUnit === 'in' && value === 'mm') {
                              // Converting from in to mm
                              setFormDiameter(inchesToMm(numValue).toFixed(3).replace(/\.?0+$/, ''))
                            }
                          }
                        }
                        setFormDiameterUnit(value)
                      }}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="mm">mm</SelectItem>
                          <SelectItem value="in">in</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formDiameter && !isNaN(parseFloat(formDiameter)) ? (
                        formDiameterUnit === 'mm' 
                          ? `${mmToInches(parseFloat(formDiameter))} in` 
                          : `${inchesToMm(parseFloat(formDiameter)).toFixed(3)} mm`
                      ) : (
                        `Enter diameter in ${formDiameterUnit === 'mm' ? 'millimeters' : 'inches'}`
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tool-type">Type</Label>
                    {!isTypeCustom ? (
                      <Select 
                        value={formType.trim() === '' ? undefined : formType} 
                        onValueChange={handleTypeChange}
                        key={isAddOpen ? 'add-select' : undefined}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select type')} />
                        </SelectTrigger>
                        <SelectContent>
                          {TOOL_TYPE_OPTIONS.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type.charAt(0).toUpperCase() + type.slice(1)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="tool-type"
                        value={formType}
                        onChange={(e) => setFormType(e.target.value)}
                        placeholder={t('Enter tool type')}
                      />
                    )}
                    {!isTypeCustom && formType && (
                      <p className="text-xs text-muted-foreground">
                        {t('Select "Other" to enter a custom type')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAdd} 
                  disabled={!formToolId.trim() || !formName.trim() || isNaN(parseInt(formToolId, 10))}
                >
                  {t('Add Tool')}
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
                <TableHead className="w-20">{t('ID')}</TableHead>
                <TableHead className="w-48">{t('Name')}</TableHead>
                <TableHead className="w-32">{t('Diameter')}</TableHead>
                <TableHead className="w-32">{t('Type')}</TableHead>
                <TableHead>{t('Description')}</TableHead>
                <TableHead className="w-28">{t('Modified')}</TableHead>
                <TableHead className="w-24 text-right">{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedTools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t('No tools configured')}</p>
                    <p className="text-xs mt-1">{t('Add tools to build your tool library')}</p>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTools.map((tool) => (
                  <TableRow key={tool.id}>
                    <TableCell className="font-mono font-medium">
                      T{tool.toolId}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{tool.name}</div>
                    </TableCell>
                    <TableCell>
                      {tool.diameter != null ? (
                        <div className="text-sm">
                          <div>
                            {tool.diameter.toFixed(3)} {tool.diameterUnit || 'mm'}
                          </div>
                          {tool.diameterUnit === 'in' && (
                            <div className="text-muted-foreground text-xs">
                              {inchesToMm(tool.diameter).toFixed(3)} mm
                            </div>
                          )}
                          {(!tool.diameterUnit || tool.diameterUnit === 'mm') && (
                            <div className="text-muted-foreground text-xs">
                              {mmToInches(tool.diameter)} in
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tool.type ? (
                        <span className="text-sm">{tool.type}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {tool.description ? (
                        <span className="text-sm text-muted-foreground">{tool.description}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(tool.mtime)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {/* Edit Dialog */}
                        <Dialog open={editingTool?.id === tool.id} onOpenChange={(open) => {
                          if (!open) {
                            setEditingTool(null)
                            resetForm()
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(tool)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Edit Tool</DialogTitle>
                              <DialogDescription>
                                Modify the tool information.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-tool-id">Tool ID *</Label>
                                  <Input
                                    id="edit-tool-id"
                                    type="number"
                                    min="0"
                                    value={formToolId}
                                    onChange={(e) => setFormToolId(e.target.value)}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-tool-name">Name *</Label>
                                  <Input
                                    id="edit-tool-name"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                  />
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-tool-description">Description</Label>
                                <Textarea
                                  id="edit-tool-description"
                                  value={formDescription}
                                  onChange={(e) => setFormDescription(e.target.value)}
                                  rows={2}
                                />
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label htmlFor="edit-tool-diameter">Diameter</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      id="edit-tool-diameter"
                                      type="number"
                                      min="0"
                                      step="0.001"
                                      value={formDiameter}
                                      onChange={(e) => setFormDiameter(e.target.value)}
                                      placeholder={formDiameterUnit === 'mm' ? '6.35' : '0.25'}
                                      className="flex-1"
                                    />
                                    <Select value={formDiameterUnit} onValueChange={(value: 'mm' | 'in') => {
                                      // Convert existing value from current unit to new unit
                                      if (formDiameter.trim()) {
                                        const numValue = parseFloat(formDiameter)
                                        if (!isNaN(numValue)) {
                                          if (formDiameterUnit === 'mm' && value === 'in') {
                                            // Converting from mm to in
                                            setFormDiameter((numValue / 25.4).toFixed(4).replace(/\.?0+$/, ''))
                                          } else if (formDiameterUnit === 'in' && value === 'mm') {
                                            // Converting from in to mm
                                            setFormDiameter(inchesToMm(numValue).toFixed(3).replace(/\.?0+$/, ''))
                                          }
                                        }
                                      }
                                      setFormDiameterUnit(value)
                                    }}>
                                      <SelectTrigger className="w-20">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="mm">mm</SelectItem>
                                        <SelectItem value="in">in</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {formDiameter && !isNaN(parseFloat(formDiameter)) ? (
                                      formDiameterUnit === 'mm' 
                                        ? `${mmToInches(parseFloat(formDiameter))} in` 
                                        : `${inchesToMm(parseFloat(formDiameter)).toFixed(3)} mm`
                                    ) : (
                                      t('Enter diameter in {{unit}}', { unit: formDiameterUnit === 'mm' ? t('millimeters') : t('inches') })
                                    )}
                                  </p>
                                </div>
                                <div className="space-y-2">
                                  <Label htmlFor="edit-tool-type">Type</Label>
                                  {!isTypeCustom ? (
                                    <Select 
                                      value={formType.trim() === '' ? undefined : formType} 
                                      onValueChange={handleTypeChange}
                                      key={editingTool?.id}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder={t('Select type')} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {TOOL_TYPE_OPTIONS.map((type) => (
                                          <SelectItem key={type} value={type}>
                                            {type.charAt(0).toUpperCase() + type.slice(1)}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : (
                                    <Input
                                      id="edit-tool-type"
                                      value={formType}
                                      onChange={(e) => setFormType(e.target.value)}
                                      placeholder={t('Enter tool type')}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setEditingTool(null)}>
                                {t('Cancel')}
                              </Button>
                              <Button 
                                onClick={handleEdit} 
                                disabled={!formToolId.trim() || !formName.trim() || isNaN(parseInt(formToolId, 10))}
                              >
                                {t('Save Changes')}
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
                              <AlertDialogTitle>{t('Delete Tool?')}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('Are you sure you want to delete tool T{{toolId}} "{{name}}"? This action cannot be undone.', { toolId: tool.toolId, name: tool.name })}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDelete(tool.id)}
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
