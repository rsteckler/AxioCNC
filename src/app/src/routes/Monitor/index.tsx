import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Terminal, Maximize2, Clock, FileText, Gauge, Columns3, PictureInPicture, ArrowLeftRight, RotateCcw, RotateCw, Square, ChevronDown, GripVertical, BarChart3, Wrench, ActivitySquare, ClipboardList } from 'lucide-react'
import Hls from 'hls.js'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { useGetSettingsQuery, useGetCamerasQuery, useGetStreamMetadataQuery, useGetGcodeQuery } from '@/services/api'
// useGetControllersQuery not currently used but may be needed in future
import { socketService } from '@/services/socket'
import { useGcodeCommand } from '@/hooks'
import { MachineActionButton } from '@/components/MachineActionButton'
import { PageStatusBar } from '@/components/PageStatusBar'
import { Console } from '@/components/Console'
import { ActionRequirements } from '@/utils/machineState'
import { VisualizerScene } from '../Setup/components/VisualizerScene'
import type { PanelProps } from '../Setup/types'
import { 
  useMachineState, 
  useJobState, 
  useAppDispatch,
  useIsConnected,
  useConnectedPort,
  useIsJobRunning,
  useWorkflowState,
  useMachinePosition,
  useWorkPosition,
  useSpindleState,
  useSpindleSpeed,
  useCurrentTool,
  usePlannerQueue,
  useRxBufferSize,
  useFeedrate,
} from '@/store/hooks'
import { machineStateSync } from '@/services/machineStateSync'
import { processGCode } from '@/lib/gcodeVisualizer'
import { Vector3 } from 'three'
import { machineToThree, type MachineLimits } from '@/lib/coordinates'
import type { HomingCorner } from '@/lib/machineLimits'
import type { CameraConfig } from '../Settings/sections/CameraSection'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CurrentStatsPanel } from './panels/CurrentStatsPanel'
import { ToolsUsedPanel } from './panels/ToolsUsedPanel'
import { formatTime } from '@/utils/formatTime'

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
  processedLines?: number
}

