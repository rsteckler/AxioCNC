import React from 'react'
import { Play, Pause } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface JobStatusBarProps {
  onStart?: () => void
  onPause?: () => void
}

export function JobStatusBar({ onStart, onPause }: JobStatusBarProps) {
  return (
    <>
      <div className="flex-1" />
      
      <div className="w-px h-6 bg-border mx-2" />
      
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground mr-2">Job:</span>
        {onStart && (
          <Button variant="outline" size="sm" onClick={onStart}>
            <Play className="w-4 h-4 mr-1" /> Start
          </Button>
        )}
        {onPause && (
          <Button variant="outline" size="sm" onClick={onPause}>
            <Pause className="w-4 h-4 mr-1" /> Pause
          </Button>
        )}
      </div>
    </>
  )
}
