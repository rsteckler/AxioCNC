import React from 'react'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FlipHorizontal, FlipVertical, Eye, EyeOff } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type MediaSourceType = 'ip-camera'

export interface CameraConfig {
  enabled: boolean
  mediaSource: MediaSourceType
  ipCameraUrl: string
  // Authentication (optional)
  username?: string
  password?: string
  // Display options
  flipHorizontal: boolean
  flipVertical: boolean
  rotation: 0 | 90 | 180 | 270
  crosshair: boolean
  crosshairColor: string
}

interface CameraSectionProps {
  config: CameraConfig
  onConfigChange: (config: Partial<CameraConfig>) => void
}

export function CameraSection({
  config,
  onConfigChange,
}: CameraSectionProps) {
  const [showPassword, setShowPassword] = React.useState(false)

  return (
    <SettingsSection
      id="camera"
      title="Camera"
      description="Configure IP camera for monitoring your CNC machine"
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
          {/* IP Camera Configuration */}
          <div className="space-y-3">
            <SettingsField
              label="Camera URL"
              description="RTSP or HTTP(S) URL for your IP camera"
            >
              <Input
                value={config.ipCameraUrl}
                onChange={(e) => onConfigChange({ ipCameraUrl: e.target.value })}
                placeholder="rtsp://192.168.1.100:554/stream or http://192.168.1.100:8080/?action=stream"
                className="font-mono text-sm"
              />
            </SettingsField>
            
            <SettingsField
              label="Authentication (Optional)"
              description="Username and password if your camera requires authentication"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="camera-username" className="text-xs text-muted-foreground">
                    Username
                  </Label>
                  <Input
                    id="camera-username"
                    type="text"
                    value={config.username || ''}
                    onChange={(e) => onConfigChange({ username: e.target.value || undefined })}
                    placeholder="admin"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="camera-password" className="text-xs text-muted-foreground">
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="camera-password"
                      type={showPassword ? 'text' : 'password'}
                      value={config.password || ''}
                      onChange={(e) => onConfigChange({ password: e.target.value || undefined })}
                      placeholder="••••••••"
                      className="font-mono text-sm pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </SettingsField>
            
            <div className="text-xs text-muted-foreground">
              Supported formats:{' '}
              <Badge variant="secondary" className="text-xs mx-0.5">RTSP</Badge>
              <Badge variant="secondary" className="text-xs mx-0.5">Motion JPEG (MJPEG)</Badge>
              <Badge variant="secondary" className="text-xs mx-0.5">HLS</Badge>
            </div>
          </div>

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