function VisualizerCameraView({ machinePosition, processedLines }: VisualizerCameraViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('side-by-side')
  const { data: settings } = useGetSettingsQuery()
  const dispatch = useAppDispatch()
  
  // Get shared machine state for positions
  const workPosition = useWorkPosition()
  const connectedPort = useConnectedPort() // Use Redux state instead of settings
  
  // G-code state for visualizer
  const [loadedGcode, setLoadedGcode] = useState<{ name: string; gcode: string } | null>(null)
  const [modelOffset, setModelOffset] = useState<{ x: number; y: number; z: number } | null>(null)
  const placedGcodeRef = useRef<string | null>(null) // Track which G-code we've already auto-placed
  const processedGcodeRef = useRef<string | null>(null) // Track which G-code we've already processed from API
  const loadedFromApiRef = useRef<string | null>(null) // Track which file was loaded from API (not Socket.IO)
  
  // Query currently loaded G-code on mount (to restore when navigating between pages)
  // Use refetchOnMountOrArgChange to ensure fresh data when navigating
  const { data: gcodeData, isLoading: isLoadingGcode } = useGetGcodeQuery(connectedPort || '', {
    skip: !connectedPort,
    refetchOnMountOrArgChange: true, // Always refetch when navigating to this page
  })
  
  // Restore loaded G-code from API on mount
  useEffect(() => {
    console.log('[Monitor] API restoration effect:', { isLoadingGcode, hasGcodeData: !!gcodeData, gcodeDataName: gcodeData?.name })
    
    // Don't do anything while the query is still loading
    if (isLoadingGcode) {
      return
    }

    // Only process if we have gcodeData (query completed)
    // If query was skipped (no connectedPort), don't do anything - preserve existing state
    if (!gcodeData) {
      return
    }

    // Skip if we've already processed this exact file from API
    if (loadedFromApiRef.current === gcodeData.name) {
      console.log('[Monitor] Already processed this file from API, skipping')
      return
    }

    // Check if we have a valid file name and G-code data
    const hasValidFile = gcodeData.name && gcodeData.name.trim() && (gcodeData.data || gcodeData.gcode)
    
    if (hasValidFile) {
      const gcode = gcodeData.data || gcodeData.gcode || ''
      console.log('[Monitor] Restoring G-code from API:', gcodeData.name, 'gcode length:', gcode.length)
      processedGcodeRef.current = gcodeData.name
      loadedFromApiRef.current = gcodeData.name // Mark as loaded from API
      
      setLoadedGcode({ name: gcodeData.name, gcode })
      // Try to restore model offset from localStorage
      const savedOffsetKey = `modelOffset_${gcodeData.name}`
      const savedOffset = localStorage.getItem(savedOffsetKey)
      if (savedOffset) {
        try {
          const offset = JSON.parse(savedOffset)
          if (offset && typeof offset.x === 'number' && typeof offset.y === 'number' && typeof offset.z === 'number') {
            setModelOffset(offset)
            placedGcodeRef.current = gcodeData.name
          }
        } catch {
          // Invalid saved offset, ignore
        }
      } else {
        // No saved offset, reset
        setModelOffset(null)
        placedGcodeRef.current = null
      }
      
      // Note: Job state (name, size, total, etc.) is restored by machineStateSync.restoreGcodeStateFromAPI
      // which is called from restoreStateFromAPI, so we don't need to duplicate it here
    } else if (!gcodeData.name || !gcodeData.name.trim()) {
      // Query completed and API explicitly says no file loaded (name is empty or missing)
      // Only clear if we loaded this file from the API (not from Socket.IO)
      if (loadedGcode && loadedFromApiRef.current === loadedGcode.name) {
        console.log('[Monitor] API says no file, clearing loaded G-code (was loaded from API)')
        processedGcodeRef.current = null
        loadedFromApiRef.current = null
        setLoadedGcode(null)
        setModelOffset(null)
        placedGcodeRef.current = null
      } else if (loadedGcode) {
        console.log('[Monitor] API says no file, but keeping loaded G-code (was loaded from Socket.IO, API may be stale)')
      }
    }
  }, [gcodeData, isLoadingGcode, dispatch, loadedGcode])
  
  // Listen to G-code load/unload events for visualizer
  useEffect(() => {
    // gcode:load emits (name, gcode, context) as separate arguments
    const handleGcodeLoad = (name: string, gcode: string) => {
      console.log('[Monitor VisualizerCameraView] gcode:load event received:', { name, gcodeLength: gcode?.length, hasGcode: !!gcode })
      if (name && gcode) {
        // Only reset if this is a different file than the one we've already placed
        const isNewFile = placedGcodeRef.current !== name
        console.log('[Monitor VisualizerCameraView] Setting loaded G-code:', { name, isNewFile })
        setLoadedGcode({ name, gcode })
        // Update processed ref to match
        processedGcodeRef.current = name
        // Don't mark as loaded from API - this came from Socket.IO
        // This prevents API restoration from clearing it if API returns stale data
        // Reset model offset and placed tracking only if this is a different file
        if (isNewFile) {
          setModelOffset(null)
          placedGcodeRef.current = null
        }
      } else {
        console.warn('[Monitor VisualizerCameraView] gcode:load event missing name or gcode:', { name, hasGcode: !!gcode })
      }
    }

    const handleGcodeUnload = () => {
      // Clear saved offset when unloading
      if (loadedGcode?.name) {
        localStorage.removeItem(`modelOffset_${loadedGcode.name}`)
      }
      setLoadedGcode(null)
      setModelOffset(null)
      placedGcodeRef.current = null
      processedGcodeRef.current = null
      loadedFromApiRef.current = null
    }

    socketService.on('gcode:load', handleGcodeLoad)
    socketService.on('gcode:unload', handleGcodeUnload)

    return () => {
      socketService.off('gcode:load', handleGcodeLoad)
      socketService.off('gcode:unload', handleGcodeUnload)
    }
  }, [])
  
  // Automatically place model at WCS origin when G-code is loaded (same logic as Setup page)
  useEffect(() => {
    if (!loadedGcode?.gcode) {
      placedGcodeRef.current = null
      return
    }

    if (!settings?.machine?.limits) {
      return
    }

    // Only auto-place if we haven't already placed this G-code file
    if (placedGcodeRef.current === loadedGcode.name) {
      return
    }

    const result = processGCode(loadedGcode.gcode)
    
    if (!result?.firstVertex) {
      return
    }

    const limits: MachineLimits = settings.machine.limits
    const homingCorner: HomingCorner = settings.machine.homingCorner ?? 'front-left'
    
    // Calculate work offset: WorkOffset = MPos - WPos
    const workOffset = {
      x: machinePosition.x - workPosition.x,
      y: machinePosition.y - workPosition.y,
      z: machinePosition.z - workPosition.z
    }
    
    // WCS origin (0,0,0) in machine coordinates is the work offset
    // Convert WCS origin to Three.js coordinates
    const wcsOriginThree = machineToThree(workOffset, limits, homingCorner)
    
    // G-code coordinates from gcode-toolpath are in WCS coordinates
    // They are currently being rendered directly as Three.js coordinates (no conversion)
    // So the G-code origin location in Three.js is just the firstVertex value
    const gcodeOriginThree = {
      x: result.firstVertex.x,
      y: result.firstVertex.y,
      z: result.firstVertex.z
    }
    
    // Calculate offset to move G-code origin to WCS origin location
    const offset = new Vector3(
      wcsOriginThree.x - gcodeOriginThree.x,
      wcsOriginThree.y - gcodeOriginThree.y,
      wcsOriginThree.z - gcodeOriginThree.z
    )
    
    const offsetValue = { x: offset.x, y: offset.y, z: offset.z }
    setModelOffset(offsetValue)
    placedGcodeRef.current = loadedGcode.name
    // Save offset to localStorage for persistence across views
    if (loadedGcode.name) {
      localStorage.setItem(`modelOffset_${loadedGcode.name}`, JSON.stringify(offsetValue))
    }
  }, [loadedGcode, settings, machinePosition, workPosition])
  
  const [view] = useState<'top' | 'front' | 'iso' | 'fit'>('iso')
  const [viewKey] = useState(0)

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
              processedLines={processedLines}
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
                    processedLines={processedLines}
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


function ProgressPanel({ 
  panelProps,
  plannerQueueDepth = 0,
  plannerQueueMax = 15,
  maxSpindleSpeed = 3000,
}: { 
  panelProps: PanelProps
  plannerQueueDepth?: number
  plannerQueueMax?: number
  maxSpindleSpeed?: number
}) {
  const {
    machinePosition = { x: 0, y: 0, z: 0 },
    workPosition = { x: 0, y: 0, z: 0 },
    spindleState = 'M5',
    spindleSpeed = 0,
    senderState,
    feedrate = 0,
    rxBufferSize = 0,
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

  // Time data from backend (in milliseconds)
  const elapsedMs = senderState?.elapsedTime ?? 0
  const remainingMs = senderState?.remainingTime ?? 0
  const totalMs = elapsedMs + remainingMs
  
  // File progress data from backend
  const linesSent = senderState?.sent ?? 0
  const linesTotal = senderState?.total ?? 0
  const fileProgressPercent = linesTotal > 0 ? (linesSent / linesTotal) * 100 : 0
  const fileSize = senderState?.size ?? 0
  const fileName = senderState?.name ?? ''
  
  // Feedrate from backend (mm/min)
  const feedRateMax = 3000 // Default max, could be made configurable

  // Format file size helper
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="flex gap-2">
          {/* Left side - Position readouts and Spindle info */}
          <div className="bg-muted/30 rounded-lg border border-border flex flex-col flex-1">
            {/* Machine Status header */}
            <div className="flex items-center gap-2 px-3 py-2 pl-10 border-b border-border bg-muted/30">
              <ActivitySquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium flex-1">Machine Status</span>
            </div>
            <div className="p-4 flex flex-col gap-4">
            {/* Position readouts and Spindle info - side by side */}
            <div className="flex gap-4">
              {/* Position readouts */}
              <div className="flex-1 space-y-2">
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

              {/* Vertical separator */}
              <div className="w-px bg-border" />

              {/* Spindle info */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                  {isOn ? (
                    direction === 'CW' ? (
                      <RotateCw className={`w-3.5 h-3.5 text-green-500 ${isOn ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }} />
                    ) : (
                      <RotateCcw className={`w-3.5 h-3.5 text-green-500 ${isOn ? 'animate-spin' : ''}`} style={{ animationDuration: '2s' }} />
                    )
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground" />
                  )}
                  <span>Spindle</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Direction:</span>
                    <span className={`font-medium ${isOn ? 'text-green-500' : 'text-muted-foreground'}`}>
                      {isOn ? direction : 'Off'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Speed:</span>
                      <span className={`font-mono font-medium ${isOn ? 'text-primary' : 'text-muted-foreground'}`}>
                        {spindleSpeed.toLocaleString()} RPM
                      </span>
                    </div>
                    <Progress 
                      value={maxSpindleSpeed > 0 ? Math.min(100, (spindleSpeed / maxSpindleSpeed) * 100) : 0} 
                      className={`h-2 ${isOn ? '' : 'opacity-50'}`}
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground text-[10px]">0</span>
                      <span className="text-muted-foreground text-[10px]">max {maxSpindleSpeed.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
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
                  <span className="font-mono font-medium">{feedrate.toLocaleString()} mm/min</span>
                  <span className="text-muted-foreground">max {feedRateMax.toLocaleString()}</span>
                </div>
                <Progress 
                  value={feedRateMax > 0 ? Math.min(100, (feedrate / feedRateMax) * 100) : 0} 
                  className="h-1.5"
                />
              </div>
            </div>
            </div>
          </div>

          {/* Center - Work progress */}
          <div className="flex-1 bg-muted/30 rounded-lg border border-border flex flex-col">
            {/* Job Status header */}
            <div className="flex items-center gap-2 px-3 py-2 pl-10 border-b border-border bg-muted/30">
              <ClipboardList className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium flex-1">Job Status</span>
            </div>
            <div className="p-4 flex flex-col gap-4">
            {/* Job filename */}
            {fileName && (
              <div className="text-sm font-medium text-foreground truncate" title={fileName}>
                {fileName}
              </div>
            )}
            {/* Time and File progress - side by side */}
            <div className="space-y-1.5">
              {/* Headers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Time</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="w-3.5 h-3.5" />
                  <span>File Progress</span>
                </div>
              </div>
              
              {/* Content rows - aligned */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Elapsed</span>
                    <span className="font-mono font-medium">
                      {elapsedMs > 0 ? formatTime(elapsedMs) : '--:--'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Remaining</span>
                    {remainingMs > 0 ? (
                      <span className="font-mono font-medium text-orange-500">
                        {formatTime(remainingMs)}
                      </span>
                    ) : (
                      <span className="font-mono font-medium text-muted-foreground">--:--</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Total</span>
                    <span className="font-mono font-medium">{totalMs > 0 ? formatTime(totalMs) : '--:--'}</span>
                  </div>
                  <Progress 
                    value={totalMs > 0 ? Math.min(100, (elapsedMs / totalMs) * 100) : 0} 
                    className="h-1.5" 
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Lines</span>
                    <span className="font-medium">{linesSent.toLocaleString()} / {linesTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium">{formatBytes(fileSize)}</span>
                  </div>
                  <Progress value={fileProgressPercent} className="h-1.5" />
                </div>
              </div>
            </div>

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
                {/* RX Buffer */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">RX Buffer</span>
                  <span className="font-medium">{rxBufferSize}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
  )
}

// ============================================================================
// PANEL CONFIGURATION
// ============================================================================

// Panel configuration with metadata
const panelConfig: Record<string, { 
  title: string
  icon: React.ElementType
  component: React.FC<PanelProps>
}> = {
  currentStats: { title: 'Current Stats', icon: BarChart3, component: CurrentStatsPanel },
  toolsUsed: { title: 'Tools Used', icon: Wrench, component: ToolsUsedPanel },
}

// Sortable Panel Component
function SortablePanel({ 
  id, 
  isCollapsed, 
  onToggle,
  panelProps,
}: { 
  id: string
  isCollapsed: boolean
  onToggle: () => void
  panelProps: PanelProps
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const config = panelConfig[id]
  if (!config) return null
  const PanelContent = config.component
  const Icon = config.icon

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {isDragging && (
        <div className="absolute inset-0 rounded-lg border-2 border-dashed border-primary bg-primary/10" />
      )}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="flex items-center border-b border-border bg-muted/30">
          <div 
            {...attributes}
            {...listeners}
            className="p-2 cursor-grab hover:bg-muted/50 transition-colors touch-none"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          <div 
            className="flex-1 flex items-center gap-2 pr-3 py-2 cursor-pointer" 
            onClick={onToggle}
          >
            <Icon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium flex-1">{config.title}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          </div>
        </div>
        {!isCollapsed && (
          <PanelContent {...panelProps} />
        )}
      </div>
    </div>
  )
}

// Drag overlay panel (shown while dragging)
function DragOverlayPanel({ id, isCollapsed, panelProps }: { id: string; isCollapsed: boolean; panelProps: PanelProps }) {
  const config = panelConfig[id]
  if (!config) return null
  const Icon = config.icon
  const PanelContent = config.component

  return (
    <div className="bg-card rounded-lg border-2 border-primary overflow-hidden shadow-2xl scale-[0.96]">
      <div className="flex items-center border-b border-border bg-muted/30">
        <div className="p-2 cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 flex items-center gap-2 pr-3 py-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{config.title}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
        </div>
      </div>
      {!isCollapsed && <PanelContent {...panelProps} />}
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
  
  // Get shared machine and job state from Redux
  const machineState = useMachineState()
  const jobState = useJobState()
  
  // Extract values from Redux state using selectors
  const isConnected = useIsConnected()
  const connectedPort = useConnectedPort()
  const machineStatus = machineState.machineStatus
  const isJobRunning = useIsJobRunning()
  const workflowState = useWorkflowState()
  const machinePosition = useMachinePosition()
  const workPosition = useWorkPosition()
  const spindleState = useSpindleState()
  const spindleSpeed = useSpindleSpeed()
  const maxSpindleSpeed = machineState.maxSpindleSpeed
  const currentTool = useCurrentTool()
  const plannerQueue = usePlannerQueue()
  const plannerQueueDepth = plannerQueue.depth
  const plannerQueueMax = plannerQueue.max
  const rxBufferSize = useRxBufferSize()
  const feedrate = useFeedrate()
  
  // Job state (sender state) - jobState is used via other extracted values
  
  // Debug log to verify job state
  React.useEffect(() => {
    console.log('[Monitor] jobState changed:', jobState)
    console.log('[Monitor] senderState values:', {
      name: jobState.name,
      size: jobState.size,
      total: jobState.total,
      sent: jobState.sent,
      received: jobState.received,
      elapsedTime: jobState.elapsedTime,
      remainingTime: jobState.remainingTime,
    })
  }, [jobState])
  
  // Panel order - load from localStorage or use default
  const [panelOrder, setPanelOrder] = useState<string[]>(() => {
    const stored = localStorage.getItem('axiocnc-monitor-panel-order')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        const validPanels = ['currentStats', 'toolsUsed']
        if (Array.isArray(parsed) && parsed.every(id => validPanels.includes(id))) {
          return parsed
        }
      } catch {
        // Invalid JSON, use default
      }
    }
    return ['currentStats', 'toolsUsed']
  })
  
  // Track which panels are collapsed
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>(() => {
    const stored = localStorage.getItem('axiocnc-monitor-panel-collapsed')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed
        }
      } catch {
        // Invalid JSON, use default
      }
    }
    return {}
  })
  
  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  // Handle drag start
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])
  
  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    
    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        const newOrder = arrayMove(items, oldIndex, newIndex)
        // Save to localStorage
        localStorage.setItem('axiocnc-monitor-panel-order', JSON.stringify(newOrder))
        return newOrder
      })
    }
    
    setActiveId(null)
  }, [])
  
  // Toggle panel collapse
  const togglePanel = useCallback((id: string) => {
    setCollapsedPanels((prev) => {
      const newState = { ...prev, [id]: !prev[id] }
      // Save to localStorage
      localStorage.setItem('axiocnc-monitor-panel-collapsed', JSON.stringify(newState))
      return newState
    })
  }, [])
  
  const { sendCommand } = useGcodeCommand(connectedPort)
  
  // Flash status when action attempted while disconnected
  const flashStatus = useCallback(() => {
    // Note: Flash status is handled by Redux, but we can trigger it here if needed
    // For now, we'll keep this as a no-op since flashing is managed by components
  }, [])
  
  // Handle Pause button
  const handlePause = useCallback(() => {
    if (!isConnected || !connectedPort) {
      flashStatus()
      return
    }
    sendCommand('gcode:pause')
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  // Handle Start button
  const handleStart = useCallback(() => {
    if (!isConnected || !connectedPort) {
      flashStatus()
      return
    }
    sendCommand('gcode:start')
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
    sendCommand('gcode:stop', { force: true })
  }, [isConnected, connectedPort, flashStatus, sendCommand])
  
  
  // Handle Reset button
  const handleReset = useCallback(() => {
    if (!connectedPort) return
    sendCommand('reset')
    // State updates are handled by machineStateSync
  }, [connectedPort, sendCommand])
  
  // Handle E-Stop button
  const handleEStop = useCallback(() => {
    if (!connectedPort) return
    sendCommand('gcode:stop', { force: true })
    sendCommand('reset')
    // State updates are handled by machineStateSync
  }, [connectedPort, sendCommand])
  
  // Restore state from API on mount (only when needed - not on every navigation)
  // Only restore if:
  // 1. Redux doesn't have valid connection state (page refresh), OR
  // 2. The connected port doesn't match the settings port (port changed)
  // If Redux already has valid connection state, trust it (it persists across navigation)
  useEffect(() => {
    if (!settings?.connection?.port) {
      return
    }

    const needsRestore = 
      !isConnected || // Redux doesn't have connection state (page refresh)
      connectedPort !== settings.connection.port // Port changed

    if (needsRestore) {
      machineStateSync.restoreStateFromAPI(settings.connection.port)
    }
  }, [settings?.connection?.port, isConnected, connectedPort])
  
  // Tab state for visualizer/console
  const [tab, setTab] = useState<'visualizer' | 'console'>('visualizer')
  
  // Panel props with real state from Redux
  const panelProps: PanelProps = {
    isConnected,
    connectedPort,
    machineStatus,
    onFlashStatus: flashStatus,
    machinePosition,
    workPosition,
    spindleState,
    spindleSpeed,
    senderState: jobState, // Use jobState from Redux
    currentTool,
    feedrate,
    rxBufferSize,
  }
  
  // Progress panel props with additional planner queue data
  // progressPanelProps prepared for future use
  // const progressPanelProps = {
  //   ...panelProps,
  //   plannerQueueDepth,
  //   plannerQueueMax,
  // }

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
      <PageStatusBar
        workflowState={workflowState}
        isJobRunning={isJobRunning}
        onStart={handleStart}
        onStop={handleStop}
        onPause={handlePause}
        onResume={handleResume}
        disabled={!isConnected || machineStatus === 'alarm'}
      />

      {/* Main content area */}
      <div className="flex-1 flex gap-2 p-2 min-h-0 overflow-hidden">
        {/* Left column - panels (33%) */}
        <OverlayScrollbarsComponent 
          className="w-1/3"
          options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={panelOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {panelOrder.map((panelId) => (
                  <SortablePanel
                    key={panelId}
                    id={panelId}
                    isCollapsed={collapsedPanels[panelId] ?? false}
                    onToggle={() => togglePanel(panelId)}
                    panelProps={panelProps}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <DragOverlayPanel 
                  id={activeId} 
                  isCollapsed={collapsedPanels[activeId] ?? false}
                  panelProps={panelProps}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </OverlayScrollbarsComponent>
        
        {/* Right column - existing content (66%) */}
        <div className="w-2/3 flex flex-col gap-2 min-h-0">
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
              {tab === 'visualizer' && <VisualizerCameraView machinePosition={machinePosition} processedLines={jobState?.received} />}
              {tab === 'console' && <Console isConnected={isConnected} connectedPort={connectedPort} />}
            </div>
          </div>

          {/* Progress panel */}
          <ProgressPanel 
            panelProps={panelProps} 
            plannerQueueDepth={plannerQueueDepth}
            plannerQueueMax={plannerQueueMax}
            maxSpindleSpeed={maxSpindleSpeed}
          />
        </div>
      </div>
    </div>
  )
}
