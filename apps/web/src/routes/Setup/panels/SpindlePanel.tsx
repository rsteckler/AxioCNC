import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCw, RotateCcw, Circle, ThermometerSun, Square } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { MachineActionButton } from '@/components/MachineActionButton'
import { MachineActionWrapper } from '@/components/MachineActionWrapper'
import { ActionRequirements } from '@/utils/machineState'
import { useGcodeCommand } from '@/hooks'
import { trackFeatureUsed } from '@/services/analytics'
import { useGetSettingsQuery } from '@/services/api'
import type { PanelProps } from '../types'

function getWarmupSpeeds(minRpm: number, maxRpm: number, stepRpm: number): number[] {
  if (minRpm >= maxRpm || stepRpm <= 0) return [minRpm]
  const speeds: number[] = []
  for (let s = minRpm; s < maxRpm; s += stepRpm) {
    speeds.push(s)
  }
  speeds.push(maxRpm)
  return speeds
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `0:${s.toString().padStart(2, '0')}`
}

export function SpindlePanel({ 
  isConnected, 
  connectedPort, 
  machineStatus, 
  onFlashStatus, 
  isJobRunning = false, 
  spindleState = 'M5', 
  spindleSpeed = 0 
}: PanelProps) {
  const { t } = useTranslation()
  const { data: settings } = useGetSettingsQuery()
  // Generate speeds array from 8000 to 24000 in 100 RPM increments
  const speeds = Array.from({ length: 161 }, (_, i) => 8000 + i * 100)
  
  // Label positions (indices) - 5 evenly spaced labels (8k, 12k, 16k, 20k, 24k)
  const labelIndices = [0, 40, 80, 120, 160] // 8000, 12000, 16000, 20000, 24000
  
  // G-code command hook
  const { sendGcode } = useGcodeCommand(connectedPort)

  // Spindle warmup (VFD) from machine settings
  const warmupConfig = settings?.machine?.spindleWarmup
  const warmupEnabled = warmupConfig?.enabled ?? false
  const warmupTimeSeconds = Math.max(1, Math.min(300, warmupConfig?.timeSeconds ?? 45))
  const warmupMinRpm = warmupConfig?.minRpm ?? 8000
  const warmupMaxRpm = warmupConfig?.maxRpm ?? 24000
  const warmupStepRpm = Math.max(100, warmupConfig?.stepRpm ?? 2000)

  const [isWarmupRunning, setIsWarmupRunning] = useState(false)
  const [warmupRemainingSeconds, setWarmupRemainingSeconds] = useState(0)
  const warmupTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const warmupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const warmupCancelledRef = useRef(false)
  const prevSpindleStateRef = useRef<string>(spindleState)

  const clearWarmupTimers = useCallback(() => {
    warmupTimeoutsRef.current.forEach(clearTimeout)
    warmupTimeoutsRef.current = []
    if (warmupIntervalRef.current) {
      clearInterval(warmupIntervalRef.current)
      warmupIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearWarmupTimers()
    }
  }, [clearWarmupTimers])

  // If spindle stops while warmup is running (e.g. e-stop), end warmup.
  // Only react to transition from M3/M4 → M5, not M5 at start (machine needs time to report M3).
  useEffect(() => {
    const wasOn = prevSpindleStateRef.current === 'M3' || prevSpindleStateRef.current === 'M4'
    prevSpindleStateRef.current = spindleState
    if (isWarmupRunning && wasOn && spindleState === 'M5') {
      warmupCancelledRef.current = true
      clearWarmupTimers()
      setIsWarmupRunning(false)
      setWarmupRemainingSeconds(0)
    }
  }, [isWarmupRunning, spindleState, clearWarmupTimers])

  const handleStopWarmup = useCallback(() => {
    warmupCancelledRef.current = true
    clearWarmupTimers()
    sendGcode('M5')
    setIsWarmupRunning(false)
    setWarmupRemainingSeconds(0)
    trackFeatureUsed('spindle', 'SpindlePanel', 'warmup_stop', '')
  }, [clearWarmupTimers, sendGcode])

  const handleStartWarmup = useCallback(() => {
    if (!connectedPort || isWarmupRunning) return
    warmupCancelledRef.current = false
    const warmupSpeeds = getWarmupSpeeds(warmupMinRpm, warmupMaxRpm, warmupStepRpm)
    const totalSeconds = warmupSpeeds.length * warmupTimeSeconds
    setIsWarmupRunning(true)
    setWarmupRemainingSeconds(totalSeconds)

    const intervalId = setInterval(() => {
      setWarmupRemainingSeconds(prev => Math.max(0, prev - 1))
    }, 1000)
    warmupIntervalRef.current = intervalId

    warmupSpeeds.forEach((rpm, i) => {
      const timeoutId = setTimeout(() => {
        if (warmupCancelledRef.current) return
        sendGcode(`M3 S${rpm}`)
      }, i * warmupTimeSeconds * 1000)
      warmupTimeoutsRef.current.push(timeoutId)
    })
    const stopTimeoutId = setTimeout(() => {
      if (warmupCancelledRef.current) return
      sendGcode('M5')
      clearWarmupTimers()
      if (warmupIntervalRef.current) {
        clearInterval(warmupIntervalRef.current)
        warmupIntervalRef.current = null
      }
      setIsWarmupRunning(false)
      setWarmupRemainingSeconds(0)
      trackFeatureUsed('spindle', 'SpindlePanel', 'warmup_complete', '')
    }, warmupSpeeds.length * warmupTimeSeconds * 1000)
    warmupTimeoutsRef.current.push(stopTimeoutId)
    trackFeatureUsed('spindle', 'SpindlePanel', 'warmup_start', `${warmupSpeeds.length}_${warmupTimeSeconds}s`)
  }, [connectedPort, isWarmupRunning, warmupMinRpm, warmupMaxRpm, warmupStepRpm, warmupTimeSeconds, sendGcode, clearWarmupTimers])
  
  // Derive state from backend
  const isOn = spindleState === 'M3' || spindleState === 'M4'
  const backendDirection = spindleState === 'M4' ? 'ccw' : 'cw'
  
  // Local state for direction (can be changed when spindle is off)
  const [localDirection, setLocalDirection] = useState<'cw' | 'ccw'>('cw')
  
  // Use backend direction when spindle is on, local direction when off
  const direction = isOn ? backendDirection : localDirection
  
  // Sync local direction with backend when spindle turns off
  useEffect(() => {
    if (!isOn) {
      setLocalDirection(backendDirection)
    }
  }, [isOn, backendDirection])
  
  // Find closest speed index from backend speed, or default to 10000 RPM (index 20)
  const getSpeedIndex = useCallback((speed: number | undefined): number => {
    if (speed === undefined) return 20 // Default to 10000 RPM
    // Clamp speed to valid range
    const clampedSpeed = Math.max(8000, Math.min(24000, speed))
    // Find closest speed in speeds array
    let closestIndex = 20
    let minDiff = Math.abs(clampedSpeed - speeds[20])
    speeds.forEach((s, i) => {
      const diff = Math.abs(clampedSpeed - s)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = i
      }
    })
    return closestIndex
  }, [speeds])
  
  const [speedIndex, setSpeedIndex] = useState(() => getSpeedIndex(spindleSpeed))
  
  // Sync slider to backend speed whenever it changes (e.g. during warmup or after start/stop)
  useEffect(() => {
    if (spindleSpeed !== undefined) {
      setSpeedIndex(getSpeedIndex(spindleSpeed))
    }
  }, [spindleSpeed, getSpeedIndex])
  
  const speed = speeds[speedIndex]
  
  // Check if controls should be disabled
  // Spindle stop should be allowed during hold, but other controls should be disabled
  const isDisabled = !isConnected || machineStatus === 'alarm' || machineStatus === 'not_connected' || 
    (isJobRunning && machineStatus !== 'hold') // Allow during hold, disable during other running states
  const canControl = !isDisabled
  
  // Handle start/stop spindle
  const handleToggleSpindle = useCallback(() => {
    if (isOn) {
      // Stop spindle
      trackFeatureUsed('spindle', 'SpindlePanel', 'toggle_spindle', 'off')
      sendGcode('M5')
    } else {
      // Start spindle with current speed and direction
      trackFeatureUsed('spindle', 'SpindlePanel', 'toggle_spindle', `${direction}_${speed}`)
      const command = direction === 'cw' ? `M3 S${speed}` : `M4 S${speed}`
      sendGcode(command)
    }
  }, [isOn, direction, speed, sendGcode])
  
  // Handle direction change (only when stopped)
  const handleDirectionChange = useCallback((newDirection: 'cw' | 'ccw') => {
    if (isOn) return // Can't change direction while running
    
    trackFeatureUsed('spindle', 'SpindlePanel', 'direction_change', newDirection)
    // Update local state - will be applied when starting
    setLocalDirection(newDirection)
  }, [isOn])
  
  // Handle speed change (only when stopped)
  const handleSpeedChange = useCallback((newSpeedIndex: number) => {
    if (isOn) return // Can't change speed while running
    
    const newSpeed = speeds[newSpeedIndex]
    trackFeatureUsed('spindle', 'SpindlePanel', 'speed_change', newSpeed)
    setSpeedIndex(newSpeedIndex)
    // Speed will be applied when starting spindle
  }, [isOn, speeds])
  
  // Flash status if action attempted while disabled (but not if disabled due to spindle running)
  const handleDisabledAction = useCallback(() => {
    if (!canControl && !isOn) {
      // Only flash if disabled for reasons other than spindle running
      onFlashStatus()
    }
  }, [canControl, isOn, onFlashStatus])

  // Don't flash when disabled due to spindle running
  const onFlashStatusForSpindleControls = isOn ? () => {} : onFlashStatus

  return (
    <div className="p-3 space-y-3">
      {/* Notice when spindle is running */}
      {isOn && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2 text-xs text-blue-700 dark:text-blue-400">
          {t('Direction and speed cannot be changed while the spindle is running.')}
        </div>
      )}
      
      {/* Direction toggle */}
      <div className="space-y-1">
        <div className="flex gap-2 w-full">
          <div className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground">{t('Most common')}</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground">{t('Not common')}</span>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatusForSpindleControls}
            onAction={() => handleDirectionChange('cw')}
            requirements={{
              requiresConnected: true,
              requiresPort: true,
              disallowAlarm: true,
              disallowRunning: false, // Allow direction change during jobs (when spindle is off)
              disallowNotConnected: true,
            }}
            customDisabled={isJobRunning || isOn} // Disable when job running or spindle is on
            variant={direction === 'cw' ? 'default' : 'outline'}
            className="flex-1"
          >
            <RotateCw className="w-4 h-4 mr-1" />
            {t('CW')}
          </MachineActionButton>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatusForSpindleControls}
            onAction={() => handleDirectionChange('ccw')}
            requirements={{
              requiresConnected: true,
              requiresPort: true,
              disallowAlarm: true,
              disallowRunning: false, // Allow direction change during jobs (when spindle is off)
              disallowNotConnected: true,
            }}
            customDisabled={isJobRunning || isOn} // Disable when job running or spindle is on
            variant={direction === 'ccw' ? 'default' : 'outline'}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            {t('CCW')}
          </MachineActionButton>
        </div>
      </div>
      
      {/* Speed control */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>{t('Speed (RPM)')}</span>
          <span className="font-mono font-medium">{speed} {t('RPM')}</span>
        </div>
        <MachineActionWrapper
          isDisabled={isDisabled || isOn}
          onFlashStatus={onFlashStatusForSpindleControls}
        >
          <Slider 
            value={[speedIndex]} 
            onValueChange={(v) => {
              if (isDisabled || isOn) {
                handleDisabledAction()
                return
              }
              handleSpeedChange(v[0])
            }}
            max={speeds.length - 1} 
            step={1}
            disabled={isDisabled || isOn} // Disable when spindle is on OR controls are disabled
          />
        </MachineActionWrapper>
        <div className="flex justify-between text-[10px] text-muted-foreground px-1">
          {labelIndices.map((idx) => {
            const labelSpeed = speeds[idx]
            const label = labelSpeed >= 1000 ? `${labelSpeed / 1000}k` : `${labelSpeed}`
            return <span key={idx}>{label}</span>
          })}
        </div>
      </div>
      
      {/* Spindle warmup (VFD) - when enabled in Machine settings */}
      {warmupEnabled && (
        <div className="space-y-1">
          {isWarmupRunning ? (
            <>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={handleStopWarmup}
                requirements={ActionRequirements.allowHold}
                className="w-full h-12 bg-red-600 hover:bg-red-700"
                variant="default"
              >
                <Square className="w-4 h-4 mr-2 fill-white" />
                {t('Stop Warmup')}
              </MachineActionButton>
              <p className="text-center text-sm font-mono text-muted-foreground">
                {t('Time remaining')}: {formatCountdown(warmupRemainingSeconds)}
              </p>
            </>
          ) : (
            <MachineActionButton
              isConnected={isConnected}
              connectedPort={connectedPort}
              machineStatus={machineStatus}
              onFlashStatus={onFlashStatus}
              onAction={handleStartWarmup}
              requirements={{
                requiresConnected: true,
                requiresPort: true,
                disallowAlarm: true,
                disallowRunning: true,
                disallowHold: true,
                disallowNotConnected: true,
              }}
              customDisabled={isJobRunning}
              className="w-full h-12"
              variant="outline"
            >
              <ThermometerSun className="w-4 h-4 mr-2" />
              {t('Warmup Spindle')}
            </MachineActionButton>
          )}
        </div>
      )}

      {/* On/Off toggle - hidden while warmup is running */}
      {!isWarmupRunning && (
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={handleToggleSpindle}
          requirements={isOn ? ActionRequirements.allowHold : {
            requiresConnected: true,
            requiresPort: true,
            disallowAlarm: true,
            disallowRunning: false, // Allow spindle start during jobs (but not during hold)
            disallowHold: true, // Don't allow starting spindle during hold
            disallowNotConnected: true,
          }}
          customDisabled={!isOn && (isJobRunning && machineStatus !== 'hold')} // Allow stop during hold, disable start during other running states
          className={`w-full h-12 ${isOn ? 'bg-green-600 hover:bg-green-700' : ''}`}
          variant={isOn ? 'default' : 'outline'}
        >
          <Circle className={`w-4 h-4 mr-2 ${isOn ? 'fill-white' : ''}`} />
          {isOn ? t('Stop Spindle') : t('Start Spindle')}
        </MachineActionButton>
      )}
    </div>
  )
}
