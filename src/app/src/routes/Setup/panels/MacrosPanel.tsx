import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { MachineActionButton } from '@/components/MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { useGetMacrosQuery, type Macro } from '@/services/api'
import { useGcodeCommand } from '@/hooks'
import { 
  parseMacroParameters, 
  validateParameterValue, 
  convertParameterValue,
  type MacroParameter 
} from '@/routes/Settings/sections/macroParameters'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { AlertCircle } from 'lucide-react'
import type { PanelProps } from '../types'

interface ParameterInputState {
  value: string
  error?: string
}

export function MacrosPanel({
  isConnected,
  connectedPort,
  machineStatus,
  onFlashStatus,
}: PanelProps) {
  const { data: macrosData, isLoading } = useGetMacrosQuery()
  const { sendCommand } = useGcodeCommand(connectedPort)
  const [confirmMacro, setConfirmMacro] = useState<Macro | null>(null)
  const [parameterValues, setParameterValues] = useState<Record<string, ParameterInputState>>({})
  
  const macros = macrosData?.records ?? []
  
  // Parse parameters from the selected macro
  const macroParameters = useMemo(() => {
    if (!confirmMacro) return []
    return parseMacroParameters(confirmMacro.content)
  }, [confirmMacro])
  
  // Initialize parameter values when macro changes
  useEffect(() => {
    if (confirmMacro && macroParameters.length > 0) {
      const initialValues: Record<string, ParameterInputState> = {}
      for (const param of macroParameters) {
        initialValues[param.name] = {
          value: param.defaultValue ?? '',
          error: undefined,
        }
      }
      setParameterValues(initialValues)
    } else {
      setParameterValues({})
    }
  }, [confirmMacro, macroParameters])
  
  const handleMacroClick = useCallback((macro: Macro) => {
    if (!isConnected || !connectedPort) {
      onFlashStatus()
      return
    }
    
    // Show confirmation dialog with the full macro
    setConfirmMacro(macro)
  }, [isConnected, connectedPort, onFlashStatus])
  
  const handleParameterChange = useCallback((paramName: string, value: string, type: MacroParameter['type']) => {
    const validation = validateParameterValue(value, type)
    setParameterValues(prev => ({
      ...prev,
      [paramName]: {
        value,
        error: validation.valid ? undefined : validation.error,
      }
    }))
  }, [])
  
  const handleBooleanToggle = useCallback((paramName: string, checked: boolean) => {
    setParameterValues(prev => ({
      ...prev,
      [paramName]: {
        value: checked ? 'true' : 'false',
        error: undefined,
      }
    }))
  }, [])
  
  // Check if all parameters are valid
  const allParametersValid = useMemo(() => {
    if (macroParameters.length === 0) return true
    
    for (const param of macroParameters) {
      const state = parameterValues[param.name]
      if (!state || state.error) return false
      
      const validation = validateParameterValue(state.value, param.type)
      if (!validation.valid) return false
    }
    return true
  }, [macroParameters, parameterValues])
  
  const handleConfirmRun = useCallback(() => {
    if (!confirmMacro || !connectedPort) {
      return
    }
    
    // Build context object with parameter values
    const context: Record<string, string | number | boolean> = {}
    for (const param of macroParameters) {
      const state = parameterValues[param.name]
      if (state) {
        context[param.name] = convertParameterValue(state.value, param.type)
      }
    }
    
    // Send macro:run command with context
    // The backend's 'macro:run' handler will retrieve the macro content from configstore
    // and execute it via the 'gcode' command handler with the context for variable substitution
    sendCommand('macro:run', confirmMacro.id, context)
    setConfirmMacro(null)
  }, [confirmMacro, connectedPort, macroParameters, parameterValues, sendCommand])
  
  if (isLoading) {
    return <LoadingState message="Loading macros..." className="py-8" />
  }
  
  if (macros.length === 0) {
    return <EmptyState message="No macros found. Add macros in Settings." className="py-12" />
  }
  
  return (
    <>
      <div className="p-3">
        <div className="flex flex-col gap-2 w-full">
          {macros.map((macro) => (
            <MachineActionButton
              key={macro.id}
              isConnected={isConnected}
              connectedPort={connectedPort}
              machineStatus={machineStatus}
              onFlashStatus={onFlashStatus}
              onAction={() => handleMacroClick(macro)}
              requirements={ActionRequirements.standard}
              variant="outline"
              size="sm"
              className="w-full h-auto min-h-[3.5rem] flex flex-col gap-1 p-2 items-center justify-center"
              title={macro.description || macro.name}
            >
              <span className="text-xs font-medium line-clamp-1 w-full text-center break-words overflow-hidden">{macro.name}</span>
              {macro.description && (
                <span className="text-[10px] text-muted-foreground w-full text-center break-words whitespace-normal">{macro.description}</span>
              )}
            </MachineActionButton>
          ))}
        </div>
      </div>
      
      <Dialog open={confirmMacro !== null} onOpenChange={(open) => !open && setConfirmMacro(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Run Macro</DialogTitle>
            <DialogDescription>
              {macroParameters.length > 0 ? (
                <>Enter parameter values for <strong>{confirmMacro?.name}</strong></>
              ) : (
                <>Are you sure you want to run <strong>{confirmMacro?.name}</strong>?</>
              )}
            </DialogDescription>
          </DialogHeader>
          
          {macroParameters.length > 0 && (
            <div className="space-y-4 py-2">
              {macroParameters.map((param) => {
                const state = parameterValues[param.name]
                const hasError = state?.error !== undefined
                
                return (
                  <div key={param.name} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`param-${param.name}`} className="font-mono text-sm">
                        {param.name}
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {param.type}
                      </Badge>
                    </div>
                    
                    {param.type === 'boolean' ? (
                      <div className="flex items-center gap-3">
                        <Switch
                          id={`param-${param.name}`}
                          checked={state?.value === 'true'}
                          onCheckedChange={(checked) => handleBooleanToggle(param.name, checked)}
                        />
                        <span className="text-sm text-muted-foreground">
                          {state?.value === 'true' ? 'true' : 'false'}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Input
                          id={`param-${param.name}`}
                          type={param.type === 'number' ? 'text' : 'text'}
                          inputMode={param.type === 'number' ? 'decimal' : 'text'}
                          value={state?.value ?? ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value, param.type)}
                          placeholder={param.defaultValue ? `Default: ${param.defaultValue}` : `Enter ${param.type}`}
                          className={hasError ? 'border-destructive' : ''}
                        />
                        {hasError && (
                          <div className="flex items-center gap-1 text-xs text-destructive">
                            <AlertCircle className="w-3 h-3" />
                            {state?.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          
          {macroParameters.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              Make sure the machine is in a safe state before proceeding.
            </p>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmMacro(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmRun}
              disabled={!allParametersValid}
            >
              Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
