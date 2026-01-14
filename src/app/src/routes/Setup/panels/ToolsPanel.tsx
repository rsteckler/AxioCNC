import React, { useEffect, useState, useMemo } from 'react'
import { Library, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { useGetToolsQuery, useGetControllersQuery, type Tool } from '@/services/api'
import { socketService } from '@/services/socket'

// Helper function to parse T commands from G-code
// Looks for patterns like: T1, T2, M6 T1, T1 M6, etc.
function parseToolsFromGcode(gcode: string): Set<number> {
  const toolIds = new Set<number>()
  if (!gcode) return toolIds
  
  // Match T commands followed by numbers
  // Pattern: T followed by optional whitespace and a number
  // Examples: T1, T2, T 1, M6 T1, T1 M6, etc.
  const toolPattern = /\bT\s*(\d+)\b/gi
  let match
  
  while ((match = toolPattern.exec(gcode)) !== null) {
    const toolId = parseInt(match[1], 10)
    if (!isNaN(toolId) && toolId >= 0) {
      toolIds.add(toolId)
    }
  }
  
  return toolIds
}

// Helper function to convert mm to inches for display
const mmToInches = (mm: number | null | undefined): string => {
  if (mm == null) return ''
  const inches = mm / 25.4
  return inches.toFixed(4).replace(/\.?0+$/, '')
}

// Helper function to convert inches to mm for display
const inchesToMm = (inches: number): number => {
  return inches * 25.4
}

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
  
  // Get connected port from controllers
  const { data: controllers } = useGetControllersQuery()
  const connectedPort = controllers?.[0]?.port || null
  
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
  
  // Listen for sender:status events to detect loaded G-code
  useEffect(() => {
    if (!connectedPort) {
      setGcodeContent(null)
      setGcodeLoaded(false)
      return
    }
    
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
    
    // Initial fetch if we have a connected port
    fetchGcodeContent()
    
    socketService.on('sender:status', handleSenderStatus)
    socketService.on('gcode:load', handleGcodeLoad)
    socketService.on('gcode:unload', handleGcodeUnload)
    
    return () => {
      socketService.off('sender:status', handleSenderStatus)
      socketService.off('gcode:load', handleGcodeLoad)
      socketService.off('gcode:unload', handleGcodeUnload)
    }
  }, [connectedPort])
  
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
  
  // If no G-code is loaded, all tools are available
  const displayInUseTools = gcodeLoaded ? inUseTools : []
  const displayAvailableTools = gcodeLoaded ? availableTools : sortedTools

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
          {gcodeLoaded && displayInUseTools.length > 0 && (
            <div className="flex-shrink-0 flex flex-col h-full">
              <div className="text-[10px] text-primary font-medium mb-1 px-1">In Use</div>
              <div className="flex-1 flex gap-2 border-l-2 border-primary pl-2">
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
    </div>
  )
}
