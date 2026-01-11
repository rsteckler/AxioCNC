import React, { useCallback, useRef, useState, useEffect } from 'react'
import { Upload, FileCode, Circle, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { useGetWorkfilesQuery, useUploadWorkfileMutation, useGetWorkfileContentQuery, useLazyGetWorkfileContentQuery, useGetControllersQuery } from '@/services/api'
import { socketService } from '@/services/socket'
import type { PanelProps } from '../types'

export function FilePanel({ connectedPort: connectedPortProp, onFlashStatus }: PanelProps) {
  // Get connected port from controllers (may be null if not connected)
  const { data: controllers } = useGetControllersQuery()
  const connectedPort = connectedPortProp || controllers?.[0]?.port || null
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null)
  const [getWorkfileContent] = useLazyGetWorkfileContentQuery()

  const { data: workfilesData, isLoading: isLoadingFiles } = useGetWorkfilesQuery()
  const [uploadWorkfile] = useUploadWorkfileMutation()

  const files = workfilesData?.files || []

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
    try {
      const result = await getWorkfileContent(filename).unwrap()
      
      // Check if we have a connection
      if (!connectedPort) {
        // No connection - flash status to indicate connection required
        onFlashStatus()
        return
      }
      
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

      setLoadedFileName(result.filename)
      
      // The gcode:load socket event will be emitted by the backend
      // which will trigger updates in other panels (like ToolsPanel)
    } catch (error) {
      console.error('Failed to load file:', error)
      // TODO: Show error toast
    }
  }, [connectedPort, getWorkfileContent, onFlashStatus])

  // Unload file from controller
  const handleUnload = useCallback(() => {
    setLoadedFileName(null)
    
    // If connected, send unload command to controller
    if (connectedPort) {
      const socket = socketService.getSocket()
      if (socket) {
        socket.emit('command', connectedPort, 'gcode:unload')
      }
    }
  }, [connectedPort])

  // Listen for gcode:load and gcode:unload events to track loaded file
  React.useEffect(() => {
    // gcode:load emits (name, gcode, context) as separate arguments
    const handleGcodeLoad = (name: string) => {
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

      {/* Loaded file info and actions */}
      {loadedFileName && (
        <div className="bg-muted/30 rounded border border-border p-3 space-y-2">
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
              <Button variant="outline" className="flex-1" size="sm" disabled>
                <Circle className="w-4 h-4 mr-1" /> Outline
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
