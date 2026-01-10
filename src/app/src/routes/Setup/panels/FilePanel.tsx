import React from 'react'
import { Upload, FileCode, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PanelProps } from '../types'

const MOCK_FILE = {
  name: 'guitar_body_roughing.nc',
  lines: 24853,
  tools: [1, 2],
  bounds: { x: [0, 450], y: [0, 180], z: [-25, 5] },
  estimatedTime: 47 * 60 + 23, // 47 min 23 sec in seconds
}

export function FilePanel(_props: PanelProps) {
  return (
    <div className="p-3 space-y-3">
        {/* Upload zone */}
        <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary transition-colors cursor-pointer">
          <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <div className="text-sm text-muted-foreground">
            Drop G-code file or click to browse
          </div>
        </div>
        
        {/* Loaded file info */}
        <div className="bg-muted/30 rounded border border-border p-3 space-y-2">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium truncate flex-1">{MOCK_FILE.name}</span>
          </div>
          <div className="text-xs text-muted-foreground flex justify-between">
            <span>{MOCK_FILE.lines.toLocaleString()} lines • Tools: T{MOCK_FILE.tools.join(', T')}</span>
            <span className="font-mono">
              ~{Math.floor(MOCK_FILE.estimatedTime / 60)}m {MOCK_FILE.estimatedTime % 60}s
            </span>
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" size="sm">
            <Circle className="w-4 h-4 mr-1" /> Outline
          </Button>
        </div>
    </div>
  )
}
