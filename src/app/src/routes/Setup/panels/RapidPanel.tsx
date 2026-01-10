import React, { useCallback } from 'react'
import { MachineActionButton } from '@/components/MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'
import { useGetSettingsQuery } from '@/services/api'
import { useGcodeCommand } from '@/hooks'
import type { PanelProps } from '../types'

export function RapidPanel({
  isConnected,
  connectedPort,
  machineStatus,
  onFlashStatus,
}: PanelProps) {
  const { data: settings } = useGetSettingsQuery()
  
  // G-code command hook
  const { sendGcode } = useGcodeCommand(connectedPort)
  
  // Get machine limits from settings, with defaults
  const limits = settings?.machine?.limits || {
    xmin: 0,
    xmax: 300,
    ymin: 0,
    ymax: 300,
    zmin: -50,
    zmax: 0,
  }
  
  // Calculate positions for each button
  const positions = {
    // Top row (Y max)
    upperLeft: { x: limits.xmin, y: limits.ymax },
    upperCenter: { x: (limits.xmin + limits.xmax) / 2, y: limits.ymax },
    upperRight: { x: limits.xmax, y: limits.ymax },
    // Middle row (Y center)
    middleLeft: { x: limits.xmin, y: (limits.ymin + limits.ymax) / 2 },
    center: { x: (limits.xmin + limits.xmax) / 2, y: (limits.ymin + limits.ymax) / 2 },
    middleRight: { x: limits.xmax, y: (limits.ymin + limits.ymax) / 2 },
    // Bottom row (Y min)
    lowerLeft: { x: limits.xmin, y: limits.ymin },
    lowerCenter: { x: (limits.xmin + limits.xmax) / 2, y: limits.ymin },
    lowerRight: { x: limits.xmax, y: limits.ymin },
  }
  
  const handleRapidMove = useCallback((x: number, y: number) => {
    if (!isConnected || !connectedPort) {
      onFlashStatus()
      return
    }
    
    // Send G0 (rapid move) command to machine coordinates using G53
    // G53 is a one-shot machine coordinate system override (non-modal, applies to current line only)
    // This moves to machine coordinates (MPos) instead of work coordinates (WPos)
    const command = `G53 G0 X${x.toFixed(3)} Y${y.toFixed(3)}`
    sendGcode(command)
  }, [isConnected, connectedPort, onFlashStatus, sendGcode])
  
  // Arrow SVG components for each direction
  const ArrowUL = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17V7h10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 7l10 10" strokeLinecap="round"/>
    </svg>
  )
  const ArrowU = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 19V5m0 0l-6 6m6-6l6 6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  const ArrowUR = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 17V7H7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 7L7 17" strokeLinecap="round"/>
    </svg>
  )
  const ArrowL = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5m0 0l6-6m-6 6l6 6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  const ArrowR = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14m0 0l-6-6m6 6l-6 6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  const ArrowLL = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 7v10h10" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7 17L17 7" strokeLinecap="round"/>
    </svg>
  )
  const ArrowD = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 5v14m0 0l-6-6m6 6l6-6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
  const ArrowLR = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 7v10H7" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M17 17L7 7" strokeLinecap="round"/>
    </svg>
  )
  const CenterIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3"/>
      <path d="M12 2v4m0 12v4M2 12h4m12 0h4" strokeLinecap="round"/>
    </svg>
  )

  return (
    <div className="p-3">
      {/* Visual grid layout matching work area orientation */}
      <div className="grid grid-cols-3 gap-1.5 max-w-[180px] mx-auto">
        {/* Top row */}
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.upperLeft.x, positions.upperLeft.y)}
          requirements={ActionRequirements.jog}
          variant="outline"
          size="sm"
          className="h-10 w-full p-0"
          title={`Upper Left (X${positions.upperLeft.x.toFixed(0)} Y${positions.upperLeft.y.toFixed(0)})`}
        >
          <ArrowUL />
        </MachineActionButton>
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.upperCenter.x, positions.upperCenter.y)}
          requirements={ActionRequirements.jog}
          variant="outline"
          size="sm"
          className="h-10 w-full p-0"
          title={`Upper Center (X${positions.upperCenter.x.toFixed(0)} Y${positions.upperCenter.y.toFixed(0)})`}
        >
          <ArrowU />
        </MachineActionButton>
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.upperRight.x, positions.upperRight.y)}
          requirements={ActionRequirements.jog}
          variant="outline"
          size="sm"
          className="h-10 w-full p-0"
          title={`Upper Right (X${positions.upperRight.x.toFixed(0)} Y${positions.upperRight.y.toFixed(0)})`}
        >
          <ArrowUR />
        </MachineActionButton>
        
        {/* Middle row */}
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.middleLeft.x, positions.middleLeft.y)}
          requirements={ActionRequirements.jog}
          variant="outline"
          size="sm"
          className="h-10 w-full p-0"
          title={`Middle Left (X${positions.middleLeft.x.toFixed(0)} Y${positions.middleLeft.y.toFixed(0)})`}
        >
          <ArrowL />
        </MachineActionButton>
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.center.x, positions.center.y)}
          requirements={ActionRequirements.jog}
          variant="secondary"
          size="sm"
          className="h-10 w-full p-0"
          title={`Center (X${positions.center.x.toFixed(0)} Y${positions.center.y.toFixed(0)})`}
        >
          <CenterIcon />
        </MachineActionButton>
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.middleRight.x, positions.middleRight.y)}
          requirements={ActionRequirements.jog}
          variant="outline"
          size="sm"
          className="h-10 w-full p-0"
          title={`Middle Right (X${positions.middleRight.x.toFixed(0)} Y${positions.middleRight.y.toFixed(0)})`}
        >
          <ArrowR />
        </MachineActionButton>
        
        {/* Bottom row */}
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.lowerLeft.x, positions.lowerLeft.y)}
          requirements={ActionRequirements.jog}
          variant="outline"
          size="sm"
          className="h-10 w-full p-0"
          title={`Lower Left (X${positions.lowerLeft.x.toFixed(0)} Y${positions.lowerLeft.y.toFixed(0)})`}
        >
          <ArrowLL />
        </MachineActionButton>
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.lowerCenter.x, positions.lowerCenter.y)}
          requirements={ActionRequirements.jog}
          variant="outline"
          size="sm"
          className="h-10 w-full p-0"
          title={`Lower Center (X${positions.lowerCenter.x.toFixed(0)} Y${positions.lowerCenter.y.toFixed(0)})`}
        >
          <ArrowD />
        </MachineActionButton>
        <MachineActionButton
          isConnected={isConnected}
          connectedPort={connectedPort}
          machineStatus={machineStatus}
          onFlashStatus={onFlashStatus}
          onAction={() => handleRapidMove(positions.lowerRight.x, positions.lowerRight.y)}
          requirements={ActionRequirements.jog}
          variant="outline"
          size="sm"
          className="h-10 w-full p-0"
          title={`Lower Right (X${positions.lowerRight.x.toFixed(0)} Y${positions.lowerRight.y.toFixed(0)})`}
        >
          <ArrowLR />
        </MachineActionButton>
      </div>
    </div>
  )
}
