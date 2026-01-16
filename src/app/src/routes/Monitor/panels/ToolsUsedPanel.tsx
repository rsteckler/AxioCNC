import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import type { PanelProps } from '../../Setup/types'
import { formatTime } from '@/utils/formatTime'
import { useGetToolsQuery } from '@/services/api'

export function ToolsUsedPanel(props: PanelProps) {
  const { senderState, currentTool } = props
  const { data: toolsData } = useGetToolsQuery()
  
  const nextM6ToolNumber = senderState?.nextM6ToolNumber
  const remainingTimeToNextM6 = senderState?.remainingTimeToNextM6 ?? 0
  
  // Find current tool info from tool library if available
  const currentToolData = currentTool !== undefined && currentTool > 0
    ? toolsData?.records?.find(t => t.toolId === currentTool)
    : null
  
  // Find next tool info from tool library if available
  const nextTool = nextM6ToolNumber !== undefined && nextM6ToolNumber >= 0
    ? toolsData?.records?.find(t => t.toolId === nextM6ToolNumber)
    : null

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
            {/* Current tool - always show if available */}
            {currentTool !== undefined && currentTool > 0 ? (
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
                <div className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                  Current Tool
                </div>
              </div>
            ) : null}
            
            {/* Next tool change - show below current tool if scheduled */}
            {nextTool ? (
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
            ) : nextM6ToolNumber !== undefined && nextM6ToolNumber >= 0 ? (
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
            ) : currentTool === undefined || currentTool === 0 ? (
              <div className="px-3 py-2 rounded border bg-background border-border text-muted-foreground text-xs">
                No tool loaded
              </div>
            ) : null}
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </div>
  )
}
