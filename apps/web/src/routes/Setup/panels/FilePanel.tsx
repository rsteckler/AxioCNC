import React, { useCallback, useRef, useState } from 'react'
import { Upload, FileCode, Circle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { useGetWorkfilesQuery, useUploadWorkfileMutation, useLazyGetWorkfileContentQuery, useGetControllersQuery, useGetGcodeQuery } from '@/services/api'
import { socketService } from '@/services/socket'
import { useGcodeCommand } from '@/hooks'
import { calculateOutline } from '@/lib/gcodeOutline'
import { useNotifications } from '@/hooks/useNotifications'
import type { PanelProps } from '../types'

export function FilePanel({ isConnected, connectedPort: connectedPortProp, onFlashStatus, machinePosition, machineStatus }: PanelProps) {
  // Get connected port from controllers (may be null if not connected)
  const { data: controllers } = useGetControllersQuery()
  const connectedPort = connectedPortProp || controllers?.[0]?.port || null
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)
  const [isOutlining, setIsOutlining] = useState(false)
  const [outlineError, setOutlineError] = useState<string | null>(null)
  const outliningStartedRef = useRef(false) // Track if we've started outlining
  const previousMachineStatusRef = useRef<string | undefined>(undefined) // Track previous machine status
  const outlineFallbackTimeoutRef = useRef<NodeJS.Timeout | null>(null) // Fallback timeout for completion
  const [getWorkfileContent] = useLazyGetWorkfileContentQuery()
  const { sendGcode } = useGcodeCommand(connectedPort)
  const { showErrorNotification, showInfoNotification } = useNotifications()

  const { data: workfilesData, isLoading: isLoadingFiles } = useGetWorkfilesQuery()
  const [uploadWorkfile] = useUploadWorkfileMutation()

  const files = workfilesData?.files || []

  // Query currently loaded G-code on mount (to restore when navigating/reloading)
  const { data: gcodeData } = useGetGcodeQuery(connectedPort || '', {
    skip: !connectedPort,
  })

  // Restore loaded file name from API on mount
  // This ensures the FilePanel shows the correct loaded file state
  React.useEffect(() => {
    if (gcodeData) {
      // Backend is source of truth - update local state to match
      if (gcodeData.name) {
        setLoadedFileName(gcodeData.name)
      } else {
        // No file loaded on backend
        setLoadedFileName(null)
      }
    }
    // If query is skipped (no connectedPort), preserve existing state
  }, [gcodeData])

  // Handle file upload (from file picker or drag-drop)
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name) return

    setIsUploading(true)
    
    try {
      const reader = new FileReader()
      
      reader.onloadend = async (event) => {
        try {
          const result = event.target?.result as string
          if (!result) {
            throw new Error('Failed to read file')
          }

          await uploadWorkfile({ name: file.name, gcode: result }).unwrap()
        } catch (error) {
          console.error('Failed to upload file:', error)
          // TODO: Show error toast
        } finally {
          setIsUploading(false)
        }
      }

      reader.onerror = () => {
        console.error('FileReader error')
        setIsUploading(false)
      }

      reader.readAsText(file)
    } catch (error) {
      console.error('Failed to process file:', error)
      setIsUploading(false)
    }
  }, [uploadWorkfile])

  // Handle file picker click
  const handleFilePickerClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
    // Reset input so same file can be selected again
    e.target.value = ''
  }, [handleFileUpload])

  // Handle drag and drop
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  // Load file into controller
  const handleLoadFile = useCallback(async (filename: string) => {
    console.log('[FilePanel] handleLoadFile called:', filename, { isConnected, connectedPort })
    try {
      // Check if we have a connection
      if (!isConnected || !connectedPort) {
        // No connection - flash status to indicate connection required
        console.log('[FilePanel] Not connected, flashing status')
        onFlashStatus()
        return
      }

      console.log('[FilePanel] Fetching file content...')
      const result = await getWorkfileContent(filename).unwrap()
      console.log('[FilePanel] File content fetched, sending to backend:', { filename: result.filename, gcodeLength: result.gcode.length })
      
      // Send to controller via existing /api/gcode endpoint
      const token = localStorage.getItem('axiocnc-token')
      const response = await fetch('/api/gcode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          port: connectedPort,
          name: result.filename,
          gcode: result.gcode,
          context: {},
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.msg || 'Failed to load file')
      }

      console.log('[FilePanel] File sent to backend successfully, waiting for gcode:load event')
      setLoadedFileName(result.filename)
      
      // The gcode:load socket event will be emitted by the backend
      // which will trigger updates in other panels (like ToolsPanel)
    } catch (error) {
      console.error('[FilePanel] Failed to load file:', error)
      // TODO: Show error toast
    }
  }, [isConnected, connectedPort, getWorkfileContent, onFlashStatus])

  // Unload file from controller
  const handleUnload = useCallback(() => {
    console.log('[FilePanel] handleUnload called', { connectedPort, loadedFileName })
    setLoadedFileName(null)
    
    // If connected, send unload command to controller
    if (connectedPort) {
      console.log('[FilePanel] Sending gcode:unload command via socket')
      socketService.command(connectedPort, 'gcode:unload')
      console.log('[FilePanel] gcode:unload command emitted, waiting for gcode:unload event')
    } else {
      console.warn('[FilePanel] No connected port, cannot send unload command')
    }
  }, [connectedPort, loadedFileName])

  // Handle outline button click
  const handleOutline = useCallback(async () => {
    if (!isConnected || !connectedPort || !loadedFileName || !machinePosition) {
      if (!isConnected || !connectedPort) {
        onFlashStatus()
      } else {
        showErrorNotification('Outline Error', 'Machine position not available')
      }
      return
    }

    if (isOutlining) {
      return // Already running
    }

    setIsOutlining(true)
    setOutlineError(null)

    try {
      // Fetch G-code content
      const result = await getWorkfileContent(loadedFileName).unwrap()
      
      if (!result.gcode) {
        throw new Error('G-code content is empty')
      }

      // Calculate outline
      const outlineResult = calculateOutline(
        result.gcode,
        {
          x: machinePosition.x,
          y: machinePosition.y,
          z: machinePosition.z,
        },
        {
          concavity: 5, // Less detailed, smoother outline
          margin: 2, // 2mm margin
          closePath: true,
          returnToStart: true,
          minPointDistance: 5, // 5mm minimum distance between points
        }
      )

      if (!outlineResult) {
        throw new Error('Failed to calculate outline. Need at least 3 XY points in toolpath.')
      }

      if (outlineResult.commands.length === 0) {
        throw new Error('No outline commands generated')
      }

      console.log('[FilePanel] Outline calculated:', {
        hullPoints: outlineResult.hullPoints.length,
        commands: outlineResult.commands.length,
        bounds: outlineResult.bounds,
      })

      // Mark that we started outlining
      outliningStartedRef.current = true
      previousMachineStatusRef.current = machineStatus
      const totalCommands = outlineResult.commands.length
      const wasIdleAtStart = machineStatus !== 'running' && machineStatus !== 'hold'
      
      console.log('[FilePanel] Starting outline:', {
        totalCommands,
        wasIdleAtStart,
        machineStatus,
        hullPoints: outlineResult.hullPoints.length,
      })
      
      // Send commands sequentially with delays (similar to ZeroingWizard pattern)
      outlineResult.commands.forEach((cmd, index) => {
        setTimeout(() => {
          sendGcode(cmd)
        }, index * 300) // 300ms delay between commands
      })

      // Show start notification immediately
      showInfoNotification('Outline Started', `Tracing outline with ${outlineResult.hullPoints.length} points`)
      
      // Calculate when last command will be sent
      const lastCommandSendTime = (totalCommands - 1) * 300
      
      // If machine was idle at start, rapid moves might not trigger "running" state
      // In that case, wait for commands to be sent + execution time, then check if still idle
      if (wasIdleAtStart) {
        // Wait for all commands to be sent, then add execution time
        // Rapid moves are fast - estimate based on path length
        let totalDistance = 0
        for (let i = 0; i < outlineResult.hullPoints.length; i++) {
          const p1 = outlineResult.hullPoints[i]
          const p2 = outlineResult.hullPoints[(i + 1) % outlineResult.hullPoints.length]
          const dx = p2.x - p1.x
          const dy = p2.y - p1.y
          totalDistance += Math.sqrt(dx * dx + dy * dy)
        }
        // Estimate: rapid speed ~2000-5000 mm/min, use conservative 2000 mm/min = 33.3 mm/s
        const executionTime = (totalDistance / 2000) * 60 * 1000 // Convert to ms
        const fallbackTimeout = lastCommandSendTime + executionTime + 2000 // 2 second buffer
        
        console.log('[FilePanel] Setting fallback timeout (idle start):', {
          lastCommandSendTime,
          executionTime,
          totalDistance: totalDistance.toFixed(2),
          fallbackTimeout,
        })
        
        const fallbackTimeoutId = setTimeout(() => {
          console.log('[FilePanel] Fallback timeout fired (idle start), completing outline')
          if (outliningStartedRef.current) {
            setIsOutlining(false)
            outliningStartedRef.current = false
            showInfoNotification('Outline Complete', 'Outline tracing finished')
          }
          outlineFallbackTimeoutRef.current = null
        }, fallbackTimeout)
        
        outlineFallbackTimeoutRef.current = fallbackTimeoutId
      } else {
        // Machine was running - rely on status transition detection
        // But still set a long fallback timeout as safety net
        const fallbackTimeout = lastCommandSendTime + 30000 // 30 second safety net
        console.log('[FilePanel] Setting fallback timeout (running start):', fallbackTimeout, 'ms')
        const fallbackTimeoutId = setTimeout(() => {
          console.log('[FilePanel] Fallback timeout fired (running start), completing outline')
          if (outliningStartedRef.current) {
            setIsOutlining(false)
            outliningStartedRef.current = false
            showInfoNotification('Outline Complete', 'Outline tracing finished')
          }
          outlineFallbackTimeoutRef.current = null
        }, fallbackTimeout)
        
        outlineFallbackTimeoutRef.current = fallbackTimeoutId
      }

    } catch (error) {
      console.error('[FilePanel] Outline error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate outline'
      setOutlineError(errorMessage)
      showErrorNotification('Outline Error', errorMessage)
      setIsOutlining(false)
      outliningStartedRef.current = false
      // Clear fallback timeout on error
      if (outlineFallbackTimeoutRef.current) {
        clearTimeout(outlineFallbackTimeoutRef.current)
        outlineFallbackTimeoutRef.current = null
      }
    }
  }, [isConnected, connectedPort, loadedFileName, machinePosition, isOutlining, getWorkfileContent, sendGcode, onFlashStatus, showErrorNotification, showInfoNotification])

  // Monitor machine status to detect when outline is complete
  // Primary: Detect running -> idle transition
  // Fallback: Timeout (handled in handleOutline)
  React.useEffect(() => {
    if (!isOutlining || !outliningStartedRef.current) {
      // Update previous status even when not outlining
      previousMachineStatusRef.current = machineStatus
      return
    }

    const previousStatus = previousMachineStatusRef.current
    const currentStatus = machineStatus
    
    // Check if machine transitioned from 'running' to a non-running state
    // This indicates the outline commands have finished executing
    const wasRunning = previousStatus === 'running'
    const isNotRunning = currentStatus !== 'running' && currentStatus !== 'hold'
    
    if (wasRunning && isNotRunning) {
      // Machine transitioned from running to idle/other state - outline is complete
      // Clear fallback timeout since we detected completion via status
      if (outlineFallbackTimeoutRef.current) {
        clearTimeout(outlineFallbackTimeoutRef.current)
        outlineFallbackTimeoutRef.current = null
      }
      
      const timeoutId = setTimeout(() => {
        setIsOutlining(false)
        outliningStartedRef.current = false
        showInfoNotification('Outline Complete', 'Outline tracing finished')
      }, 500) // 500ms delay to ensure state is stable
      
      previousMachineStatusRef.current = currentStatus
      return () => clearTimeout(timeoutId)
    }
    
    // Update previous status
    previousMachineStatusRef.current = currentStatus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [machineStatus, isOutlining, showInfoNotification])

  // Listen for gcode:load and gcode:unload events to track loaded file
  React.useEffect(() => {
    // gcode:load emits (name, gcode, context) as separate arguments
    const handleGcodeLoad = (name: string) => {
      console.log('[FilePanel] gcode:load event received:', name)
      if (name) {
        setLoadedFileName(name)
      }
    }

    const handleGcodeUnload = () => {
      setLoadedFileName(null)
    }

    socketService.on('gcode:load', handleGcodeLoad)
    socketService.on('gcode:unload', handleGcodeUnload)

    return () => {
      socketService.off('gcode:load', handleGcodeLoad)
      socketService.off('gcode:unload', handleGcodeUnload)
    }
  }, [])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (mtime: number) => {
    return new Date(mtime).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="p-3 space-y-3 h-full flex flex-col">
      {/* Upload zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
          ${isDragging 
            ? 'border-primary bg-primary/10' 
            : 'border-border hover:border-primary'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onClick={handleFilePickerClick}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".nc,.gcode,.cnc,.tap"
          className="hidden"
          onChange={handleFileInputChange}
          disabled={isUploading}
        />
        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 mx-auto text-primary mb-2 animate-spin" />
            <div className="text-sm text-muted-foreground">Uploading...</div>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground">
              Drop G-code file or click to browse
            </div>
          </>
        )}
      </div>

      {/* Loaded file card */}
      <div className="bg-muted/30 rounded border border-border p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground mb-1">
          Loaded File
        </div>
        {loadedFileName ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm font-medium truncate">{loadedFileName}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 flex-shrink-0"
                onClick={(e) => {
                  e.stopPropagation()
                  handleUnload()
                }}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            {/* Actions - only show when connected */}
            {connectedPort && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  size="sm" 
                  disabled={isOutlining || !loadedFileName || !machinePosition}
                  onClick={handleOutline}
                >
                  {isOutlining ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Tracing...
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4 mr-1" /> Outline
                    </>
                  )}
                </Button>
              </div>
            )}
            {/* Error message */}
            {outlineError && (
              <div className="text-xs text-destructive mt-1">
                {outlineError}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-1">
            No file loaded
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
          Files ({files.length})
        </div>
        <OverlayScrollbarsComponent 
          className="max-h-[400px]"
          options={{ 
            scrollbars: { autoHide: 'scroll', autoHideDelay: 400 },
            overflow: { x: 'hidden', y: 'scroll' }
          }}
        >
          <div className="space-y-1 pr-2">
            {isLoadingFiles ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
                Loading files...
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No files uploaded yet
              </div>
            ) : (
              files.map((file) => {
                const isLoaded = loadedFileName === file.filename
                return (
                  <div
                    key={file.filename}
                    className={`
                      rounded border p-2 text-sm cursor-pointer transition-colors
                      ${isLoaded 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-border-foreground/20'
                      }
                    `}
                    onClick={() => handleLoadFile(file.filename)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <FileCode className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-medium truncate">{file.filename}</span>
                          {isLoaded && (
                            <span className="text-xs text-primary font-medium">Loaded</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>
                            {file.lines.toLocaleString()} lines
                            {file.tools.length > 0 && (
                              <> • Tools: T{file.tools.join(', T')}</>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.mtime)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </OverlayScrollbarsComponent>
      </div>
    </div>
  )
}
