import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Gamepad2, CheckCircle2, XCircle, Settings, Lock, Unlock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useGetSettingsQuery, useSetSettingsMutation } from '@/services/api'
import { useNavigate } from 'react-router-dom'
import { JoystickTestDialog } from '@/routes/Settings/sections/JoystickTestDialog'
import type { PanelProps } from '../types'
import type { JoystickConfig } from '@/routes/Settings/sections/JoystickSection'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function JoystickPanel(_props: PanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: settings } = useGetSettingsQuery()
  const [setSettings] = useSetSettingsMutation()
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [isGamepadConnected, setIsGamepadConnected] = useState(false)

  const joystickConfig: JoystickConfig | null = settings?.joystick ?? null

  // Check if selected gamepad is currently connected
  const checkGamepadConnection = useCallback(() => {
    if (!joystickConfig?.selectedGamepad) {
      setIsGamepadConnected(false)
      return
    }

    if (joystickConfig.connectionLocation === 'client') {
      // Check browser Gamepad API
      const gamepads = navigator.getGamepads?.() || []
      const isConnected = Array.from(gamepads).some(
        gp => gp && gp.id === joystickConfig.selectedGamepad
      )
      setIsGamepadConnected(isConnected)
    } else {
      // For server-side, we can't directly check connection status from here
      // Assume connected if gamepad is selected (server handles connection)
      setIsGamepadConnected(true)
    }
  }, [joystickConfig])

  // Check connection status periodically
  useEffect(() => {
    checkGamepadConnection()
    
    if (joystickConfig?.connectionLocation === 'client' && joystickConfig?.selectedGamepad) {
      // For client-side, check more frequently (gamepads can connect/disconnect)
      const interval = setInterval(checkGamepadConnection, 1000)
      return () => clearInterval(interval)
    }
  }, [checkGamepadConnection, joystickConfig?.connectionLocation, joystickConfig?.selectedGamepad])

  if (!joystickConfig || !joystickConfig.enabled) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <Gamepad2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">{t('Joystick is disabled')}</p>
        <p className="text-xs mt-1">{t('Enable joystick in Settings to use this panel')}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => navigate('/settings?section=joystick')}
        >
          <Settings className="w-4 h-4 mr-2" />
          {t('Open Settings')}
        </Button>
      </div>
    )
  }

  const gamepadName = joystickConfig.selectedGamepad
    ? joystickConfig.selectedGamepad.split('(')[0].trim() || t('Gamepad')
    : t('No gamepad selected')

  return (
    <div className="p-4 space-y-4">
      {/* Connection Status */}
      <div className="space-y-2">
        <div className="text-sm">
          <span className="text-muted-foreground">{t('Status:')} </span>
          <div className="inline-flex items-center gap-2">
            {isGamepadConnected ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400">{t('Connected')}</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400">{t('Disconnected')}</span>
              </>
            )}
          </div>
        </div>
        
        <div className="text-sm">
          <span className="text-muted-foreground">{t('Selected:')} </span>
          <span className="font-medium">{gamepadName}</span>
        </div>

        <div className="text-xs text-muted-foreground">
          <span>Connection: </span>
          <Badge variant="secondary" className="text-xs">
            {joystickConfig.connectionLocation === 'client' ? 'Browser' : 'Server'}
          </Badge>
        </div>
      </div>


      {/* Info Message */}
      {joystickConfig.connectionLocation === 'client' && !isGamepadConnected && (
        <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <p className="text-xs text-blue-900 dark:text-blue-100">
            {t('Press a button on your gamepad while this webpage is focused to connect.')}
          </p>
        </div>
      )}

      {/* Lock Toggle */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
        <div className="flex items-center gap-2">
          {joystickConfig.locked ? (
            <Lock className="w-4 h-4 text-orange-500" />
          ) : (
            <Unlock className="w-4 h-4 text-green-500" />
          )}
          <Label htmlFor="joystick-lock" className="text-sm font-medium cursor-pointer">
            {t('Lock Joystick')}
          </Label>
        </div>
        <Switch
          id="joystick-lock"
          checked={joystickConfig.locked}
          onCheckedChange={async (checked) => {
            // Prevent unlocking if joystick is not connected
            if (!checked && !isGamepadConnected) {
              return
            }
            try {
              await setSettings({
                joystick: {
                  ...joystickConfig,
                  locked: checked,
                },
              }).unwrap()
            } catch (error) {
              console.error('Failed to toggle joystick lock:', error)
            }
          }}
          disabled={!joystickConfig.selectedGamepad || (joystickConfig.locked && !isGamepadConnected)}
        />
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setTestDialogOpen(true)}
          disabled={!joystickConfig.selectedGamepad}
        >
          <Gamepad2 className="w-4 h-4 mr-2" />
          {t('Test Gamepad')}
        </Button>
      </div>

      {/* Test Dialog */}
      {joystickConfig.selectedGamepad && (
        <JoystickTestDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          config={joystickConfig}
          gamepadId={joystickConfig.selectedGamepad}
        />
      )}
    </div>
  )
}
