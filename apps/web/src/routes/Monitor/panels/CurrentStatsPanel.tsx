import { useTranslation } from 'react-i18next'
import type { PanelProps } from '../../Setup/types'

export function CurrentStatsPanel(props: PanelProps) {
  const { t } = useTranslation()
  const stats = props.senderState?.stats
  
  // Get distances from stats
  const totalDistance = stats?.totalDistance || { x: 0, y: 0, z: 0, total: 0 }
  const cuttingDistance = stats?.cuttingDistance || { x: 0, y: 0, z: 0, total: 0 }
  const transitionDistance = stats?.transitionDistance || { x: 0, y: 0, z: 0, total: 0 }
  const retractDistance = stats?.retractDistance || { x: 0, y: 0, z: 0, total: 0 }
  
  // Calculate operation type breakdown (for pie chart)
  const totalDistanceTotal = totalDistance.total || 1 // Avoid division by zero
  const cuttingPercent = totalDistanceTotal > 0 ? (cuttingDistance.total / totalDistanceTotal) * 100 : 0
  const transitionPercent = totalDistanceTotal > 0 ? (transitionDistance.total / totalDistanceTotal) * 100 : 0
  const retractPercent = totalDistanceTotal > 0 ? (retractDistance.total / totalDistanceTotal) * 100 : 0
  
  const operationTypes = [
    { type: t('Cutting'), percent: cuttingPercent, color: 'rgb(59 130 246)', bgColor: 'bg-blue-500', distance: cuttingDistance.total },
    { type: t('Transition'), percent: transitionPercent, color: 'rgb(34 197 94)', bgColor: 'bg-green-500', distance: transitionDistance.total },
    { type: t('Retract'), percent: retractPercent, color: 'rgb(249 115 22)', bgColor: 'bg-orange-500', distance: retractDistance.total },
  ].filter(op => op.percent > 0) // Only show operations with distance
  
  // Use real travel distances from stats
  const totalTravelX = totalDistance.x || 0
  const totalTravelY = totalDistance.y || 0
  const totalTravelZ = totalDistance.z || 0
  const totalDistanceSum = totalTravelX + totalTravelY + totalTravelZ
  
  return (
    <div className="p-4 space-y-4">
      {/* Total distance traveled */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">{t('Total Distance')}</div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">X:</span>
            <span className="text-xs font-mono font-medium">{totalTravelX.toFixed(1)} {t('mm')}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Y:</span>
            <span className="text-xs font-mono font-medium">{totalTravelY.toFixed(1)} {t('mm')}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">Z:</span>
            <span className="text-xs font-mono font-medium">{totalTravelZ.toFixed(1)} {t('mm')}</span>
          </div>
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-border">
            <span className="text-xs font-medium">{t('Total:')}</span>
            <span className="text-xs font-mono font-semibold">{totalDistanceSum.toFixed(1)} {t('mm')}</span>
          </div>
        </div>
      </div>
      
      {/* Operation type pie chart */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">{t('Operation Types')}</div>
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
            {operationTypes.length > 0 ? (
              operationTypes.map(({ type, percent, bgColor, distance }) => (
                <div key={type} className="flex items-center gap-2 text-xs">
                  <div className={`w-2.5 h-2.5 rounded ${bgColor}`} />
                  <span className="flex-1 text-muted-foreground truncate">{type}</span>
                  <span className="font-medium">{percent.toFixed(1)}%</span>
                  <span className="font-mono text-muted-foreground">({distance.toFixed(1)}mm)</span>
                </div>
              ))
            ) : (
              <div className="text-xs text-muted-foreground">{t('No distance data available')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
