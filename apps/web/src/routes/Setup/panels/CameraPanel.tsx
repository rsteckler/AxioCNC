import React, { useMemo, useEffect, useRef } from 'react'
import { useGetCamerasQuery, useGetStreamMetadataQuery, useGetSettingsQuery } from '@/services/api'
import type { PanelProps } from '../types'
import type { CameraConfig } from '../../Settings/sections/CameraSection'
import Hls from 'hls.js'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function CameraPanel(_props: PanelProps) {
  const { data: camerasData, isLoading: isLoadingCameras } = useGetCamerasQuery(undefined, {
    // Refetch every 5 seconds to catch new cameras
    pollingInterval: 5000,
  })
  const { data: settings } = useGetSettingsQuery()
  
  // Get first enabled camera
  const enabledCamera = useMemo(() => {
    if (!camerasData?.records) {
      return null
    }
    return camerasData.records.find(c => c.enabled) || null
  }, [camerasData])
  
  // Get stream metadata for the enabled camera
  const { data: streamMetadata, isLoading: isLoadingStream, error: streamError } = useGetStreamMetadataQuery(
    enabledCamera?.id || '',
    { 
      skip: !enabledCamera?.id,
      // Retry on failure
      retry: 2,
    }
  )
  
  // Log errors for debugging
  React.useEffect(() => {
    if (streamError) {
      console.error('[CameraPanel] Stream metadata error:', streamError)
    }
  }, [streamError])
  
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
        // Use hls.js for non-Safari browsers
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
        // Native HLS support (Safari)
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
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading cameras...
        </div>
      </div>
    )
  }
  
  if (!enabledCamera) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          No enabled camera found. Configure a camera in Settings.
        </div>
      </div>
    )
  }
  
  if (isLoadingStream) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading stream...
        </div>
      </div>
    )
  }
  
  if (!streamMetadata) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          Stream not available. Check camera configuration.
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-3 space-y-2">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
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
    </div>
  )
}
