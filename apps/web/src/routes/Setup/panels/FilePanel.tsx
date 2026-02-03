import React, { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, FileCode, Circle, Loader2, X, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { useGetWorkfilesQuery, useUploadWorkfileMutation, useLazyGetWorkfileContentQuery, useGetControllersQuery, useGetGcodeQuery } from '@/services/api'
import { socketService } from '@/services/socket'
import { runGcodeBatch } from '@/utils/runGcodeBatch'
import { calculateOutline } from '@/lib/gcodeOutline'
import { useNotifications } from '@/hooks/useNotifications'
import { ConfirmationDialog } from '@/components/ConfirmationDialog'
import type { PanelProps } from '../types'
import { MachineActionButton } from '@/components/MachineActionButton'
import { ActionRequirements } from '@/utils/machineState'

export interface FilePanelProps extends PanelProps {
  onSetUpJob?: () => void
}

export function FilePanel({ isConnected, connectedPort: connectedPortProp, onFlashStatus, machinePosition, machineStatus, onSetUpJob }: FilePanelProps) {
  const { t } = useTranslation()
  // Get connected port from controllers (may be null if not connected)
  const { data: controllers } = useGetControllersQuery()
  const connectedPort = connectedPortProp || controllers?.[0]?.port || null
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)
  const [isOutlining, setIsOutlining] = useState(false)
  const [outlineError, setOutlineError] = useState<string | null>(null)
  const [showOutlineConfirm, setShowOutlineConfirm] = useState(false)
  const outliningStartedRef = useRef(false)
  const [getWorkfileContent] = useLazyGetWorkfileContentQuery()
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
            throw new Error(t('Failed to read file'))
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
        throw new Error(error.msg || t('Failed to load file'))
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

  // Perform the actual outline (called after confirmation)
  const performOutline = useCallback(async () => {
    if (!isConnected || !connectedPort || !loadedFileName || !machinePosition) {
      if (!isConnected || !connectedPort) {
        onFlashStatus()
      } else {
        showErrorNotification(t('Outline Error'), t('Machine position not available'))
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
        throw new Error(t('G-code content is empty'))
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
        throw new Error(t('Failed to calculate outline. Need at least 3 XY points in toolpath.'))
      }

      if (outlineResult.commands.length === 0) {
        throw new Error(t('No outline commands generated'))
      }

      console.log('[FilePanel] Outline calculated:', {
        hullPoints: outlineResult.hullPoints.length,
        commands: outlineResult.commands.length,
        bounds: outlineResult.bounds,
      })

      outliningStartedRef.current = true
      const outlineGcode = outlineResult.commands.join('\n')

      showInfoNotification(t('Outline Started'), t('Tracing outline with {{count}} points', { count: outlineResult.hullPoints.length }))

      runGcodeBatch({ gcode: outlineGcode, port: connectedPort, waitForIdle: true })
        .then(() => {
          setIsOutlining(false)
          outliningStartedRef.current = false
          showInfoNotification(t('Outline Complete'), t('Outline tracing finished'))
        })
        .catch((err) => {
          setIsOutlining(false)
          outliningStartedRef.current = false
          const errorMessage = err?.message ?? t('Outline tracing failed')
          setOutlineError(errorMessage)
          showErrorNotification(t('Outline Error'), errorMessage)
        })
    } catch (error) {
      console.error('[FilePanel] Outline error:', error)
      const errorMessage = error instanceof Error ? error.message : t('Failed to generate outline')
      setOutlineError(errorMessage)
      showErrorNotification(t('Outline Error'), errorMessage)
      setIsOutlining(false)
      outliningStartedRef.current = false
    }
  }, [isConnected, connectedPort, loadedFileName, machinePosition, isOutlining, getWorkfileContent, onFlashStatus, showErrorNotification, showInfoNotification, t])

  // Handle outline button click - show confirmation dialog
  const handleOutline = useCallback(() => {
    if (!isConnected || !connectedPort || !loadedFileName || !machinePosition) {
      if (!isConnected || !connectedPort) {
        onFlashStatus()
      } else {
        showErrorNotification(t('Outline Error'), t('Machine position not available'))
      }
      return
    }

    if (isOutlining) {
      return // Already running
    }

    setShowOutlineConfirm(true)
  }, [isConnected, connectedPort, loadedFileName, machinePosition, isOutlining, onFlashStatus, showErrorNotification])

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
            <div className="text-sm text-muted-foreground">{t('Uploading...')}</div>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground">
              {t('Drop G-code file or click to browse')}
            </div>
          </>
        )}
      </div>

      {/* Loaded file card */}
      <div className="bg-muted/30 rounded border border-border p-3 space-y-2">
        <div className="text-xs font-medium text-muted-foreground mb-1">
          {t('Loaded File')}
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
              <div className="flex flex-col gap-2">
                {onSetUpJob && (
                  <MachineActionButton
                    isConnected={isConnected}
                    connectedPort={connectedPort}
                    machineStatus={machineStatus ?? 'not_connected'}
                    onFlashStatus={onFlashStatus}
                    onAction={onSetUpJob}
                    requirements={ActionRequirements.standard}
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <ClipboardList className="w-4 h-4 mr-2" />
                    {t('Set up job')}
                  </MachineActionButton>
                )}
                <Button 
                  variant="outline" 
                  className="w-full" 
                  size="sm" 
                  disabled={isOutlining || !loadedFileName || !machinePosition}
                  onClick={handleOutline}
                >
                  {isOutlining ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" /> {t('Tracing...')}
                    </>
                  ) : (
                    <>
                      <Circle className="w-4 h-4 mr-1" /> {t('Outline')}
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
            {t('No file loaded')}
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
          {t('Files ({{count}})', { count: files.length })}
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
                {t('Loading files...')}
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {t('No files uploaded yet')}
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
                            <span className="text-xs text-primary font-medium">{t('Loaded')}</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>
                            {t('{{count}} lines', { count: file.lines })}
                            {file.tools.length > 0 && (
                              <> • {t('Tools:')} T{file.tools.join(', T')}</>
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

      {/* Outline confirmation dialog */}
      <ConfirmationDialog
        open={showOutlineConfirm}
        onOpenChange={setShowOutlineConfirm}
        title={t('Confirm Outline Tracing')}
        description={
          <>
            <p className="mb-2">
              {t('The tool will trace the outline of the loaded G-code at Z=-5 (machine coordinates).')}
            </p>
            <p className="font-medium">
              {t('Please ensure nothing is in the way of the tool path. The spindle will remain off during the outline.')}
            </p>
          </>
        }
        confirmLabel={t('Start Outline')}
        cancelLabel={t('Cancel')}
        onConfirm={performOutline}
      />
    </div>
  )
}
