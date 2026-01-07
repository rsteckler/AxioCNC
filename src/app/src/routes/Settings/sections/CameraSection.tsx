import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Camera, Webcam, Globe, RotateCw, FlipHorizontal, FlipVertical } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type MediaSourceType = 'webcam' | 'ip-camera'

export interface CameraConfig {
  enabled: boolean
  mediaSource: MediaSourceType
  autoDetect: boolean
  selectedDeviceId: string | null
  ipCameraUrl: string
  // Display options
  flipHorizontal: boolean
  flipVertical: boolean
  rotation: 0 | 90 | 180 | 270
  crosshair: boolean
  crosshairColor: string
}

interface DetectedCamera {
  deviceId: string
  label: string
}

interface CameraSectionProps {
  config: CameraConfig
  detectedCameras: DetectedCamera[]
  onConfigChange: (config: Partial<CameraConfig>) => void
  onRefreshCameras: () => void
}

export function CameraSection({
  config,
  detectedCameras,
  onConfigChange,
  onRefreshCameras,
}: CameraSectionProps) {
  return (
    <SettingsSection
      id="camera"
      title="Camera"
      description="Configure webcam or IP camera for monitoring your CNC machine"
    >
      {/* Enable Camera */}
      <SettingsField
        label="Enable Camera Feed"
        description="Show a live camera feed in the workspace"
        horizontal
      >
        <Switch
          checked={config.enabled}
          onCheckedChange={(enabled) => onConfigChange({ enabled })}
        />
      </SettingsField>

      {config.enabled && (
        <>
          {/* Media Source Selection */}
          <SettingsField
            label="Media Source"
            description="Choose between a local webcam or network IP camera"
          >
            <RadioGroup
              value={config.mediaSource}
              onValueChange={(value) => onConfigChange({ mediaSource: value as MediaSourceType })}
              className="space-y-3"
            >
              {/* Webcam Option */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="webcam" id="webcam" className="mt-1" />
                <div className="flex-1 space-y-3">
                  <Label htmlFor="webcam" className="flex items-center gap-2 cursor-pointer">
                    <Webcam className="w-4 h-4" />
                    Use a built-in camera or connected webcam
                  </Label>
                  
                  {config.mediaSource === 'webcam' && (
                    <div className="pl-0 space-y-3">
                      <div className="flex items-center gap-3">
                        <Switch
                          id="auto-detect"
                          checked={config.autoDetect}
                          onCheckedChange={(autoDetect) => onConfigChange({ autoDetect })}
                        />
                        <Label htmlFor="auto-detect" className="text-sm">
                          Automatic detection
                        </Label>
                      </div>

                      {!config.autoDetect && (
                        <div className="flex gap-2">
                          <Select
                            value={config.selectedDeviceId || 'none'}
                            onValueChange={(value) => onConfigChange({ 
                              selectedDeviceId: value === 'none' ? null : value 
                            })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select camera..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">
                                {detectedCameras.length === 0 ? 'No cameras detected' : 'None selected'}
                              </SelectItem>
                              {detectedCameras.map((camera) => (
                                <SelectItem key={camera.deviceId} value={camera.deviceId}>
                                  <div className="flex items-center gap-2">
                                    <Camera className="w-4 h-4" />
                                    {camera.label || `Camera ${camera.deviceId.slice(0, 8)}...`}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <button
                            onClick={onRefreshCameras}
                            className="p-2 rounded-md border hover:bg-accent"
                          >
                            <RotateCw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* IP Camera Option */}
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="ip-camera" id="ip-camera" className="mt-1" />
                <div className="flex-1 space-y-3">
                  <Label htmlFor="ip-camera" className="flex items-center gap-2 cursor-pointer">
                    <Globe className="w-4 h-4" />
                    Connect to an IP camera
                  </Label>
                  
                  {config.mediaSource === 'ip-camera' && (
                    <div className="space-y-2">
                      <Input
                        value={config.ipCameraUrl}
                        onChange={(e) => onConfigChange({ ipCameraUrl: e.target.value })}
                        placeholder="http://192.168.1.100:8080/?action=stream"
                        className="font-mono text-sm"
                      />
                      <div className="text-xs text-muted-foreground">
                        The URL should point to a stream in one of the following formats:{' '}
                        <Badge variant="secondary" className="text-xs mx-0.5">Motion JPEG</Badge>
                        <Badge variant="secondary" className="text-xs mx-0.5">RTSP</Badge>
                        <Badge variant="secondary" className="text-xs mx-0.5">H264 (MP4)</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </RadioGroup>
          </SettingsField>

          {/* Display Options */}
          <div className="space-y-4 pt-4">
            <h4 className="font-medium text-sm">Display Options</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Flip & Rotation */}
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="flip-h"
                      checked={config.flipHorizontal}
                      onCheckedChange={(flipHorizontal) => onConfigChange({ flipHorizontal })}
                    />
                    <Label htmlFor="flip-h" className="text-sm flex items-center gap-1.5">
                      <FlipHorizontal className="w-4 h-4" />
                      Flip Horizontal
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="flip-v"
                      checked={config.flipVertical}
                      onCheckedChange={(flipVertical) => onConfigChange({ flipVertical })}
                    />
                    <Label htmlFor="flip-v" className="text-sm flex items-center gap-1.5">
                      <FlipVertical className="w-4 h-4" />
                      Flip Vertical
                    </Label>
                  </div>
                </div>

                <SettingsField
                  label="Rotation"
                  description="Rotate the camera feed"
                >
                  <Select
                    value={String(config.rotation)}
                    onValueChange={(value) => onConfigChange({ rotation: Number(value) as 0 | 90 | 180 | 270 })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0°</SelectItem>
                      <SelectItem value="90">90°</SelectItem>
                      <SelectItem value="180">180°</SelectItem>
                      <SelectItem value="270">270°</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsField>
              </div>

              {/* Crosshair */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="crosshair"
                    checked={config.crosshair}
                    onCheckedChange={(crosshair) => onConfigChange({ crosshair })}
                  />
                  <Label htmlFor="crosshair" className="text-sm">
                    Show crosshair overlay
                  </Label>
                </div>

                {config.crosshair && (
                  <SettingsField
                    label="Crosshair Color"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={config.crosshairColor}
                        onChange={(e) => onConfigChange({ crosshairColor: e.target.value })}
                        className="w-10 h-10 rounded border cursor-pointer"
                      />
                      <Input
                        value={config.crosshairColor}
                        onChange={(e) => onConfigChange({ crosshairColor: e.target.value })}
                        placeholder="#ff0000"
                        className="w-28 font-mono text-sm"
                      />
                    </div>
                  </SettingsField>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </SettingsSection>
  )
}

