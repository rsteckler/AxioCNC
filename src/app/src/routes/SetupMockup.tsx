import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { socketService } from '@/services/socket'
import { useGetSettingsQuery, useGetMacrosQuery } from '@/services/api'
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
  ArrowDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MachineActionButton } from '@/components/MachineActionButton'
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
  
  // Handle zero out work offset for a single axis
  const handleZeroAxis = useCallback((axis: 'X' | 'Y' | 'Z') => {
    if (!connectedPort) return
    const p = getWCSPNumber(workspace)
    const gcode = `G10 L20 P${p} ${axis}0`
    socketService.getSocket()?.emit('command', connectedPort, 'gcode', gcode)
  }, [connectedPort, workspace])
  
  // Handle zero out all work offsets
  const handleZeroAll = useCallback(() => {
    if (!connectedPort) return
    const p = getWCSPNumber(workspace)
    const gcode = `G10 L20 P${p} X0 Y0 Z0`
    socketService.getSocket()?.emit('command', connectedPort, 'gcode', gcode)
  }, [connectedPort, workspace])
  
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

function VisualizerPanel({ 
  isConnected, 
  connectedPort 
}: { 
  isConnected: boolean
  connectedPort: string | null
}) {
  const [tab, setTab] = useState<'3d' | 'console'>('3d')
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>([])
  const [commandInput, setCommandInput] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const consoleContainerRef = useRef<HTMLDivElement>(null)
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
  useEffect(() => {
    if (!isConnected || !connectedPort) {
      // Clear console when disconnected
      setConsoleLines([])
      return
    }

    const socket = socketService.getSocket()
    if (!socket) return

    // Listen for messages FROM Grbl
    const handleSerialRead = (message: string) => {
      const line = parseConsoleMessage(message, 'read')
      setConsoleLines(prev => [...prev, line])
    }

    // Listen for messages TO Grbl
    const handleSerialWrite = (data: string) => {
      const line = parseConsoleMessage(data, 'write')
      setConsoleLines(prev => [...prev, line])
    }

    socket.on('serialport:read', handleSerialRead)
    socket.on('serialport:write', handleSerialWrite)

    return () => {
      socket.off('serialport:read', handleSerialRead)
      socket.off('serialport:write', handleSerialWrite)
    }
  }, [isConnected, connectedPort])
  
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
      </div>
      
      {tab === '3d' ? (
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

const MOCK_PROBE_STRATEGIES = [
  { id: 1, name: 'Probe Z', desc: 'Touch plate on top of workpiece' },
  { id: 2, name: 'Probe Z (Surface)', desc: 'Direct surface contact' },
  { id: 3, name: 'Probe XYZ Corner', desc: 'Find corner origin' },
  { id: 4, name: 'Probe X', desc: 'Find X edge' },
  { id: 5, name: 'Probe Y', desc: 'Find Y edge' },
  { id: 6, name: 'Center Finder', desc: 'Find center of hole/boss' },
]

function ProbePanel(_props: PanelProps) {
  return (
    <div className="p-3 space-y-2">
      {MOCK_PROBE_STRATEGIES.map((strategy) => (
        <div 
          key={strategy.id}
          className="flex items-center gap-3 p-2 rounded border border-border hover:bg-muted/50 transition-colors"
        >
          <Target className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">{strategy.name}</div>
            <div className="text-xs text-muted-foreground truncate">{strategy.desc}</div>
          </div>
          <Button size="sm" variant="secondary" className="h-7 text-xs flex-shrink-0">
            Run
          </Button>
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
              <span className="text-[10px] text-muted-foreground line-clamp-2 w-full text-center break-words overflow-hidden">{macro.description}</span>
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
  const isDisabled = !isConnected || machineStatus === 'alarm' || isJobRunning || machineStatus === 'not_connected'
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
  
  // Flash status if action attempted while disabled
  const handleDisabledAction = useCallback(() => {
    if (!canControl) {
      onFlashStatus()
    }
  }, [canControl, onFlashStatus])

  return (
    <div className="p-3 space-y-3">
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
            onFlashStatus={onFlashStatus}
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
            onFlashStatus={onFlashStatus}
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
          onFlashStatus={onFlashStatus}
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
        requirements={{
          requiresConnected: true,
          requiresPort: true,
          disallowAlarm: true,
          disallowRunning: false, // Allow spindle control during jobs
          disallowNotConnected: true,
        }}
        customDisabled={isJobRunning}
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
  panelProps
}: { 
  id: string
  isCollapsed: boolean
  onToggle: () => void
  panelProps: PanelProps
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
  // Safety check: never render 'commands' panel even if it somehow gets into panelOrder
  if (!config || id === 'commands') return null
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
        {!isCollapsed && <PanelContent {...panelProps} />}
      </div>
    </div>
  )
}

// Drag overlay panel (shown while dragging) - full panel clone
function DragOverlayPanel({ id, isCollapsed, panelProps }: { id: string; isCollapsed: boolean; panelProps: PanelProps }) {
  const config = panelConfig[id]
  // Safety check: never render 'commands' panel even if it somehow gets into panelOrder
  if (!config || id === 'commands') return null
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
  // Filter out 'commands' to ensure it never appears (handles any cached localStorage or old state)
  const [panelOrder, setPanelOrder] = useState(() => {
    const defaultOrder = ['dro', 'jog', 'spindle', 'rapid', 'probe', 'file', 'macros']
    // If there's cached order in localStorage, filter out 'commands'
    try {
      const cached = localStorage.getItem('setup-panel-order')
      if (cached) {
        const parsed = JSON.parse(cached) as string[]
        // Filter out 'commands' and only keep valid panel IDs
        const validPanelIds = ['dro', 'jog', 'rapid', 'probe', 'file', 'macros', 'spindle']
        const filtered = parsed.filter(id => id !== 'commands' && validPanelIds.includes(id))
        if (filtered.length > 0) return filtered
      }
    } catch {
      // Ignore localStorage errors
    }
    return defaultOrder
  })
  
  // Track which panels are collapsed
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({})
  
  // Filter out 'commands' from panelOrder on mount (safety check for cached state)
  useEffect(() => {
    const hasCommands = panelOrder.includes('commands')
    const hasInvalidPanels = panelOrder.some(id => !panelConfig[id])
    if (hasCommands || hasInvalidPanels) {
      console.warn('[Setup] Detected invalid panel IDs, filtering them out:', {
        original: panelOrder,
        hasCommands,
        invalidPanels: panelOrder.filter(id => !panelConfig[id])
      })
      const filtered = panelOrder.filter(id => id !== 'commands' && panelConfig[id])
      setPanelOrder(filtered)
      // Also clean up any localStorage that might have cached the old order
      try {
        localStorage.removeItem('setup-panel-order')
      } catch {
        // Ignore localStorage errors
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount
  
  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Machine status type
  type MachineStatus = 
    | 'not_connected'
    | 'connected_pre_home'
    | 'connected_post_home'
    | 'alarm'
    | 'running'
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
  
  // Refs to track state in event handlers to avoid stale closures
  const isConnectedRef = useRef(isConnected)
  isConnectedRef.current = isConnected
  const isHomedRef = useRef(isHomed)
  isHomedRef.current = isHomed
  const homingInProgressRef = useRef(homingInProgress)
  homingInProgressRef.current = homingInProgress
  
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
        showErrorNotification('Socket Not Available', 'Socket connection is not available. Please refresh the page.')
        return
      }
      
      socket.emit('close', connectedPort, (err: Error | null) => {
        if (err) {
          console.error('Disconnect error:', err)
          const errorMessage = err.message || (typeof err === 'string' ? err : 'Failed to disconnect from machine')
          showErrorNotification('Disconnect Failed', errorMessage)
        } else {
          setIsConnected(false)
          setConnectedPort(null)
          setMachineStatus('not_connected')
          isHomedRef.current = false
          setIsHomed(false)
          setIsJobRunning(false)
          setSpindleState('M5')
          setSpindleSpeed(0)
        }
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
  }, [connectedPort])
  
  // Handler for jog commands (called from JogPanel)
  const handleJogAction = useCallback(() => {
    if (!isConnected) {
      flashStatus()
    }
  }, [isConnected, flashStatus])
  
  // Listen for connection events and errors
  useEffect(() => {
    const handleSerialPortOpen = (...args: unknown[]) => {
      const data = args[0] as { port: string }
      setIsConnected(true)
      setConnectedPort(data.port)
      setIsConnecting(false)
      setMachineStatus('connected_pre_home')
      isHomedRef.current = false
      setIsHomed(false)
      setHomingInProgress(false)
      homingInProgressRef.current = false
      setIsJobRunning(false)
    }
    
    const handleSerialPortClose = () => {
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
    const handleControllerState = (...args: unknown[]) => {
      // Backend sends: controller:state(GRBL, state)
      // State structure: { status: { activeState: 'Idle'|'Run'|'Alarm'|... }, parserstate: {...} }
      const controllerType = args[0] as string
      const state = args[1] as { 
        status?: {
          activeState?: string
          mpos?: { x?: string; y?: string; z?: string }
          wpos?: { x?: string; y?: string; z?: string }
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
      
      // Update spindle speed from parserstate
      if (state.parserstate?.spindle !== undefined) {
        const speed = parseFloat(state.parserstate.spindle || '0')
        setSpindleSpeed(speed)
      }
      
      // Only update status if we're actually connected
      if (!isConnectedRef.current) return
      
      // Extract activeState from nested structure
      const activeState = state.status?.activeState || ''
      const isAlarm = activeState === 'Alarm'
      const isRunning = activeState === 'Run'
      const isHoming = activeState === 'Home'
      const isIdle = activeState === 'Idle'
      
      // Check if homing completed FIRST - when we transition from 'Home' state to 'Idle'
      // This must run before the status update logic to avoid race conditions
      let homingJustCompleted = false
      // Check if we're idle and homing was in progress - this indicates homing completed
      // We check homingInProgressRef to detect the transition from Home to Idle
      if (isIdle && !isHoming && homingInProgressRef.current && !isHomedRef.current && isConnectedRef.current) {
        // Homing was in progress and now we're idle - homing completed
        console.log('[Homing] Homing completed - transitioning to post-home', {
          isIdle,
          isHoming,
          homingInProgress: homingInProgressRef.current,
          isHomed: isHomedRef.current,
          isConnected: isConnectedRef.current
        })
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
      
      // Priority: Alarm > Running (from workflow) > Idle (post-home) > Idle (pre-home)
      // Note: Running state is handled by workflow:state, not controller:state
      // Don't override running status unless we get an alarm
      // Use isHomedRef to avoid stale closure issues
      // Don't override status if homing just completed (already set above)
      if (isAlarm) {
        setMachineStatus('alarm')
        setIsJobRunning(false)
      } else if (!isJobRunning && !homingJustCompleted) {
        // Only update status if workflow is not running and homing didn't just complete
        // Workflow running state takes priority over controller idle state
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
      }
    }
    
    // Listen for workflow state to detect running jobs
    const handleWorkflowState = (workflowState: string) => {
      // Only update if we're connected
      if (!isConnectedRef.current) return
      
      // workflowState is 'idle', 'running', or 'paused'
      if (workflowState === 'running') {
        setMachineStatus('running')
        setIsJobRunning(true)
      } else {
        // When workflow stops (idle or paused), let controller state determine the status
        setIsJobRunning(false)
        // Trigger a status update by checking current controller state
        // The controller state handler will set the appropriate status
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
      console.log('Socket disconnected:', reason)
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
      socketService.off('controller:homing', handleHomingComplete)
      socketService.off('grbl:homing', handleHomingComplete)
      socketService.off('marlin:homing', handleHomingComplete)
    }
  }, [showErrorNotification, isConnected])
  
  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )
  
  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string
    // Never allow dragging 'commands' panel
    if (activeId === 'commands') return
    setActiveId(activeId)
  }
  
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        // Filter out 'commands' and invalid panel IDs before reordering
        const validItems = items.filter(id => {
          // Exclude 'commands' and ensure the panel exists in panelConfig
          if (id === 'commands') return false
          return panelConfig[id] !== undefined
        })
        const oldIndex = validItems.indexOf(active.id as string)
        const newIndex = validItems.indexOf(over.id as string)
        if (oldIndex >= 0 && newIndex >= 0) {
          const reordered = arrayMove(validItems, oldIndex, newIndex)
          return reordered
        }
        return validItems
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
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">AxioCNC</span>
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
            requirements={ActionRequirements.standard}
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
        <div 
          className={`
            px-3 py-1.5 rounded border flex items-center gap-2 min-w-[140px] justify-center
            transition-all duration-200
            ${
              machineStatus === 'connected_post_home' || machineStatus === 'running'
                ? 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-400' 
                : machineStatus === 'connected_pre_home'
                ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400'
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
                  : machineStatus === 'alarm' || machineStatus === 'error'
                  ? 'bg-red-500'
                  : 'bg-zinc-500'
              }
            `} 
          />
          <span className="text-xs font-medium">
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
              : machineStatus === 'error'
              ? 'Error'
              : 'Unknown'}
          </span>
        </div>
        
        {/* Action buttons - context-aware based on machine status */}
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
            <SortableContext items={panelOrder.filter(id => id !== 'commands' && panelConfig[id])} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col gap-2">
                {panelOrder.filter(id => id !== 'commands' && panelConfig[id]).map((panelId) => (
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
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId && activeId !== 'commands' ? (
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
            <VisualizerPanel isConnected={isConnected} connectedPort={connectedPort} />
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

