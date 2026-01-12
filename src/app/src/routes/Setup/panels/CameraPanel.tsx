import React, { useMemo } from 'react'
import { useGetSettingsQuery } from '@/services/api'
import type { PanelProps } from '../types'
import type { CameraConfig } from '../../Settings/sections/CameraSection'

// Map 0.0.0.0 to current hostname (like legacy app)
const mapMetaAddressToHostname = (url: string): string => {
  const hostname = window.location.hostname
  return String(url).trim().replace(/((?:https?:)?\/\/)?(0\.0\.0\.0)/i, (match, p1) => {
    return [p1 || 'http://', hostname].join('')
  })
}

export function CameraPanel({ 
  isConnected, 
  connectedPort, 
  machineStatus, 
  onFlashStatus 
}: PanelProps) {
  const { data: settings, isLoading } = useGetSettingsQuery()
  
  const cameraConfig: CameraConfig | undefined = settings?.camera
  const isIPCamera = cameraConfig?.enabled && cameraConfig?.mediaSource === 'ip-camera' && cameraConfig?.ipCameraUrl
  
  // Map URL if needed
  const cameraUrl = useMemo(() => {
    if (!isIPCamera || !cameraConfig?.ipCameraUrl) return null
    return mapMetaAddressToHostname(cameraConfig.ipCameraUrl)
  }, [isIPCamera, cameraConfig?.ipCameraUrl])
  
  // Determine if it's a video stream (MP4)
  const isVideoStream = useMemo(() => {
    return cameraUrl?.endsWith('.mp4') || false
  }, [cameraUrl])
  
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
  
  if (isLoading) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          Loading camera settings...
        </div>
      </div>
    )
  }
  
  if (!cameraConfig?.enabled) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          Camera is disabled. Enable it in Settings.
        </div>
      </div>
    )
  }
  
  if (!isIPCamera) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          Webcam support coming soon. Configure an IP camera in Settings.
        </div>
      </div>
    )
  }
  
  if (!cameraUrl) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          No IP camera URL configured. Set it in Settings.
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-3 space-y-2">
      <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
        {isVideoStream ? (
          <video
            src={cameraUrl}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-contain"
            style={{ transform: transformStyle }}
          />
        ) : (
          <img
            src={cameraUrl}
            alt="IP Camera Feed"
            className="w-full h-full object-contain"
            style={{ transform: transformStyle }}
          />
        )}
        
        {/* Crosshair overlay */}
        {cameraConfig.crosshair && (
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
