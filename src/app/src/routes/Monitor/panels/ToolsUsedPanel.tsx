import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import type { PanelProps } from '../../Setup/types'
import { formatTime } from '@/utils/formatTime'
import { useGetToolsQuery, useGetExtensionsQuery } from '@/services/api'
import { useMachineState } from '@/store/hooks'
import { useMemo } from 'react'

export function ToolsUsedPanel(props: PanelProps) {
  const { senderState, currentTool } = props
  const { data: toolsData } = useGetToolsQuery()
  const machineState = useMachineState()
  
  // Get current WCS from machine state (default to G54)
  const currentWCS = useMemo(() => {
    const wcs = machineState.backendStatus?.parserstate?.modal?.wcs
    return wcs || 'G54'
  }, [machineState])
  
  // Get tool reference for current WCS
  const toolReferenceKey = `bitsetter.toolReference.${currentWCS}`
  const { data: toolReferenceData } = useGetExtensionsQuery({ key: toolReferenceKey }, {
    skip: !currentWCS, // Skip if no WCS available
  })
  
  // Extract tool offset value from the reference data
  // The API returns the data directly: { value: number, wcs: string, timestamp: string }
  const toolOffset = useMemo(() => {
    if (!toolReferenceData) return null
    
    // Handle both direct value and object with value property
    if (typeof toolReferenceData === 'number') {
      return toolReferenceData
    }
    
    if (typeof toolReferenceData === 'object' && toolReferenceData !== null && 'value' in toolReferenceData) {
      const value = (toolReferenceData as { value?: unknown }).value
      return typeof value === 'number' ? value : null
    }
    
    return null
  }, [toolReferenceData])
  
  const nextM6ToolNumber = senderState?.nextM6ToolNumber
  const remainingTimeToNextM6 = senderState?.remainingTimeToNextM6 ?? 0
  
  // Get tool stats from sender state
  const toolStats = senderState?.stats?.toolStats || {}
  const currentToolStats = currentTool !== undefined && currentTool > 0
    ? toolStats[currentTool]
    : null
  
  // Get current tool time (including active time if tool is currently active)
  const currentToolTime = useMemo(() => {
    if (!currentToolStats) return 0
    let time = currentToolStats.time || 0
    
    // If this tool is currently active, add elapsed time since tool start
    if (senderState?.stats?.currentTool === currentTool && senderState?.stats?.toolStartTime) {
      const now = Date.now()
      const elapsed = now - senderState.stats.toolStartTime
      time += elapsed
    }
    
    return time
  }, [currentToolStats, senderState?.stats?.currentTool, senderState?.stats?.toolStartTime, currentTool])
  
  // Find current tool info from tool library if available
  const currentToolData = currentTool !== undefined && currentTool > 0
    ? toolsData?.records?.find(t => t.toolId === currentTool)
    : null
  
  // Find next tool info from tool library if available
  const nextTool = nextM6ToolNumber !== undefined && nextM6ToolNumber >= 0
    ? toolsData?.records?.find(t => t.toolId === nextM6ToolNumber)
    : null
  
  // Check if G-code file is loaded
  const isFileLoaded = !!senderState?.name
  
  // Get all tools scheduled in the job (from M6 indices) or with stats
  const scheduledToolNumbers = isFileLoaded ? (senderState?.m6ToolNumbers || []) : []
  const currentToolNum = isFileLoaded ? (senderState?.stats?.currentTool) : undefined
  
  // Get all tools that have been used OR are scheduled in the job (sorted by tool number)
  const usedTools = useMemo(() => {
    // If no file is loaded, don't show any tools
    if (!isFileLoaded) {
      return []
    }
    
    // Start with all tool numbers that are in the job (from M6 indices or current tool)
    const toolNumbersInJob = new Set<number>()
    
    // Add current tool if set and > 0 (T0 is not a valid tool)
    if (currentToolNum !== undefined && currentToolNum !== null && currentToolNum > 0) {
      toolNumbersInJob.add(currentToolNum)
    }
    
    // Add all scheduled tools from M6 indices (filter out T0)
    scheduledToolNumbers.forEach(toolNum => {
      if (toolNum > 0) {
        toolNumbersInJob.add(toolNum)
      }
    })
    
    // Add next tool if scheduled (filter out T0)
    if (nextM6ToolNumber !== undefined && nextM6ToolNumber > 0) {
      toolNumbersInJob.add(nextM6ToolNumber)
    }
    
    // Build list of tools: those with stats, or those scheduled in the job
    const toolsMap = new Map<number, typeof toolStats[keyof typeof toolStats]>()
    
    // First, add all tools with stats (filter out T0)
    Object.values(toolStats).forEach(tool => {
      if (tool && tool.toolNumber !== undefined && tool.toolNumber > 0) {
        toolsMap.set(tool.toolNumber, tool)
      }
    })
    
    // Then, ensure all scheduled tools are included (even without stats yet)
    toolNumbersInJob.forEach(toolNum => {
      if (!toolsMap.has(toolNum)) {
        // Create placeholder entry for scheduled tool without stats yet
        toolsMap.set(toolNum, {
          toolNumber: toolNum,
          distance: { x: 0, y: 0, z: 0, total: 0 },
          time: 0,
        })
      }
    })
    
    return Array.from(toolsMap.values())
      .sort((a, b) => (a.toolNumber || 0) - (b.toolNumber || 0))
  }, [toolStats, scheduledToolNumbers, currentToolNum, nextM6ToolNumber, isFileLoaded])

  return (
    <div className="p-4 flex flex-col" style={{ minHeight: 0, maxHeight: '100%' }}>
      <div className="text-xs text-muted-foreground mb-2">Tools</div>
      {/* Scrollable tool list */}
      <div className="flex-1 min-h-0">
        <OverlayScrollbarsComponent 
          className="h-full"
          options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
        >
          <div className="space-y-1.5 pr-2">
            {/* Current tool - always show if available and file is loaded */}
            {isFileLoaded && currentTool !== undefined && currentTool > 0 ? (
              <div className="px-3 py-2 rounded border bg-green-500/10 border-green-500/30">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium text-green-600 dark:text-green-400">T{currentTool}</span>
                    {currentToolData ? (
                      <span className="text-xs font-medium">{currentToolData.name || 'Tool ' + currentTool}</span>
                    ) : null}
                  </div>
                  {currentToolData?.diameter && (
                    <span className="text-xs text-muted-foreground">Ø{currentToolData.diameter}{currentToolData.diameterUnit || 'mm'}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Current Tool
                  </div>
                  {toolOffset !== null && (
                    <div className="text-xs text-muted-foreground">
                      Offset: <span className="font-mono">{toolOffset.toFixed(3)}mm</span>
                    </div>
                  )}
                </div>
                {currentToolStats && (currentToolStats.distance?.total > 0 || currentToolTime > 0) && (
                  <div className="mt-1.5 pt-1.5 border-t border-green-500/20 space-y-0.5">
                    {currentToolStats.distance?.total > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Distance:</span>
                        <span className="font-mono font-medium">{currentToolStats.distance.total.toFixed(1)} mm</span>
                      </div>
                    )}
                    {currentToolTime > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Time:</span>
                        <span className="font-mono font-medium">{formatTime(currentToolTime)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
            
            {/* Next tool change - show below current tool if scheduled and file is loaded */}
            {isFileLoaded && nextTool ? (
              <div className="px-3 py-2 rounded border bg-primary/10 border-primary/30 text-primary">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium">T{nextTool.toolId}</span>
                    <span className="text-xs font-medium">{nextTool.name || 'Tool ' + nextTool.toolId}</span>
                  </div>
                  {nextTool.diameter && (
                    <span className="text-xs text-muted-foreground">Ø{nextTool.diameter}{nextTool.diameterUnit || 'mm'}</span>
                  )}
                </div>
                {remainingTimeToNextM6 > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Next change: {formatTime(remainingTimeToNextM6)}
                  </div>
                )}
              </div>
            ) : isFileLoaded && nextM6ToolNumber !== undefined && nextM6ToolNumber > 0 ? (
              <div className="px-3 py-2 rounded border bg-primary/10 border-primary/30 text-primary">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-medium">T{nextM6ToolNumber}</span>
                  </div>
                </div>
                {remainingTimeToNextM6 > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Next change: {formatTime(remainingTimeToNextM6)}
                  </div>
                )}
              </div>
            ) : !isFileLoaded || currentTool === undefined || currentTool === 0 ? (
              <div className="px-3 py-2 rounded border bg-background border-border text-muted-foreground text-xs">
                {!isFileLoaded ? 'No file loaded' : 'No tool loaded'}
              </div>
            ) : null}
            
            {/* Previously used tools - show below current/next tool */}
            {isFileLoaded && usedTools.length > 0 && (
              <>
                {(currentTool !== undefined && currentTool > 0) || (nextM6ToolNumber !== undefined && nextM6ToolNumber > 0) ? (
                  <div className="pt-2 mt-2 border-t border-border">
                    <div className="text-xs text-muted-foreground mb-2">Used Tools</div>
                  </div>
                ) : null}
                {usedTools.map((toolStat) => {
                  // Skip current tool (already shown above)
                  if (toolStat.toolNumber === currentTool) return null
                  
                  // Skip next tool (already shown above)
                  if (toolStat.toolNumber === nextM6ToolNumber) return null
                  
                  const toolData = toolsData?.records?.find(t => t.toolId === toolStat.toolNumber)
                  const hasStats = (toolStat.distance?.total > 0 || toolStat.time > 0)
                  
                  return (
                    <div key={toolStat.toolNumber} className={`px-3 py-2 rounded border ${hasStats ? 'bg-muted/30 border-border' : 'bg-muted/10 border-border/50'}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-medium">T{toolStat.toolNumber}</span>
                          {toolData ? (
                            <span className="text-xs font-medium">{toolData.name || 'Tool ' + toolStat.toolNumber}</span>
                          ) : !hasStats ? (
                            <span className="text-xs text-muted-foreground italic">Scheduled</span>
                          ) : null}
                        </div>
                        {toolData?.diameter && (
                          <span className="text-xs text-muted-foreground">Ø{toolData.diameter}{toolData.diameterUnit || 'mm'}</span>
                        )}
                      </div>
                      {hasStats && (
                        <div className="flex items-center justify-between mt-1 space-x-4">
                          {toolStat.distance?.total > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono font-medium">{toolStat.distance.total.toFixed(1)} mm</span>
                            </div>
                          )}
                          {toolStat.time > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono font-medium">{formatTime(toolStat.time)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </div>
  )
}
