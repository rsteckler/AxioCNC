import React, { useEffect, useState, useMemo } from 'react'
import { Library, ChevronDown, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { useGetToolsQuery, useGetControllersQuery, useCreateToolMutation, useUpdateToolMutation, type Tool } from '@/services/api'
import { socketService } from '@/services/socket'
import { parseToolsFromGcode } from '@/utils/gcode'
import { mmToInches, inchesToMm } from '@/utils/units'

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

interface PanelHeaderProps {
  title: string
  icon: React.ElementType
  isCollapsed?: boolean
  onToggle?: () => void
}

function PanelHeader({ 
  title, 
  icon: Icon,
  isCollapsed,
  onToggle
}: PanelHeaderProps) {
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 pl-10 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onToggle}
    >
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium flex-1">{title}</span>
      {onToggle && (
        <ChevronDown 
          className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} 
        />
      )}
    </div>
  )
}

export function ToolsPanel() {
  // Fetch tools from API
  const { data: toolsData } = useGetToolsQuery()
  const tools: Tool[] = toolsData?.records ?? []
  const [createTool] = useCreateToolMutation()
  const [updateTool] = useUpdateToolMutation()
  
  // Get connected port from controllers
  const { data: controllers } = useGetControllersQuery()
  const connectedPort = controllers?.[0]?.port || null
  
  // Dialog state for editing missing tools
  const [editingToolId, setEditingToolId] = useState<number | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formDiameter, setFormDiameter] = useState('')
  const [formDiameterUnit, setFormDiameterUnit] = useState<'mm' | 'in'>('mm')
  const [formType, setFormType] = useState<string>('')
  const [formFlutes, setFormFlutes] = useState('')
  const [isTypeCustom, setIsTypeCustom] = useState(false)
  
  // Track loaded G-code content and filename
  const [gcodeContent, setGcodeContent] = useState<string | null>(null)
  const [gcodeLoaded, setGcodeLoaded] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)
  
  // Parse tools from G-code
  const toolsInUse = useMemo(() => {
    if (!gcodeLoaded || !gcodeContent) {
      return new Set<number>() // No G-code loaded, no tools in use
    }
    return parseToolsFromGcode(gcodeContent)
  }, [gcodeContent, gcodeLoaded])
  
  const fetchGcodeContent = async () => {
    if (!connectedPort) return
    
    try {
      const token = localStorage.getItem('axiocnc-token')
      const response = await fetch(`/api/gcode?port=${encodeURIComponent(connectedPort)}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.data && data.name) {
          // G-code is loaded
          setGcodeContent(data.data)
          setGcodeLoaded(true)
          setLoadedFileName(data.name)
        } else {
          // No G-code loaded
          setGcodeContent(null)
          setGcodeLoaded(false)
          setLoadedFileName(null)
        }
      } else if (response.status === 404 || response.status === 400) {
        // No G-code loaded for this port
        setGcodeContent(null)
        setGcodeLoaded(false)
        setLoadedFileName(null)
      }
    } catch (error) {
      console.error('Failed to fetch G-code:', error)
      setGcodeContent(null)
      setGcodeLoaded(false)
      setLoadedFileName(null)
    }
  }
    
  // Listen for sender:status events to detect loaded G-code
  useEffect(() => {
    if (!connectedPort) {
      setGcodeContent(null)
      setGcodeLoaded(false)
      return
    }
    
    // Initial fetch if we have a connected port
    fetchGcodeContent()
    
  }, [connectedPort])

  useEffect(() => {
    const handleSenderStatus = (...args: unknown[]) => {
      const senderData = args[0] as {
        name?: string
        total?: number
        size?: number
      }
      
      if (senderData?.name) {
        // G-code file is loaded (has a name) - fetch content
        fetchGcodeContent()
      } else {
        // No G-code loaded (no name)
        setGcodeContent(null)
        setGcodeLoaded(false)
        setLoadedFileName(null)
      }
    }
    
    // gcode:load emits (name, gcode, context) as separate arguments
    const handleGcodeLoad = (name: string, gcode: string) => {
      if (name && gcode) {
        // G-code was loaded - use the content directly from the event
        setGcodeContent(gcode)
        setGcodeLoaded(true)
        setLoadedFileName(name)
      } else {
        // Fallback: fetch from API if event didn't include content
        fetchGcodeContent()
      }
    }
    
    const handleGcodeUnload = () => {
      setGcodeContent(null)
      setGcodeLoaded(false)
      setLoadedFileName(null)
    }

    socketService.on('sender:status', handleSenderStatus)
    socketService.on('gcode:load', handleGcodeLoad)
    socketService.on('gcode:unload', handleGcodeUnload)

    return () => {
      socketService.off('sender:status', handleSenderStatus)
      socketService.off('gcode:load', handleGcodeLoad)
      socketService.off('gcode:unload', handleGcodeUnload)
    }
  }, [])


  // Convert vertical wheel to horizontal scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY !== 0) {
      const container = e.currentTarget.querySelector('[data-overlayscrollbars-viewport]') as HTMLElement
      if (container) {
        container.scrollLeft += e.deltaY
      }
    }
  }
  
  // Sort tools by toolId
  const sortedTools = [...tools].sort((a, b) => a.toolId - b.toolId)
  
  // Split tools into "In Use" and "Available"
  const inUseTools = sortedTools.filter(tool => toolsInUse.has(tool.toolId))
  const availableTools = sortedTools.filter(tool => !toolsInUse.has(tool.toolId))
  
  // Find missing tools (in G-code but not in library)
  const missingToolIds = useMemo(() => {
    if (!gcodeLoaded) return new Set<number>()
    const libraryToolIds = new Set(tools.map(t => t.toolId))
    return new Set(Array.from(toolsInUse).filter(id => !libraryToolIds.has(id)))
  }, [toolsInUse, tools, gcodeLoaded])
  
  // If no G-code is loaded, all tools are available
  const displayInUseTools = gcodeLoaded ? inUseTools : []
  const displayAvailableTools = gcodeLoaded ? availableTools : sortedTools
  
  // Open edit dialog for a missing tool
  const openEditDialog = (toolId: number) => {
    // Check if this tool exists in library (might have been added)
    const existingTool = tools.find(t => t.toolId === toolId)
    if (existingTool) {
      // Edit existing tool
      setFormName(existingTool.name)
      setFormDescription(existingTool.description || '')
      setFormDiameter(existingTool.diameter?.toString() || '')
      setFormDiameterUnit(existingTool.diameterUnit || 'mm')
      setFormType(existingTool.type || '')
      setFormFlutes(existingTool.flutes?.toString() || '')
      setIsTypeCustom(existingTool.type ? !TOOL_TYPE_OPTIONS.includes(existingTool.type as ToolTypeOption) : false)
    } else {
      // New tool - start with placeholder data
      setFormName(`Tool T${toolId}`)
      setFormDescription('')
      setFormDiameter('')
      setFormDiameterUnit('mm')
      setFormType('')
      setFormFlutes('')
      setIsTypeCustom(false)
    }
    setEditingToolId(toolId)
    setIsDialogOpen(true)
  }
  
  const handleTypeChange = (value: string) => {
    if (value === 'other') {
      setIsTypeCustom(true)
      setFormType('')
    } else {
      setIsTypeCustom(false)
      setFormType(value)
    }
  }
  
  const handleSaveTool = async () => {
    if (!editingToolId || !formName.trim()) return
    
    const toolIdNum = editingToolId
    
    // Parse diameter
    let diameterValue: number | null = null
    if (formDiameter.trim()) {
      const parsed = parseFloat(formDiameter)
      if (!isNaN(parsed)) {
        diameterValue = parsed
      }
    }
    
    // Parse flutes
    let flutesNum: number | null = null
    if (formFlutes.trim()) {
      const flutesValue = parseInt(formFlutes, 10)
      if (!isNaN(flutesValue) && flutesValue > 0) {
        flutesNum = flutesValue
      }
    }
    
    const toolData: Omit<Tool, 'id' | 'mtime'> = {
      toolId: toolIdNum,
      name: formName.trim(),
      description: formDescription.trim() || undefined,
      diameter: diameterValue,
      diameterUnit: diameterValue != null ? formDiameterUnit : undefined,
      type: formType.trim() || undefined,
      flutes: flutesNum,
    }
    
    try {
      // Check if tool exists
      const existingTool = tools.find(t => t.toolId === toolIdNum)
      if (existingTool) {
        // Update existing tool
        await updateTool({ id: existingTool.id, updates: toolData }).unwrap()
      } else {
        // Create new tool
        await createTool(toolData).unwrap()
      }
      setIsDialogOpen(false)
      setEditingToolId(null)
      // Reset form
      setFormName('')
      setFormDescription('')
      setFormDiameter('')
      setFormDiameterUnit('mm')
      setFormType('')
      setFormFlutes('')
      setIsTypeCustom(false)
    } catch (error) {
      console.error('Failed to save tool:', error)
    }
  }
  
  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingToolId(null)
    setFormName('')
    setFormDescription('')
    setFormDiameter('')
    setFormDiameterUnit('mm')
    setFormType('')
    setFormFlutes('')
    setIsTypeCustom(false)
  }

  return (
    <div className="h-full flex flex-col" onWheel={handleWheel}>
      <PanelHeader title="Tool Library" icon={Library} />
      <OverlayScrollbarsComponent 
        className="flex-1 p-2"
        options={{ 
          scrollbars: { autoHide: 'never' },
          overflow: { x: 'scroll', y: 'hidden' }
        }}
      >
        <div className="flex gap-2 h-full items-stretch">
          {/* In Use Section */}
          {gcodeLoaded && (displayInUseTools.length > 0 || missingToolIds.size > 0) && (
            <div className="flex-shrink-0 flex flex-col h-full">
              <div className="text-[10px] text-primary font-medium mb-1 px-1">In Use</div>
              <div className="flex-1 flex gap-2 border-l-2 border-primary pl-2">
                {/* Tools from library */}
                {displayInUseTools.map((tool) => (
                  <div 
                    key={tool.id}
                    className="flex-shrink-0 w-44 p-2 rounded border border-primary bg-primary/10 flex flex-col"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="w-8 justify-center text-xs">
                        T{tool.toolId}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium mt-1 truncate">{tool.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {tool.diameter != null ? (
                        <>
                          Ø{tool.diameter.toFixed(3)}{tool.diameterUnit || 'mm'}
                          {tool.diameterUnit === 'in' && (
                            <> • {inchesToMm(tool.diameter).toFixed(3)}mm</>
                          )}
                          {(!tool.diameterUnit || tool.diameterUnit === 'mm') && mmToInches(tool.diameter) && (
                            <> • {mmToInches(tool.diameter)}in</>
                          )}
                        </>
                      ) : null}
                      {tool.type && (
                        <> • {tool.type}</>
                      )}
                      {tool.flutes != null && (
                        <> • {tool.flutes} fl{tool.flutes === 1 ? 'ute' : 'utes'}</>
                      )}
                    </div>
                    {tool.description && (
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                        {tool.description}
                      </div>
                    )}
                  </div>
                ))}
                {/* Missing tools (not in library) */}
                {Array.from(missingToolIds).sort((a, b) => a - b).map((toolId) => (
                  <div 
                    key={`missing-${toolId}`}
                    className="flex-shrink-0 w-44 p-2 rounded border border-dashed border-primary/50 bg-muted/50 flex flex-col relative group"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-8 justify-center text-xs border-primary/50">
                        T{toolId}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => openEditDialog(toolId)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="text-sm font-medium mt-1 truncate text-muted-foreground">Not configured</div>
                    <div className="text-xs text-muted-foreground italic">
                      Click edit to add to library
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Available Section */}
          <div className="flex-shrink-0 flex flex-col h-full">
            <div className="text-[10px] text-muted-foreground font-medium mb-1 px-1">Available</div>
            <div className="flex-1 flex gap-2 border-l-2 border-muted pl-2">
              {displayAvailableTools.length === 0 ? (
                <div className="flex-shrink-0 w-44 p-2 rounded border border-border bg-card text-center text-xs text-muted-foreground">
                  No tools configured
                </div>
              ) : (
                displayAvailableTools.map((tool) => (
                  <div 
                    key={tool.id}
                    className="flex-shrink-0 w-44 p-2 rounded border border-border bg-card flex flex-col"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="w-8 justify-center text-xs">
                        T{tool.toolId}
                      </Badge>
                    </div>
                    <div className="text-sm font-medium mt-1 truncate">{tool.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {tool.diameter != null ? (
                        <>
                          Ø{tool.diameter.toFixed(3)}{tool.diameterUnit || 'mm'}
                          {tool.diameterUnit === 'in' && (
                            <> • {inchesToMm(tool.diameter).toFixed(3)}mm</>
                          )}
                          {(!tool.diameterUnit || tool.diameterUnit === 'mm') && mmToInches(tool.diameter) && (
                            <> • {mmToInches(tool.diameter)}in</>
                          )}
                        </>
                      ) : null}
                      {tool.type && (
                        <> • {tool.type}</>
                      )}
                      {tool.flutes != null && (
                        <> • {tool.flutes} fl{tool.flutes === 1 ? 'ute' : 'utes'}</>
                      )}
                    </div>
                    {tool.description && (
                      <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                        {tool.description}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </OverlayScrollbarsComponent>
      
      {/* Edit Tool Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingToolId !== null && tools.find(t => t.toolId === editingToolId)
                ? 'Edit Tool'
                : 'Add Tool to Library'}
            </DialogTitle>
            <DialogDescription>
              {editingToolId !== null && (
                <>Configure tool T{editingToolId}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tool-name">Name *</Label>
              <Input
                id="tool-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., 1/4&quot; End Mill"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tool-description">Description</Label>
              <Textarea
                id="tool-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Optional description"
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
                          setFormDiameter((numValue / 25.4).toFixed(4).replace(/\.?0+$/, ''))
                        } else if (formDiameterUnit === 'in' && value === 'mm') {
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
              </div>
              <div className="space-y-2">
                <Label htmlFor="tool-type">Type</Label>
                {!isTypeCustom ? (
                  <Select 
                    value={formType.trim() === '' ? undefined : formType} 
                    onValueChange={handleTypeChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
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
                    placeholder="Enter tool type"
                  />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tool-flutes">Number of Flutes</Label>
              <Input
                id="tool-flutes"
                type="number"
                min="1"
                step="1"
                value={formFlutes}
                onChange={(e) => setFormFlutes(e.target.value)}
                placeholder="e.g., 2, 4"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveTool} 
              disabled={!formName.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
