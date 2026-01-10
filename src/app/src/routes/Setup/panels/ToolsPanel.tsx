import React from 'react'
import { Library, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'

const MOCK_TOOLS = [
  { num: 1, name: '1/4" Flat Endmill', diameter: 6.35, type: 'endmill', inUse: true, desc: 'Roughing, pockets, profiles' },
  { num: 2, name: '1/8" Ballnose', diameter: 3.175, type: 'ballnose', inUse: true, desc: '3D finishing, contours' },
  { num: 3, name: '60° V-Bit', diameter: 6.35, type: 'vbit', inUse: false, desc: 'Engraving, chamfers, lettering' },
  { num: 4, name: '1/16" Engraver', diameter: 1.5875, type: 'engraver', inUse: false, desc: 'Fine detail, PCB traces' },
  { num: 5, name: '1/2" Surfacing', diameter: 12.7, type: 'endmill', inUse: false, desc: 'Spoilboard, large flattening' },
  { num: 6, name: '1/4" Compression', diameter: 6.35, type: 'endmill', inUse: false, desc: 'Plywood, laminates, clean edges' },
  { num: 7, name: '90° V-Bit', diameter: 12.7, type: 'vbit', inUse: false, desc: 'Chamfers, signs, inlays' },
  { num: 8, name: '1/8" Flat Endmill', diameter: 3.175, type: 'endmill', inUse: false, desc: 'Detail work, small pockets' },
  { num: 9, name: '1/4" Bullnose', diameter: 6.35, type: 'ballnose', inUse: false, desc: 'Rounded edges, soft 3D' },
  { num: 10, name: '1/8" Drill', diameter: 3.175, type: 'drill', inUse: false, desc: 'Hole drilling, dowel pins' },
]

interface PanelHeaderProps {
  title: string
  icon: React.ElementType
  isCollapsed?: boolean
  onToggle?: () => void
}

function PanelHeader({ 
  title, 
  icon: Icon,
  isCollapsed,
  onToggle
}: PanelHeaderProps) {
  return (
    <div 
      className="flex items-center gap-2 px-3 py-2 pl-10 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={onToggle}
    >
      <Icon className="w-4 h-4 text-primary" />
      <span className="text-sm font-medium flex-1">{title}</span>
      {onToggle && (
        <ChevronDown 
          className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} 
        />
      )}
    </div>
  )
}

export function ToolsPanel() {
  // Convert vertical wheel to horizontal scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY !== 0) {
      const container = e.currentTarget.querySelector('[data-overlayscrollbars-viewport]') as HTMLElement
      if (container) {
        container.scrollLeft += e.deltaY
      }
    }
  }

  return (
    <div className="h-full flex flex-col" onWheel={handleWheel}>
      <PanelHeader title="Tool Library" icon={Library} />
      <OverlayScrollbarsComponent 
        className="flex-1 p-2"
        options={{ 
          scrollbars: { autoHide: 'never' },
          overflow: { x: 'scroll', y: 'hidden' }
        }}
      >
        <div className="flex gap-2 h-full items-stretch">
          {/* In Use Section */}
          <div className="flex-shrink-0 flex flex-col h-full">
            <div className="text-[10px] text-primary font-medium mb-1 px-1">In Use</div>
            <div className="flex-1 flex gap-2 border-l-2 border-primary pl-2">
              {MOCK_TOOLS.filter(t => t.inUse).map((tool) => (
                <div 
                  key={tool.num}
                  className="flex-shrink-0 w-44 p-2 rounded border border-primary bg-primary/10 flex flex-col"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="default" className="w-8 justify-center text-xs">
                      T{tool.num}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium mt-1 truncate">{tool.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Ø{tool.diameter}mm • {tool.type}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {tool.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Available Section */}
          <div className="flex-shrink-0 flex flex-col h-full">
            <div className="text-[10px] text-muted-foreground font-medium mb-1 px-1">Available</div>
            <div className="flex-1 flex gap-2 border-l-2 border-muted pl-2">
              {MOCK_TOOLS.filter(t => !t.inUse).map((tool) => (
                <div 
                  key={tool.num}
                  className="flex-shrink-0 w-44 p-2 rounded border border-border bg-card flex flex-col"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-8 justify-center text-xs">
                      T{tool.num}
                    </Badge>
                  </div>
                  <div className="text-sm font-medium mt-1 truncate">{tool.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Ø{tool.diameter}mm • {tool.type}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                    {tool.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </OverlayScrollbarsComponent>
    </div>
  )
}
