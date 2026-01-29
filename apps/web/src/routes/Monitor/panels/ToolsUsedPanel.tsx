import { useTranslation } from 'react-i18next'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import type { PanelProps } from '../../Setup/types'
import { formatTime } from '@/utils/formatTime'
import { useGetToolsQuery, useGetExtensionsQuery } from '@/services/api'
import { useMachineState } from '@/store/hooks'
import { useMemo } from 'react'

export function ToolsUsedPanel(props: PanelProps) {
  const { t } = useTranslation()
  const { senderState } = props
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
  
  const remainingTimeToNextM6 = senderState?.remainingTimeToNextM6 ?? 0
  
  // Get tool stats from sender state (wrap in useMemo to prevent recreating on every render)
  const toolStats = useMemo(() => senderState?.stats?.toolStats || {}, [senderState?.stats?.toolStats])
  
  // Check if G-code file is loaded
  const isFileLoaded = !!senderState?.name
  
  // Get current tool from sender state (more reliable than props)
  const currentToolNum = isFileLoaded ? (senderState?.stats?.currentTool) : undefined
  
  // Get all tools in the job in order (from M6 indices)
  const toolsInJob = useMemo(() => {
    // If no file is loaded, don't show any tools
    if (!isFileLoaded) {
      return []
    }
    
    // Get tools in job order from m6ToolNumbers (filter out T0)
    const scheduledToolNumbers = (senderState?.m6ToolNumbers || []).filter(tn => tn > 0)
    
    // Return tools with their stats in job order
    return scheduledToolNumbers.map(toolNum => {
      const stats = toolStats[toolNum]
      return {
        toolNumber: toolNum,
        distance: stats?.distance || { x: 0, y: 0, z: 0, total: 0 },
        time: stats?.time || 0,
      }
    })
  }, [toolStats, senderState?.m6ToolNumbers, isFileLoaded])
  
  // Find index of current tool in the job order
  const currentToolIndex = useMemo(() => {
    if (!currentToolNum || !isFileLoaded) return -1
    return toolsInJob.findIndex(t => t.toolNumber === currentToolNum)
  }, [toolsInJob, currentToolNum, isFileLoaded])
  
  // Get next tool after current one (if any)
  const nextToolInJob = useMemo(() => {
    if (currentToolIndex < 0 || currentToolIndex >= toolsInJob.length - 1) return null
    return toolsInJob[currentToolIndex + 1]
  }, [toolsInJob, currentToolIndex])

  return (
    <div className="p-4 flex flex-col" style={{ minHeight: 0, maxHeight: '100%' }}>
      <div className="text-xs text-muted-foreground mb-2">{t('Tools')}</div>
      {/* Scrollable tool list */}
      <div className="flex-1 min-h-0">
        <OverlayScrollbarsComponent 
          className="h-full"
          options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
        >
          <div className="space-y-1.5 pr-2">
            {!isFileLoaded ? (
              <div className="px-3 py-2 rounded border bg-background border-border text-muted-foreground text-xs">
                {t('No file loaded')}
              </div>
            ) : toolsInJob.length === 0 ? (
              <div className="px-3 py-2 rounded border bg-background border-border text-muted-foreground text-xs">
                {t('No tools in job')}
              </div>
            ) : (
              toolsInJob.map((toolStat) => {
                const isCurrentTool = toolStat.toolNumber === currentToolNum && currentToolNum !== null && currentToolNum > 0
                const toolData = toolsData?.records?.find(t => t.toolId === toolStat.toolNumber)
                const hasStats = (toolStat.distance?.total > 0 || toolStat.time > 0)
                
                // Calculate current tool time (including active time if currently active)
                let toolTime = toolStat.time || 0
                if (isCurrentTool && senderState?.stats?.currentTool === toolStat.toolNumber && senderState?.stats?.toolStartTime) {
                  const now = Date.now()
                  const elapsed = now - senderState.stats.toolStartTime
                  toolTime += elapsed
                }
                
                return (
                  <div key={toolStat.toolNumber}>
                    {/* Tool card */}
                    <div className={`px-3 py-2 rounded border ${
                      isCurrentTool 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : hasStats 
                          ? 'bg-muted/30 border-border' 
                          : 'bg-muted/10 border-border/50'
                    }`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-xs font-medium ${
                            isCurrentTool ? 'text-green-600 dark:text-green-400' : ''
                          }`}>
                            T{toolStat.toolNumber}
                          </span>
                          {toolData ? (
                            <span className="text-xs font-medium">{toolData.name || t('Tool {{num}}', { num: toolStat.toolNumber })}</span>
                          ) : !hasStats ? (
                            <span className="text-xs text-muted-foreground italic">{t('Scheduled')}</span>
                          ) : null}
                        </div>
                        {toolData?.diameter && (
                          <span className="text-xs text-muted-foreground">Ø{toolData.diameter}{toolData.diameterUnit || 'mm'}</span>
                        )}
                      </div>
                      
                      {/* Current tool indicator and offset */}
                      {isCurrentTool && (
                        <div className="flex items-center justify-between mt-1 mb-1.5">
                          <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {t('Current Tool')}
                          </div>
                          {toolOffset !== null && (
                            <div className="text-xs text-muted-foreground">
                              {t('Offset:')} <span className="font-mono">{toolOffset.toFixed(3)}{t('mm')}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Stats: distance and time */}
                      {hasStats && (
                        <div className={`flex items-center justify-between space-x-4 ${isCurrentTool ? 'mt-1.5 pt-1.5 border-t border-green-500/20' : 'mt-1'}`}>
                          {toolStat.distance?.total > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono font-medium">{toolStat.distance.total.toFixed(1)} mm</span>
                            </div>
                          )}
                          {toolTime > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-mono font-medium">{formatTime(toolTime)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Tool change countdown card - show between current tool and next tool */}
                    {isCurrentTool && nextToolInJob && (
                      <div className="px-2 py-1.5 rounded border bg-primary/10 border-primary/30 text-primary mt-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium">
                            {t('Next:')} T{nextToolInJob.toolNumber}
                          </div>
                          {remainingTimeToNextM6 > 0 && (
                            <div className="text-xs font-mono">
                              {formatTime(remainingTimeToNextM6)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </div>
  )
}
