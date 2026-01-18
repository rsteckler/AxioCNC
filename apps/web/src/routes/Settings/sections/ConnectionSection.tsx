import { useState, useEffect, useRef } from 'react'
import { SettingsSection } from '../SettingsSection'
import { SettingsField } from '../SettingsField'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RefreshCw, Plug, Loader2, CheckCircle2, XCircle } from 'lucide-react'

// Common baud rates for CNC controllers
const BAUD_RATES = [9600, 19200, 38400, 57600, 115200, 230400, 250000, 500000, 1000000]

export interface ConnectionConfig {
  port: string
  baudRate: number
  controllerType?: string
  setDTR: boolean
  setRTS: boolean
  rtscts: boolean
  autoConnect: boolean
}

interface DetectedPort {
  path: string
  manufacturer?: string
}

type TestStatus = 'idle' | 'testing' | 'success' | 'error'

interface ConnectionSectionProps {
  config: ConnectionConfig
  detectedPorts: DetectedPort[]
  onConfigChange: (config: Partial<ConnectionConfig>) => void
  onRefreshPorts: () => void
  onTestConnection?: () => Promise<{ success: boolean; message?: string }>
}

export function ConnectionSection({
  config,
  detectedPorts,
  onConfigChange,
  onRefreshPorts,
  onTestConnection,
}: ConnectionSectionProps) {
  const [testStatus, setTestStatus] = useState<TestStatus>('idle')
  const [testMessage, setTestMessage] = useState<string>('')
  
  // Track connection settings that affect the test (port, baudRate, controllerType, serial line settings)
  const prevConnectionSettings = useRef<{
    port: string
    baudRate: number
    controllerType?: string
    setDTR: boolean
    setRTS: boolean
    rtscts: boolean
  }>({
    port: config.port,
    baudRate: config.baudRate,
    controllerType: config.controllerType,
    setDTR: config.setDTR,
    setRTS: config.setRTS,
    rtscts: config.rtscts,
  })
  
  // Reset test status when connection settings change
  useEffect(() => {
    const current = {
      port: config.port,
      baudRate: config.baudRate,
      controllerType: config.controllerType,
      setDTR: config.setDTR,
      setRTS: config.setRTS,
      rtscts: config.rtscts,
    }
    
    const prev = prevConnectionSettings.current
    
    // Check if any connection-affecting settings changed
    if (
      current.port !== prev.port ||
      current.baudRate !== prev.baudRate ||
      current.controllerType !== prev.controllerType ||
      current.setDTR !== prev.setDTR ||
      current.setRTS !== prev.setRTS ||
      current.rtscts !== prev.rtscts
    ) {
      // Only reset if we had a test result (not if we're idle or testing)
      if (testStatus === 'success' || testStatus === 'error') {
        setTestStatus('idle')
        setTestMessage('')
      }
      prevConnectionSettings.current = current
    }
  }, [config.port, config.baudRate, config.controllerType, config.setDTR, config.setRTS, config.rtscts, testStatus])

  const handleTestConnection = async () => {
    if (!onTestConnection || !config.port) return
    
    setTestStatus('testing')
    setTestMessage('')
    
    try {
      const result = await onTestConnection()
      setTestStatus(result.success ? 'success' : 'error')
      setTestMessage(result.message || (result.success ? 'Connection successful!' : 'Connection failed'))
      // Don't auto-reset - let it persist until settings change
    } catch (err) {
      setTestStatus('error')
      setTestMessage(err instanceof Error ? err.message : 'Connection test failed')
      // Don't auto-reset - let it persist until settings change
    }
  }

  return (
    <SettingsSection
      id="connection"
      title="Connection"
      description="Configure how AxioCNC connects to your machine's controller"
    >
      {/* Port Selection */}
      <SettingsField
        label="Port"
        description="Serial port for the CNC controller"
      >
        <div className="flex gap-2">
          <Select
            value={config.port || 'none'}
            onValueChange={(value) => {
              if (value === 'none') {
                onConfigChange({ port: '' })
              } else {
                onConfigChange({ port: value })
              }
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select port...">
                {config.port ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{config.port}</span>
                    {detectedPorts.find(p => p.path === config.port)?.manufacturer && (
                      <span className="text-xs text-muted-foreground">
                        ({detectedPorts.find(p => p.path === config.port)?.manufacturer})
                      </span>
                    )}
                  </div>
                ) : (
                  'None selected'
                )}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {detectedPorts.length === 0 ? 'No ports detected' : 'None selected'}
              </SelectItem>
              {/* Show saved port if not in detected list */}
              {config.port && !detectedPorts.some(p => p.path === config.port) && (
                <SelectItem value={config.port}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{config.port}</span>
                    <span className="text-xs text-muted-foreground">(saved)</span>
                  </div>
                </SelectItem>
              )}
              {detectedPorts.map((port) => (
                <SelectItem key={port.path} value={port.path}>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{port.path}</span>
                    {port.manufacturer && (
                      <span className="text-xs text-muted-foreground">({port.manufacturer})</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={onRefreshPorts}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </SettingsField>

      {/* Baud Rate */}
      <SettingsField
        label="Baud Rate"
        description="Communication speed with the controller"
      >
        <Select
          value={String(config.baudRate)}
          onValueChange={(value) => onConfigChange({ 
            baudRate: Number(value) 
          })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BAUD_RATES.map((rate) => (
              <SelectItem key={rate} value={String(rate)}>
                {rate.toLocaleString()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsField>

      {/* Serial Line Controls */}
      <SettingsField
        label="Set DTR line status upon opening"
        tooltip="Data Terminal Ready signal. Some controllers require DTR to be set to start communication."
        horizontal
      >
        <Switch
          checked={config.setDTR}
          onCheckedChange={(setDTR) => onConfigChange({ setDTR })}
        />
      </SettingsField>

      <SettingsField
        label="Set RTS line status upon opening"
        tooltip="Request To Send signal. Some controllers use RTS for flow control or reset."
        horizontal
      >
        <Switch
          checked={config.setRTS}
          onCheckedChange={(setRTS) => onConfigChange({ setRTS })}
        />
      </SettingsField>

      <SettingsField
        label="Use RTS/CTS flow control"
        tooltip="Hardware flow control using RTS and CTS lines. Enable if your controller supports it for more reliable communication."
        horizontal
      >
        <Switch
          checked={config.rtscts}
          onCheckedChange={(rtscts) => onConfigChange({ rtscts })}
        />
      </SettingsField>

      <SettingsField
        label="Connect automatically"
        description="Auto-connect when the application starts"
        horizontal
      >
        <Switch
          checked={config.autoConnect}
          onCheckedChange={(autoConnect) => onConfigChange({ autoConnect })}
        />
      </SettingsField>

      {/* Test Connection Button */}
      <div className="pt-4 border-t">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleTestConnection}
            disabled={!config.port || testStatus === 'testing'}
            variant={testStatus === 'success' ? 'default' : testStatus === 'error' ? 'destructive' : 'outline'}
            className="gap-2"
          >
            {testStatus === 'testing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Testing...
              </>
            ) : testStatus === 'success' ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Connected!
              </>
            ) : testStatus === 'error' ? (
              <>
                <XCircle className="w-4 h-4" />
                Failed
              </>
            ) : (
              <>
                <Plug className="w-4 h-4" />
                Test Connection
              </>
            )}
          </Button>
          
          {testMessage && testStatus !== 'testing' && (
            <span className={`text-sm ${testStatus === 'success' ? 'text-green-600' : 'text-destructive'}`}>
              {testMessage}
            </span>
          )}
        </div>
        
        {!config.port && (
          <p className="text-xs text-muted-foreground mt-2">
            Select a port to test the connection
          </p>
        )}
      </div>
    </SettingsSection>
  )
}

