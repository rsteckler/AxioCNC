import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Maximize2, Terminal, Target, Move, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { socketService } from '@/services/socket'
import { useGetSettingsQuery, useGetCamerasQuery, useGetStreamMetadataQuery } from '@/services/api'
import type { ZeroingMethod } from '../../../../shared/schemas/settings'
import { VisualizerScene } from '../components/VisualizerScene'
import { Console } from '@/components/Console'
import { ZeroingWizardTab } from './ZeroingWizardTab'
import { processGCode } from '@/lib/gcodeVisualizer'
import { Vector3 } from 'three'
import { machineToThree, workToThree, type MachineLimits } from '@/lib/coordinates'
import type { HomingCorner } from '@/lib/machineLimits'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { CameraConfig } from '../../Settings/sections/CameraSection'
import Hls from 'hls.js'

// Camera Tab Component
function CameraTab() {
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
    <div className="flex-1 relative bg-black">
      {streamMetadata.type === 'hls' ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
          style={{ transform: transformStyle }}
        />
      ) : (
        <img
          src={streamMetadata.src}
          alt={`${enabledCamera.name} Feed`}
          className="w-full h-full object-contain"
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

interface VisualizerPanelProps {
  isConnected: boolean
  connectedPort: string | null
  wizardMethod?: ZeroingMethod | null
  onWizardClose?: () => void
  machinePosition?: { x: number; y: number; z: number }
  workPosition?: { x: number; y: number; z: number }
  probeContact?: boolean
  lastAlarmMessageRef?: React.MutableRefObject<string | null>
  currentWCS?: string
}

export function VisualizerPanel({ 
  isConnected, 
  connectedPort,
  wizardMethod,
  onWizardClose,
  machinePosition = { x: 0, y: 0, z: 0 },
  workPosition = { x: 0, y: 0, z: 0 },
  probeContact = false,
  lastAlarmMessageRef,
  currentWCS = 'G54'
}: VisualizerPanelProps) {
  // Get settings for connection options (needed for joining port room)
  const { data: settings } = useGetSettingsQuery()
  
  const [tab, setTab] = useState<'3d' | 'console' | 'camera' | 'wizard'>('3d')
  const [view, setView] = useState<'top' | 'front' | 'iso' | 'fit' | undefined>('iso')
  const [viewKey, setViewKey] = useState(0)
  
  // Switch to wizard tab when wizard method is set
  useEffect(() => {
    if (wizardMethod) {
      setTab('wizard')
    }
  }, [wizardMethod])
  // G-code state for visualizer
  const [loadedGcode, setLoadedGcode] = useState<{ name: string; gcode: string } | null>(null)
  const [modelOffset, setModelOffset] = useState<{ x: number; y: number; z: number } | null>(null)
  const placedGcodeRef = useRef<string | null>(null) // Track which G-code we've already auto-placed
  
  // Listen to G-code load/unload events for visualizer
  useEffect(() => {
    // gcode:load emits (name, gcode, context) as separate arguments
    const handleGcodeLoad = (name: string, gcode: string) => {
      if (name && gcode) {
        // Only reset if this is a different file than the one we've already placed
        const isNewFile = placedGcodeRef.current !== name
        setLoadedGcode({ name, gcode })
        // Reset model offset and placed tracking only if this is a different file
        if (isNewFile) {
          setModelOffset(null)
          placedGcodeRef.current = null
        }
      }
    }

    const handleGcodeUnload = () => {
      setLoadedGcode(null)
      setModelOffset(null)
      placedGcodeRef.current = null
    }

    socketService.on('gcode:load', handleGcodeLoad)
    socketService.on('gcode:unload', handleGcodeUnload)

    return () => {
      socketService.off('gcode:load', handleGcodeLoad)
      socketService.off('gcode:unload', handleGcodeUnload)
    }
  }, [])

  // Automatically place model at WCS origin when G-code is loaded
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
    
    setModelOffset({ x: offset.x, y: offset.y, z: offset.z })
    placedGcodeRef.current = loadedGcode.name
  }, [loadedGcode, settings, machinePosition, workPosition])

  // Handle "Place Model" button - place toolpath origin at WCS origin (0,0,0)
  const handlePlaceModel = useCallback(() => {
    if (!loadedGcode?.gcode) {
      return
    }

    if (!settings?.machine?.limits) {
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
    
    setModelOffset({ x: offset.x, y: offset.y, z: offset.z })
  }, [loadedGcode, machinePosition, workPosition, settings])
  

  return (
    <div className="h-full flex flex-col">
      {/* Tab header */}
      <div className="flex items-center border-b border-border bg-muted/30 px-2">
        <button
          onClick={() => setTab('3d')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === '3d' 
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
        <div className="w-px h-4 bg-border" />
        <button
          onClick={() => setTab('camera')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'camera' 
              ? 'border-primary text-foreground' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Camera className="w-4 h-4 inline mr-1.5" />
          Camera
        </button>
        {wizardMethod && (
          <>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => setTab('wizard')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'wizard' 
                  ? 'border-primary text-foreground' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="w-4 h-4 inline mr-1.5" />
              {wizardMethod.name}
            </button>
          </>
        )}
      </div>
      
      {tab === 'wizard' && wizardMethod ? (
        <ZeroingWizardTab
          method={wizardMethod}
          onClose={onWizardClose || (() => {})}
          isConnected={isConnected}
          connectedPort={connectedPort}
          machinePosition={machinePosition}
          workPosition={workPosition}
          probeContact={probeContact}
          currentWCS={currentWCS}
        />
      ) : tab === 'camera' ? (
        <CameraTab />
      ) : tab === '3d' ? (
        <div className="flex-1 relative">
          <VisualizerScene 
            gcode={loadedGcode?.gcode} 
            limits={settings?.machine?.limits}
            view={view}
            viewKey={viewKey}
            machinePosition={machinePosition}
            modelOffset={modelOffset ? new Vector3(modelOffset.x, modelOffset.y, modelOffset.z) : undefined}
          />
          
          {/* View controls overlay */}
          <div className="absolute bottom-3 left-3 flex gap-1">
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => { setView('top'); setViewKey(k => k + 1) }}>Top</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => { setView('front'); setViewKey(k => k + 1) }}>Front</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => { setView('iso'); setViewKey(k => k + 1) }}>Iso</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={() => { setView('fit'); setViewKey(k => k + 1) }}>Fit</Button>
          </div>
          
          {/* Place Model button */}
          {loadedGcode && (
            <div className="absolute bottom-3 right-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="secondary" 
                      size="sm" 
                      className="h-7 text-xs" 
                      onClick={handlePlaceModel}
                    >
                      <Move className="w-3 h-3 mr-1" />
                      Place Model
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Place the loaded model at the current workspace zero position</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      ) : (
        <Console 
          isConnected={isConnected} 
          connectedPort={connectedPort}
          lastAlarmMessageRef={lastAlarmMessageRef}
        />
      )}
    </div>
  )
}
