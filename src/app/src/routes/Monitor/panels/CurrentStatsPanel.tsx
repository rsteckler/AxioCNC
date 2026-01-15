import React from 'react'
import type { PanelProps } from '../../Setup/types'

export function CurrentStatsPanel(props: PanelProps) {
  // Mock operation type breakdown (for pie chart)
  // TODO: Replace with real data from sender/feeder when available
  const operationTypes = [
    { type: 'Cutting', percent: 45, color: 'rgb(59 130 246)', bgColor: 'bg-blue-500' },
    { type: 'Positioning', percent: 30, color: 'rgb(34 197 94)', bgColor: 'bg-green-500' },
    { type: 'Retracting/Plunging', percent: 25, color: 'rgb(249 115 22)', bgColor: 'bg-orange-500' },
  ]
  
  // Mock travel distances
  // TODO: Replace with real data from sender when available
  const totalTravelX = 6234.2 // mm
  const totalTravelY = 6216.3 // mm
  const totalTravelZ = 234.8 // mm
  
  return (
    <div className="p-4 space-y-4">
      {/* Total distance traveled */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Total Distance</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">X:</span>
            <span className="text-xs font-mono font-medium">{totalTravelX.toFixed(1)} mm</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Y:</span>
            <span className="text-xs font-mono font-medium">{totalTravelY.toFixed(1)} mm</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Z:</span>
            <span className="text-xs font-mono font-medium">{totalTravelZ.toFixed(1)} mm</span>
          </div>
        </div>
      </div>
      
      {/* Operation type pie chart */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Operation Types</div>
        <div className="flex items-center gap-3">
          {/* Simple pie chart visualization - condensed */}
          <div className="relative w-14 h-14 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="transform -rotate-90">
              {operationTypes.reduce((acc, { percent, color }, index) => {
                const prevPercent = acc.prev
                const offset = prevPercent * 3.6 // Convert to degrees
                const length = percent * 3.6
                return {
                  prev: prevPercent + percent,
                  elements: [
                    ...acc.elements,
                    <circle
                      key={index}
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke={color}
                      strokeWidth="10"
                      strokeDasharray={`${length} ${360 - length}`}
                      strokeDashoffset={-offset}
                      className="transition-all"
                    />
                  ]
                }
              }, { prev: 0, elements: [] as JSX.Element[] }).elements}
            </svg>
          </div>
          <div className="flex-1 space-y-0.5">
            {operationTypes.map(({ type, percent, bgColor }) => (
              <div key={type} className="flex items-center gap-2 text-xs">
                <div className={`w-2.5 h-2.5 rounded ${bgColor}`} />
                <span className="flex-1 text-muted-foreground truncate">{type}</span>
                <span className="font-medium">{percent}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
