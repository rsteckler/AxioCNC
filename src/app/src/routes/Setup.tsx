import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { socketService } from '@/services/socket'
import { useGetSettingsQuery, useGetMacrosQuery, useGetControllersQuery, useLazyGetMachineStatusQuery, useSetExtensionsMutation, useDeleteExtensionsMutation, type MachineStatus as MachineStatusType } from '@/services/api'
import type { ZeroingMethod } from '../../../shared/schemas/settings'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { 
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Home, Play, Pause, Square, Upload, Unlock, 
  Crosshair, RotateCcw, RotateCw, Maximize2, GripVertical,
  Zap, Terminal, Wrench, Target, FileCode, Library,
  Circle, Move, Pencil, Navigation, Bell, AlertCircle, X,
  ArrowDown, HelpCircle, Check, ChevronRight as ChevronRightIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MachineActionButton } from '@/components/MachineActionButton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { MachineActionWrapper } from '@/components/MachineActionWrapper'
import { ActionRequirements, canPerformAction } from '@/utils/machineState'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// ============================================================================
// MOCKUP DATA
// ============================================================================

const MOCK_POSITION = { x: 125.450, y: 89.230, z: 15.000 }
const MOCK_WORK_POS = { x: 0.000, y: 0.000, z: 0.000 }

const MOCK_WORKSPACES = [
  { id: 'G54', name: 'Main' },
  { id: 'G55', name: 'Fixture 2' },
  { id: 'G56', name: 'G56' },
  { id: 'G57', name: 'G57' },
  { id: 'G58', name: 'G58' },
  { id: 'G59', name: 'G59' },
]

const MOCK_MACROS = [
  { id: 1, name: 'Home All', icon: Home },
  { id: 2, name: 'Probe Z', icon: Target },
  { id: 3, name: 'Tool Change', icon: Wrench },
  { id: 4, name: 'Park', icon: Square },
]


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

const MOCK_FILE = {
  name: 'guitar_body_roughing.nc',
  lines: 24853,
  tools: [1, 2],
  bounds: { x: [0, 450], y: [0, 180], z: [-25, 5] },
  estimatedTime: 47 * 60 + 23, // 47 min 23 sec in seconds
}

// ============================================================================
// 3D VISUALIZER SCENE
// ============================================================================

