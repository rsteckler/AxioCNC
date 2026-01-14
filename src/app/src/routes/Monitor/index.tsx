import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Terminal, Maximize2, Clock, FileText, Gauge, HelpCircle, Columns3, Maximize, PictureInPicture, ArrowLeftRight, RotateCcw, Square, Home } from 'lucide-react'
import Hls from 'hls.js'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { useGetSettingsQuery, useGetControllersQuery, useLazyGetMachineStatusQuery, useGetCamerasQuery, useGetStreamMetadataQuery, useGetGcodeQuery, type MachineStatus as ApiMachineStatus } from '@/services/api'
import { socketService } from '@/services/socket'
import { useGcodeCommand } from '@/hooks'
import { MachineActionButton } from '@/components/MachineActionButton'
import { MachineStatusBar, type MachineStatus as MachineStatusType } from '@/components/MachineStatusBar'
import { JobStatusBar } from '@/components/JobStatusBar'
import { Console } from '@/components/Console'
import { ActionRequirements } from '@/utils/machineState'
import { VisualizerScene } from '../Setup/components/VisualizerScene'
import type { PanelProps } from '../Setup/types'
import type { CameraConfig } from '../Settings/sections/CameraSection'

// ============================================================================
// CAMERA COMPONENT
// ============================================================================

function CameraView() {
  const { data: camerasData, isLoading: isLoadingCameras } = useGetCamerasQuery(undefined, {
    pollingInterval: 5000,
  })
  const { data: settings } = useGetSettingsQuery()
  
  // Get first enabled camera
  const enabledCamera = useMemo(() => {
    return camerasData?.records?.find(c => c.enabled) || null
  }, [camerasData])
  
  // Get stream metadata for the enabled camera
  const { data: streamMetadata, isLoading: isLoadingStream, error: streamError } = useGetStreamMetadataQuery(
    enabledCamera?.id || '',
    { 
      skip: !enabledCamera?.id,
      retry: 2,
    }
  )
  
  // Get display options from settings (still stored in settings.camera)
  const cameraConfig: CameraConfig | undefined = settings?.camera
  
  // Build transform style for display options
  const transformStyle = useMemo(() => {
    if (!cameraConfig) return ''
    const transforms: string[] = []
    
    if (cameraConfig.flipVertical) {
      transforms.push('rotateX(180deg)')
    }
    if (cameraConfig.flipHorizontal) {
      transforms.push('rotateY(180deg)')
    }
    if (cameraConfig.rotation) {
      transforms.push(`rotate(${cameraConfig.rotation}deg)`)
    }
    
    return transforms.length > 0 ? transforms.join(' ') : ''
  }, [cameraConfig])
  
  // HLS video ref
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  
  // Setup HLS player for HLS streams
  useEffect(() => {
    if (streamMetadata?.type === 'hls' && videoRef.current) {
      const video = videoRef.current
      const streamUrl = streamMetadata.src
      
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        })
        hls.loadSource(streamUrl)
        hls.attachMedia(video)
        hlsRef.current = hls
        
        return () => {
          hls.destroy()
          hlsRef.current = null
        }
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl
      }
    }
    
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [streamMetadata])
  
  if (isLoadingCameras) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading cameras...
        </div>
      </div>
    )
  }
  
  if (!enabledCamera) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground text-center py-8">
          No enabled camera found. Configure a camera in Settings.
        </div>
      </div>
    )
  }
  
  if (isLoadingStream) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading stream...
        </div>
      </div>
    )
  }
  
  if (streamError || !streamMetadata) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-sm text-muted-foreground text-center py-8">
          {streamError ? 'Error loading stream' : 'Stream not available. Check camera configuration.'}
        </div>
      </div>
    )
  }
  
  return (
    <div className="absolute inset-0 bg-black flex items-center justify-center">
      {streamMetadata.type === 'hls' ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="max-w-full max-h-full object-contain"
          style={{ transform: transformStyle }}
        />
      ) : (
        <img
          src={streamMetadata.src}
          alt={`${enabledCamera.name} Feed`}
          className="max-w-full max-h-full object-contain"
          style={{ transform: transformStyle }}
        />
      )}
      
      {/* Crosshair overlay */}
      {cameraConfig?.crosshair && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Horizontal line */}
          <div 
            className="absolute top-1/2 left-0 right-0 h-px"
            style={{ backgroundColor: cameraConfig.crosshairColor }}
          />
          {/* Vertical line */}
          <div 
            className="absolute left-1/2 top-0 bottom-0 w-px"
            style={{ backgroundColor: cameraConfig.crosshairColor }}
          />
          {/* Inner circle */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border"
            style={{ borderColor: cameraConfig.crosshairColor }}
          />
          {/* Outer circle */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full border"
            style={{ borderColor: cameraConfig.crosshairColor }}
          />
        </div>
      )}
    </div>
  )
}

