import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { 
  RotateCcw, 
  Square, 
  Clock, 
  FileText, 
  Wrench, 
  TrendingUp,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { MachineActionButton } from '@/components/MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'
import { 
  useIsConnected,
  useConnectedPort,
  useMachineState,
  useMachinePosition,
} from '@/store/hooks'
import { useGcodeCommand } from '@/hooks'
import { 
  useGetSettingsQuery,
  useGetJobHistoryQuery,
  useGetJobHistoryJobQuery,
  useGetJobHistoryStatsQuery,
  useGetJobHistoryToolStatsQuery,
  useGetToolsQuery,
} from '@/services/api'
import { VisualizerScene } from '@/routes/Setup/components/VisualizerScene'
import { cn } from '@/lib/utils'

// Operation type for pie chart
interface OperationType {
  type: string
  percent: number
  color: string
  bgColor: string
}

// Mock data types
interface CumulativeStats {
  totalJobs: number
  totalRuntime: number // milliseconds
  totalDistance: number // mm
  distanceX: number // mm
  distanceY: number // mm
  distanceZ: number // mm
  successfulJobs: number
  failedJobs: number
  cancelledJobs: number
  operationTypes: OperationType[]
}

interface ToolStats {
  toolNumber: number
  name: string
  diameter: number
  type: string
  description?: string
  usageCount: number
  totalRuntime: number // milliseconds
  totalDistance: number // mm
}

interface JobToolUsage {
  toolNumber: number
  time: number // milliseconds
  distance: number // mm
}

interface JobStats {
  id: string
  name: string
  startTime: Date
  endTime: Date | null
  status: 'completed' | 'failed' | 'cancelled'
  runtime: number // milliseconds
  toolsUsed: number[]
  toolUsage: JobToolUsage[] // Full tool usage data with time and distance
  linesProcessed: number
  totalLines: number
  distance: number // mm (total)
  distanceX: number // mm
  distanceY: number // mm
  distanceZ: number // mm
  gcode?: string // G-code content for visualization
  operationTypes?: OperationType[] // Operation type breakdown for this job
}

export default function Stats() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  
  // Get shared machine state from Redux
  const isConnected = useIsConnected()
  const connectedPort = useConnectedPort()
  const machineState = useMachineState()
  const machineStatus = machineState.machineStatus
  const machinePosition = useMachinePosition()
  
  // Get settings for machine limits
  const { data: settings } = useGetSettingsQuery()
  
  // Get tools for tool information
  const { data: toolsData } = useGetToolsQuery()
  const toolsMap = React.useMemo(() => {
    if (!toolsData?.records) return new Map()
    const map = new Map()
    toolsData.records.forEach(tool => {
      const toolNum = Number(tool.toolId) // Use toolId, not toolNumber
      if (!isNaN(toolNum)) {
        map.set(toolNum, tool)
      }
    })
    return map
  }, [toolsData])
  
  // Get job history data
  const { data: jobHistoryData, isLoading: isLoadingJobs } = useGetJobHistoryQuery()
  const { data: statsData, isLoading: isLoadingStats } = useGetJobHistoryStatsQuery()
  const { data: toolStatsData, isLoading: isLoadingToolStats } = useGetJobHistoryToolStatsQuery()
  const { data: selectedJobData } = useGetJobHistoryJobQuery(selectedJobId || '', { skip: !selectedJobId })
  
  // Use G-code command hook for Reset and E-Stop buttons
  const { sendCommand } = useGcodeCommand(connectedPort)
  
  // Flash status when action attempted while disconnected
  const flashStatus = React.useCallback(() => {
    // Flash status is handled by Redux
  }, [])
  
  // Handle Reset button
  const handleReset = React.useCallback(() => {
    if (!connectedPort) return
    sendCommand('reset')
  }, [connectedPort, sendCommand])
  
  // Handle E-Stop button
  const handleEStop = React.useCallback(() => {
    if (!connectedPort) return
    sendCommand('gcode:stop', { force: true })
    sendCommand('reset')
  }, [connectedPort, sendCommand])

  // Transform API stats to component format
  // Calculate cumulative stats from job history since backend doesn't track axis distances or operation types separately
  const cumulativeStats: CumulativeStats = React.useMemo(() => {
    if (!statsData && !jobHistoryData) {
      return {
        totalJobs: 0,
        totalRuntime: 0,
        totalDistance: 0,
        distanceX: 0,
        distanceY: 0,
        distanceZ: 0,
        successfulJobs: 0,
        failedJobs: 0,
        cancelledJobs: 0,
        operationTypes: [],
      }
    }
    
    // Calculate cumulative axis distances from all jobs
    let cumulativeDistanceX = 0
    let cumulativeDistanceY = 0
    let cumulativeDistanceZ = 0
    let cumulativeTotalDistance = 0
    let cumulativeCuttingDistance = 0
    let cumulativeTransitionDistance = 0
    let cumulativeRetractDistance = 0
    
    if (jobHistoryData && jobHistoryData.length > 0) {
      jobHistoryData.forEach(job => {
        // Extract distance data from nested structure
        const totalDist = job.stats?.totalDistance || { x: 0, y: 0, z: 0, total: 0 }
        const cuttingDist = job.stats?.cuttingDistance || { x: 0, y: 0, z: 0, total: 0 }
        const transitionDist = job.stats?.transitionDistance || { x: 0, y: 0, z: 0, total: 0 }
        const retractDist = job.stats?.retractDistance || { x: 0, y: 0, z: 0, total: 0 }
        
        cumulativeDistanceX += totalDist.x || 0
        cumulativeDistanceY += totalDist.y || 0
        cumulativeDistanceZ += totalDist.z || 0
        cumulativeTotalDistance += totalDist.total || 0
        cumulativeCuttingDistance += cuttingDist.total || 0
        cumulativeTransitionDistance += transitionDist.total || 0
        cumulativeRetractDistance += retractDist.total || 0
      })
    }
    
    // Calculate operation types percentages from cumulative distances
    const operationTypes: OperationType[] = []
    if (cumulativeTotalDistance > 0) {
      if (cumulativeCuttingDistance > 0) {
        operationTypes.push({
          type: 'Cutting',
          percent: Math.round((cumulativeCuttingDistance / cumulativeTotalDistance) * 100),
          color: 'rgb(34 197 94)', // green-500
          bgColor: 'bg-green-500',
        })
      }
      
      if (cumulativeTransitionDistance > 0) {
        operationTypes.push({
          type: 'Transition',
          percent: Math.round((cumulativeTransitionDistance / cumulativeTotalDistance) * 100),
          color: 'rgb(59 130 246)', // blue-500
          bgColor: 'bg-blue-500',
        })
      }
      
      if (cumulativeRetractDistance > 0) {
        operationTypes.push({
          type: 'Retract',
          percent: Math.round((cumulativeRetractDistance / cumulativeTotalDistance) * 100),
          color: 'rgb(249 115 22)', // orange-500
          bgColor: 'bg-orange-500',
        })
      }
    }
    
    return {
      totalJobs: statsData?.totalJobs || 0,
      totalRuntime: statsData?.totalTime || 0,
      totalDistance: statsData?.totalDistance || cumulativeTotalDistance,
      distanceX: cumulativeDistanceX,
      distanceY: cumulativeDistanceY,
      distanceZ: cumulativeDistanceZ,
      successfulJobs: statsData?.successfulJobs || 0,
      failedJobs: statsData?.failedJobs || 0,
      cancelledJobs: statsData?.stoppedJobs || 0, // Map stopped to cancelled
      operationTypes,
    }
  }, [statsData, jobHistoryData])

  // Transform tool stats to component format
  // Show all tools from library, even if they haven't been used
  const toolStats: ToolStats[] = React.useMemo(() => {
    // Create a map of tool stats by tool number (normalize to number for consistent matching)
    const statsMap = new Map<number, { usageCount: number; totalRuntime: number; totalDistance: number }>()
    if (toolStatsData && Array.isArray(toolStatsData)) {
      toolStatsData.forEach(toolStat => {
        const toolNum = Number(toolStat.toolNumber)
        if (!isNaN(toolNum)) {
          statsMap.set(toolNum, {
            usageCount: toolStat.usageCount || 0,
            totalRuntime: toolStat.totalTime || 0,
            totalDistance: toolStat.totalDistance || 0,
          })
        }
      })
    }
    
    // Get all tools from library
    const allTools: ToolStats[] = []
    const processedToolNumbers = new Set<number>()
    
    if (toolsData?.records) {
      // Add all tools from library
      toolsData.records.forEach(tool => {
        const toolNum = Number(tool.toolId) // Use toolId, not toolNumber
        if (isNaN(toolNum)) return // Skip invalid tool numbers
        
        processedToolNumbers.add(toolNum)
        const stats = statsMap.get(toolNum) || {
          usageCount: 0,
          totalRuntime: 0,
          totalDistance: 0,
        }
        
        allTools.push({
          toolNumber: toolNum,
          name: tool.name || `T${toolNum}`,
          diameter: tool.diameter || 0,
          type: tool.type || 'unknown',
          description: tool.description,
          usageCount: stats.usageCount,
          totalRuntime: stats.totalRuntime,
          totalDistance: stats.totalDistance,
        })
      })
    }
    
    // Also include any tools that have stats but aren't in the library
    if (toolStatsData && Array.isArray(toolStatsData)) {
      toolStatsData.forEach(toolStat => {
        const toolNum = Number(toolStat.toolNumber)
        if (isNaN(toolNum)) return // Skip invalid tool numbers
        
        if (!processedToolNumbers.has(toolNum)) {
          allTools.push({
            toolNumber: toolNum,
            name: `T${toolNum}`,
            diameter: 0,
            type: 'unknown',
            usageCount: toolStat.usageCount || 0,
            totalRuntime: toolStat.totalTime || 0,
            totalDistance: toolStat.totalDistance || 0,
          })
        }
      })
    }
    
    // Final deduplication by toolNumber (prefer tools with library data over stats-only tools)
    const deduplicatedTools = new Map<number, ToolStats>()
    allTools.forEach(tool => {
      const existing = deduplicatedTools.get(tool.toolNumber)
      // If tool already exists, prefer the one with library data (name other than "T{number}" or has diameter)
      if (!existing) {
        deduplicatedTools.set(tool.toolNumber, tool)
      } else {
        // Prefer tool with library data (has actual name, diameter, or description)
        const hasLibraryData = (tool.name && !tool.name.startsWith('T')) || tool.diameter > 0 || tool.description
        const existingHasLibraryData = (existing.name && !existing.name.startsWith('T')) || existing.diameter > 0 || existing.description
        
        if (hasLibraryData && !existingHasLibraryData) {
          // Replace with library tool, but merge in stats
          deduplicatedTools.set(tool.toolNumber, {
            ...tool,
            usageCount: existing.usageCount || tool.usageCount,
            totalRuntime: existing.totalRuntime || tool.totalRuntime,
            totalDistance: existing.totalDistance || tool.totalDistance,
          })
        } else if (!hasLibraryData && !existingHasLibraryData) {
          // Both are stats-only, keep the one with better stats
          if ((tool.usageCount || 0) > (existing.usageCount || 0)) {
            deduplicatedTools.set(tool.toolNumber, tool)
          }
        }
      }
    })
    
    return Array.from(deduplicatedTools.values()).sort((a, b) => a.toolNumber - b.toolNumber)
  }, [toolStatsData, toolsData])

  // Helper to calculate operation types from distance stats
  const calculateOperationTypes = (stats: {
    totalDistance?: { total?: number }
    cuttingDistance?: { total?: number }
    transitionDistance?: { total?: number }
    retractDistance?: { total?: number }
  }): OperationType[] => {
    if (!stats) return []
    
    const total = stats.totalDistance?.total || 0
    const cutting = stats.cuttingDistance?.total || 0
    const transition = stats.transitionDistance?.total || 0
    const retract = stats.retractDistance?.total || 0
    
    if (total === 0) return []
    
    const types: OperationType[] = []
    
    if (cutting > 0) {
      types.push({
        type: 'Cutting',
        percent: Math.round((cutting / total) * 100),
        color: 'rgb(34 197 94)', // green-500
        bgColor: 'bg-green-500',
      })
    }
    
    if (transition > 0) {
      types.push({
        type: 'Transition',
        percent: Math.round((transition / total) * 100),
        color: 'rgb(59 130 246)', // blue-500
        bgColor: 'bg-blue-500',
      })
    }
    
    if (retract > 0) {
      types.push({
        type: 'Retract',
        percent: Math.round((retract / total) * 100),
        color: 'rgb(249 115 22)', // orange-500
        bgColor: 'bg-orange-500',
      })
    }
    
    return types
  }

  // Transform job history to component format
  const jobStats: JobStats[] = React.useMemo(() => {
    if (!jobHistoryData) return []
    
    return jobHistoryData.map(job => {
      const status = job.status === 'completed'
        ? 'completed'
        : job.status === 'error'
        ? 'failed'
        : 'cancelled'
      
      const toolsUsed = job.tools?.map(t => t.toolNumber) || []
      const toolUsage: JobToolUsage[] = job.tools?.map(t => ({
        toolNumber: t.toolNumber,
        time: t.time || 0,
        distance: typeof t.distance === 'number' ? t.distance : 0,
      })) || []
      
      // Extract distance data from nested structure
      const totalDist = job.stats?.totalDistance || { x: 0, y: 0, z: 0, total: 0 }
      const operationTypes = calculateOperationTypes({
        totalDistance: job.stats?.totalDistance,
        cuttingDistance: job.stats?.cuttingDistance,
        transitionDistance: job.stats?.transitionDistance,
        retractDistance: job.stats?.retractDistance,
      })
      
      return {
        id: job.id,
        name: job.fileName || 'Unknown',
        startTime: new Date(job.stats?.startTime || job.timestamp),
        endTime: job.stats?.finishTime ? new Date(job.stats.finishTime) : null,
        status: status as 'completed' | 'failed' | 'cancelled',
        runtime: job.stats?.elapsedTime || 0,
        toolsUsed,
        toolUsage,
        linesProcessed: job.stats?.received || 0,
        totalLines: job.stats?.total || 0,
        distance: totalDist.total || 0,
        distanceX: totalDist.x || 0,
        distanceY: totalDist.y || 0,
        distanceZ: totalDist.z || 0,
        gcode: job.gcode,
        operationTypes,
      }
    })
  }, [jobHistoryData])

  const selectedJob = React.useMemo(() => {
    if (!selectedJobData) {
      return selectedJobId ? jobStats.find(j => j.id === selectedJobId) : null
    }
    
    const status = selectedJobData.status === 'completed'
      ? 'completed'
      : selectedJobData.status === 'error'
      ? 'failed'
      : 'cancelled'
    
    const toolsUsed = selectedJobData.tools?.map(t => t.toolNumber) || []
    const toolUsage: JobToolUsage[] = selectedJobData.tools?.map(t => ({
      toolNumber: t.toolNumber,
      time: t.time || 0,
      distance: typeof t.distance === 'number' ? t.distance : 0,
    })) || []
    
    // Extract distance data from nested structure
    const totalDist = selectedJobData.stats?.totalDistance || { x: 0, y: 0, z: 0, total: 0 }
    const operationTypes = calculateOperationTypes({
      totalDistance: selectedJobData.stats?.totalDistance,
      cuttingDistance: selectedJobData.stats?.cuttingDistance,
      transitionDistance: selectedJobData.stats?.transitionDistance,
      retractDistance: selectedJobData.stats?.retractDistance,
    })
    
    return {
      id: selectedJobData.id,
      name: selectedJobData.fileName || 'Unknown',
      startTime: new Date(selectedJobData.stats?.startTime || selectedJobData.timestamp),
      endTime: selectedJobData.stats?.finishTime ? new Date(selectedJobData.stats.finishTime) : null,
      status: status as 'completed' | 'failed' | 'cancelled',
      runtime: selectedJobData.stats?.elapsedTime || 0,
      toolsUsed,
      toolUsage,
      linesProcessed: selectedJobData.stats?.received || 0,
      totalLines: selectedJobData.stats?.total || 0,
      distance: totalDist.total || 0,
      distanceX: totalDist.x || 0,
      distanceY: totalDist.y || 0,
      distanceZ: totalDist.z || 0,
      gcode: selectedJobData.gcode,
      operationTypes,
    }
  }, [selectedJobData, selectedJobId, jobStats])

  // Format time helper
  const formatTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const years = Math.floor(days / 365)
    
    // Calculate remainders
    const remainingDays = days % 365
    const remainingHours = hours % 24
    const remainingMinutes = minutes % 60
    const remainingSeconds = seconds % 60
    
    // Build result string with appropriate units
    const parts: string[] = []
    
    if (years > 0) {
      parts.push(`${years}${years === 1 ? 'y' : 'y'}`)
      if (remainingDays > 0) {
        parts.push(`${remainingDays}${remainingDays === 1 ? 'd' : 'd'}`)
      }
      return parts.join(' ')
    }
    
    if (days > 0) {
      parts.push(`${days}${days === 1 ? 'd' : 'd'}`)
      if (remainingHours > 0) {
        parts.push(`${remainingHours}${remainingHours === 1 ? 'h' : 'h'}`)
      }
      return parts.join(' ')
    }
    
    if (hours > 0) {
      parts.push(`${hours}${hours === 1 ? 'h' : 'h'}`)
      if (remainingMinutes > 0) {
        parts.push(`${remainingMinutes}${remainingMinutes === 1 ? 'm' : 'm'}`)
      }
      return parts.join(' ')
    }
    
    if (minutes > 0) {
      parts.push(`${minutes}${minutes === 1 ? 'm' : 'm'}`)
      if (remainingSeconds > 0) {
        parts.push(`${remainingSeconds}${remainingSeconds === 1 ? 's' : 's'}`)
      }
      return parts.join(' ')
    }
    
    return `${remainingSeconds}${remainingSeconds === 1 ? 's' : 's'}`
  }

  // Format distance helper
  const formatDistance = (mm: number): string => {
    const km = Math.floor(mm / 1000000)
    const remainingM = Math.floor((mm % 1000000) / 1000)
    const remainingMm = mm % 1000
    
    // Build result string with appropriate units
    const parts: string[] = []
    
    if (km > 0) {
      parts.push(`${km} km`)
      if (remainingM > 0) {
        parts.push(`${remainingM} m`)
      }
      return parts.join(' ')
    }
    
    if (remainingM > 0) {
      parts.push(`${remainingM} m`)
      if (remainingMm > 0 && remainingMm >= 1) {
        parts.push(`${remainingMm.toFixed(0)} mm`)
      }
      return parts.join(' ')
    }
    
    return `${remainingMm.toFixed(1)} mm`
  }

  const formatDate = (date: Date): string => {
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Pie chart component
  const PieChart = ({ operationTypes, size = 14 }: { operationTypes: OperationType[], size?: number }) => {
    const chartSize = size * 4 // Convert to pixels
    
    // Zero state when no operation types
    if (!operationTypes || operationTypes.length === 0) {
      return (
        <div className="flex items-center gap-3">
          <div className="relative flex-shrink-0" style={{ width: `${chartSize}px`, height: `${chartSize}px` }}>
            <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="rgb(128 128 128)"
                strokeWidth="10"
                strokeDasharray="360 360"
                className="opacity-20"
              />
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-xs text-muted-foreground">{t('No operation data')}</div>
          </div>
        </div>
      )
    }
    
    return (
      <div className="flex items-center gap-3">
        {/* Simple pie chart visualization */}
        <div className="relative flex-shrink-0" style={{ width: `${chartSize}px`, height: `${chartSize}px` }}>
          <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
            {operationTypes.reduce((acc, { percent, color }, index) => {
              const prevPercent = acc.prev
              const offset = prevPercent * 3.6 // Convert to degrees
              const length = percent * 3.6
              return {
                prev: prevPercent + percent,
                elements: [
                  ...acc.elements,
                  <circle
                    key={index}
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke={color}
                    strokeWidth="10"
                    strokeDasharray={`${length} ${360 - length}`}
                    strokeDashoffset={-offset}
                    className="transition-all"
                  />
                ]
              }
            }, { prev: 0, elements: [] as JSX.Element[] }).elements}
          </svg>
        </div>
        <div className="flex-1 space-y-0.5">
          {operationTypes.map(({ type, percent, bgColor }) => (
            <div key={type} className="flex items-center gap-2 text-xs">
              <div className={`w-2.5 h-2.5 rounded ${bgColor}`} />
              <span className="text-muted-foreground truncate">{t(type)}</span>
              <span className="font-medium text-foreground">{percent}%</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Header - persistent across all screens */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <img src="/fulllogo.png" alt="AxioCNC" className="h-8 w-auto" />
        </div>
        
        {/* Mode tabs */}
        <div className="flex gap-1 ml-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>{t('Setup')}</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/monitor')}>{t('Monitor')}</Button>
          <Button variant="default" size="sm">{t('Stats')}</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>{t('Settings')}</Button>
          <Button variant="ghost" size="sm" asChild>
            <a href="https://axiocnc.com/docs" target="_blank" rel="noopener noreferrer">
              {t('Docs')}
            </a>
          </Button>
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Emergency actions - Reset and E-Stop */}
        <div className="ml-4 flex items-center gap-2">
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={flashStatus}
            onAction={handleReset}
            requirements={ActionRequirements.allowAlarm}
            variant="outline"
            size="sm"
            className="h-9 px-4"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            {t('Reset')}
          </MachineActionButton>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={flashStatus}
            onAction={handleEStop}
            requirements={ActionRequirements.standard}
            variant="destructive"
            size="lg"
            className="h-10 px-6 font-bold uppercase tracking-wide bg-red-600 hover:bg-red-700"
          >
            <Square className="w-5 h-5 mr-2" />
            {t('E-Stop')}
          </MachineActionButton>
        </div>
      </header>
      
      {/* Main content area */}
      <main className="flex-1 flex gap-4 p-4 min-h-0 overflow-hidden">
        {(isLoadingStats || isLoadingToolStats || isLoadingJobs) ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <div className="text-lg mb-2">{t('Loading statistics...')}</div>
            </div>
          </div>
        ) : (
          <>
            {/* Left panel - Cumulative Stats and Tool Stats (scrollable) */}
            <div className="w-80 flex flex-col min-h-0">
              <OverlayScrollbarsComponent 
                className="flex-1 min-h-0"
                options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
              >
                <div className="space-y-4 pr-2">
                  {/* Cumulative Stats */}
                  <div className="space-y-4">
                    <Card key="total-jobs">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('Total Jobs')}</CardTitle>
                      </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-2xl font-bold">{cumulativeStats.totalJobs}</div>
                    </div>
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          <span className="text-xs text-muted-foreground">{t('Successful')}</span>
                        </div>
                        <span className="text-lg font-bold text-green-500">{cumulativeStats.successfulJobs}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                          <span className="text-xs text-muted-foreground">{t('Failed')}</span>
                        </div>
                        <span className="text-lg font-bold text-red-500">{cumulativeStats.failedJobs}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-yellow-500" />
                          <span className="text-xs text-muted-foreground">{t('Cancelled')}</span>
                        </div>
                        <span className="text-lg font-bold text-yellow-500">{cumulativeStats.cancelledJobs}</span>
                      </div>
                    </div>
                      </CardContent>
                    </Card>
                    <Card key="runtime-distance">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('Runtime & Distance')}</CardTitle>
                      </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t('Total Runtime')}</div>
                      <div className="text-xl font-bold">{formatTime(cumulativeStats.totalRuntime)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">{t('Total Distance')}</div>
                      <div className="text-xl font-bold mb-2">{formatDistance(cumulativeStats.totalDistance)}</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground"><span className="text-red-500 font-bold">X</span>:</span>
                          <span className="font-mono font-medium">{formatDistance(cumulativeStats.distanceX)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground"><span className="text-green-500 font-bold">Y</span>:</span>
                          <span className="font-mono font-medium">{formatDistance(cumulativeStats.distanceY)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground"><span className="text-blue-500 font-bold">Z</span>:</span>
                          <span className="font-mono font-medium">{formatDistance(cumulativeStats.distanceZ)}</span>
                        </div>
                      </div>
                    </div>
                      </CardContent>
                    </Card>
                    <Card key="operation-types">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">{t('Operation Types')}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <PieChart operationTypes={cumulativeStats.operationTypes} size={12} />
                      </CardContent>
                    </Card>
                  </div>

              {/* Tool Stats */}
              <Card>
                <CardHeader className="border-b border-border">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="w-4 h-4" />
                    {t('Tool Stats')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    {toolStats.map((tool) => (
                      <div
                        key={tool.toolNumber}
                        className="p-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">T{tool.toolNumber}</div>
                            <div className="text-xs text-muted-foreground">{tool.name}</div>
                            {tool.description && (
                              <div className="text-xs text-muted-foreground mt-1 italic">{tool.description}</div>
                            )}
                          </div>
                          {(tool.diameter > 0 || (tool.type && tool.type !== 'unknown')) && (
                            <div className="text-xs text-muted-foreground ml-2 flex-shrink-0">
                              {tool.diameter > 0 ? `⌀${tool.diameter}mm` : tool.type}
                            </div>
                          )}
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('Usage:')}</span>
                            <span className="font-medium">{tool.usageCount} {t('jobs')}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('Runtime:')}</span>
                            <span className="font-medium">{formatTime(tool.totalRuntime)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">{t('Distance:')}</span>
                            <span className="font-medium">{formatDistance(tool.totalDistance)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </OverlayScrollbarsComponent>
        </div>

        {/* Right side - Job History and Job Details (full height) */}
        <div className="flex-1 flex gap-4 min-h-0">
            {/* Job List - Left side */}
            <Card className="w-96 flex flex-col min-h-0">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  {t('Job History')}
                </CardTitle>
              </CardHeader>
              <OverlayScrollbarsComponent 
                className="flex-1 min-h-0"
                options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
              >
                <div className="p-2">
                  {jobStats.map((job) => (
                    <button
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id === selectedJobId ? null : job.id)}
                      className={cn(
                        'w-full text-left p-3 rounded-lg border transition-colors mb-2',
                        selectedJobId === job.id
                          ? 'border-primary bg-primary/10'
                          : 'border-border bg-card hover:bg-muted/50'
                      )}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">{job.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatDate(job.startTime)}
                          </div>
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          {job.status === 'completed' && (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          )}
                          {job.status === 'failed' && (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          {job.status === 'cancelled' && (
                            <AlertCircle className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTime(job.runtime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          {job.toolsUsed.length} {job.toolsUsed.length !== 1 ? t('tools') : t('tool')}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </OverlayScrollbarsComponent>
            </Card>

            {/* Job Details - Right side */}
            <Card className="flex-1 flex flex-col min-h-0">
              <CardHeader className="border-b border-border">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  {t('Job Details')}
                </CardTitle>
              </CardHeader>
              {selectedJob ? (
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Scrollable stats section */}
                  <OverlayScrollbarsComponent 
                    className="flex-1 min-h-0"
                    options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
                  >
                    <div className="p-6 space-y-6">
                      {/* Job Header */}
                      <div>
                        <h3 className="text-lg font-bold mb-1">{selectedJob.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>{t('Started:')} {formatDate(selectedJob.startTime)}</span>
                          {selectedJob.endTime && (
                            <>
                              <span>•</span>
                              <span>{t('Ended:')} {formatDate(selectedJob.endTime)}</span>
                            </>
                          )}
                        </div>
                        <div className="mt-2">
                          {selectedJob.status === 'completed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-500/10 text-green-500">
                              <CheckCircle2 className="w-3 h-3" />
                              {t('Completed')}
                            </span>
                          )}
                          {selectedJob.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-500/10 text-red-500">
                              <XCircle className="w-3 h-3" />
                              {t('Failed')}
                            </span>
                          )}
                          {selectedJob.status === 'cancelled' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-yellow-500/10 text-yellow-500">
                              <AlertCircle className="w-3 h-3" />
                              {t('Cancelled')}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-lg border border-border bg-muted/30">
                          <div className="text-sm text-muted-foreground mb-1">{t('Runtime')}</div>
                          <div className="text-xl font-bold mb-3">{formatTime(selectedJob.runtime)}</div>
                          <div className="pt-3 border-t border-border">
                            <div className="text-sm text-muted-foreground mb-1">{t('Lines Processed')}</div>
                            <div className="text-xl font-bold mb-2">
                              {selectedJob.linesProcessed.toLocaleString()} / {selectedJob.totalLines.toLocaleString()}
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary"
                                style={{ width: `${(selectedJob.linesProcessed / selectedJob.totalLines) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="p-4 rounded-lg border border-border bg-muted/30">
                          <div className="text-sm text-muted-foreground mb-2">{t('Distance')}</div>
                          <div className="text-xl font-bold mb-2">{formatDistance(selectedJob.distance)}</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground"><span className="text-red-500 font-bold">X</span>:</span>
                              <span className="font-mono font-medium">{formatDistance(selectedJob.distanceX)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground"><span className="text-green-500 font-bold">Y</span>:</span>
                              <span className="font-mono font-medium">{formatDistance(selectedJob.distanceY)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground"><span className="text-blue-500 font-bold">Z</span>:</span>
                              <span className="font-mono font-medium">{formatDistance(selectedJob.distanceZ)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Operation Types Pie Chart */}
                      <div className="p-4 rounded-lg border border-border bg-muted/30">
                        <div className="text-sm text-muted-foreground mb-3">Operation Types</div>
                        <PieChart operationTypes={selectedJob.operationTypes || []} size={16} />
                      </div>

                      {/* Tools Used */}
                      <div className="p-4 rounded-lg border border-border bg-muted/30">
                        <div className="text-sm text-muted-foreground mb-3">Tools Used</div>
                        <div className="space-y-2">
                          {selectedJob.toolUsage.map((toolUsageData) => {
                            const tool = toolsMap.get(toolUsageData.toolNumber)
                            return (
                              <div
                                key={`tool-${toolUsageData.toolNumber}`}
                                className="p-3 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-sm">T{toolUsageData.toolNumber}</span>
                                      {tool && (
                                        <>
                                          <span className="text-xs text-muted-foreground">•</span>
                                          <span className="text-sm text-foreground">{tool.name}</span>
                                        </>
                                      )}
                                    </div>
                                    {tool && tool.description && (
                                      <div className="text-xs text-muted-foreground mb-1 italic">{tool.description}</div>
                                    )}
                                    {tool && tool.diameter > 0 && (
                                      <div className="text-xs text-muted-foreground">
                                        ⌀{tool.diameter}mm • {tool.type}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <div className="text-muted-foreground mb-0.5">{t('Runtime')}</div>
                                    <div className="font-medium">{formatTime(toolUsageData.time)}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground mb-0.5">{t('Distance')}</div>
                                    <div className="font-medium">{formatDistance(toolUsageData.distance)}</div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  </OverlayScrollbarsComponent>

                  {/* Visualizer Panel - Fixed height at bottom */}
                  {selectedJob.gcode && (
                    <div className="border-t border-border">
                      <div className="px-4 py-2 bg-muted/30 border-b border-border">
                        <h4 className="text-sm font-medium">{t('G-code Visualization')}</h4>
                      </div>
                      <div className="h-64 relative">
                        <VisualizerScene 
                          gcode={selectedJob.gcode}
                          limits={settings?.machine?.limits}
                          view="iso"
                          viewKey={Number(selectedJob.id) || 0}
                          machinePosition={machinePosition}
                          processedLines={selectedJob.linesProcessed}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">{t('Select a job from the list to view details')}</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
          </>
        )}
      </main>
    </div>
  )
}