function ToolIndicator({ position }: { position: { x: number; y: number; z: number } }) {
  return (
    <group position={[position.x / 10, position.z / 10, -position.y / 10]}>
      {/* Tool cone */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.3, 1.5, 16]} />
        <meshStandardMaterial color="#f97316" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Tool holder */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.4, 0.4, 1, 16]} />
        <meshStandardMaterial color="#71717a" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Glow ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.8, 0]}>
        <ringGeometry args={[0.4, 0.6, 32]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

function WorkZeroMarker() {
  const length = 3
  return (
    <group>
      {/* X axis - Red */}
      <mesh position={[length / 2, 0, 0]}>
        <boxGeometry args={[length, 0.1, 0.1]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      {/* Y axis - Green */}
      <mesh position={[0, 0, -length / 2]}>
        <boxGeometry args={[0.1, 0.1, length]} />
        <meshStandardMaterial color="#22c55e" />
      </mesh>
      {/* Z axis - Blue */}
      <mesh position={[0, length / 2, 0]}>
        <boxGeometry args={[0.1, length, 0.1]} />
        <meshStandardMaterial color="#3b82f6" />
      </mesh>
      {/* Origin sphere */}
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function VisualizerScene() {
  return (
    <Canvas>
      <PerspectiveCamera makeDefault position={[40, 30, 40]} fov={50} />
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        minDistance={10}
        maxDistance={100}
      />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      
      {/* Work area grid */}
      <Grid
        args={[50, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#404040"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#606060"
        fadeDistance={100}
        position={[25, 0, -10]}
      />
      
      {/* Work zero marker */}
      <WorkZeroMarker />
      
      {/* Tool position */}
      <ToolIndicator position={MOCK_POSITION} />
      
      {/* Mock toolpath - simple rectangle for demo */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={5}
            array={new Float32Array([
              0, 0, 0,
              45, 0, 0,
              45, 0, -18,
              0, 0, -18,
              0, 0, 0,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#f97316" linewidth={2} />
      </line>
    </Canvas>
  )
}

// ============================================================================
// PANEL COMPONENTS
// ============================================================================

function PanelHeader({ 
  title, 
  icon: Icon,
  isCollapsed,
  onToggle
}: { 
  title: string
  icon: React.ElementType
  isCollapsed?: boolean
  onToggle?: () => void
}) {
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

function DROPanel({ isConnected, connectedPort, machineStatus, onFlashStatus, machinePosition = { x: 0, y: 0, z: 0 }, workPosition = { x: 0, y: 0, z: 0 }, currentWCS = 'G54' }: PanelProps) {
  const [workspaces, setWorkspaces] = useState(MOCK_WORKSPACES)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingName, setEditingName] = useState('')
  
  // Extensions API for clearing bitsetter reference
  const [deleteExtensions] = useDeleteExtensionsMutation()
  
  // Use currentWCS from props, fallback to G54
  const workspace = currentWCS || 'G54'
  const currentWorkspace = workspaces.find(ws => ws.id === workspace)
  
  // Get WCS number for G10 commands (G54=1, G55=2, etc.)
  const getWCSPNumber = (wcs: string): number => {
    const map: Record<string, number> = {
      'G54': 1, 'G55': 2, 'G56': 3, 'G57': 4, 'G58': 5, 'G59': 6
    }
    return map[wcs] || 1
  }
  
  // Helper to clear bitsetter reference for current WCS
  const clearBitsetterReference = useCallback(async () => {
    try {
      const wcsKey = `bitsetter.toolReference.${workspace}`
      await deleteExtensions({ key: wcsKey }).unwrap()
    } catch (err) {
      console.error('Failed to clear bitsetter reference:', err)
      // Don't block zeroing if clearing reference fails
    }
  }, [workspace, deleteExtensions])
  
  // Handle zero out work offset for a single axis
  const handleZeroAxis = useCallback(async (axis: 'X' | 'Y' | 'Z') => {
    if (!connectedPort) return
    
    // Clear bitsetter reference if Z zero is being set (bitsetter reference becomes invalid)
    if (axis === 'Z') {
      await clearBitsetterReference()
    }
    
    const p = getWCSPNumber(workspace)
    const gcode = `G10 L20 P${p} ${axis}0`
    socketService.getSocket()?.emit('command', connectedPort, 'gcode', gcode)
  }, [connectedPort, workspace, getWCSPNumber, clearBitsetterReference])
  
  // Handle zero out all work offsets
  const handleZeroAll = useCallback(async () => {
    if (!connectedPort) return
    
    // Clear bitsetter reference when zeroing all axes (includes Z)
    await clearBitsetterReference()
    
    const p = getWCSPNumber(workspace)
    const gcode = `G10 L20 P${p} X0 Y0 Z0`
    socketService.getSocket()?.emit('command', connectedPort, 'gcode', gcode)
  }, [connectedPort, workspace, getWCSPNumber, clearBitsetterReference])
  
  // Handle go to work zero for a single axis
  const handleGoToZeroAxis = useCallback((axis: 'X' | 'Y' | 'Z') => {
    if (!connectedPort) return
    const gcode = `G0 ${axis}0`
    socketService.getSocket()?.emit('command', connectedPort, 'gcode', gcode)
  }, [connectedPort])
  
  // Handle go to work zero for all axes
  const handleGoToZeroAll = useCallback(() => {
    if (!connectedPort) return
    const gcode = 'G0 X0 Y0 Z0'
    socketService.getSocket()?.emit('command', connectedPort, 'gcode', gcode)
  }, [connectedPort])
  
  const handleEditClick = () => {
    setEditingName(currentWorkspace?.name || '')
    setEditDialogOpen(true)
  }
  
  const handleSaveName = () => {
    setWorkspaces(workspaces.map(ws => 
      ws.id === workspace ? { ...ws, name: editingName } : ws
    ))
    setEditDialogOpen(false)
  }
  
  const axes = [
    { axis: 'X' as const, color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', mpos: machinePosition.x, wpos: workPosition.x },
    { axis: 'Y' as const, color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', mpos: machinePosition.y, wpos: workPosition.y },
    { axis: 'Z' as const, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', mpos: machinePosition.z, wpos: workPosition.z },
  ]

  return (
    <div className="p-3 space-y-2">
        {/* Workspace selector dropdown */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Workspace:</span>
          <Select value={workspace} onValueChange={() => {}} disabled>
            <SelectTrigger className="h-8 flex-1">
              <SelectValue>
                <span className="font-mono text-muted-foreground mr-2">{workspace}</span>
                <span>{currentWorkspace?.name}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  <span className="font-mono text-muted-foreground mr-2">{ws.id}</span>
                  <span>{ws.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleEditClick}>
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </div>
        
        {/* Edit workspace name dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Rename Workspace {workspace}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="Workspace name"
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveName}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Column headers */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <div className="w-5" /> {/* Axis label spacer */}
          <div className="w-8 text-center">Zero</div>
          <div className="flex-1 text-center">Workspace</div>
          <div className="w-20 text-center">Machine</div>
          <div className="w-8 text-center">Go</div>
        </div>
        
        {/* Axis readouts - 4 column layout */}
        {axes.map(({ axis, color, bgColor, borderColor, mpos, wpos }) => (
          <div key={axis} className="flex items-center gap-1.5">
            {/* Axis label */}
            <span className={`text-sm font-bold w-5 ${color}`}>{axis}</span>
            
            {/* Set Zero button - icon only */}
            <MachineActionButton
              isConnected={isConnected}
              connectedPort={connectedPort}
              machineStatus={machineStatus}
              onFlashStatus={onFlashStatus}
              onAction={() => handleZeroAxis(axis)}
              requirements={ActionRequirements.standard}
              variant="outline"
              size="sm"
              className="w-8 h-8 p-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </MachineActionButton>
            
            {/* Work position - gets the flex space */}
            <div className={`flex-1 ${bgColor} ${borderColor} border rounded px-2 py-1.5 font-mono text-right text-base font-medium`}>
              {wpos.toFixed(3)}
            </div>
            
            {/* Machine position - fixed width, gray */}
            <div className="w-20 bg-muted/30 border border-border rounded px-2 py-1.5 font-mono text-right text-sm text-muted-foreground">
              {mpos.toFixed(2)}
            </div>
            
            {/* Go to Zero button - icon only */}
            <MachineActionButton
              isConnected={isConnected}
              connectedPort={connectedPort}
              machineStatus={machineStatus}
              onFlashStatus={onFlashStatus}
              onAction={() => handleGoToZeroAxis(axis)}
              requirements={ActionRequirements.standard}
              variant="secondary"
              size="sm"
              className="w-8 h-8 p-0"
            >
              <Home className="w-3.5 h-3.5" />
            </MachineActionButton>
          </div>
        ))}
        
        {/* All axes action buttons */}
        <div className="flex gap-2 pt-2 border-t border-border mt-2">
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatus}
            onAction={handleZeroAll}
            requirements={ActionRequirements.standard}
            variant="outline"
            size="sm"
            className="flex-1 w-full h-8"
          >
            <RotateCcw className="w-3 h-3 mr-1" /> Zero All
          </MachineActionButton>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatus}
            onAction={handleGoToZeroAll}
            requirements={ActionRequirements.standard}
            variant="secondary"
            size="sm"
            className="flex-1 w-full h-8"
          >
            <Home className="w-3 h-3 mr-1" /> Go to Zero
          </MachineActionButton>
        </div>
    </div>
  )
}

function JogPanel({ isConnected, connectedPort, machineStatus, onFlashStatus }: PanelProps) {
  const [mode, setMode] = useState<'steps' | 'analog'>('steps')
  const [distanceIndex, setDistanceIndex] = useState(3) // Default to 10mm
  const distances = [0.01, 0.1, 1, 10, 100, 500, 'Continuous'] as const
  const currentDistance = distances[distanceIndex]
  
  // Handle jog command
  const handleJog = useCallback((x: number, y: number, z: number) => {
    if (!connectedPort) return
    
    // For "Continuous", we'll use a very large distance (999999)
    // In practice, continuous jogging would need different handling
    const distance = currentDistance === 'Continuous' ? 999999 : currentDistance
    
    // Build the movement command
    const parts: string[] = []
    if (x !== 0) parts.push(`X${x * distance}`)
    if (y !== 0) parts.push(`Y${y * distance}`)
    if (z !== 0) parts.push(`Z${z * distance}`)
    
    if (parts.length === 0) return
    
    const command = parts.join(' ')
    
    // Send jog commands: G91 (relative), G0 (rapid move), G90 (absolute)
    const socket = socketService.getSocket()
    if (socket) {
      socket.emit('command', connectedPort, 'gcode', 'G91') // relative mode
      socket.emit('command', connectedPort, 'gcode', `G0 ${command}`) // rapid move
      socket.emit('command', connectedPort, 'gcode', 'G90') // absolute mode
    }
  }, [connectedPort, currentDistance])
  
  // Handle go to zero for XY axes
  const handleGoToZeroXY = useCallback(() => {
    if (!connectedPort) return
    const socket = socketService.getSocket()
    if (socket) {
      socket.emit('command', connectedPort, 'gcode', 'G0 X0 Y0')
    }
  }, [connectedPort])
  
  // Handle go to zero for Z axis
  const handleGoToZeroZ = useCallback(() => {
    if (!connectedPort) return
    const socket = socketService.getSocket()
    if (socket) {
      socket.emit('command', connectedPort, 'gcode', 'G0 Z0')
    }
  }, [connectedPort])
  
  // Analog joystick state
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 })
  const [zLevel, setZLevel] = useState(50) // 0-100, 50 = center/stopped

  // Diagonal arrow SVGs
  const DiagUL = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 17L7 7M7 7v8M7 7h8" />
    </svg>
  )
  const DiagUR = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 17L17 7M17 7v8M17 7H9" />
    </svg>
  )
  const DiagLL = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 7L7 17M7 17v-8M7 17h8" />
    </svg>
  )
  const DiagLR = () => (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 7L17 17M17 17v-8M17 17H9" />
    </svg>
  )
  
  // Handle joystick drag
  const handleJoystickMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const x = ((e.clientX - rect.left) - centerX) / centerX
    const y = ((e.clientY - rect.top) - centerY) / centerY
    // Clamp to circle
    const dist = Math.sqrt(x * x + y * y)
    if (dist > 1) {
      setJoystickPos({ x: x / dist, y: y / dist })
    } else {
      setJoystickPos({ x, y })
    }
  }

  return (
    <div className="p-3 flex flex-col gap-3">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <Button 
          variant={mode === 'steps' ? 'default' : 'ghost'} 
          size="sm" 
          className="flex-1 h-7 text-xs"
          onClick={() => setMode('steps')}
        >
          Steps
        </Button>
        <Button 
          variant={mode === 'analog' ? 'default' : 'ghost'} 
          size="sm" 
          className="flex-1 h-7 text-xs"
          onClick={() => setMode('analog')}
        >
          Analog
        </Button>
      </div>
      
      {mode === 'steps' ? (
        <>
          {/* XY and Z Controls side by side */}
          <div className="flex items-center justify-center gap-24">
            {/* XY Pad - 3x3 with diagonals */}
            <div className="grid grid-cols-3 gap-1" style={{ width: '140px' }}>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(-1, 1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <DiagUL />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(0, 1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronUp className="w-5 h-5" />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(1, 1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <DiagUR />
              </MachineActionButton>
              
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(-1, 0, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={handleGoToZeroXY}
                requirements={ActionRequirements.jog}
                variant="outline"
                className="aspect-square p-0 text-xs font-bold"
                title="Go to XY zero"
              >
                XY 0
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(1, 0, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronRight className="w-5 h-5" />
              </MachineActionButton>
              
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(-1, -1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <DiagLL />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(0, -1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronDown className="w-5 h-5" />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(1, -1, 0)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <DiagLR />
              </MachineActionButton>
            </div>
            
            {/* Z Controls - vertically stacked */}
            <div className="flex flex-col gap-1" style={{ width: '56px' }}>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(0, 0, 1)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronUp className="w-5 h-5 text-blue-500" />
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={handleGoToZeroZ}
                requirements={ActionRequirements.jog}
                variant="outline"
                className="aspect-square p-0 text-xs font-bold text-blue-500"
                title="Go to Z zero"
              >
                Z 0
              </MachineActionButton>
              <MachineActionButton
                isConnected={isConnected}
                connectedPort={connectedPort}
                machineStatus={machineStatus}
                onFlashStatus={onFlashStatus}
                onAction={() => handleJog(0, 0, -1)}
                requirements={ActionRequirements.jog}
                variant="secondary"
                className="aspect-square p-0"
              >
                <ChevronDown className="w-5 h-5 text-blue-500" />
              </MachineActionButton>
            </div>
          </div>
          
          {/* Distance selector */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Distance</span>
              <span className="font-mono font-medium">
                {currentDistance === 'Continuous' ? 'Continuous' : `${currentDistance} mm`}
              </span>
            </div>
            <MachineActionWrapper
              isDisabled={!canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)}
              onFlashStatus={onFlashStatus}
            >
              <Slider 
                value={[distanceIndex]} 
                onValueChange={(v) => setDistanceIndex(v[0])}
                max={distances.length - 1} 
                step={1}
                disabled={!canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)}
              />
            </MachineActionWrapper>
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>0.01</span>
              <span>0.1</span>
              <span>1</span>
              <span>10</span>
              <span>100</span>
              <span>500</span>
              <span>∞</span>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Analog mode */}
          <div className="flex items-center justify-center gap-12">
            {/* XY Joystick */}
            <div 
              className="relative w-36 h-36 rounded-full bg-muted border-2 border-border cursor-crosshair select-none"
              onMouseMove={(e) => {
                const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
                if (!canJog) {
                  return // Don't flash on hover, just prevent movement
                }
                if (e.buttons === 1) {
                  handleJoystickMove(e)
                }
              }}
              onMouseDown={(e) => {
                const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
                if (!canJog) {
                  e.preventDefault()
                  e.stopPropagation()
                  onFlashStatus()
                  return
                }
                handleJoystickMove(e)
              }}
              onMouseUp={() => setJoystickPos({ x: 0, y: 0 })}
              onMouseLeave={() => setJoystickPos({ x: 0, y: 0 })}
            >
              {/* Crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute w-full h-px bg-border" />
                <div className="absolute h-full w-px bg-border" />
              </div>
              {/* Axis labels */}
              <span className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-green-500 font-bold">Y+</span>
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-green-500 font-bold">Y-</span>
              <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-red-500 font-bold">X-</span>
              <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-red-500 font-bold">X+</span>
              {/* Joystick thumb */}
              <div 
                className="absolute w-8 h-8 rounded-full bg-primary shadow-lg border-2 border-primary-foreground transition-transform"
                style={{
                  left: `calc(50% + ${joystickPos.x * 50}% - 16px)`,
                  top: `calc(50% + ${joystickPos.y * 50}% - 16px)`,
                }}
              />
            </div>
            
            {/* Z Lever */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-[10px] text-blue-500 font-bold">Z+</span>
              <div 
                className="relative h-32 w-10 rounded-full bg-muted border-2 border-border cursor-ns-resize select-none"
                onMouseMove={(e) => {
                  const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
                  if (!canJog) {
                    return // Don't flash on hover, just prevent movement
                  }
                  if (e.buttons === 1) {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const y = (e.clientY - rect.top) / rect.height
                    setZLevel(Math.max(0, Math.min(100, (1 - y) * 100)))
                  }
                }}
                onMouseDown={(e) => {
                  const canJog = canPerformAction(isConnected, connectedPort, machineStatus, false, ActionRequirements.jog)
                  if (!canJog) {
                    e.preventDefault()
                    e.stopPropagation()
                    onFlashStatus()
                    return
                  }
                  const rect = e.currentTarget.getBoundingClientRect()
                  const y = (e.clientY - rect.top) / rect.height
                  setZLevel(Math.max(0, Math.min(100, (1 - y) * 100)))
                }}
                onMouseUp={() => setZLevel(50)}
                onMouseLeave={() => setZLevel(50)}
              >
                {/* Center line */}
                <div className="absolute top-1/2 left-2 right-2 h-px bg-border" />
                {/* Visual thumb */}
                <div 
                  className="absolute left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-blue-500 shadow-lg border-2 border-white pointer-events-none"
                  style={{ top: `calc(${100 - zLevel}% - 14px)` }}
                />
              </div>
              <span className="text-[10px] text-blue-500 font-bold">Z-</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Console line interface
interface ConsoleLine {
  id: string
  type: 'cmd' | 'ok' | 'error' | 'info' | 'alarm' | 'status'
  timestamp: Date
  message: string
  raw?: string
}

// Parse console messages from backend
function parseConsoleMessage(
  message: string,
  direction: 'read' | 'write'
): ConsoleLine {
  const trimmed = message.trim()
  const timestamp = new Date()
  const id = `${timestamp.getTime()}-${Math.random()}`

  // Commands sent TO Grbl
  if (direction === 'write') {
    // Check for reset character (Ctrl+X = \x18 = \u0018)
    if (message === '\x18' || message === '\u0018' || trimmed === '\x18' || trimmed === '\u0018') {
      return {
        id,
        type: 'cmd',
        timestamp,
        message: 'Reset',
        raw: message
      }
    }
    
    return {
      id,
      type: 'cmd',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Messages FROM Grbl
  // Status reports: <Idle,MPos:...>
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return {
      id,
      type: 'status',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Errors: error:5 or error:5 (message)
  if (trimmed.startsWith('error:')) {
    return {
      id,
      type: 'error',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Alarms: ALARM:1 or ALARM:1 (message)
  if (trimmed.startsWith('ALARM:')) {
    return {
      id,
      type: 'alarm',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // OK responses
  if (trimmed === 'ok') {
    return {
      id,
      type: 'ok',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Settings: $0=10
  if (trimmed.match(/^\$\d+=/)) {
    return {
      id,
      type: 'info',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Parser state: [G0 G54 G17...]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return {
      id,
      type: 'info',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // G-code lines: > G0 X0 Y0 (ln=123)
  if (trimmed.startsWith('> ')) {
    return {
      id,
      type: 'cmd',
      timestamp,
      message: trimmed,
      raw: trimmed
    }
  }

  // Default: info
  return {
    id,
    type: 'info',
    timestamp,
    message: trimmed,
    raw: trimmed
  }
}

interface VisualizerPanelProps {
  isConnected: boolean
  connectedPort: string | null
  wizardMethod?: ZeroingMethod | null
  onWizardClose?: () => void
  machinePosition?: { x: number; y: number; z: number }
  workPosition?: { x: number; y: number; z: number }
  probeContact?: boolean
  lastAlarmMessageRef?: React.MutableRefObject<string | null>
  currentWCS?: string
}

function VisualizerPanel({ 
  isConnected, 
  connectedPort,
  wizardMethod,
  onWizardClose,
  machinePosition = { x: 0, y: 0, z: 0 },
  workPosition = { x: 0, y: 0, z: 0 },
  probeContact = false,
  lastAlarmMessageRef,
  currentWCS = 'G54'
}: VisualizerPanelProps) {
  // Get settings for connection options (needed for joining port room)
  const { data: settings } = useGetSettingsQuery()
  
  const [tab, setTab] = useState<'3d' | 'console' | 'wizard'>('3d')
  
  // Switch to wizard tab when wizard method is set
  useEffect(() => {
    if (wizardMethod) {
      setTab('wizard')
    }
  }, [wizardMethod])
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [commandInput, setCommandInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const consoleContainerRef = useRef<HTMLDivElement>(null)
  const consoleLinesRef = useRef<ConsoleLine[]>([]) // Track console lines for alarm message lookup
  const scrollToBottom = useCallback(() => {
    if (!consoleContainerRef.current) return
    
    // Find the OverlayScrollbars viewport element within the container
    const viewport = consoleContainerRef.current.querySelector('[data-overlayscrollbars-viewport]') as HTMLElement
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight
      return
    }
    
    // Fallback: try to find any scrollable element
    const scrollable = consoleContainerRef.current.querySelector('.os-viewport') as HTMLElement
    if (scrollable) {
      scrollable.scrollTop = scrollable.scrollHeight
    }
  }, [])
  
  const MAX_LINES = 1000
  
  // Auto-scroll to bottom when new lines are added (only if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll && consoleLines.length > 0) {
      // Use requestAnimationFrame for immediate attempt, then setTimeout for delayed attempt
      // This handles cases where OverlayScrollbars hasn't initialized yet
      requestAnimationFrame(() => {
        scrollToBottom()
      })
      
      const timeoutId = setTimeout(() => {
        scrollToBottom()
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [consoleLines, autoScroll, scrollToBottom])
  
  // Limit console history to prevent memory issues
  useEffect(() => {
    setConsoleLines(prev => {
      if (prev.length > MAX_LINES) {
        return prev.slice(-MAX_LINES)
      }
      return prev
    })
  }, [consoleLines.length])
  
  // Listen to Socket.IO events for console messages
  // IMPORTANT: Must wait for socket to be connected AND added to controller.sockets via addConnection
  // The controller's emit method only sends to sockets in this.sockets, so we need to ensure
  // the socket is connected first, then added to controller.sockets
  useEffect(() => {
    if (!isConnected || !connectedPort) {
      // Clear console when disconnected
      setConsoleLines([])
      return
    }

    const socket = socketService.getSocket()
    if (!socket) {
      return
    }

    // Helper function to set up console listeners
    const setupConsoleListeners = () => {

      // Listen for messages FROM Grbl
      // Backend emits: this.emit('serialport:read', res.raw) or this.emit('serialport:read', message)
      // Controller's emit method forwards to all sockets: socket.emit('serialport:read', ...args)
      // So we receive: (message: string) directly
      const handleSerialRead = (message: string) => {
        // Backend emits serialport:read with just the message string
        // The controller's emit method forwards to all sockets in this.sockets
        // So we just receive the message string directly
        
        // Check for alarm messages BEFORE parsing - capture the raw message
        const trimmed = message.trim()
        if (trimmed.startsWith('ALARM:')) {
          if (lastAlarmMessageRef) {
            lastAlarmMessageRef.current = trimmed
          }
        }
        
        const line = parseConsoleMessage(message, 'read')
        setConsoleLines(prev => {
          const updated = [...prev, line]
          consoleLinesRef.current = updated // Keep ref in sync
          return updated
        })
        
        // Track alarm messages for notifications (also after parsing in case format differs)
        if (line.type === 'alarm') {
          if (lastAlarmMessageRef) {
            lastAlarmMessageRef.current = line.message
          }
        }
      }

      // Listen for messages TO Grbl
      // Backend emits: this.emit('serialport:write', data, context)
      // So we receive: (data: string, context?: object)
      const handleSerialWrite = (data: string, context?: unknown) => {
        // Backend emits serialport:write with (data, context) where context is an object
        // Not (port, data) - the controller's emit method forwards to all sockets in this.sockets
        // So we just receive the data string directly
        const line = parseConsoleMessage(data, 'write')
        setConsoleLines(prev => [...prev, line])
      }

      // Set up listeners - they'll receive events once the socket is added to controller.sockets
      // (which happens when we call socket.emit('open', ...))
      socket.on('serialport:read', handleSerialRead)
      socket.on('serialport:write', handleSerialWrite)

      return () => {
        socket.off('serialport:read', handleSerialRead)
        socket.off('serialport:write', handleSerialWrite)
      }
    }

    // CRITICAL: Only set up listeners when socket is actually connected
    // If socket is not connected yet, wait for it to connect
    if (!socket.connected) {
      const cleanupRef = { current: null as (() => void) | null }
      
      const handleConnect = () => {
        // Set up listeners after socket connects
        cleanupRef.current = setupConsoleListeners()
        // Also ensure we join the port room (if we're restoring state)
        if (settings?.connection?.port && settings.connection.port === connectedPort) {
          const connectionOptions = settings.connection ? {
            controllerType: settings.connection.controllerType || 'Grbl',
            baudrate: settings.connection.baudRate || 115200,
            rtscts: settings.connection.rtscts || false,
          } : {
            controllerType: 'Grbl',
            baudrate: 115200,
            rtscts: false,
          }
          socket.emit('open', connectedPort, connectionOptions, (err: Error | null) => {
            if (err) {
              console.error('[Setup] Error joining port room after socket connect:', err)
            }
          })
        }
      }
      socket.once('connect', handleConnect)
      
      return () => {
        socket.off('connect', handleConnect)
        if (cleanupRef.current) {
          cleanupRef.current()
        }
      }
    }

    // Socket is connected, set up listeners immediately
    // Also ensure we join the port room if not already joined
    const cleanup = setupConsoleListeners()
    
    // Join port room if we're connected but haven't joined yet
    if (settings?.connection?.port && settings.connection.port === connectedPort) {
      const connectionOptions = settings.connection ? {
        controllerType: settings.connection.controllerType || 'Grbl',
        baudrate: settings.connection.baudRate || 115200,
        rtscts: settings.connection.rtscts || false,
      } : {
        controllerType: 'Grbl',
        baudrate: 115200,
        rtscts: false,
      }
      socket.emit('open', connectedPort, connectionOptions, (err: Error | null) => {
        if (err) {
          console.error('[Setup] Error joining port room:', err)
        }
      })
    }
    
    return cleanup
  }, [isConnected, connectedPort, settings?.connection?.port])
  
  // Handle command input
  const handleSendCommand = useCallback(() => {
    if (!commandInput.trim() || !isConnected || !connectedPort) return

    // Send via Socket.IO
    socketService.getSocket()?.emit('writeln', connectedPort, commandInput.trim())
    
    // Clear input
    setCommandInput('')
  }, [commandInput, isConnected, connectedPort])
  
  // Handle Enter key
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSendCommand()
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tab header */}
      <div className="flex items-center border-b border-border bg-muted/30 px-2">
        <button
          onClick={() => setTab('3d')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === '3d' 
              ? 'border-primary text-foreground' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Maximize2 className="w-4 h-4 inline mr-1.5" />
          3D View
        </button>
        <div className="w-px h-4 bg-border" />
        <button
          onClick={() => setTab('console')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === 'console' 
              ? 'border-primary text-foreground' 
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Terminal className="w-4 h-4 inline mr-1.5" />
          Console
        </button>
        {wizardMethod && (
          <>
            <div className="w-px h-4 bg-border" />
            <button
              onClick={() => setTab('wizard')}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                tab === 'wizard' 
                  ? 'border-primary text-foreground' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Target className="w-4 h-4 inline mr-1.5" />
              {wizardMethod.name}
            </button>
          </>
        )}
      </div>
      
      {tab === 'wizard' && wizardMethod ? (
        <ZeroingWizardTab
          method={wizardMethod}
          onClose={onWizardClose || (() => {})}
          isConnected={isConnected}
          connectedPort={connectedPort}
          machinePosition={machinePosition}
          workPosition={workPosition}
          probeContact={probeContact}
          currentWCS={currentWCS}
        />
      ) : tab === '3d' ? (
        <div className="flex-1 relative">
          <VisualizerScene />
          
          {/* View controls overlay */}
          <div className="absolute bottom-3 left-3 flex gap-1">
            <Button variant="secondary" size="sm" className="h-7 text-xs">Top</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs">Front</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs">Iso</Button>
            <Button variant="secondary" size="sm" className="h-7 text-xs">Fit</Button>
          </div>
          
          {/* File info overlay */}
          <div className="absolute top-3 right-3 bg-background/80 backdrop-blur rounded px-2 py-1 text-xs">
            <span className="text-muted-foreground">Bounds:</span>{' '}
            <span className="font-mono">450 × 180 × 30 mm</span>
          </div>
        </div>
      ) : (
        <div ref={consoleContainerRef} className="flex-1 flex flex-col bg-zinc-950 min-h-0 relative">
          <OverlayScrollbarsComponent 
            className="flex-1 min-h-0"
            options={{ 
              scrollbars: { autoHide: 'scroll', autoHideDelay: 400 },
              overflow: { x: 'hidden', y: 'scroll' }
            }}
          >
            <div className="p-2 font-mono text-xs">
              {consoleLines.length === 0 ? (
                <div className="text-zinc-500 text-center py-8">
                  {isConnected 
                    ? 'Console ready. Messages will appear here...'
                    : 'Not connected. Connect to a serial port to see console messages.'}
                </div>
              ) : (
                consoleLines.map((line) => (
                  <div key={line.id} className="py-0.5">
                    <span className="text-zinc-500">
                      {line.timestamp.toLocaleTimeString()}
                    </span>
                    <span className={`ml-2 ${
                      line.type === 'cmd' ? 'text-blue-400' :
                      line.type === 'ok' ? 'text-green-400' :
                      line.type === 'error' ? 'text-red-400' :
                      line.type === 'alarm' ? 'text-orange-400' :
                      line.type === 'status' ? 'text-cyan-400' :
                      'text-zinc-300'
                    }`}>
                      {line.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </OverlayScrollbarsComponent>
          {/* Auto-scroll toggle button */}
          <div className="absolute bottom-14 right-2 z-10">
            <Button
              size="sm"
              variant={autoScroll ? "default" : "outline"}
              className="h-7 w-7 p-0"
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
            >
              <ArrowDown className={`w-4 h-4 ${autoScroll ? '' : 'opacity-50'}`} />
            </Button>
          </div>
          {/* Command input */}
          <div className="border-t border-zinc-800 p-2 flex items-center gap-2">
            <span className="text-blue-400 font-mono text-sm leading-none">&gt;</span>
            <input 
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter command..."
              disabled={!isConnected}
              className="flex-1 bg-transparent text-zinc-100 font-mono text-sm outline-none placeholder:text-zinc-600 leading-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button 
              size="sm" 
              variant="secondary" 
              className="h-7 text-xs"
              onClick={handleSendCommand}
              disabled={!commandInput.trim() || !isConnected}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// Helper function to get description for zeroing method based on type
function getMethodDescription(method: ZeroingMethod): string {
  switch (method.type) {
    case 'bitsetter':
      return 'Automatic tool length sensor for Z-axis zeroing'
    case 'bitzero':
      return `Corner/edge/center probe for ${method.axes.toUpperCase()} zeroing`
    case 'touchplate':
      return 'Touch plate for Z-axis zeroing'
    case 'manual':
      return `Manually jog to position and set ${method.axes.toUpperCase()} zero`
    case 'custom':
      return 'Custom G-code sequence for zeroing'
    default:
      return 'Zeroing method'
  }
}

// Helper function to get axes label
function getAxesLabel(axes: string): string {
  return axes.toUpperCase()
}

// ============================================================================
// Zeroing Wizard Component (Tab Version)
// ============================================================================

interface ZeroingWizardTabProps {
  method: ZeroingMethod
  onClose: () => void
  isConnected: boolean
  connectedPort: string | null
  machinePosition: { x: number; y: number; z: number }
  workPosition: { x: number; y: number; z: number }
  probeContact?: boolean
  currentWCS?: string
}

function ZeroingWizardTab({ 
  method, 
  onClose,
  isConnected, 
  connectedPort,
  machinePosition,
  workPosition,
  probeContact = false,
  currentWCS = 'G54'
}: ZeroingWizardTabProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [probeStatus, setProbeStatus] = useState<'idle' | 'probing' | 'capturing' | 'storing' | 'complete' | 'error'>('idle')
  const [probeError, setProbeError] = useState<string | null>(null)
  const socket = socketService.getSocket()
  
  // Extensions API for bitsetter toolReference storage
  const [setExtensions] = useSetExtensionsMutation()
  const [deleteExtensions] = useDeleteExtensionsMutation()
  
  // Helper to convert WCS to P number (G54=1, G55=2, etc.)
  const getWCSPNumber = useCallback((wcs: string): number => {
    const map: Record<string, number> = {
      'G54': 1, 'G55': 2, 'G56': 3, 'G57': 4, 'G58': 5, 'G59': 6
    }
    return map[wcs] || 1
  }, [])
  
  // Helper to clear bitsetter reference for current WCS
  const clearBitsetterReference = useCallback(async () => {
    try {
      const wcsKey = `bitsetter.toolReference.${currentWCS}`
      await deleteExtensions({ key: wcsKey }).unwrap()
    } catch (err) {
      console.error('Failed to clear bitsetter reference:', err)
    }
  }, [currentWCS, deleteExtensions])
  
  // Reset to step 1 when method changes
  useEffect(() => {
    setCurrentStep(1)
  }, [method.id])
  
  // Get total steps based on method type
  const getTotalSteps = () => {
    if (method.type === 'manual') {
      return 3
    }
    if (method.type === 'touchplate') {
      // If requireCheck is false, skip the verification step (2 steps instead of 3)
      return method.requireCheck === false ? 2 : 3
    }
    if (method.type === 'bitsetter') {
      // If requireCheck is false, skip the verification step (3 steps instead of 4)
      return method.requireCheck === false ? 3 : 4
    }
    // Other methods will be implemented later
    return 1
  }
  
  const totalSteps = getTotalSteps()
  const isLastStep = currentStep === totalSteps
  const isFirstStep = currentStep === 1
  
  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStep(prev => prev + 1)
    } else {
      // On last step, complete the wizard
      handleComplete()
    }
  }
  
  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep(prev => prev - 1)
    }
  }
  
  const handleSetZero = useCallback(async (axes: 'x' | 'y' | 'z' | 'xy' | 'xyz') => {
    if (!connectedPort || !socket) {
      return
    }
    
    // Clear bitsetter reference if Z zero is being set (bitsetter reference becomes invalid)
    if (axes.includes('z')) {
      await clearBitsetterReference()
    }
    
    // Build G10 command to set zero
    // G10 L20 Px sets work coordinate system (P1 = G54, P2 = G55, etc.)
    // G10 L20 Px X0 Y0 Z0 sets current position as origin
    const parts: string[] = []
    if (axes.includes('x')) parts.push('X0')
    if (axes.includes('y')) parts.push('Y0')
    if (axes.includes('z')) parts.push('Z0')
    
    if (parts.length > 0) {
      const p = getWCSPNumber(currentWCS)
      const command = `G10 L20 P${p} ${parts.join(' ')}`
      socket.emit('command', connectedPort, 'gcode', command)
    }
  }, [connectedPort, socket, currentWCS, getWCSPNumber, clearBitsetterReference])
  
  const handleTouchPlateProbe = useCallback(async () => {
    if (!connectedPort || !socket || method.type !== 'touchplate') {
      return
    }
    
    // Clear bitsetter reference when setting Z zero via touchplate (bitsetter reference becomes invalid)
    await clearBitsetterReference()
    
    // Build probe sequence:
    // 1. Switch to relative mode
    // 2. Probe down (G38.2 for Grbl)
    // 3. Switch to absolute mode
    // 4. Set zero with plate thickness offset (G10 L20 Px Z[plateThickness])
    // 5. Retract
    const p = getWCSPNumber(currentWCS)
    const commands = [
      'G21', // Metric units
      'M5', // Stop spindle
      'G90', // Absolute mode
      'G91', // Relative mode (for probe)
      `G38.2 Z-${method.probeDistance} F${method.probeFeedrate}`, // Probe down
      'G90', // Absolute mode
      `G10 L20 P${p} Z${method.plateThickness}`, // Set zero with plate thickness
      'G91', // Relative mode
      'G0 Z10', // Retract 10mm
      'G90', // Absolute mode
    ]
    
    // Send commands sequentially
    commands.forEach((cmd, index) => {
      setTimeout(() => {
        socket.emit('command', connectedPort, 'gcode', cmd)
      }, index * 100) // Small delay between commands
    })
  }, [connectedPort, socket, method, currentWCS, getWCSPNumber, clearBitsetterReference])
  
  const handleBitsetterNavigate = useCallback(() => {
    if (!connectedPort || !socket || method.type !== 'bitsetter') {
      return
    }
    
    // Navigate to bitsetter position safely using machine coordinates (G53)
    // Sequence: Raise Z to safe height -> Move XY -> Lower Z to bitsetter position
    const safeHeight = method.position.z + method.retractHeight
    const commands = [
      'G90', // Absolute mode (ensure we're in absolute mode)
      `G53 G0 Z${safeHeight}`, // Raise Z to safe height above bitsetter (machine coordinates)
      `G53 G0 X${method.position.x} Y${method.position.y}`, // Move to bitsetter XY position (machine coordinates)
      `G53 G0 Z${method.position.z}`, // Lower to bitsetter Z position (machine coordinates, tool should be above sensor)
    ]
    
    // Send commands sequentially with delays to allow each command to complete
    commands.forEach((cmd, index) => {
      setTimeout(() => {
        socket.emit('command', connectedPort, 'gcode', cmd)
      }, index * 300) // Longer delay for navigation commands to allow movement to complete
    })
  }, [connectedPort, socket, method])
  
  const handleBitsetterProbe = useCallback(async () => {
    if (!connectedPort || !socket || method.type !== 'bitsetter') {
      return
    }
    
    // Reset capture flag for new probe
    capturingPositionRef.current = false
    
    setProbeStatus('probing')
    setProbeError(null)
    
    // Multi-stage probe sequence based on user's example script:
    // 1. Fast probe down
    // 2. Small retract
    // 3. Fine probe down with pauses
    // 4. Probe up to verify contact loss
    // 5. Fine probe down again
    // 6. Probe up to verify contact loss again
    // 7. Switch to absolute mode
    // 8. Capture position (TOOL_REFERENCE)
    // 9. Retract to safe height
    
    const rapidFeedrate = method.probeFeedrate || 200 // Fast feedrate for initial probe
    const fineFeedrate = 40 // Fine feedrate for dialing in
    
    const commands = [
      'G21', // Metric units
      'M5', // Stop spindle
      'G90', // Absolute positioning
      'G91', // Switch to relative mode for probing
      `G38.2 Z-${method.probeDistance} F${rapidFeedrate}`, // Fast probe down
      'G0 Z2', // Small retract
      `G38.2 Z-5 F${fineFeedrate}`, // Fine probe down
      'G4 P0.25', // Pause 0.25 seconds
      'G38.4 Z10 F20', // Probe up to verify contact loss
      'G4 P0.25', // Pause 0.25 seconds
      'G38.2 Z-2 F10', // Very fine probe down
      'G4 P0.25', // Pause 0.25 seconds
      'G38.4 Z10 F5', // Ultra fine probe up to verify contact loss
      'G4 P0.25', // Pause 0.25 seconds
      'G90', // Switch back to absolute mode (position is now stable)
    ]
    
    // Store the position before probing to detect when it stabilizes after probe
    const positionBeforeProbe = { ...workPosition }
    previousWorkPositionRef.current = positionBeforeProbe
    
    // Send probe sequence commands sequentially
    let commandIndex = 0
    const sendCommand = () => {
      if (commandIndex < commands.length) {
        socket.emit('command', connectedPort, 'gcode', commands[commandIndex])
        commandIndex++
        // Vary delays: longer for movements, shorter for pauses
        // Probe commands need more time (500ms for G38.2/G38.4, 300ms for G4)
        const cmd = commands[commandIndex - 1]
        const delay = cmd.startsWith('G4') ? 350 : (cmd.startsWith('G38') ? 800 : 300)
        setTimeout(sendCommand, delay)
      } else {
        // After probe sequence completes, wait for controller state to update
        // Then capture position once it stabilizes
        setTimeout(() => {
          setProbeStatus('capturing')
          // Position will be captured via useEffect watching workPosition
        }, 1000) // Longer delay to ensure controller has processed all commands
      }
    }
    
    sendCommand()
  }, [connectedPort, socket, method, currentWCS, getWCSPNumber, workPosition])
  
  // Monitor workPosition after probe to capture TOOL_REFERENCE
  const previousWorkPositionRef = useRef<{ x: number; y: number; z: number } | null>(null)
  const capturingPositionRef = useRef(false)
  const captureTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  useEffect(() => {
    // Only capture position if we're in capturing state and haven't captured yet
    if (probeStatus === 'capturing' && !capturingPositionRef.current) {
      const previousPos = previousWorkPositionRef.current
      
      // Check if position has changed (probe has completed) and stabilized
      // Position should have changed from before probe, then stabilized
      if (previousPos) {
        const zChanged = Math.abs(workPosition.z - previousPos.z) > 0.001
        
        // Wait for position to stabilize (no change for 500ms)
        if (captureTimeoutRef.current) {
          clearTimeout(captureTimeoutRef.current)
        }
        
        captureTimeoutRef.current = setTimeout(() => {
          // Check again if position is stable
          const currentPos = { ...workPosition }
          if (previousWorkPositionRef.current && Math.abs(currentPos.z - previousWorkPositionRef.current.z) < 0.001) {
            capturingPositionRef.current = true
            setProbeStatus('storing')
            
            // Store TOOL_REFERENCE in Extensions API
            // This is the work Z position at bitsetter contact point
            const toolReference = currentPos.z
            const wcsKey = `bitsetter.toolReference.${currentWCS}`
            
            setExtensions({ 
              key: wcsKey, 
              data: { 
                value: toolReference, 
                wcs: currentWCS, 
                timestamp: new Date().toISOString() 
              } 
            })
              .unwrap()
              .then(() => {
                setProbeStatus('complete')
                // Retract to safe height after storing reference
                if (method.type === 'bitsetter') {
                  const safeHeight = method.position.z + method.retractHeight
                  if (connectedPort && socket) {
                    socket.emit('command', connectedPort, 'gcode', 'G90') // Ensure absolute mode
                    setTimeout(() => {
                      socket.emit('command', connectedPort, 'gcode', `G53 G0 Z${safeHeight}`) // Retract in machine coordinates
                    }, 200)
                  }
                }
              })
              .catch((err) => {
                console.error('Failed to store bitsetter reference:', err)
                setProbeStatus('error')
                setProbeError('Failed to store tool reference. Please try again.')
                capturingPositionRef.current = false
              })
          }
        }, 500) // Wait 500ms for position to stabilize
      }
    }
    
    // Update previous position reference
    previousWorkPositionRef.current = { ...workPosition }
    
    // Cleanup timeout on unmount or status change
    return () => {
      if (captureTimeoutRef.current) {
        clearTimeout(captureTimeoutRef.current)
      }
    }
  }, [workPosition, probeStatus, currentWCS, setExtensions, method, connectedPort, socket])
  
  const handleComplete = async () => {
    // For touchplate and manual, clear bitsetter reference if Z zero is being set
    if (method.type === 'touchplate' || (method.type === 'manual' && method.axes.includes('z'))) {
      await clearBitsetterReference()
    }
    
    // For touchplate, the probe already sets zero, so just close
    if (method.type === 'touchplate') {
      onClose()
      return
    }
    
    // For bitsetter, the probe already captured the reference, so just close
    if (method.type === 'bitsetter') {
      onClose()
      return
    }
    
    // For manual, set zero for the axes specified by the method
    if (method.type === 'manual') {
      await handleSetZero(method.axes)
      onClose()
      return
    }
    
    onClose()
  }
  
  // Render step content based on method type and current step
  const renderStepContent = () => {
    if (method.type === 'manual') {
      return renderManualStep(currentStep, method.axes)
    }
    if (method.type === 'touchplate') {
      return renderTouchPlateStep(currentStep, method)
    }
    if (method.type === 'bitsetter') {
      return renderBitsetterStep(currentStep, method)
    }
    // Other method types will be implemented later
    return <div>Method type {method.type} not yet implemented</div>
  }
  
  const renderManualStep = (step: number, axes: string) => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 1: Position XY</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Use the jog controls to move the tool to the XY location that matches the zero point in your CAM software.
                </p>
                {axes.includes('x') && axes.includes('y') && (
                  <>
                    <p>
                      When the endmill is directly above the desired point, press the zero buttons in the Position panel:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span>Zero button</span>
                        <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </span>
                        <span>next to X</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span>Zero button</span>
                        <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </span>
                        <span>next to Y</span>
                      </li>
                    </ul>
                    <p>
                      This sets the current position as the zero point for this job. After you have set zero for X and Y, press Next to continue.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Current Machine Position:</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{machinePosition.x.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{machinePosition.y.toFixed(3)}</span>
                </div>
              </div>
            </div>
            {axes.includes('x') && axes.includes('y') && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Tip: You can use the Z controls to lower the bit near the surface for better accuracy when positioning XY. We'll set the Z zero in the next step.
                </p>
              </div>
            )}
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 2: Position Z (Paper Test)</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Lower the Z-axis until the tool just touches the surface. A piece of paper should barely slide in and out with friction.
                </p>
                {axes.includes('z') && (
                  <>
                    <p>
                      When the tool is positioned correctly, press the zero button in the Position panel:
                    </p>
                    <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                      <li className="flex items-center gap-2">
                        <span>Zero button</span>
                        <span className="inline-flex items-center justify-center w-6 h-6 border border-border rounded bg-muted/50">
                          <RotateCcw className="w-3.5 h-3.5" />
                        </span>
                        <span>next to Z</span>
                      </li>
                    </ul>
                    <p>
                      After you have set zero for Z, press Next to continue.
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Current Machine Position:</div>
              <div className="text-sm">
                <span className="text-muted-foreground">Z: </span>
                <span className="font-mono">{machinePosition.z.toFixed(3)}</span>
              </div>
            </div>
            {axes.includes('z') && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                    <p className="font-medium">Paper Test Instructions:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Place a piece of paper (about 0.1mm thick) on the surface</li>
                      <li>Slowly lower the Z-axis using small jog steps</li>
                      <li>Stop when the paper can barely slide in and out with friction</li>
                      <li>The tool should just touch the paper, not press into it</li>
                    </ol>
                  </div>
                </div>
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-900 dark:text-yellow-100">
                    <strong>Tip:</strong> Use very small jog distances (0.01mm) for fine adjustment when approaching the surface.
                  </p>
                </div>
              </div>
            )}
          </div>
        )
      case 3:
        // Check if WCS is at zero for the axes that were zeroed
        const isAtZero = 
          (!axes.includes('x') || Math.abs(workPosition.x) < 0.001) &&
          (!axes.includes('y') || Math.abs(workPosition.y) < 0.001) &&
          (!axes.includes('z') || Math.abs(workPosition.z) < 0.001)
        
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 3: Confirm Zero</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Zero has been set for {getAxesLabel(axes)}. Pressing XY0 in the jog controls will return to this XY position, and pressing Z0 will move Z down to this depth.
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">Work Coordinate System Position:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                {axes.includes('x') && (
                  <div>
                    <span className="text-muted-foreground">X: </span>
                    <span className="font-mono">{workPosition.x.toFixed(3)}</span>
                  </div>
                )}
                {axes.includes('y') && (
                  <div>
                    <span className="text-muted-foreground">Y: </span>
                    <span className="font-mono">{workPosition.y.toFixed(3)}</span>
                  </div>
                )}
                {axes.includes('z') && (
                  <div>
                    <span className="text-muted-foreground">Z: </span>
                    <span className="font-mono">{workPosition.z.toFixed(3)}</span>
                  </div>
                )}
              </div>
            </div>
            {isAtZero ? (
              <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                <div className="text-sm text-green-900 dark:text-green-100">
                  <p className="font-medium">Zero confirmed: The work coordinate system is set to the current position.</p>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <div className="text-sm text-red-900 dark:text-red-100">
                  <p className="font-medium">Warning: The current position is not at the zero position. The work coordinate system shows non-zero values.</p>
                </div>
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }
  
  const renderTouchPlateStep = (step: number, method: ZeroingMethod) => {
    if (method.type !== 'touchplate') return null
    
    // TypeScript should narrow to TouchPlateConfig here, but we'll be explicit
    const touchplateMethod = method as Extract<ZeroingMethod, { type: 'touchplate' }>
    
    // Map step numbers based on requireCheck setting
    // If requireCheck is false, skip step 1 (verification), so step 1->position, step 2->probe
    const skipVerification = touchplateMethod.requireCheck === false
    const actualStep = skipVerification ? step + 1 : step
    
    switch (actualStep) {
      case 1:
        // Step 1: Verify Touch Plate (only shown if requireCheck is true)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 1: Verify Touch Plate</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Verify that the touch plate is working by manually touching it to the tool. The touch plate should trigger when contact is made.
                </p>
                <p>
                  This ensures the probe circuit is functioning correctly before starting the zeroing process.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Touch the plate to the tool manually. If the probe triggers correctly, you're ready to proceed. If not, check your wiring and probe settings.
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${
                probeContact 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    probeContact ? 'bg-green-500' : 'bg-muted'
                  }`} />
                  <span className="text-sm font-medium">
                    Probe Status: {probeContact ? 'Contact Detected' : 'No Contact'}
                  </span>
                </div>
                {probeContact && (
                  <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                    The probe circuit is working correctly. You can proceed to the next step.
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      case 2:
        // Step 2: Position Touch Plate (shown as step 1 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 1 : 2}: Position Touch Plate</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Place the touch plate on the workpiece at the location where you want to set Z zero.
                </p>
                <p>
                  Use the jog controls to position the tool above the touch plate location. The tool should be positioned so it can probe down onto the plate.
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Work Coordinate System Position:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{workPosition.x.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{workPosition.y.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Z: </span>
                  <span className="font-mono">{workPosition.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Make sure the touch plate is flat on the workpiece surface and the tool can reach it when probing down.
              </p>
            </div>
          </div>
        )
      case 3:
        // Step 3: Run Probe (shown as step 2 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 2 : 3}: Run Probe</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Press the probe button below to start the automatic Z-probe sequence. The tool will probe down until it contacts the touch plate, then set Z zero accounting for the plate thickness ({touchplateMethod.plateThickness}mm).
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">Probe Settings:</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Plate Thickness: </span>
                  <span className="font-mono">{touchplateMethod.plateThickness}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Probe Feedrate: </span>
                  <span className="font-mono">{touchplateMethod.probeFeedrate}mm/min</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Probe Distance: </span>
                  <span className="font-mono">{touchplateMethod.probeDistance}mm</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center py-4">
              <Button
                onClick={handleTouchPlateProbe}
                variant="default"
                size="lg"
                className="gap-2"
                disabled={!isConnected || !connectedPort}
              >
                <Target className="w-5 h-5" />
                Start Z-Probe
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Warning:</strong> Make sure the tool is positioned above the touch plate and there is enough clearance for the probe distance ({touchplateMethod.probeDistance}mm) before starting.
              </p>
            </div>
          </div>
        )
      default:
        return null
    }
  }
  
  const renderBitsetterStep = (step: number, method: ZeroingMethod) => {
    if (method.type !== 'bitsetter') return null
    
    // TypeScript should narrow to BitSetterConfig here, but we'll be explicit
    const bitsetterMethod = method as Extract<ZeroingMethod, { type: 'bitsetter' }>
    
    // Map step numbers based on requireCheck setting
    // If requireCheck is false, skip step 1 (verification), so step 1->navigate, step 2->tool change, step 3->probe
    const skipVerification = bitsetterMethod.requireCheck === false
    const actualStep = skipVerification ? step + 1 : step
    
    switch (actualStep) {
      case 1:
        // Step 1: Verify BitSetter Circuit (only shown if requireCheck is true)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step 1: Verify BitSetter Circuit</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Verify that the BitSetter circuit is working by manually pressing the sensor down. The BitSetter should trigger when the sensor is pressed.
                </p>
                <p>
                  This ensures the probe circuit is functioning correctly before starting the zeroing process.
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-900 dark:text-blue-100">
                  Press the BitSetter sensor down manually with your finger or a tool. If the probe triggers correctly, you're ready to proceed. If not, check your wiring and probe settings.
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${
                probeContact 
                  ? 'bg-green-500/10 border-green-500/30' 
                  : 'bg-muted/50 border-border'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    probeContact ? 'bg-green-500' : 'bg-muted'
                  }`} />
                  <span className="text-sm font-medium">
                    Probe Status: {probeContact ? 'Contact Detected' : 'No Contact'}
                  </span>
                </div>
                {probeContact && (
                  <p className="text-xs text-green-900 dark:text-green-100 mt-1 ml-5">
                    The probe circuit is working correctly. You can proceed to the next step.
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      case 2:
        // Step 2: Navigate to BitSetter (shown as step 1 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 1 : 2}: Navigate to BitSetter</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  The tool will automatically navigate to the BitSetter location configured in settings. The machine will move to the BitSetter position safely.
                </p>
                <p>
                  <strong>BitSetter Location:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2 text-sm">
                  <li>X: {bitsetterMethod.position.x.toFixed(3)}mm</li>
                  <li>Y: {bitsetterMethod.position.y.toFixed(3)}mm</li>
                  <li>Z: {bitsetterMethod.position.z.toFixed(3)}mm</li>
                </ul>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="text-sm font-medium">Current Position:</div>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">X: </span>
                  <span className="font-mono">{machinePosition.x.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Y: </span>
                  <span className="font-mono">{machinePosition.y.toFixed(3)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Z: </span>
                  <span className="font-mono">{machinePosition.z.toFixed(3)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center py-4">
              <Button
                onClick={handleBitsetterNavigate}
                variant="default"
                size="lg"
                className="gap-2"
                disabled={!isConnected || !connectedPort}
              >
                <Navigation className="w-5 h-5" />
                Navigate to BitSetter
              </Button>
            </div>
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-900 dark:text-yellow-100">
                <strong>Warning:</strong> Make sure there is a clear path to the BitSetter location and that no obstacles will interfere with the tool movement.
              </p>
            </div>
          </div>
        )
      case 3:
        // Step 3: Install First Tool (shown as step 2 if requireCheck is false)
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 2 : 3}: Install First Tool</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Install the first tool before probing. We will measure the length of this tool so tool changes during the job are easier and you will only need to re-measure on the bitsetter instead of setting Z again on the material.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-900 dark:text-blue-100">
                Once the first tool is installed, press Next to proceed to the probing step.
              </p>
            </div>
          </div>
        )
      case 4:
        // Step 4: Run Probe (shown as step 3 if requireCheck is false)
        const isProbing = probeStatus === 'probing' || probeStatus === 'capturing' || probeStatus === 'storing'
        const isProbeComplete = probeStatus === 'complete'
        const isProbeError = probeStatus === 'error'
        
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-base font-semibold">Step {skipVerification ? 3 : 4}: Run Probe</h3>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>
                  Press the probe button below to start the automatic BitSetter probe sequence. The tool will perform a multi-stage probe sequence to accurately measure the tool length.
                </p>
                <p>
                  After probing, the tool reference will be stored. The tool will automatically retract to a safe height above the BitSetter.
                </p>
              </div>
            </div>
            
            {/* Probe Status */}
            {isProbing && (
              <div className={`p-4 rounded-lg border ${
                probeStatus === 'probing' ? 'bg-blue-500/10 border-blue-500/30' :
                probeStatus === 'capturing' ? 'bg-amber-500/10 border-amber-500/30' :
                'bg-purple-500/10 border-purple-500/30'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full animate-pulse ${
                    probeStatus === 'probing' ? 'bg-blue-500' :
                    probeStatus === 'capturing' ? 'bg-amber-500' :
                    'bg-purple-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {probeStatus === 'probing' && 'Running probe sequence...'}
                      {probeStatus === 'capturing' && 'Capturing position...'}
                      {probeStatus === 'storing' && 'Storing tool reference...'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {probeStatus === 'probing' && 'The tool is probing down to contact the BitSetter sensor.'}
                      {probeStatus === 'capturing' && 'Reading work position after probe contact...'}
                      {probeStatus === 'storing' && 'Saving tool reference to Extensions API...'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isProbeComplete && (
              <div className="p-4 rounded-lg border bg-green-500/10 border-green-500/30">
                <div className="flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-900 dark:text-green-100">
                      Probe complete! Tool reference stored.
                    </p>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      The tool reference has been saved for {currentWCS}. You can now use this reference for tool changes.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isProbeError && (
              <div className="p-4 rounded-lg border bg-red-500/10 border-red-500/30">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100">
                      Probe error
                    </p>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                      {probeError || 'An error occurred during the probe sequence. Please try again.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="text-sm font-medium">Probe Settings:</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Probe Feedrate: </span>
                  <span className="font-mono">{bitsetterMethod.probeFeedrate}mm/min</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Probe Distance: </span>
                  <span className="font-mono">{bitsetterMethod.probeDistance}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Retract Height: </span>
                  <span className="font-mono">{bitsetterMethod.retractHeight}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Work Coordinate: </span>
                  <span className="font-mono">{currentWCS}</span>
                </div>
              </div>
            </div>
            
            {/* Current Position Display */}
            {!isProbeComplete && (
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="text-sm font-medium">Current Work Position:</div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">X: </span>
                    <span className="font-mono">{workPosition.x.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Y: </span>
                    <span className="font-mono">{workPosition.y.toFixed(3)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Z: </span>
                    <span className="font-mono">{workPosition.z.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-center py-4">
              <Button
                onClick={handleBitsetterProbe}
                variant="default"
                size="lg"
                className="gap-2"
                disabled={!isConnected || !connectedPort || isProbing}
              >
                {isProbing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    {probeStatus === 'probing' && 'Probing...'}
                    {probeStatus === 'capturing' && 'Capturing...'}
                    {probeStatus === 'storing' && 'Storing...'}
                  </>
                ) : (
                  <>
                    <Target className="w-5 h-5" />
                    {isProbeComplete ? 'Probe Complete' : 'Start BitSetter Probe'}
                  </>
                )}
              </Button>
            </div>
            
            {!isProbing && !isProbeComplete && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Warning:</strong> Make sure the tool is positioned above the BitSetter and there is enough clearance for the probe distance ({bitsetterMethod.probeDistance}mm) before starting. The tool should already be at the BitSetter location from the previous step.
                </p>
              </div>
            )}
            
            {isProbeComplete && (
              <div className="flex items-start gap-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <HelpCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
                  <p className="font-medium">Tool reference stored</p>
                  <p>
                    The tool reference for {currentWCS} has been saved. When you change tools during a job, you can use this reference to automatically adjust the Z offset.
                  </p>
                </div>
              </div>
            )}
          </div>
        )
      default:
        return null
    }
  }
  
  if (!isConnected || !connectedPort) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-2">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
          <h3 className="text-lg font-semibold">Not Connected</h3>
          <p className="text-sm text-muted-foreground">
            Please connect to a machine before running this zeroing method.
          </p>
          <Button variant="outline" onClick={onClose} className="mt-4">
            Close
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="flex-1 flex flex-col min-h-0 p-6">
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">
              {method.type === 'bitsetter' ? 'BitSetter (First Tool)' : method.name}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Step {currentStep} of {totalSteps} - {getAxesLabel(method.axes)} Zeroing
        </p>
      </div>
      
      {/* Progress indicator - full width with justified steps */}
      <div className="relative w-full py-4 mb-4">
        {/* Full-width connecting line behind circles */}
        <div className="absolute top-1/2 left-0 right-0 h-0.5 -translate-y-1/2 bg-muted" />
        
        {/* Steps container with justify-between - first on left, last on right, middle centered */}
        <div className="relative flex items-center justify-between w-full">
          {Array.from({ length: totalSteps }).map((_, index) => {
            const stepNum = index + 1
            const isActive = stepNum === currentStep
            const isComplete = stepNum < currentStep
            
            return (
              <div
                key={stepNum}
                className="relative z-10"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                    isComplete
                      ? 'bg-green-500 text-white'
                      : isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground border-2 border-background'
                  }`}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : stepNum}
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Progress line that extends as steps are completed */}
        {currentStep > 1 && (
          <div 
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-green-500 transition-all duration-300 z-0"
            style={{
              left: '16px', // Half of circle width (w-8 = 32px, so 16px is center)
              width: totalSteps === 3
                ? currentStep === 2 
                  ? 'calc(50% - 32px)' // To middle of second circle
                  : 'calc(100% - 32px)' // To middle of third circle
                : currentStep === totalSteps
                ? 'calc(100% - 32px)'
                : `calc(${((currentStep - 1) / (totalSteps - 1)) * 100}% - 32px)`
            }}
          />
        )}
      </div>
      
      {/* Step content */}
      <div className="flex-1 overflow-y-auto min-h-0 mb-4">
        {renderStepContent()}
      </div>
      
      {/* Navigation buttons */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        {!isFirstStep && (
          <Button
            variant="outline"
            onClick={handleBack}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        )}
        <div className="flex-1" />
        {isLastStep ? (
          <Button onClick={handleComplete} className="gap-2">
            <Check className="w-4 h-4" />
            Complete
          </Button>
        ) : (
          <Button onClick={handleNext} className="gap-2">
            Next
            <ChevronRightIcon className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

interface ProbePanelProps extends PanelProps {
  onStartWizard?: (method: ZeroingMethod) => void
}

function ProbePanel({ isConnected, connectedPort, machineStatus, onFlashStatus, workPosition = { x: 0, y: 0, z: 0 }, onStartWizard }: ProbePanelProps) {
  const { data: settings, isLoading } = useGetSettingsQuery()
  
  // Get enabled zeroing methods from settings
  const methods: ZeroingMethod[] = settings?.zeroingMethods?.methods?.filter(m => m.enabled) ?? []
  
  const handleRun = useCallback((method: ZeroingMethod) => {
    if (onStartWizard) {
      onStartWizard(method)
    }
  }, [onStartWizard])
  
  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        <div className="text-sm text-muted-foreground text-center py-4">Loading zeroing methods...</div>
      </div>
    )
  }
  
  if (methods.length === 0) {
    return (
      <div className="p-3 space-y-2">
        <div className="text-sm text-muted-foreground text-center py-4">
          No zeroing methods configured. Add methods in Settings.
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-3 space-y-2">
      {methods.map((method) => (
        <div 
          key={method.id}
          className="flex items-center gap-3 p-2 rounded border border-border hover:bg-muted/50 transition-colors"
        >
          <Target className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{method.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {getMethodDescription(method)} • {getAxesLabel(method.axes)}
            </div>
          </div>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatus}
            onAction={() => handleRun(method)}
            requirements={ActionRequirements.jog}
            variant="secondary"
            size="sm"
            className="h-7 text-xs flex-shrink-0"
          >
            Run
          </MachineActionButton>
        </div>
      ))}
    </div>
  )
}

function MacrosPanel({
  isConnected,
  connectedPort,
  machineStatus,
  onFlashStatus,
}: PanelProps) {
  const { data: macrosData, isLoading } = useGetMacrosQuery()
  const socket = socketService.getSocket()
  
  const macros = macrosData?.records ?? []
  
  const handleMacroClick = useCallback((content: string) => {
    if (!isConnected || !connectedPort || !socket) {
      onFlashStatus()
      return
    }
    
    // Send the macro G-code content to the backend
    // The backend's 'gcode' command handler can accept multi-line strings
    // It will automatically split by newlines and feed them to the queue
    socket.emit('command', connectedPort, 'gcode', content)
  }, [isConnected, connectedPort, socket, onFlashStatus])
  
  if (isLoading) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">Loading macros...</div>
      </div>
    )
  }
  
  if (macros.length === 0) {
    return (
      <div className="p-3">
        <div className="text-sm text-muted-foreground text-center py-8">
          No macros found. Add macros in Settings.
        </div>
      </div>
    )
  }
  
  return (
    <div className="p-3">
      <div className="flex flex-col gap-2 w-full">
        {macros.map((macro) => (
          <MachineActionButton
            key={macro.id}
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatus}
            onAction={() => handleMacroClick(macro.content)}
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
  )
}


function SpindlePanel({ isConnected, connectedPort, machineStatus, onFlashStatus, isJobRunning = false, spindleState = 'M5', spindleSpeed = 0 }: PanelProps) {
  const speeds = [0, 500, 1000, 1500, 2000, 2500, 3000]
  
  // Derive state from backend
  const isOn = spindleState === 'M3' || spindleState === 'M4'
  const backendDirection = spindleState === 'M4' ? 'ccw' : 'cw'
  
  // Local state for direction (can be changed when spindle is off)
  const [localDirection, setLocalDirection] = useState<'cw' | 'ccw'>('cw')
  
  // Use backend direction when spindle is on, local direction when off
  const direction = isOn ? backendDirection : localDirection
  
  // Sync local direction with backend when spindle turns off
  useEffect(() => {
    if (!isOn) {
      setLocalDirection(backendDirection)
    }
  }, [isOn, backendDirection])
  
  // Find closest speed index from backend speed, or default to 1000 RPM
  const getSpeedIndex = (speed: number | undefined): number => {
    if (speed === undefined) return 2 // Default to 1000 RPM
    // Find closest speed in speeds array
    let closestIndex = 2
    let minDiff = Math.abs(speed - speeds[2])
    speeds.forEach((s, i) => {
      const diff = Math.abs(speed - s)
      if (diff < minDiff) {
        minDiff = diff
        closestIndex = i
      }
    })
    return closestIndex
  }
  
  const [speedIndex, setSpeedIndex] = useState(() => getSpeedIndex(spindleSpeed))
  
  // Update speed index when backend speed changes (only if spindle is off)
  useEffect(() => {
    if (!isOn && spindleSpeed !== undefined) {
      setSpeedIndex(getSpeedIndex(spindleSpeed))
    }
  }, [spindleSpeed, isOn])
  
  const speed = speeds[speedIndex]
  
  // Check if controls should be disabled
  // Spindle stop should be allowed during hold, but other controls should be disabled
  const isDisabled = !isConnected || machineStatus === 'alarm' || machineStatus === 'not_connected' || 
    (isJobRunning && machineStatus !== 'hold') // Allow during hold, disable during other running states
  const canControl = !isDisabled
  
  // Handle start/stop spindle
  const handleToggleSpindle = useCallback(() => {
    if (!connectedPort) return
    
    const socket = socketService.getSocket()
    if (!socket) return
    
    if (isOn) {
      // Stop spindle
      socket.emit('command', connectedPort, 'gcode', 'M5')
    } else {
      // Start spindle with current speed and direction
      const command = direction === 'cw' ? `M3 S${speed}` : `M4 S${speed}`
      socket.emit('command', connectedPort, 'gcode', command)
    }
  }, [connectedPort, isOn, direction, speed])
  
  // Handle direction change (only when stopped)
  const handleDirectionChange = useCallback((newDirection: 'cw' | 'ccw') => {
    if (isOn) return // Can't change direction while running
    
    // Update local state - will be applied when starting
    setLocalDirection(newDirection)
  }, [isOn])
  
  // Handle speed change (only when stopped)
  const handleSpeedChange = useCallback((newSpeedIndex: number) => {
    if (isOn) return // Can't change speed while running
    
    setSpeedIndex(newSpeedIndex)
    // Speed will be applied when starting spindle
  }, [isOn])
  
  // Flash status if action attempted while disabled (but not if disabled due to spindle running)
  const handleDisabledAction = useCallback(() => {
    if (!canControl && !isOn) {
      // Only flash if disabled for reasons other than spindle running
      onFlashStatus()
    }
  }, [canControl, isOn, onFlashStatus])

  // Don't flash when disabled due to spindle running
  const onFlashStatusForSpindleControls = isOn ? () => {} : onFlashStatus

  return (
    <div className="p-3 space-y-3">
      {/* Notice when spindle is running */}
      {isOn && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-2 text-xs text-blue-700 dark:text-blue-400">
          Direction and speed cannot be changed while the spindle is running.
        </div>
      )}
      
      {/* Direction toggle */}
      <div className="space-y-1">
        <div className="flex gap-2 w-full">
          <div className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground">Most common</span>
          </div>
          <div className="flex-1 text-center">
            <span className="text-[10px] text-muted-foreground">Not common</span>
          </div>
        </div>
        <div className="flex gap-2 w-full">
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatusForSpindleControls}
            onAction={() => handleDirectionChange('cw')}
            requirements={{
              requiresConnected: true,
              requiresPort: true,
              disallowAlarm: true,
              disallowRunning: false, // Allow direction change during jobs (when spindle is off)
              disallowNotConnected: true,
            }}
            customDisabled={isJobRunning || isOn} // Disable when job running or spindle is on
            variant={direction === 'cw' ? 'default' : 'outline'}
            className="flex-1"
          >
            <RotateCw className="w-4 h-4 mr-1" />
            CW
          </MachineActionButton>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={onFlashStatusForSpindleControls}
            onAction={() => handleDirectionChange('ccw')}
            requirements={{
              requiresConnected: true,
              requiresPort: true,
              disallowAlarm: true,
              disallowRunning: false, // Allow direction change during jobs (when spindle is off)
              disallowNotConnected: true,
            }}
            customDisabled={isJobRunning || isOn} // Disable when job running or spindle is on
            variant={direction === 'ccw' ? 'default' : 'outline'}
            className="flex-1"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            CCW
          </MachineActionButton>
        </div>
      </div>
      
      {/* Speed control */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>Speed (RPM)</span>
          <span className="font-mono font-medium">{speed} RPM</span>
        </div>
        <MachineActionWrapper
          isDisabled={isDisabled || isOn}
          onFlashStatus={onFlashStatusForSpindleControls}
        >
          <Slider 
            value={[speedIndex]} 
            onValueChange={(v) => {
              if (isDisabled || isOn) {
                handleDisabledAction()
                return
              }
              handleSpeedChange(v[0])
            }}
            max={speeds.length - 1} 
            step={1}
            disabled={isDisabled || isOn} // Disable when spindle is on OR controls are disabled
          />
        </MachineActionWrapper>
        <div className="flex justify-between text-[10px] text-muted-foreground px-1">
          <span>0</span>
          <span>500</span>
          <span>1k</span>
          <span>1.5k</span>
          <span>2k</span>
          <span>2.5k</span>
          <span>3k</span>
        </div>
      </div>
      
      {/* On/Off toggle */}
        <MachineActionButton
        isConnected={isConnected}
        connectedPort={connectedPort}
        machineStatus={machineStatus}
        onFlashStatus={onFlashStatus}
        onAction={handleToggleSpindle}
        requirements={isOn ? ActionRequirements.allowHold : {
          requiresConnected: true,
          requiresPort: true,
          disallowAlarm: true,
          disallowRunning: false, // Allow spindle start during jobs (but not during hold)
          disallowHold: true, // Don't allow starting spindle during hold
          disallowNotConnected: true,
        }}
        customDisabled={!isOn && (isJobRunning && machineStatus !== 'hold')} // Allow stop during hold, disable start during other running states
        className={`w-full h-12 ${isOn ? 'bg-green-600 hover:bg-green-700' : ''}`}
        variant={isOn ? 'default' : 'outline'}
      >
        <Circle className={`w-4 h-4 mr-2 ${isOn ? 'fill-white' : ''}`} />
        {isOn ? 'Stop Spindle' : 'Start Spindle'}
      </MachineActionButton>
    </div>
  )
}

function FilePanel(_props: PanelProps) {
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

function RapidPanel({
  isConnected,
  connectedPort,
  machineStatus,
  onFlashStatus,
}: PanelProps) {
  const { data: settings } = useGetSettingsQuery()
  const socket = socketService.getSocket()
  
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
    if (!isConnected || !connectedPort || !socket) {
      onFlashStatus()
      return
    }
    
    // Send G0 (rapid move) command to machine coordinates using G53
    // G53 is a one-shot machine coordinate system override (non-modal, applies to current line only)
    // This moves to machine coordinates (MPos) instead of work coordinates (WPos)
    const command = `G53 G0 X${x.toFixed(3)} Y${y.toFixed(3)}`
    socket.emit('command', connectedPort, 'gcode', command)
  }, [isConnected, connectedPort, socket, onFlashStatus])
  
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

function ToolsPanel() {
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

// ============================================================================
// MAIN DASHBOARD
// ============================================================================

// Panel props interface
interface PanelProps {
  isConnected: boolean
  connectedPort: string | null
  machineStatus: 'not_connected' | 'connected_pre_home' | 'connected_post_home' | 'alarm' | 'running' | 'error'
  onFlashStatus: () => void
  machinePosition?: { x: number; y: number; z: number }
  workPosition?: { x: number; y: number; z: number }
  currentWCS?: string
  isJobRunning?: boolean
  spindleState?: 'M3' | 'M4' | 'M5'
  spindleSpeed?: number
}

// Panel configuration with metadata
const panelConfig: Record<string, { 
  title: string
  icon: React.ElementType
  component: React.FC<PanelProps>
}> = {
  dro: { title: 'Position', icon: Crosshair, component: DROPanel },
  jog: { title: 'Jog Control', icon: Move, component: JogPanel },
  rapid: { title: 'Rapid', icon: Navigation, component: RapidPanel },
  probe: { title: 'Probe', icon: Target, component: ProbePanel },
  macros: { title: 'Macros', icon: Zap, component: MacrosPanel },
  file: { title: 'File', icon: FileCode, component: FilePanel },
  spindle: { title: 'Spindle', icon: RotateCw, component: SpindlePanel },
}

// Sortable Panel Component
function SortablePanel({ 
  id, 
  isCollapsed, 
  onToggle,
  panelProps,
  onStartWizard
}: { 
  id: string
  isCollapsed: boolean
  onToggle: () => void
  panelProps: PanelProps
  onStartWizard?: (method: ZeroingMethod) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // When dragging, show a placeholder outline where item will go
    opacity: isDragging ? 0 : 1,
  }

  const config = panelConfig[id]
  if (!config) return null
  const PanelContent = config.component
  const Icon = config.icon

  return (
    <div ref={setNodeRef} style={style} className="relative">
      {/* Placeholder shown when this item is being dragged (shows where it came from / will land) */}
      {isDragging && (
        <div className="absolute inset-0 rounded-lg border-2 border-dashed border-primary bg-primary/10" />
      )}
      {/* The actual panel */}
      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        {/* Header row */}
        <div className="flex items-center border-b border-border bg-muted/30">
          {/* Drag handle - listeners applied ONLY here */}
          <div 
            {...attributes}
            {...listeners}
            className="p-2 cursor-grab hover:bg-muted/50 transition-colors touch-none"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground" />
          </div>
          {/* Header content - clickable for collapse */}
          <div 
            className="flex-1 flex items-center gap-2 pr-3 py-2 cursor-pointer" 
            onClick={onToggle}
          >
            <Icon className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium flex-1">{config.title}</span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
          </div>
        </div>
        {/* Panel content */}
        {!isCollapsed && (
          id === 'probe' && onStartWizard ? (
            <ProbePanel {...panelProps} onStartWizard={onStartWizard} />
          ) : (
            <PanelContent {...panelProps} />
          )
        )}
      </div>
    </div>
  )
}

// Drag overlay panel (shown while dragging) - full panel clone
function DragOverlayPanel({ id, isCollapsed, panelProps }: { id: string; isCollapsed: boolean; panelProps: PanelProps }) {
  const config = panelConfig[id]
  if (!config) return null
  const Icon = config.icon
  const PanelContent = config.component

  return (
    <div className="bg-card rounded-lg border-2 border-primary overflow-hidden shadow-2xl scale-[0.96]">
      <div className="flex items-center border-b border-border bg-muted/30">
        <div className="p-2 cursor-grabbing">
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 flex items-center gap-2 pr-3 py-2">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{config.title}</span>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
        </div>
      </div>
      {!isCollapsed && <PanelContent {...panelProps} />}
    </div>
  )
}

export default function Setup() {
  const navigate = useNavigate()
  
  // Panel order - just an array of IDs
  const [panelOrder, setPanelOrder] = useState(['dro', 'jog', 'spindle', 'rapid', 'probe', 'file', 'macros'])
  
  // Track which panels are collapsed
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({})
  
  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Machine status type
  type MachineStatus = 
    | 'not_connected'
    | 'connected_pre_home'
    | 'connected_post_home'
    | 'alarm'
    | 'running'
    | 'hold'
    | 'error'
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectedPort, setConnectedPort] = useState<string | null>(null)
  const [machineStatus, setMachineStatus] = useState<MachineStatus>('not_connected')
  const [isFlashing, setIsFlashing] = useState(false)
  const [isHomed, setIsHomed] = useState(false)
  const [isJobRunning, setIsJobRunning] = useState(false)
  const [homingInProgress, setHomingInProgress] = useState(false)
  
  // Position state
  const [machinePosition, setMachinePosition] = useState({ x: 0, y: 0, z: 0 })
  const [workPosition, setWorkPosition] = useState({ x: 0, y: 0, z: 0 })
  const [currentWCS, setCurrentWCS] = useState('G54') // Work Coordinate System
  
  // Spindle state
  const [spindleState, setSpindleState] = useState<'M3' | 'M4' | 'M5'>('M5')
  const [spindleSpeed, setSpindleSpeed] = useState<number>(0)
  
  // Hold state
  const [holdReason, setHoldReason] = useState<{ data?: string; msg?: string } | null>(null)
  
  // Probe status (from pinState - 'P' indicates probe contact)
  const [probeContact, setProbeContact] = useState<boolean>(false)
  
  // Wizard state
  const [wizardMethod, setWizardMethod] = useState<ZeroingMethod | null>(null)
  
  // Refs to track state in event handlers to avoid stale closures
  const machineStatusRef = useRef<MachineStatus>(machineStatus)
  machineStatusRef.current = machineStatus // Keep ref in sync
  const isConnectedRef = useRef(isConnected)
  isConnectedRef.current = isConnected
  const isHomedRef = useRef(isHomed)
  isHomedRef.current = isHomed
  const homingInProgressRef = useRef(homingInProgress)
  homingInProgressRef.current = homingInProgress
  const lastAlarmMessageRef = useRef<string | null>(null) // Track last alarm message from console
  
  // Notifications state
  const [notifications, setNotifications] = useState<Array<{
    id: string
    type: 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: Date
    read: boolean
  }>>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  
  // Get connection settings from API
  const { data: settings } = useGetSettingsQuery()
  
  // Get active controllers to check if we're already connected when remounting
  // Refetch on mount to ensure we have fresh data when navigating back
  const { data: controllersData, isLoading: isLoadingControllers, refetch: refetchControllers } = useGetControllersQuery(undefined, {
    refetchOnMountOrArgChange: true, // Always refetch when component mounts
  })

  // Lazy query for machine status (we'll call it manually when needed)
  const [getMachineStatus] = useLazyGetMachineStatusQuery()

  // Store backend machine status
  const [backendMachineStatus, setBackendMachineStatus] = useState<MachineStatusType | null>(null)
  
  // Show error notification
  const showErrorNotification = useCallback((title: string, message: string) => {
    const notification = {
      id: Date.now().toString(),
      type: 'error' as const,
      title,
      message,
      timestamp: new Date(),
      read: false
    }
    setNotifications(prev => [notification, ...prev])
    setNotificationsOpen(true)
  }, [])
  
  // Handle Connect/Disconnect
  const handleConnect = useCallback(() => {
    // Prevent double-clicking while connecting
    if (isConnecting) {
      return
    }
    
    // Check if settings are loaded
    if (!settings) {
      showErrorNotification('Settings Not Loaded', 'Please wait for settings to load, or check your connection to the server')
      return
    }
    
    // Check if port is configured
    if (!settings.connection?.port) {
      showErrorNotification('No Port Configured', 'Please configure a serial port in Settings before connecting')
      return
    }
    
    // Validate connection settings
    const { port, baudRate, controllerType } = settings.connection
    
    if (!port || port.trim() === '') {
      showErrorNotification('Invalid Port', 'Serial port is empty. Please configure a valid port in Settings')
      return
    }
    
    if (!baudRate || baudRate <= 0) {
      showErrorNotification('Invalid Baud Rate', `Baud rate must be greater than 0. Current: ${baudRate}`)
      return
    }
    
    if (isConnected && connectedPort) {
      // Disconnect
      
      const socket = socketService.getSocket()
      if (!socket) {
        // Socket not available - update UI immediately
        setIsConnected(false)
        setConnectedPort(null)
        setMachineStatus('not_connected')
        isHomedRef.current = false
        setIsHomed(false)
        setIsJobRunning(false)
        setSpindleState('M5')
        setSpindleSpeed(0)
        return
      }
      
      
      // Mark as manually disconnected to prevent restore
      manuallyDisconnectedRef.current = true
      
      // Update UI optimistically (will be confirmed by serialport:close event)
      setIsConnected(false)
      setConnectedPort(null)
      setMachineStatus('not_connected')
      isHomedRef.current = false
      setIsHomed(false)
      setIsJobRunning(false)
      setSpindleState('M5')
      setSpindleSpeed(0)
      
      // Request disconnect from backend
      socket.emit('close', connectedPort, (err: Error | null) => {
        if (err) {
          console.error('Disconnect error:', err)
          // If already disconnected, that's fine - UI is already updated
          // Only show error if it's a real error (not "already disconnected")
          const errorMessage = err.message || (typeof err === 'string' ? err : 'Failed to disconnect from machine')
          if (!errorMessage.toLowerCase().includes('not connected') && 
              !errorMessage.toLowerCase().includes('already') &&
              !errorMessage.toLowerCase().includes('not found')) {
            showErrorNotification('Disconnect Failed', errorMessage)
          }
        }
        // UI is already updated above, so we don't need to update it here
        // The serialport:close event will also confirm the disconnect
      })
    } else {
      // Connect
      setIsConnecting(true)
      
      // Set a timeout for connection attempts (10 seconds)
      const connectionTimeout = setTimeout(() => {
        setIsConnecting(false)
        showErrorNotification('Connection Timeout', 'Connection attempt timed out. Please check that the port is available and the machine is powered on.')
      }, 10000)
      
      // Ensure socket is connected first
      let socket = socketService.getSocket()
      if (!socket || !socketService.isConnected()) {
        socket = socketService.connect()
        if (!socket) {
          clearTimeout(connectionTimeout)
          setIsConnecting(false)
          showErrorNotification('Socket Connection Failed', 'Failed to establish socket connection. Please check your authentication and try again.')
          return
        }
      }
      
      // Wait a moment for socket to be ready if it was just connected
      const attemptConnection = () => {
        socket = socketService.getSocket()
        if (!socket) {
          clearTimeout(connectionTimeout)
          setIsConnecting(false)
          showErrorNotification('Socket Not Ready', 'Socket connection is not ready. Please try again.')
          return
        }
        
        socket.emit('open', port, {
          baudrate: baudRate,
          controllerType: controllerType || 'Grbl'
        }, (err: Error | null) => {
          clearTimeout(connectionTimeout)
          setIsConnecting(false)
          if (err) {
            console.error('Connection error:', err)
            const errorMessage = err.message || (typeof err === 'string' ? err : 'Failed to connect to machine')
            showErrorNotification('Connection Failed', errorMessage)
          } else {
            setIsConnected(true)
            setConnectedPort(port)
            setMachineStatus('connected_pre_home')
            isHomedRef.current = false
            setIsHomed(false) // Reset homing state on new connection
          }
        })
      }
      
      // If socket was just connected, give it a moment to initialize
      if (!socketService.isConnected()) {
        setTimeout(attemptConnection, 100)
      } else {
        attemptConnection()
      }
    }
  }, [settings, isConnected, isConnecting, connectedPort, showErrorNotification])
  
  // Flash status when action attempted while disconnected
  const flashStatus = useCallback(() => {
    // Trigger flash animation: 150ms ramp up, 3x 50ms flash, 150ms ramp down (450ms total)
    setIsFlashing(true)
    setTimeout(() => {
      setIsFlashing(false)
    }, 450)
  }, [])
  
  // Handle Home button - transitions to post-home after successful homing
  const handleHome = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot home: not connected')
      flashStatus()
      return
    }
    setHomingInProgress(true)
    homingInProgressRef.current = true
    socketService.getSocket()?.emit('command', connectedPort, 'homing')
    // Note: actual transition to post-home happens when we receive homing completion from controller
  }, [isConnected, connectedPort, flashStatus])
  
  // Handle Reset button - goes to pre-home state
  const handleReset = useCallback(() => {
    if (!connectedPort) return
    socketService.getSocket()?.emit('command', connectedPort, 'reset')
    setMachineStatus('connected_pre_home')
    isHomedRef.current = false
    setIsHomed(false) // Reset homing state after reset
    setHomingInProgress(false)
    homingInProgressRef.current = false
    setIsJobRunning(false)
  }, [connectedPort])
  
  // Handle Unlock button (clears alarms) - goes to pre-home state after unlock
  const handleUnlock = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot unlock: not connected')
      flashStatus()
      return
    }
    socketService.getSocket()?.emit('command', connectedPort, 'unlock')
    // After unlock, transition to pre-home (position might not be trusted)
    setMachineStatus('connected_pre_home')
    isHomedRef.current = false
    setIsHomed(false)
    setHomingInProgress(false)
    homingInProgressRef.current = false
  }, [isConnected, connectedPort, flashStatus])
  
  // Handle E-Stop button (emergency stop - force stop all motion)
  const handleEStop = useCallback(() => {
    if (!connectedPort) return
    const socket = socketService.getSocket()
    if (!socket) return
    
    // Stop workflow first
    socket.emit('command', connectedPort, 'gcode:stop', { force: true })
    
    // Always send reset command to Grbl (sends Ctrl-X) regardless of state
    // This ensures E-Stop always sends something to the machine
    socket.emit('command', connectedPort, 'reset')
    
    // E-Stop should stop any running job
    setIsJobRunning(false)
    // Reset homing state after E-Stop (machine position may be invalid)
    isHomedRef.current = false
    setIsHomed(false)
    setHomingInProgress(false)
    homingInProgressRef.current = false
    setMachineStatus('connected_pre_home')
    // Clear hold state on E-Stop
    setHoldReason(null)
  }, [connectedPort])
  
  // Handle Resume button (sends ~ to resume from hold and resets feeder/sender state)
  const handleResume = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot resume: not connected')
      flashStatus()
      return
    }
    const socket = socketService.getSocket()
    if (!socket) {
      console.warn('Cannot resume: socket not available')
      flashStatus()
      return
    }
    // Send gcode:resume command (sends ~ AND resets feeder/sender hold state)
    // This is better than cyclestart which only sends ~ without resetting feeder state
    socket.emit('command', connectedPort, 'gcode:resume')
  }, [isConnected, connectedPort, flashStatus])
  
  // Handle Stop button (stops the job during hold)
  const handleStop = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot stop: not connected')
      flashStatus()
      return
    }
    const socket = socketService.getSocket()
    if (!socket) {
      console.warn('Cannot stop: socket not available')
      flashStatus()
      return
    }
    // Stop the job
    socket.emit('command', connectedPort, 'gcode:stop')
    setIsJobRunning(false)
    // Clear hold state
    setHoldReason(null)
    // Status will be updated by workflow:state event
  }, [isConnected, connectedPort, flashStatus])
  
  // Handler for jog commands (called from JogPanel)
  const handleJogAction = useCallback(() => {
    if (!isConnected) {
      flashStatus()
    }
  }, [isConnected, flashStatus])
  
  // Track if we've received initial state from backend (for page refresh)
  const hasReceivedInitialStateRef = useRef(false)
  
  // Track if we manually disconnected (to prevent restore after manual disconnect)
  const manuallyDisconnectedRef = useRef(false)
  
  // Listen for connection events and errors
  useEffect(() => {
    const handleSerialPortOpen = (...args: unknown[]) => {
      const data = args[0] as { port: string }
      
      // Clear manual disconnect flag when we successfully connect
      manuallyDisconnectedRef.current = false
      
      setIsConnected(true)
      setConnectedPort(data.port)
      setIsConnecting(false)
      
      // On initial connection, backend will send current state via:
      // - controller:state (activeState, positions, etc.)
      // - feeder:status (hold state, hold reason)
      // - sender:status (hold state, hold reason)
      // - workflow:state (running/idle/paused)
      // Don't reset state here - wait for those events to set the truth
      // If this is a new connection (not page refresh), state will be reset below
      if (!hasReceivedInitialStateRef.current) {
        // Wait for initial state from backend
        // State will be set by controller:state, feeder:status, sender:status, workflow:state events
        // Set a default status that will be overridden by actual state
        setMachineStatus('connected_pre_home')
      }
    }
    
    const handleSerialPortClose = (data?: { port?: string }) => {
      
      setIsConnected(false)
      setConnectedPort(null)
      setIsConnecting(false)
      setMachineStatus('not_connected')
      isHomedRef.current = false
      setIsHomed(false)
      setHomingInProgress(false)
      homingInProgressRef.current = false
      setIsJobRunning(false)
      setSpindleState('M5')
      setSpindleSpeed(0)
      
    }
    
    const handleSocketError = (error: unknown) => {
      console.error('Socket error:', error)
      setIsConnecting(false)
      setMachineStatus('error')
      const errorMessage = error instanceof Error ? error.message : 'Socket connection error occurred'
      showErrorNotification('Socket Error', errorMessage)
    }
    
    // Listen for controller state changes to detect alarm, running, and homing states
    // This is called on initial connection (page refresh) AND on state changes
    const handleControllerState = (...args: unknown[]) => {
      // Backend sends: controller:state(GRBL, state)
      // State structure: { status: { activeState: 'Idle'|'Run'|'Alarm'|... }, parserstate: {...} }
      const controllerType = args[0] as string
      const state = args[1] as { 
        status?: {
          activeState?: string
          mpos?: { x?: string; y?: string; z?: string }
          wpos?: { x?: string; y?: string; z?: string }
          pinState?: string // Grbl v1.1: 'P' indicates probe triggered, e.g., 'PZ' = probe + Z limit
        }
        parserstate?: {
          modal?: {
            wcs?: string
            spindle?: string // 'M3', 'M4', or 'M5'
          }
          spindle?: string // Speed value as string (e.g., "1000.0")
        }
      }
      
      // Update positions
      if (state.status?.mpos) {
        setMachinePosition({
          x: parseFloat(state.status.mpos.x || '0'),
          y: parseFloat(state.status.mpos.y || '0'),
          z: parseFloat(state.status.mpos.z || '0')
        })
      }
      if (state.status?.wpos) {
        setWorkPosition({
          x: parseFloat(state.status.wpos.x || '0'),
          y: parseFloat(state.status.wpos.y || '0'),
          z: parseFloat(state.status.wpos.z || '0')
        })
      }
      
      // Update WCS from parserstate
      if (state.parserstate?.modal?.wcs) {
        setCurrentWCS(state.parserstate.modal.wcs)
      }
      
      // Update spindle state from parserstate
      if (state.parserstate?.modal?.spindle) {
        const spindle = state.parserstate.modal.spindle
        if (spindle === 'M3' || spindle === 'M4' || spindle === 'M5') {
          setSpindleState(spindle)
        }
      }
      
      // Update probe contact status from pinState (Grbl v1.1)
      // pinState contains 'P' when probe is triggered
      if (state.status?.pinState !== undefined) {
        const pinState = state.status.pinState || ''
        setProbeContact(pinState.includes('P'))
      }
      
      // Update spindle speed from parserstate
      if (state.parserstate?.spindle !== undefined) {
        const speed = parseFloat(state.parserstate.spindle || '0')
        setSpindleSpeed(speed)
      }
      
      // Only update status if we're actually connected
      if (!isConnectedRef.current) return
      
      // Mark that we've received initial state from backend (for page refresh handling)
      hasReceivedInitialStateRef.current = true
      
      // Extract activeState from nested structure
      const activeState = state.status?.activeState || ''
      const isAlarm = activeState === 'Alarm'
      const isRunning = activeState === 'Run'
      const isHold = activeState === 'Hold'
      const isHoming = activeState === 'Home'
      const isIdle = activeState === 'Idle'
      
      // Check if homing completed FIRST - when we transition from 'Home' state to 'Idle'
      // This must run before the status update logic to avoid race conditions
      let homingJustCompleted = false
      // Check if we're idle and homing was in progress - this indicates homing completed
      // We check homingInProgressRef to detect the transition from Home to Idle
      if (isIdle && !isHoming && homingInProgressRef.current && !isHomedRef.current && isConnectedRef.current) {
        // Homing was in progress and now we're idle - homing completed
        isHomedRef.current = true
        setIsHomed(true)
        setHomingInProgress(false)
        homingInProgressRef.current = false
        setMachineStatus('connected_post_home')
        homingJustCompleted = true
      } else if (isIdle && !isHoming && !homingInProgressRef.current && !isHomedRef.current) {
        // Reset homing progress flag if we're idle without homing active
        setHomingInProgress(false)
      }
      
      // Priority: Alarm > Hold > Running (from workflow) > Idle (post-home) > Idle (pre-home)
      // Note: Running state is handled by workflow:state, not controller:state
      // Don't override running/hold status unless we get an alarm
      // Use isHomedRef to avoid stale closure issues
      // Don't override status if homing just completed (already set above)
      // Note: Hold from controller:state is complementary to sender:status hold
      //       sender:status provides hold reason (M0, M6, etc.), controller:state confirms Hold state
      if (isAlarm) {
        // Check current status before updating - this is the "previous" value for transition detection
        const currentStatus = machineStatusRef.current
        const isTransitioningToAlarm = currentStatus !== 'alarm'
        
        setMachineStatus('alarm')
        setIsJobRunning(false)
        // Clear hold on alarm
        setHoldReason(null)
        
        // Show notification when transitioning TO alarm state (not when already in alarm)
        if (isTransitioningToAlarm) {
          // Try to get alarm message from ref (updated by VisualizerPanel when serialport:read events arrive)
          let alarmMessage = lastAlarmMessageRef.current
          
          // If still no message found, wait a short time for the alarm message to arrive via serialport:read
          // This handles the case where controller:state arrives before serialport:read
          if (!alarmMessage) {
            // Wait up to 100ms for alarm message to arrive
            setTimeout(() => {
              const delayedMessage = lastAlarmMessageRef.current || 'Machine alarm triggered'
              showErrorNotification('Machine Alarm', delayedMessage)
            }, 100)
          } else {
            // Message found immediately, show notification right away
            showErrorNotification('Machine Alarm', alarmMessage)
          }
        }
      } else if (isHold) {
        // Grbl reports Hold state - set machine status to hold
        // If we already have hold reason from sender:status, keep it
        // If not, we still show hold status (reason might come later)
        setMachineStatus('hold')
        setIsJobRunning(true) // Job is still running, just paused
      } else if (!isJobRunning && !homingJustCompleted && machineStatus !== 'hold') {
        // Only update status if workflow is not running, not in hold, and homing didn't just complete
        // Workflow running state takes priority over controller idle state
        // Hold state takes priority over idle state
        if (isIdle && isHomedRef.current) {
          // Idle after homing = post-home ready
          setMachineStatus('connected_post_home')
        } else if (isHoming) {
          // Homing in progress - stay in pre-home until complete
          setMachineStatus('connected_pre_home')
        } else if (isIdle && !isHomedRef.current) {
          // Idle but not homed = pre-home
          setMachineStatus('connected_pre_home')
        }
      } else if (isIdle && machineStatus === 'hold' && !isHold) {
        // If we were in hold and now we're idle (not hold), clear hold state
        // This handles the case where hold is cleared (e.g., after resume)
        setHoldReason(null)
        // Let workflow/controller determine the new status
        if (isHomedRef.current) {
          setMachineStatus('connected_post_home')
        } else {
          setMachineStatus('connected_pre_home')
        }
      } else if (isHold && machineStatus !== 'hold') {
        // Controller shows Hold but UI doesn't - set hold state
        // (holdReason will be set by sender:status or feeder:status if available)
        setMachineStatus('hold')
        setIsJobRunning(true)
      } else if (!isHold && machineStatus === 'hold') {
        // Controller no longer shows Hold but UI does - clear hold state
        setHoldReason(null)
        if (isHomedRef.current) {
          setMachineStatus('connected_post_home')
        } else {
          setMachineStatus('connected_pre_home')
        }
      }
    }
    
    // Listen for workflow state to detect running jobs
    const handleWorkflowState = (workflowState: string) => {
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      // workflowState is 'idle', 'running', or 'paused'
      // Note: Don't override hold status - hold takes priority
      // Use functional setState to check current state
      setMachineStatus((currentStatus) => {
        if (currentStatus === 'hold') {
          // Hold takes priority - don't change status
          if (workflowState === 'running') {
            setIsJobRunning(true)
          }
          return currentStatus
        }
        
        if (workflowState === 'running') {
          setIsJobRunning(true)
          return 'running'
        } else {
          setIsJobRunning(false)
          // When workflow stops (idle or paused), let controller state determine the status
          // The controller state handler will set the appropriate status
          return currentStatus // Keep current status, controller will update it
        }
      })
    }
    
    // Listen for sender status to detect hold state (for loaded G-code files)
    const handleSenderStatus = (senderData: {
      hold?: boolean
      holdReason?: { data?: string; msg?: string; err?: boolean }
      name?: string
      size?: number
      total?: number
      sent?: number
      received?: number
    }) => {
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      if (senderData.hold && senderData.holdReason) {
        // Machine is in hold state (from sender - loaded G-code files)
        setHoldReason(senderData.holdReason)
        setMachineStatus('hold')
        setIsJobRunning(true) // Job is still running, just paused
      } else if (!senderData.hold && machineStatus === 'hold') {
        // Hold was cleared - check if we should reset
        // Only reset if controller state also says we're not in hold
        // This prevents resetting when sender clears but controller still shows Hold
      }
    }
    
    // Listen for feeder status to get hold reason (for macros sent via command('gcode'))
    // NOTE: We don't set hold state from feeder status - only controller state determines hold
    // Feeder status is only used to get the hold reason message (M0 comment, etc.)
    // This is called on initial connection (page refresh) AND on state changes
    const handleFeederStatus = (feederData: {
      hold?: boolean
      holdReason?: { data?: string; msg?: string; err?: boolean }
      queue?: number
      pending?: boolean
    }) => {
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      // Mark that we've received initial state from backend
      hasReceivedInitialStateRef.current = true
      
      // Only update hold reason if controller confirms we're in Hold state
      // This prevents storing hold reason from stale feeder state
      if (feederData.hold && feederData.holdReason && machineStatusRef.current === 'hold') {
        // Machine is in hold state (confirmed by controller) - update hold reason message
        setHoldReason(prevReason => {
          // Prefer feeder holdReason if it has a message, otherwise keep previous
          if (feederData.holdReason?.msg) {
            return feederData.holdReason
          }
          return prevReason || feederData.holdReason
        })
      } else if (!feederData.hold && machineStatusRef.current !== 'hold') {
        // Feeder hold was cleared AND controller confirms we're not in hold - clear hold reason
        if (holdReason) {
          setHoldReason(null)
        }
      }
    }
    
    // Listen for homing completion (controller-specific events)
    const handleHomingComplete = () => {
      if (isConnectedRef.current) {
        isHomedRef.current = true
        setIsHomed(true)
        setHomingInProgress(false)
        homingInProgressRef.current = false
        setMachineStatus('connected_post_home')
      }
    }
    
    const handleSocketDisconnect = (reason: unknown) => {
      if (isConnected) {
        setIsConnected(false)
        setConnectedPort(null)
        setMachineStatus('not_connected')
        isHomedRef.current = false
        setIsHomed(false)
        setIsJobRunning(false)
        setSpindleState('M5')
        setSpindleSpeed(0)
        const reasonStr = typeof reason === 'string' ? reason : 'Connection lost'
        showErrorNotification('Connection Lost', `Socket disconnected: ${reasonStr}`)
      }
    }
    
    socketService.on('serialport:open', handleSerialPortOpen)
    socketService.on('serialport:close', handleSerialPortClose)
    socketService.on('error', handleSocketError)
    socketService.on('disconnect', handleSocketDisconnect)
    socketService.on('controller:state', handleControllerState)
    socketService.on('workflow:state', handleWorkflowState)
    socketService.on('sender:status', handleSenderStatus)
    socketService.on('feeder:status', handleFeederStatus)
    socketService.on('controller:homing', handleHomingComplete)
    socketService.on('grbl:homing', handleHomingComplete) // Grbl-specific
    socketService.on('marlin:homing', handleHomingComplete) // Marlin-specific
    
    
    return () => {
      socketService.off('serialport:open', handleSerialPortOpen)
      socketService.off('serialport:close', handleSerialPortClose)
      socketService.off('error', handleSocketError)
      socketService.off('disconnect', handleSocketDisconnect)
      socketService.off('controller:state', handleControllerState)
      socketService.off('workflow:state', handleWorkflowState)
      socketService.off('sender:status', handleSenderStatus)
      socketService.off('feeder:status', handleFeederStatus)
      socketService.off('controller:homing', handleHomingComplete)
      socketService.off('grbl:homing', handleHomingComplete)
      socketService.off('marlin:homing', handleHomingComplete)
    }
  }, [showErrorNotification, isConnected])
  
  // Listen to machine:status events from backend (single source of truth)
  useEffect(() => {
    const socket = socketService.getSocket()
    if (!socket) {
      return
    }


    const handleMachineStatus = (port: string, status: MachineStatusType) => {

      // Update backend status
      setBackendMachineStatus(status)

      // Only update local state if this is for the configured port
      if (status.port === settings?.connection?.port) {
        
        setIsConnected(status.connected)
        setConnectedPort(status.connected ? status.port : null)
        setMachineStatus(status.machineStatus)
        setIsHomed(status.isHomed)
        isHomedRef.current = status.isHomed
        setIsJobRunning(status.isJobRunning)
        
        if (status.controllerState) {
          setMachinePosition({
            x: parseFloat(status.controllerState.mpos?.x || '0'),
            y: parseFloat(status.controllerState.mpos?.y || '0'),
            z: parseFloat(status.controllerState.mpos?.z || '0')
          })
          setWorkPosition({
            x: parseFloat(status.controllerState.wpos?.x || '0'),
            y: parseFloat(status.controllerState.wpos?.y || '0'),
            z: parseFloat(status.controllerState.wpos?.z || '0')
          })
        }
      } else {
      }
    }

    socket.on('machine:status', handleMachineStatus)

    // Request current status on mount
    if (settings?.connection?.port) {
      socket.emit('machine:status:request', settings.connection.port)
    } else {
      socket.emit('machine:status:request')
    }

    return () => {
      socket.off('machine:status', handleMachineStatus)
    }
  }, [settings?.connection?.port])

  // Separate effect to restore connection state when component mounts or controllers data loads
  // This handles both navigation back (socket connected) and hard refresh (socket not connected yet)
  // NOTE: This is a fallback - the machine:status Socket.IO events should be the primary source
  useEffect(() => {
    // If we already have backend machine status, use that instead
    if (backendMachineStatus && backendMachineStatus.connected && backendMachineStatus.port === settings?.connection?.port) {
      setIsConnected(backendMachineStatus.connected)
      setConnectedPort(backendMachineStatus.port)
      setMachineStatus(backendMachineStatus.machineStatus)
      setIsHomed(backendMachineStatus.isHomed)
      isHomedRef.current = backendMachineStatus.isHomed
      setIsJobRunning(backendMachineStatus.isJobRunning)
      return
    }
    
    const checkAndRestore = () => {
      
      // Only run if we're not already connected
      if (isConnected) {
        return
      }
      
      // If we manually disconnected, don't restore
      if (manuallyDisconnectedRef.current) {
        return
      }
      
      // Try to get machine status from API first (more reliable than controllers)
      if (settings?.connection?.port) {
        getMachineStatus({ port: settings.connection.port })
          .unwrap()
          .then((response) => {
            if (response.status && response.status.connected) {
              const status = response.status
              
              setIsConnected(true)
              setConnectedPort(status.port)
              setMachineStatus(status.machineStatus)
              setIsHomed(status.isHomed)
              isHomedRef.current = status.isHomed
              setIsJobRunning(status.isJobRunning)
              
              // Store backend status so restore effect can use it
              setBackendMachineStatus(status)
              
              // Join port room ONLY if socket is connected
              // The backend should preserve state when joining an existing connection
              // Request status via Socket.IO instead of calling open
              const socket = socketService.getSocket()
              if (socket?.connected) {
                // Request current status via Socket.IO (backend will preserve state)
                socket.emit('machine:status:request', status.port)
                
                // Also join the port room to receive console events
                // But only if we haven't already joined (to avoid triggering serialport:open)
                // Actually, we need to join the room - but the backend should handle this gracefully
                // The backend's handleSerialPortOpen now preserves state, so this should be safe
                const connectionOptions = settings.connection ? {
                  controllerType: settings.connection.controllerType || 'Grbl',
                  baudrate: settings.connection.baudRate || 115200,
                  rtscts: settings.connection.rtscts || false,
                } : {
                  controllerType: 'Grbl',
                  baudrate: 115200,
                  rtscts: false,
                }
                
                socket.emit('open', status.port, connectionOptions, (err: Error | null) => {
                  if (!err) {
                    // Request status again after joining to ensure we have latest
                    setTimeout(() => {
                      socket.emit('machine:status:request', status.port)
                    }, 100)
                    
                    // Force a status report to trigger console events and verify listeners are working
                    setTimeout(() => {
                      socket.emit('command', status.port, 'statusreport')
                    }, 200)
                  } else {
                    console.error('[Setup] Error joining port room:', err)
                  }
                })
              } else {
              }
            }
          })
          .catch((err) => {
            console.warn('[Setup] Failed to get machine status from API, falling back to controllers:', err)
            // Fall through to controllers-based restore
            restoreFromControllers()
          })
        return
      }
      
      // Fallback: restore from controllers data (old method)
      restoreFromControllers()
    }

    const restoreFromControllers = () => {
      // Wait for controllers data to be available
      if (!controllersData) {
        return
      }
      
      const controllers = controllersData || []
      if (controllers.length > 0) {
        const activeController = controllers[0]
        const port = activeController.port
        if (!port) {
          return
        }
        
        setIsConnected(true)
        setConnectedPort(port)
        
        // Use homed flag from backend controller
        const isHomed = activeController.homed === true
        const controllerState = activeController.controller?.state
        
        if (controllerState?.status?.activeState === 'Alarm') {
          setMachineStatus('alarm')
          setIsHomed(false)
        } else if (isHomed) {
          setMachineStatus('connected_post_home')
          setIsHomed(true)
        } else {
          setMachineStatus('connected_pre_home')
          setIsHomed(false)
        }
        isHomedRef.current = isHomed
        
        // Join port room
        const socket = socketService.getSocket()
        if (socket?.connected) {
          const connectionOptions = {
            controllerType: activeController.controller?.type || 'Grbl',
            baudrate: activeController.baudrate || 115200,
            rtscts: activeController.rtscts || false,
          }
          socket.emit('open', port, connectionOptions)
        }
      }
    }
    
    // Check immediately on mount
    checkAndRestore()
      
    // Also check when controllersData changes (in case it loads after mount)
  }, [controllersData, isConnected, connectedPort, settings?.connection?.port, backendMachineStatus, getMachineStatus])
  
  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        const oldIndex = items.indexOf(active.id as string)
        const newIndex = items.indexOf(over.id as string)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }
  
  const togglePanel = (panelId: string) => {
    setCollapsedPanels(prev => ({ ...prev, [panelId]: !prev[panelId] }))
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* OverlayScrollbars custom styling */}
      <style>{`
        .os-scrollbar {
          --os-size: 8px;
          --os-padding-perpendicular: 2px;
          --os-padding-axis: 2px;
        }
        .os-scrollbar-handle {
          background: hsl(var(--muted-foreground) / 0.3) !important;
          border-radius: 4px !important;
        }
        .os-scrollbar-handle:hover {
          background: hsl(var(--muted-foreground) / 0.5) !important;
        }
        .os-scrollbar-track {
          background: transparent !important;
        }
        @keyframes flash-bright {
          0% {
            filter: brightness(1);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
          }
          33.3% {
            /* 150ms: Ramp up complete */
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          38.9% {
            /* 175ms: Flash 1 peak */
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          44.4% {
            /* 200ms: Flash 1 low */
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          50% {
            /* 225ms: Flash 2 peak */
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          55.6% {
            /* 250ms: Flash 2 low */
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          61.1% {
            /* 275ms: Flash 3 peak */
            filter: brightness(1.8);
            transform: scale(1.08);
            box-shadow: 0 0 12px 3px currentColor;
          }
          66.7% {
            /* 300ms: Flash 3 low - start ramp down */
            filter: brightness(1.3);
            transform: scale(1.04);
            box-shadow: 0 0 6px 2px currentColor;
          }
          100% {
            /* 450ms: Ramp down complete */
            filter: brightness(1);
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(0, 0, 0, 0);
          }
        }
      `}</style>
      {/* Header - persistent across all screens */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <img src="/fulllogo.png" alt="AxioCNC" className="h-8 w-auto" />
        </div>
        
        {/* Mode tabs */}
        <div className="flex gap-1 ml-6">
          <Button variant="default" size="sm">Setup</Button>
          <Button variant="ghost" size="sm">Monitor</Button>
          <Button variant="ghost" size="sm">Stats</Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>Settings</Button>
        </div>
        
        {/* Spacer */}
        <div className="flex-1" />
        
        {/* Notifications button */}
        <div className="relative">
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            onClick={() => setNotificationsOpen(true)}
          >
            <Bell className="w-4 h-4" />
          </Button>
          {notifications.filter(n => !n.read).length > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">
                {notifications.filter(n => !n.read).length > 9 ? '9+' : notifications.filter(n => !n.read).length}
              </span>
            </div>
          )}
        </div>
        
        {/* Emergency actions - Reset and E-Stop */}
        <div className="ml-4 flex items-center gap-2">
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={flashStatus}
            onAction={handleReset}
            requirements={ActionRequirements.allowAlarm}
            variant="outline"
            size="sm"
            className="h-9 px-4"
          >
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </MachineActionButton>
          <MachineActionButton
            isConnected={isConnected}
            connectedPort={connectedPort}
            machineStatus={machineStatus}
            onFlashStatus={flashStatus}
            onAction={handleEStop}
            requirements={ActionRequirements.standard}
            variant="destructive"
            size="lg"
            className="h-10 px-6 font-bold uppercase tracking-wide bg-red-600 hover:bg-red-700"
          >
            <Square className="w-5 h-5 mr-2" />
            E-Stop
          </MachineActionButton>
        </div>
      </header>
      
      {/* Setup control bar - screen-specific controls */}
      <div className="h-12 border-b border-border bg-muted/30 flex items-center px-4 gap-2">
        <span className="text-sm text-muted-foreground mr-2">Machine:</span>
        {/* Machine status - rectangular badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div 
                className={`
                  relative px-3 py-1.5 rounded border flex items-center gap-2 min-w-[140px] justify-center
                  transition-all duration-200
                  ${
                    machineStatus === 'connected_post_home' || machineStatus === 'running'
                      ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' 
                      : machineStatus === 'connected_pre_home'
                      ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
                      : machineStatus === 'hold'
                      ? 'bg-orange-500/10 border-orange-500/30 text-orange-700 dark:text-orange-400'
                      : machineStatus === 'alarm'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                      : machineStatus === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400'
                      : 'bg-muted border-border text-muted-foreground'
                  }
                `}
                style={isFlashing ? {
                  animation: 'flash-bright 450ms ease-in-out'
                } : {}}
              >
                <div 
                  className={`
                    w-2 h-2 rounded-full
                    ${
                      machineStatus === 'connected_post_home' || machineStatus === 'running'
                        ? 'bg-green-500' 
                        : machineStatus === 'connected_pre_home'
                        ? 'bg-yellow-500'
                        : machineStatus === 'hold'
                        ? 'bg-orange-500'
                        : machineStatus === 'alarm' || machineStatus === 'error'
                        ? 'bg-red-500'
                        : 'bg-zinc-500'
                    }
                  `} 
                />
                <span className="text-xs font-medium pr-3">
                  {machineStatus === 'not_connected'
                    ? 'Not connected'
                    : machineStatus === 'connected_pre_home'
                    ? 'Ready (Run Home)'
                    : machineStatus === 'connected_post_home'
                    ? 'Ready'
                    : machineStatus === 'alarm'
                    ? 'Alarm'
                    : machineStatus === 'running'
                    ? 'Busy'
                    : machineStatus === 'hold'
                    ? 'Hold'
                    : machineStatus === 'error'
                    ? 'Error'
                    : 'Unknown'}
                </span>
                {/* Help icon in top right */}
                <HelpCircle className="absolute top-0.5 right-0.5 w-3 h-3 text-white cursor-help" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">
                {machineStatus === 'not_connected'
                  ? 'AxioCNC is not connected to your machine.'
                  : machineStatus === 'connected_pre_home'
                  ? 'Your machine is connected, but AxioCNC can\'t verify that the displayed position matches the physical machine. Home your machine to establish truth of position.'
                  : machineStatus === 'connected_post_home'
                  ? 'Your machine is connected and ready.'
                  : machineStatus === 'hold'
                  ? 'Your machine is paused and motion is disabled for safety. This can happen during a tool change, or because a job was paused. Click Resume to enable machine motion.'
                  : machineStatus === 'alarm'
                  ? 'The machine is in an error state and motion has been disabled. Hit Reset to clear the alarm. If the machine is still in alarm state after a reset, it may need to be unlocked to complete the reset. In all cases, the machine should be rehomed after clearing the alarm to establish truth of position. AxioCNC can\'t verify that the displayed position matches the physical machine until it is rehomed.'
                  : machineStatus === 'running'
                  ? 'Your machine is running a job.'
                  : machineStatus === 'error'
                  ? 'An error has occurred.'
                  : 'Unknown machine status.'}
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Action buttons - context-aware based on machine status */}
        {machineStatus === 'hold' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="default" size="sm" onClick={handleResume}>
              <Play className="w-4 h-4 mr-1" /> Resume
            </Button>
            <Button variant="outline" size="sm" onClick={handleStop}>
              <Square className="w-4 h-4 mr-1" /> Stop
            </Button>
          </>
        )}
        
        {machineStatus === 'not_connected' && (
          <div className="ml-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        )}
        
        {/* Connected pre-home: Yellow Ready (Run Home) - Show Disconnect and Home */}
        {machineStatus === 'connected_pre_home' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleHome}>
              <Home className="w-4 h-4 mr-1" /> Run Home
            </Button>
          </>
        )}
        
        {/* Connected post-home: Green Ready - Show Disconnect and Home */}
        {machineStatus === 'connected_post_home' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleHome}>
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          </>
        )}
        
        {/* Running: Green Busy - Show Disconnect and Home */}
        {machineStatus === 'running' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleHome} disabled>
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          </>
        )}
        
        {/* Alarm: Red Alarm - Show Unlock and Home */}
        {machineStatus === 'alarm' && (
          <>
            <div className="ml-3">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                Disconnect
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={handleUnlock}>
              <Unlock className="w-4 h-4 mr-1" /> Unlock
            </Button>
            <Button variant="outline" size="sm" onClick={handleHome}>
              <Home className="w-4 h-4 mr-1" /> Home
            </Button>
          </>
        )}
        
        <div className="flex-1" />
        
        <div className="w-px h-6 bg-border mx-2" />
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">Job:</span>
          <Button variant="outline" size="sm">
            <Play className="w-4 h-4 mr-1" /> Start
          </Button>
          <Button variant="outline" size="sm">
            <Pause className="w-4 h-4 mr-1" /> Pause
          </Button>
        </div>
      </div>
      
      {/* Dashboard - Two column flex layout */}
      <main className="flex-1 flex gap-2 p-2 min-h-0">
        {/* Left column - scrollable sortable list (33%) */}
        <OverlayScrollbarsComponent 
          className="w-1/3"
          options={{ scrollbars: { autoHide: 'scroll', autoHideDelay: 400 } }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={panelOrder} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {panelOrder.map((panelId) => (
                  <SortablePanel
                    key={panelId}
                    id={panelId}
                    isCollapsed={collapsedPanels[panelId] ?? false}
                    onToggle={() => togglePanel(panelId)}
                    panelProps={{
                      isConnected,
                      connectedPort,
                      machineStatus,
                      onFlashStatus: flashStatus,
                      machinePosition,
                      workPosition,
                      currentWCS,
                      isJobRunning,
                      spindleState,
                      spindleSpeed
                    }}
                    onStartWizard={(method) => setWizardMethod(method)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <DragOverlayPanel 
                  id={activeId} 
                  isCollapsed={collapsedPanels[activeId] ?? false}
                  panelProps={{
                    isConnected,
                    connectedPort,
                    machineStatus,
                    onFlashStatus: flashStatus,
                    machinePosition,
                    workPosition,
                    currentWCS
                  }}
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        </OverlayScrollbarsComponent>
        
        {/* Right column - fixed layout (66%) */}
        <div className="w-2/3 flex flex-col gap-2 min-h-0">
          {/* Visualizer - 75% height */}
          <div className="flex-[3] min-h-0 bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <VisualizerPanel 
              isConnected={isConnected} 
              connectedPort={connectedPort}
              wizardMethod={wizardMethod}
              onWizardClose={() => setWizardMethod(null)}
              machinePosition={machinePosition}
              workPosition={workPosition}
              probeContact={probeContact}
              lastAlarmMessageRef={lastAlarmMessageRef}
              currentWCS={currentWCS}
            />
          </div>
          {/* Tools - 25% height */}
          <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <ToolsPanel />
          </div>
        </div>
      </main>
      
      {/* Notifications Modal */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Notifications & Errors</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mt-4">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${
                    notification.type === 'error'
                      ? 'border-red-500/50 bg-red-500/10'
                      : notification.type === 'warning'
                      ? 'border-yellow-500/50 bg-yellow-500/10'
                      : 'border-border bg-muted/30'
                  } ${!notification.read ? 'opacity-100' : 'opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {notification.type === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Bell className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{notification.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {notification.timestamp.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => {
                        setNotifications(prev =>
                          prev.map(n =>
                            n.id === notification.id ? { ...n, read: true } : n
                          )
                        )
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNotifications([])
              }}
            >
              Clear All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })))
              }}
            >
              Mark All Read
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