// ============================================================================
// VISUALIZER/CAMERA COMBINED VIEW
// ============================================================================

type ViewMode = 'side-by-side' | 'visual-only' | 'camera-only' | 'pip-visual' | 'pip-camera'

interface VisualizerCameraViewProps {
  machinePosition: { x: number; y: number; z: number }
}

function VisualizerCameraView({ machinePosition }: VisualizerCameraViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const { data: settings } = useGetSettingsQuery()
  
  // G-code state for visualizer
  const [loadedGcode, setLoadedGcode] = useState<{ name: string; gcode: string } | null>(null)
  const [modelOffset, setModelOffset] = useState<{ x: number; y: number; z: number } | null>(null)
  
  // Get connection port for querying loaded G-code (settings is already declared above)
  const connectedPort = settings?.connection?.port
  
  // Query currently loaded G-code on mount (to restore when navigating between pages)
  const { data: gcodeData } = useGetGcodeQuery(connectedPort || '', {
    skip: !connectedPort,
  })
  
  // Restore loaded G-code from API on mount
  useEffect(() => {
    if (gcodeData && gcodeData.name && (gcodeData.data || gcodeData.gcode)) {
      setLoadedGcode({
        name: gcodeData.name,
        gcode: gcodeData.data || gcodeData.gcode || '',
      })
    } else if (gcodeData && !gcodeData.name) {
      // No file loaded
      setLoadedGcode(null)
    }
  }, [gcodeData])
  
  // Listen to G-code load/unload events for visualizer
  useEffect(() => {
    // gcode:load emits (name, gcode, context) as separate arguments
    const handleGcodeLoad = (name: string, gcode: string) => {
      if (name && gcode) {
        setLoadedGcode({ name, gcode })
        // Try to restore saved offset from localStorage
        const savedOffsetKey = `modelOffset_${name}`
        const savedOffset = localStorage.getItem(savedOffsetKey)
        if (savedOffset) {
          try {
            const offset = JSON.parse(savedOffset)
            if (offset && typeof offset.x === 'number' && typeof offset.y === 'number' && typeof offset.z === 'number') {
              setModelOffset(offset)
            } else {
              setModelOffset(null)
            }
          } catch (err) {
            setModelOffset(null)
          }
        } else {
          setModelOffset(null)
        }
      }
    }

    const handleGcodeUnload = () => {
      // Clear saved offset when unloading
      if (loadedGcode?.name) {
        localStorage.removeItem(`modelOffset_${loadedGcode.name}`)
      }
      setLoadedGcode(null)
      setModelOffset(null)
    }

    socketService.on('gcode:load', handleGcodeLoad)
    socketService.on('gcode:unload', handleGcodeUnload)

    return () => {
      socketService.off('gcode:load', handleGcodeLoad)
      socketService.off('gcode:unload', handleGcodeUnload)
    }
  }, [])
  
  const [view, setView] = useState<'top' | 'front' | 'iso' | 'fit'>('iso')
  const [viewKey, setViewKey] = useState(0)

  const handleSwapPiP = () => {
    if (viewMode === 'pip-visual') {
      setViewMode('pip-camera')
    } else if (viewMode === 'pip-camera') {
      setViewMode('pip-visual')
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Main content area */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Visualizer - full screen modes */}
        {(viewMode === 'side-by-side' || viewMode === 'visual-only' || viewMode === 'pip-visual') && (
          <div className={`
            ${viewMode === 'side-by-side' ? 'w-1/2' : 'w-full'}
            flex-1 relative
          `}>
            <VisualizerScene 
              gcode={loadedGcode?.gcode} 
              limits={settings?.machine?.limits}
              view={view}
              viewKey={viewKey}
              machinePosition={machinePosition}
              modelOffset={modelOffset}
            />
            {/* PiP camera overlay when visualizer is full screen */}
            {viewMode === 'pip-visual' && (
              <div className="absolute bottom-4 right-4 w-80 h-60 border-2 border-primary rounded-lg overflow-hidden shadow-lg bg-card z-10">
                <div className="absolute top-1 right-1 z-20 bg-primary/80 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                  Camera
                </div>
                <div className="w-full h-full">
                  <CameraView />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Camera - full screen modes */}
        {(viewMode === 'side-by-side' || viewMode === 'camera-only' || viewMode === 'pip-camera') && (
          <div className={`
            ${viewMode === 'side-by-side' ? 'w-1/2 border-l border-border' : 'w-full'}
            flex-1 relative min-h-0 overflow-hidden
          `}>
            <CameraView />
            {/* PiP visualizer overlay when camera is full screen */}
            {viewMode === 'pip-camera' && (
              <div className="absolute bottom-4 right-4 w-80 h-60 border-2 border-primary rounded-lg overflow-hidden shadow-lg bg-card z-10">
                <div className="absolute top-1 right-1 z-20 bg-primary/80 text-primary-foreground text-[10px] px-1.5 py-0.5 rounded">
                  3D View
                </div>
                <div className="w-full h-full">
                  <VisualizerScene 
                    gcode={loadedGcode?.gcode} 
                    limits={settings?.machine?.limits}
                    view={view}
                    viewKey={viewKey}
                    machinePosition={machinePosition}
                    modelOffset={modelOffset}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View mode controls */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-card/95 backdrop-blur-sm border border-border rounded-lg px-2 py-1.5 shadow-lg">
        <Button
          variant={viewMode === 'side-by-side' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setViewMode('side-by-side')}
        >
          <Columns3 className="w-3 h-3 mr-1" />
          Side-by-Side
        </Button>
        <Button
          variant={viewMode === 'visual-only' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setViewMode('visual-only')}
        >
          <Maximize2 className="w-3 h-3 mr-1" />
          3D View Only
        </Button>
        <Button
          variant={viewMode === 'camera-only' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setViewMode('camera-only')}
        >
          <Camera className="w-3 h-3 mr-1" />
          Camera Only
        </Button>
        <div className="w-px h-4 bg-border mx-1" />
        <Button
          variant={viewMode === 'pip-visual' || viewMode === 'pip-camera' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setViewMode(viewMode === 'pip-visual' || viewMode === 'pip-camera' ? 'side-by-side' : 'pip-visual')}
        >
          <PictureInPicture className="w-3 h-3 mr-1" />
          PiP
        </Button>
        {(viewMode === 'pip-visual' || viewMode === 'pip-camera') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSwapPiP}
          >
            <ArrowLeftRight className="w-3 h-3" />
          </Button>
        )}
      </div>
    </div>
  )
}


function ProgressPanel({ panelProps }: { panelProps: PanelProps }) {
  const {
    machinePosition = { x: 0, y: 0, z: 0 },
    workPosition = { x: 0, y: 0, z: 0 },
    spindleState = 'M5',
    spindleSpeed = 0,
  } = panelProps

  // Spindle direction from state
  const isOn = spindleState === 'M3' || spindleState === 'M4'
  const direction = spindleState === 'M4' ? 'CCW' : 'CW'

  // Axis data
  const axes = [
    { axis: 'X' as const, color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', mpos: machinePosition.x, wpos: workPosition.x },
    { axis: 'Y' as const, color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', mpos: machinePosition.y, wpos: workPosition.y },
    { axis: 'Z' as const, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', mpos: machinePosition.z, wpos: workPosition.z },
  ]

  // Mock tool data - tools in order of use (can repeat)
  const toolsInOrder = [
    { id: 1, number: 1, name: 'End Mill 1/4"', diameter: 6.35, isCurrent: false },
    { id: 2, number: 2, name: 'Drill 1/8"', diameter: 3.175, isCurrent: false },
    { id: 3, number: 1, name: 'End Mill 1/4"', diameter: 6.35, isCurrent: true }, // Tool 1 used again, currently active
    { id: 4, number: 3, name: 'Chamfer Bit', diameter: 4.0, isCurrent: false },
  ]

  // Mock progress data
  const elapsedSeconds = 1247 // 20:47
  const remainingSeconds = 1853 // 30:53
  const remainingConfidenceSeconds = 135 // ± 2:15
  const totalSeconds = elapsedSeconds + remainingSeconds
  const fileProgressPercent = 67.3
  const linesSent = 12450
  const linesTotal = 18500
  const bytesSent = 245000
  const bytesTotal = 364000
  const plannerQueueDepth = 14
  const plannerQueueMax = 16
  const feedRate = 1200 // mm/min
  const feedRateMax = 3000
  const totalTravelXY = 12450.5 // mm
  const totalTravelZ = 234.8 // mm
  const chiploadEnabled = true // Mock: whether tool library is set up
  const chiploadValue = 0.0025 // Mock: current chipload in mm (0.001 = too low, 0.002-0.004 = ideal, 0.005+ = too high)

  // Operation type breakdown (for pie chart)
  const operationTypes = [
    { type: 'Cutting', percent: 45, color: 'rgb(59 130 246)', bgColor: 'bg-blue-500' },
    { type: 'Positioning', percent: 30, color: 'rgb(34 197 94)', bgColor: 'bg-green-500' },
    { type: 'Retracting/Plunging', percent: 25, color: 'rgb(249 115 22)', bgColor: 'bg-orange-500' },
  ]

  // Format time helper
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Format file size helper
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="flex gap-6">
          {/* Left side - Position readouts and Spindle info */}
          <div className="bg-muted/30 rounded-lg border border-border p-4 flex flex-col gap-4 flex-shrink-0">
            {/* Position readouts */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground mb-1">Position</div>
              {/* Column headers */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-5" /> {/* Axis label spacer */}
                <div className="w-24 text-center">WCS</div>
                <div className="w-20 text-center">Machine</div>
              </div>
              
              {/* Axis readouts */}
              {axes.map(({ axis, color, bgColor, borderColor, mpos, wpos }) => (
                <div key={axis} className="flex items-center gap-2">
                  {/* Axis label */}
                  <span className={`text-sm font-bold w-5 ${color}`}>{axis}</span>
                  
                  {/* Work position */}
                  <div className={`w-24 ${bgColor} ${borderColor} border rounded px-2 py-1.5 font-mono text-right text-sm font-medium`}>
                    {wpos.toFixed(3)}
                  </div>
                  
                  {/* Machine position */}
                  <div className="w-20 bg-muted/30 border border-border rounded px-2 py-1.5 font-mono text-right text-xs text-muted-foreground">
                    {mpos.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            {/* Spindle info */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground mb-1">Spindle</div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">Direction:</span>
                <span className="font-medium">{isOn ? direction : 'Off'}</span>
                <span className="text-muted-foreground">Speed:</span>
                <span className="font-mono font-medium">{spindleSpeed} RPM</span>
              </div>
            </div>

            {/* Feed rate */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Gauge className="w-3.5 h-3.5" />
                <span>Feed Rate</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-medium">{feedRate} mm/min</span>
                  <span className="text-muted-foreground">max {feedRateMax}</span>
                </div>
                <Progress 
                  value={(feedRate / feedRateMax) * 100} 
                  className="h-1.5"
                />
              </div>
            </div>
          </div>

          {/* Center - Work progress */}
          <div className="flex-1 bg-muted/30 rounded-lg border border-border p-4 flex flex-col gap-4">
            {/* Time and File progress - side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Time indicators */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Elapsed</span>
                    <span className="font-mono font-medium">{formatTime(elapsedSeconds)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-mono font-medium text-orange-500">
                      {formatTime(remainingSeconds)}
                      <span className="text-[10px] text-muted-foreground ml-1">
                        ± {formatTime(remainingConfidenceSeconds)}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono font-medium">{formatTime(totalSeconds)}</span>
                  </div>
                </div>
                <Progress value={(elapsedSeconds / totalSeconds) * 100} className="h-1.5" />
              </div>

              {/* File progress */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" />
                  <span>File Progress</span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Lines</span>
                    <span className="font-medium">{fileProgressPercent.toFixed(1)}%</span>
                  </div>
                  <Progress value={fileProgressPercent} className="h-1.5" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{linesSent.toLocaleString()} / {linesTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{formatBytes(bytesSent)} / {formatBytes(bytesTotal)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Operation type pie chart and travel distances */}
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">Operation Types & Travel</div>
              <div className="flex items-center gap-3">
                {/* Simple pie chart visualization - condensed */}
                <div className="relative w-14 h-14 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="transform -rotate-90">
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
                      <span className="flex-1 text-muted-foreground truncate">{type}</span>
                      <span className="font-medium">{percent}%</span>
                    </div>
                  ))}
                </div>
                {/* Travel distances */}
                <div className="flex-shrink-0 space-y-1.5 border-l border-border pl-3">
                  <div className="text-xs text-muted-foreground">Travel</div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">XY:</span>
                      <span className="text-xs font-mono font-medium">{totalTravelXY.toFixed(1)} mm</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">Z:</span>
                      <span className="text-xs font-mono font-medium">{totalTravelZ.toFixed(1)} mm</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Planner queue and Chipload - side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Planner queue */}
              <div className="space-y-2">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Planner Queue</span>
                    <span className="font-medium">{plannerQueueDepth} / {plannerQueueMax}</span>
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: plannerQueueMax }, (_, i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded ${
                          i < plannerQueueDepth 
                            ? i < plannerQueueMax * 0.7 
                              ? 'bg-green-500' 
                              : i < plannerQueueMax * 0.9 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
                            : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Chipload indicator */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Chipload</span>
                  <TooltipProvider delayDuration={300}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        {chiploadEnabled ? (
                          <p>This is the chip load estimate based on current feed rate, spindle speed, and tool geometry from the tool library.</p>
                        ) : (
                          <p>Chipload indicator requires the tool library to be set up with tool geometry information.</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {chiploadEnabled ? (
                  <div className="relative">
                    {/* Gauge background with zones */}
                    <div className="relative h-6 bg-muted rounded border overflow-hidden">
                      {/* Too low zone (left) */}
                      <div className="absolute left-0 top-0 h-full w-1/3 bg-orange-500/20" />
                      {/* Ideal zone (center) */}
                      <div className="absolute left-1/3 top-0 h-full w-1/3 bg-green-500/20" />
                      {/* Too high zone (right) */}
                      <div className="absolute right-0 top-0 h-full w-1/3 bg-red-500/20" />
                      
                      {/* Zone labels */}
                      <div className="absolute inset-0 flex items-center justify-between px-1.5 text-[9px] text-muted-foreground">
                        <span>Low</span>
                        <span>Ideal</span>
                        <span>High</span>
                      </div>
                      
                      {/* Needle indicator */}
                      <div 
                        className="absolute top-0 bottom-0 w-0.5 bg-foreground z-10 transition-all"
                        style={{
                          left: `${Math.min(100, Math.max(0, ((chiploadValue - 0.001) / (0.006 - 0.001)) * 100))}%`,
                          transform: 'translateX(-50%)'
                        }}
                      >
                        <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 border-2 border-foreground bg-background rounded-full" />
                      </div>
                    </div>
                    <div className="mt-0.5 text-[10px] text-center font-mono text-muted-foreground">
                      {chiploadValue.toFixed(4)} mm
                    </div>
                  </div>
                ) : (
                  <div className="h-6 bg-muted/50 rounded border border-dashed flex items-center justify-center">
                    <span className="text-[10px] text-muted-foreground">Not available</span>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right side - Tools used in order */}
          <div className="ml-auto bg-muted/30 rounded-lg border border-border p-4 flex-shrink-0 flex flex-col" style={{ minHeight: 0, maxHeight: '100%' }}>
            <div className="text-xs text-muted-foreground mb-2">Tools Used</div>
            {/* Scrollable tool list - top half */}
            <div className="flex-1 min-h-0">
              <OverlayScrollbarsComponent 
                className="h-full"
                options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
              >
                <div className="space-y-1.5 pr-2">
                  {toolsInOrder.map((tool, index) => {
                    // Find the index of the current tool
                    const currentToolIndex = toolsInOrder.findIndex(t => t.isCurrent)
                    const isUsed = currentToolIndex !== -1 && index < currentToolIndex
                    
                    return (
                      <div
                        key={tool.id}
                        className={`
                          px-3 py-2 rounded border text-sm
                          ${tool.isCurrent 
                            ? 'bg-primary/10 border-primary/30 text-primary font-medium' 
                            : isUsed
                              ? 'bg-background border-border text-muted-foreground opacity-50'
                              : 'bg-background border-border text-foreground'
                          }
                        `}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs">T{tool.number}</span>
                            <span className="text-xs">{tool.name}</span>
                          </div>
                          <span className="text-xs text-muted-foreground">Ø{tool.diameter}mm</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </OverlayScrollbarsComponent>
            </div>
          </div>
        </div>
  )
}

// ============================================================================
// MAIN MONITOR PAGE
// ============================================================================

export default function Monitor() {
  const navigate = useNavigate()
  
  // Get connection settings from API
  const { data: settings } = useGetSettingsQuery()
  const { data: controllersData } = useGetControllersQuery()
  const [getMachineStatus] = useLazyGetMachineStatusQuery()
  
  // Machine status type
  type MachineStatus = 
    | 'not_connected'
    | 'connected_pre_home'
    | 'connected_post_home'
    | 'alarm'
    | 'running'
    | 'hold'
    | 'error'
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectedPort, setConnectedPort] = useState<string | null>(null)
  const [machineStatus, setMachineStatus] = useState<MachineStatus>('not_connected')
  const [isFlashing, setIsFlashing] = useState(false)
  const [isHomed, setIsHomed] = useState(false)
  const [isJobRunning, setIsJobRunning] = useState(false)
  const [workflowState, setWorkflowState] = useState<'idle' | 'running' | 'paused' | null>(null)
  
  // Position state
  const [machinePosition, setMachinePosition] = useState({ x: 0, y: 0, z: 0 })
  const [workPosition, setWorkPosition] = useState({ x: 0, y: 0, z: 0 })
  
  // Spindle state
  const [spindleState, setSpindleState] = useState('M5')
  const [spindleSpeed, setSpindleSpeed] = useState(0)
  
  const { sendCommand } = useGcodeCommand(connectedPort)
  
  // Flash status when action attempted while disconnected
  const flashStatus = useCallback(() => {
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 450)
  }, [])
  
  // Handle Connect/Disconnect button
  const handleConnect = useCallback(() => {
    if (isConnecting) return
    
    if (isConnected && connectedPort) {
      // Disconnect
      const socket = socketService.getSocket()
      if (socket) {
        socket.emit('close', connectedPort)
      }
      setIsConnected(false)
      setConnectedPort(null)
      setMachineStatus('not_connected')
      setIsHomed(false)
      setIsJobRunning(false)
    } else {
      // Connect
      if (!settings?.connection?.port) {
        flashStatus()
        return
      }
      
      setIsConnecting(true)
      const socket = socketService.getSocket()
      if (!socket || !socketService.isConnected()) {
        socketService.connect()
      }
      
      const port = settings.connection.port
      const connectionOptions = {
        baudrate: settings.connection.baudRate || 115200,
        controllerType: settings.connection.controllerType || 'Grbl',
        rtscts: settings.connection.rtscts || false,
      }
      
      const connectionTimeout = setTimeout(() => {
        setIsConnecting(false)
      }, 10000)
      
      setTimeout(() => {
        const socket = socketService.getSocket()
        if (!socket) {
          clearTimeout(connectionTimeout)
          setIsConnecting(false)
          return
        }
        
        socket.emit('open', port, connectionOptions, (err: Error | null) => {
          clearTimeout(connectionTimeout)
          setIsConnecting(false)
          if (err) {
            console.error('Connection error:', err)
          } else {
            setIsConnected(true)
            setConnectedPort(port)
            setMachineStatus('connected_pre_home')
            setIsHomed(false)
          }
        })
      }, 100)
    }
  }, [settings, isConnected, isConnecting, connectedPort, flashStatus])
  
  // Handle Home button
  const handleHome = useCallback(() => {
    if (!isConnected || !connectedPort) {
      flashStatus()
      return
    }
    sendCommand('homing')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Pause button
  const handlePause = useCallback(() => {
    if (!isConnected || !connectedPort) {
      flashStatus()
      return
    }
    sendCommand('gcode:pause')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Resume button
  const handleResume = useCallback(() => {
    if (!isConnected || !connectedPort) {
      flashStatus()
      return
    }
    sendCommand('gcode:resume')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Stop button
  const handleStop = useCallback(() => {
    if (!isConnected || !connectedPort) {
      flashStatus()
      return
    }
    sendCommand('gcode:stop')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Unlock button
  const handleUnlock = useCallback(() => {
    if (!isConnected || !connectedPort) {
      flashStatus()
      return
    }
    sendCommand('unlock')
    setMachineStatus('connected_pre_home')
    setIsHomed(false)
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Reset button
  const handleReset = useCallback(() => {
    if (!connectedPort) return
    sendCommand('reset')
    setMachineStatus('connected_pre_home')
    setIsHomed(false)
    setIsJobRunning(false)
  }, [connectedPort, sendCommand])
  
  // Handle E-Stop button
  const handleEStop = useCallback(() => {
    if (!connectedPort) return
    sendCommand('gcode:stop', { force: true })
    sendCommand('reset')
    setIsJobRunning(false)
    setIsHomed(false)
    setMachineStatus('connected_pre_home')
  }, [connectedPort, sendCommand])
  
  // Listen for connection events
  useEffect(() => {
    const socket = socketService.getSocket()
    if (!socket) return
    
    const handleSerialPortOpen = (...args: unknown[]) => {
      const data = args[0] as { port: string }
      setIsConnected(true)
      setConnectedPort(data.port)
      setIsConnecting(false)
    }
    
    const handleSerialPortClose = (...args: unknown[]) => {
      const data = args[0] as { port: string }
      if (data.port === connectedPort) {
        setIsConnected(false)
        setConnectedPort(null)
        setMachineStatus('not_connected')
        setIsHomed(false)
        setIsJobRunning(false)
      }
    }
    
    const handleWorkflowState = (...args: unknown[]) => {
      const state = args[0] as string
      if (typeof state === 'string') {
        setWorkflowState(state as 'idle' | 'running' | 'paused')
        if (state === 'running') {
          setIsJobRunning(true)
        } else if (state === 'idle') {
          setIsJobRunning(false)
        }
      }
    }
    
    const handleControllerState = (...args: unknown[]) => {
      const state = args[1] as { 
        status?: { activeState?: string }
        parserstate?: { mpos?: { x?: string, y?: string, z?: string }, wpos?: { x?: string, y?: string, z?: string } }
      }
      
      if (state.status?.activeState === 'Alarm') {
        setMachineStatus('alarm')
      } else if (state.status?.activeState === 'Run') {
        setMachineStatus('running')
      } else if (state.status?.activeState === 'Hold') {
        setMachineStatus('hold')
      } else if (state.status?.activeState === 'Idle') {
        if (machineStatus === 'running') {
          setMachineStatus('connected_post_home')
        }
      }
      
      if (state.parserstate) {
        if (state.parserstate.mpos) {
          setMachinePosition({
            x: parseFloat(state.parserstate.mpos.x || '0'),
            y: parseFloat(state.parserstate.mpos.y || '0'),
            z: parseFloat(state.parserstate.mpos.z || '0'),
          })
        }
        if (state.parserstate.wpos) {
          setWorkPosition({
            x: parseFloat(state.parserstate.wpos.x || '0'),
            y: parseFloat(state.parserstate.wpos.y || '0'),
            z: parseFloat(state.parserstate.wpos.z || '0'),
          })
        }
      }
    }
    
    const handleMachineStatus: (...args: unknown[]) => void = (...args) => {
      const port = args[0] as string
      const status = args[1] as ApiMachineStatus
      if (typeof port !== 'string' || !status || typeof status !== 'object') return

      // Only update local state if this is for the configured port
      if (status.port === settings?.connection?.port) {
        setIsConnected(status.connected)
        setConnectedPort(status.connected ? status.port : null)
        setMachineStatus(status.machineStatus)
        setIsHomed(status.isHomed)
        setIsJobRunning(status.isJobRunning)
        setWorkflowState(status.workflowState || null)
        
        if (status.controllerState) {
          setMachinePosition({
            x: parseFloat(status.controllerState.mpos?.x || '0'),
            y: parseFloat(status.controllerState.mpos?.y || '0'),
            z: parseFloat(status.controllerState.mpos?.z || '0')
          })
          setWorkPosition({
            x: parseFloat(status.controllerState.wpos?.x || '0'),
            y: parseFloat(status.controllerState.wpos?.y || '0'),
            z: parseFloat(status.controllerState.wpos?.z || '0')
          })
        }
      }
    }
    
    socket.on('serialport:open', handleSerialPortOpen)
    socket.on('serialport:close', handleSerialPortClose)
    socket.on('controller:state', handleControllerState)
    socket.on('machine:status', handleMachineStatus)
    socket.on('workflow:state', handleWorkflowState)
    
    // Request current status
    if (settings?.connection?.port) {
      socket.emit('machine:status:request', settings.connection.port)
    } else {
      socket.emit('machine:status:request')
    }
    
    return () => {
      socket.off('serialport:open', handleSerialPortOpen)
      socket.off('serialport:close', handleSerialPortClose)
      socket.off('controller:state', handleControllerState)
      socket.off('machine:status', handleMachineStatus)
      socket.off('workflow:state', handleWorkflowState)
    }
  }, [settings?.connection?.port, connectedPort, machineStatus])
  
  // Separate effect to restore connection state when component mounts
  // This handles navigation from Setup page where connection already exists
  useEffect(() => {
    const checkAndRestore = () => {
      // Only run if we're not already connected
      if (isConnected) {
        return
      }
      
      // Try to get machine status from API
      if (settings?.connection?.port) {
        getMachineStatus({ port: settings.connection.port })
          .unwrap()
          .then((response) => {
            if (response.status && response.status.connected) {
              const status = response.status
              
              setIsConnected(true)
              setConnectedPort(status.port)
              setMachineStatus(status.machineStatus)
              setIsHomed(status.isHomed)
              setIsJobRunning(status.isJobRunning)
              setWorkflowState(status.workflowState || null)
              
              // Join port room if socket is connected
              const socket = socketService.getSocket()
              if (socket?.connected) {
                // Request current status via Socket.IO
                socket.emit('machine:status:request', status.port)
                
                // Also join the port room to receive console events
                const connectionOptions = settings.connection ? {
                  controllerType: settings.connection.controllerType || 'Grbl',
                  baudrate: settings.connection.baudRate || 115200,
                  rtscts: settings.connection.rtscts || false,
                } : {
                  controllerType: 'Grbl',
                  baudrate: 115200,
                  rtscts: false,
                }
                
                socket.emit('open', status.port, connectionOptions, (err: Error | null) => {
                  if (err) {
                    console.error('[Monitor] Error joining port room:', err)
                  }
                })
              }
            }
          })
          .catch((err) => {
            console.warn('[Monitor] Failed to get machine status from API:', err)
          })
      }
    }
    
    // Check immediately on mount
    checkAndRestore()
  }, [settings?.connection?.port, isConnected, getMachineStatus])
  
  // Tab state for visualizer/console
  const [tab, setTab] = useState<'visualizer' | 'console'>('visualizer')
  
  // Panel props with real state
  const panelProps: PanelProps = {
    isConnected,
    connectedPort,
    machineStatus,
    onFlashStatus: flashStatus,
    machinePosition,
    workPosition,
    spindleState,
    spindleSpeed,
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      {/* Flash animation styles */}
      <style>{`
        @keyframes flash-bright {
          0% {
            filter: brightness(1);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
          }
          33.3% {
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          38.9% {
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          44.4% {
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          50% {
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          55.6% {
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          61.1% {
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          66.7% {
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          100% {
            filter: brightness(1);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
          }
        }
      `}</style>
      {/* Header - persistent across all screens */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <img src="/fulllogo.png" alt="AxioCNC" className="h-8 w-auto" />
        </div>
        
        {/* Mode tabs */}
        <div className="flex gap-1 ml-6">
          <Button variant="ghost" size="sm" onClick={() => navigate('/')}>Setup</Button>
          <Button variant="default" size="sm">Monitor</Button>
          <Button variant="ghost" size="sm">Stats</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>Settings</Button>
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
            Reset
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
            E-Stop
          </MachineActionButton>
        </div>
      </header>

      {/* Monitor control bar - screen-specific controls */}
      <div className="h-12 border-b border-border bg-muted/30 flex items-center px-4 gap-2">
        <MachineStatusBar
          machineStatus={machineStatus as MachineStatusType}
          isFlashing={isFlashing}
          isConnecting={isConnecting}
          onConnect={handleConnect}
          onHome={handleHome}
          onResume={handleResume}
          onStop={handleStop}
          onUnlock={handleUnlock}
        />
        
        <JobStatusBar
          workflowState={workflowState}
          isJobRunning={isJobRunning}
          onStop={handleStop}
          onPause={handlePause}
          onResume={handleResume}
          disabled={!isConnected || machineStatus === 'alarm'}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex gap-4 p-4 overflow-hidden">
        {/* Main content - full width */}
        <div className="w-full flex flex-col gap-4 overflow-hidden">
          {/* Visualizer/Console/Camera tabs */}
          <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden shadow-sm flex flex-col min-h-0">
            {/* Tab buttons */}
            <div className="flex items-center border-b border-border px-4">
              <button
                onClick={() => setTab('visualizer')}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === 'visualizer' 
                    ? 'border-primary text-foreground' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Maximize2 className="w-4 h-4 inline mr-1.5" />
                3D View
              </button>
              <div className="w-px h-4 bg-border" />
              <button
                onClick={() => setTab('console')}
                className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  tab === 'console' 
                    ? 'border-primary text-foreground' 
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Terminal className="w-4 h-4 inline mr-1.5" />
                Console
              </button>
            </div>
            
            {/* Tab content */}
            <div className="flex-1 flex flex-col min-h-0">
              {tab === 'visualizer' && <VisualizerCameraView machinePosition={machinePosition} />}
              {tab === 'console' && <Console isConnected={isConnected} connectedPort={connectedPort} />}
            </div>
          </div>

          {/* Progress panel */}
          <ProgressPanel panelProps={panelProps} />
        </div>
      </div>
    </div>
  )
}
