import React, { useState, useCallback } from 'react'
import { MachineActionButton } from '@/components/MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'
import { LoadingState } from '@/components/LoadingState'
import { EmptyState } from '@/components/EmptyState'
import { ConfirmationDialog } from '@/components/ConfirmationDialog'
import { useGetMacrosQuery } from '@/services/api'
import { useGcodeCommand } from '@/hooks'
import type { PanelProps } from '../types'

export function MacrosPanel({
  isConnected,
  connectedPort,
  machineStatus,
  onFlashStatus,
}: PanelProps) {
  const { data: macrosData, isLoading } = useGetMacrosQuery()
  const { sendCommand } = useGcodeCommand(connectedPort)
  const [confirmMacro, setConfirmMacro] = useState<{ id: string; name: string } | null>(null)
  
  const macros = macrosData?.records ?? []
  
  const handleMacroClick = useCallback((macroId: string, macroName: string) => {
    if (!isConnected || !connectedPort) {
      onFlashStatus()
      return
    }
    
    // Show confirmation dialog
    setConfirmMacro({ id: macroId, name: macroName })
  }, [isConnected, connectedPort, onFlashStatus])
  
  const handleConfirmRun = useCallback(() => {
    if (!confirmMacro || !connectedPort) {
      return
    }
    
    // Send macro:run command to execute the macro by ID (same as legacy frontend)
    // The backend's 'macro:run' handler will retrieve the macro content from configstore
    // and execute it via the 'gcode' command handler
    sendCommand('macro:run', confirmMacro.id)
  }, [confirmMacro, connectedPort, sendCommand])
  
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
              onAction={() => handleMacroClick(macro.id, macro.name)}
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
      
      <ConfirmationDialog
        open={confirmMacro !== null}
        onOpenChange={(open) => !open && setConfirmMacro(null)}
        title="Run Macro?"
        description={
          <>
            Are you sure you want to run the macro <strong>{confirmMacro?.name}</strong>? Make sure the machine is in a safe state before proceeding.
          </>
        }
        confirmLabel="Run"
        onConfirm={handleConfirmRun}
      />
    </>
  )
}
