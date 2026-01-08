import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { socketService } from '@/services/socket'
import { useGetSettingsQuery } from '@/services/api'
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

const MOCK_COMMANDS = [
  { id: 1, name: 'Unlock', code: '$X', icon: Zap },
  { id: 2, name: 'Check Mode', code: '$C', icon: Circle },
  { id: 3, name: 'Sleep', code: '$SLP', icon: Square },
  { id: 4, name: 'Get Settings', code: '$$', icon: Terminal },
  { id: 5, name: 'Get Position', code: '?', icon: Crosshair },
  { id: 6, name: 'Get Parser', code: '$G', icon: FileCode },
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

function DROPanel() {
  const [workspace, setWorkspace] = useState('G54')
  const [workspaces, setWorkspaces] = useState(MOCK_WORKSPACES)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingName, setEditingName] = useState('')
  
  const currentWorkspace = workspaces.find(ws => ws.id === workspace)
  
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
    { axis: 'X', color: 'text-red-500', bgColor: 'bg-red-500/10', borderColor: 'border-red-500/30', mpos: MOCK_POSITION.x, wpos: MOCK_WORK_POS.x },
    { axis: 'Y', color: 'text-green-500', bgColor: 'bg-green-500/10', borderColor: 'border-green-500/30', mpos: MOCK_POSITION.y, wpos: MOCK_WORK_POS.y },
    { axis: 'Z', color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/30', mpos: MOCK_POSITION.z, wpos: MOCK_WORK_POS.z },
  ]

  return (
    <div className="p-3 space-y-2">
        {/* Workspace selector dropdown */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-muted-foreground">Workspace:</span>
          <Select value={workspace} onValueChange={setWorkspace}>
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
            <Button variant="outline" size="sm" className="w-8 h-8 p-0">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
            
            {/* Work position - gets the flex space */}
            <div className={`flex-1 ${bgColor} ${borderColor} border rounded px-2 py-1.5 font-mono text-right text-base font-medium`}>
              {wpos.toFixed(3)}
            </div>
            
            {/* Machine position - fixed width, gray */}
            <div className="w-20 bg-muted/30 border border-border rounded px-2 py-1.5 font-mono text-right text-sm text-muted-foreground">
              {mpos.toFixed(2)}
            </div>
            
            {/* Go to Zero button - icon only */}
            <Button variant="secondary" size="sm" className="w-8 h-8 p-0">
              <Home className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        
        {/* All axes action buttons */}
        <div className="flex gap-2 pt-2 border-t border-border mt-2">
          <Button variant="outline" size="sm" className="flex-1 h-8">
            <RotateCcw className="w-3 h-3 mr-1" /> Zero All
          </Button>
          <Button variant="secondary" size="sm" className="flex-1 h-8">
            <Home className="w-3 h-3 mr-1" /> Go to Zero
          </Button>
        </div>
    </div>
  )
}

function JogPanel() {
  const [mode, setMode] = useState<'steps' | 'analog'>('steps')
  const [distanceIndex, setDistanceIndex] = useState(3) // Default to 10mm
  const distances = [0.01, 0.1, 1, 10, 100, 500, 'Continuous'] as const
  const currentDistance = distances[distanceIndex]
  
  const [speedIndex, setSpeedIndex] = useState(3) // Default to 500
  const speeds = [10, 50, 100, 500, 1000, 2000, 5000] as const
  const currentSpeed = speeds[speedIndex]
  
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
              <Button variant="secondary" className="aspect-square p-0">
                <DiagUL />
              </Button>
              <Button variant="secondary" className="aspect-square p-0">
                <ChevronUp className="w-5 h-5" />
              </Button>
              <Button variant="secondary" className="aspect-square p-0">
                <DiagUR />
              </Button>
              
              <Button variant="secondary" className="aspect-square p-0">
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <Button variant="outline" className="aspect-square p-0 text-xs font-bold">
                XY
              </Button>
              <Button variant="secondary" className="aspect-square p-0">
                <ChevronRight className="w-5 h-5" />
              </Button>
              
              <Button variant="secondary" className="aspect-square p-0">
                <DiagLL />
              </Button>
              <Button variant="secondary" className="aspect-square p-0">
                <ChevronDown className="w-5 h-5" />
              </Button>
              <Button variant="secondary" className="aspect-square p-0">
                <DiagLR />
              </Button>
            </div>
            
            {/* Z Controls - vertically stacked */}
            <div className="flex flex-col gap-1" style={{ width: '56px' }}>
              <Button variant="secondary" className="aspect-square p-0">
                <ChevronUp className="w-5 h-5 text-blue-500" />
              </Button>
              <Button variant="outline" className="aspect-square p-0 text-xs font-bold text-blue-500">
                Z
              </Button>
              <Button variant="secondary" className="aspect-square p-0">
                <ChevronDown className="w-5 h-5 text-blue-500" />
              </Button>
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
            <Slider 
              value={[distanceIndex]} 
              onValueChange={(v) => setDistanceIndex(v[0])}
              max={distances.length - 1} 
              step={1}
            />
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
          
          {/* Speed */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Speed</span>
              <span className="font-mono font-medium">{currentSpeed} mm/min</span>
            </div>
            <Slider 
              value={[speedIndex]} 
              onValueChange={(v) => setSpeedIndex(v[0])}
              max={speeds.length - 1} 
              step={1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>10</span>
              <span>50</span>
              <span>100</span>
              <span>500</span>
              <span>1k</span>
              <span>2k</span>
              <span>5k</span>
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
              onMouseMove={(e) => e.buttons === 1 && handleJoystickMove(e)}
              onMouseDown={handleJoystickMove}
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
                  if (e.buttons === 1) {
                    const rect = e.currentTarget.getBoundingClientRect()
                    const y = (e.clientY - rect.top) / rect.height
                    setZLevel(Math.max(0, Math.min(100, (1 - y) * 100)))
                  }
                }}
                onMouseDown={(e) => {
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
          
          {/* Speed for analog mode */}
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Max Speed</span>
              <span className="font-mono font-medium">{currentSpeed} mm/min</span>
            </div>
            <Slider 
              value={[speedIndex]} 
              onValueChange={(v) => setSpeedIndex(v[0])}
              max={speeds.length - 1} 
              step={1}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>10</span>
              <span>50</span>
              <span>100</span>
              <span>500</span>
              <span>1k</span>
              <span>2k</span>
              <span>5k</span>
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

function ProbePanel() {
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

function MacrosPanel() {
  return (
    <div className="p-3">
      <div className="grid grid-cols-2 gap-2">
        {MOCK_MACROS.map((macro) => (
          <Button 
            key={macro.id} 
            variant="outline" 
            className="h-14 flex-col gap-1"
          >
            <macro.icon className="w-5 h-5" />
            <span className="text-xs">{macro.name}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

function CommandsPanel() {
  return (
    <div className="p-3">
      <div className="grid grid-cols-2 gap-2">
        {MOCK_COMMANDS.map((command) => (
          <Button 
            key={command.id} 
            variant="outline" 
            className="h-14 flex-col gap-1"
          >
            <command.icon className="w-5 h-5" />
            <span className="text-xs">{command.name}</span>
          </Button>
        ))}
      </div>
    </div>
  )
}

function SpindlePanel() {
  const [isOn, setIsOn] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(2) // Default to 1000 RPM
  const [direction, setDirection] = useState<'cw' | 'ccw'>('cw')
  
  const speeds = [0, 500, 1000, 1500, 2000, 2500, 3000]
  const speed = speeds[speedIndex]

  return (
    <div className="p-3 space-y-3">
      {/* On/Off toggle */}
      <Button 
        className={`w-full h-12 ${isOn ? 'bg-green-600 hover:bg-green-700' : ''}`}
        variant={isOn ? 'default' : 'outline'}
        onClick={() => setIsOn(!isOn)}
      >
        <Circle className={`w-4 h-4 mr-2 ${isOn ? 'fill-white' : ''}`} />
        {isOn ? 'Stop Spindle' : 'Start Spindle'}
      </Button>
      
      {/* Speed control */}
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground flex justify-between">
          <span>Speed (RPM)</span>
          <span className="font-mono font-medium">{speed} RPM</span>
        </div>
        <Slider 
          value={[speedIndex]} 
          onValueChange={(v) => setSpeedIndex(v[0])}
          max={speeds.length - 1} 
          step={1}
          disabled={!isOn}
        />
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
      
      {/* Direction toggle */}
      <div className="flex gap-2">
        <Button
          variant={direction === 'cw' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => setDirection('cw')}
          disabled={!isOn}
        >
          <RotateCw className="w-4 h-4 mr-1" />
          CW
        </Button>
        <Button
          variant={direction === 'ccw' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => setDirection('ccw')}
          disabled={!isOn}
        >
          <RotateCcw className="w-4 h-4 mr-1" />
          CCW
        </Button>
      </div>
    </div>
  )
}

function FilePanel() {
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

function RapidPanel() {
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
        <Button variant="outline" size="sm" className="h-10 w-full p-0" title="Upper Left">
          <ArrowUL />
        </Button>
        <Button variant="outline" size="sm" className="h-10 w-full p-0" title="Upper Center">
          <ArrowU />
        </Button>
        <Button variant="outline" size="sm" className="h-10 w-full p-0" title="Upper Right">
          <ArrowUR />
        </Button>
        
        {/* Middle row */}
        <Button variant="outline" size="sm" className="h-10 w-full p-0" title="Middle Left">
          <ArrowL />
        </Button>
        <Button variant="secondary" size="sm" className="h-10 w-full p-0" title="Center">
          <CenterIcon />
        </Button>
        <Button variant="outline" size="sm" className="h-10 w-full p-0" title="Middle Right">
          <ArrowR />
        </Button>
        
        {/* Bottom row */}
        <Button variant="outline" size="sm" className="h-10 w-full p-0" title="Lower Left">
          <ArrowLL />
        </Button>
        <Button variant="outline" size="sm" className="h-10 w-full p-0" title="Lower Center">
          <ArrowD />
        </Button>
        <Button variant="outline" size="sm" className="h-10 w-full p-0" title="Lower Right">
          <ArrowLR />
        </Button>
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

// Panel configuration with metadata
const panelConfig: Record<string, { 
  title: string
  icon: React.ElementType
  component: React.FC<{ isCollapsed?: boolean }>
}> = {
  dro: { title: 'Position', icon: Crosshair, component: DROPanel },
  jog: { title: 'Jog Control', icon: Move, component: JogPanel },
  rapid: { title: 'Rapid', icon: Navigation, component: RapidPanel },
  probe: { title: 'Probe', icon: Target, component: ProbePanel },
  macros: { title: 'Macros', icon: Zap, component: MacrosPanel },
  commands: { title: 'Commands', icon: Terminal, component: CommandsPanel },
  file: { title: 'File', icon: FileCode, component: FilePanel },
  spindle: { title: 'Spindle', icon: RotateCw, component: SpindlePanel },
}

// Sortable Panel Component
function SortablePanel({ 
  id, 
  isCollapsed, 
  onToggle 
}: { 
  id: string
  isCollapsed: boolean
  onToggle: () => void 
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
        {!isCollapsed && <PanelContent />}
      </div>
    </div>
  )
}

// Drag overlay panel (shown while dragging) - full panel clone
function DragOverlayPanel({ id, isCollapsed }: { id: string; isCollapsed: boolean }) {
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
      {!isCollapsed && <PanelContent />}
    </div>
  )
}

export default function SetupMockup() {
  const navigate = useNavigate()
  
  // Panel order - just an array of IDs
  const [panelOrder, setPanelOrder] = useState(['dro', 'jog', 'spindle', 'rapid', 'probe', 'file', 'macros', 'commands'])
  
  // Track which panels are collapsed
  const [collapsedPanels, setCollapsedPanels] = useState<Record<string, boolean>>({})
  
  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null)
  
  // Connection state
  const [isConnected, setIsConnected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectedPort, setConnectedPort] = useState<string | null>(null)
  
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
  
  // Handle Home button
  const handleHome = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot home: not connected')
      return
    }
    socketService.getSocket()?.emit('command', connectedPort, 'homing')
  }, [isConnected, connectedPort])
  
  // Handle Reset button
  const handleReset = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot reset: not connected')
      return
    }
    socketService.getSocket()?.emit('command', connectedPort, 'reset')
  }, [isConnected, connectedPort])
  
  // Handle Unlock button (clears alarms)
  const handleUnlock = useCallback(() => {
    if (!isConnected || !connectedPort) {
      console.warn('Cannot unlock: not connected')
      return
    }
    socketService.getSocket()?.emit('command', connectedPort, 'unlock')
  }, [isConnected, connectedPort])
  
  // Listen for connection events and errors
  useEffect(() => {
    const handleSerialPortOpen = (...args: unknown[]) => {
      const data = args[0] as { port: string }
      setIsConnected(true)
      setConnectedPort(data.port)
      setIsConnecting(false)
    }
    
    const handleSerialPortClose = () => {
      setIsConnected(false)
      setConnectedPort(null)
      setIsConnecting(false)
    }
    
    const handleSocketError = (error: unknown) => {
      console.error('Socket error:', error)
      setIsConnecting(false)
      const errorMessage = error instanceof Error ? error.message : 'Socket connection error occurred'
      showErrorNotification('Socket Error', errorMessage)
    }
    
    const handleSocketDisconnect = (reason: unknown) => {
      console.log('Socket disconnected:', reason)
      if (isConnected) {
        setIsConnected(false)
        setConnectedPort(null)
        const reasonStr = typeof reason === 'string' ? reason : 'Connection lost'
        showErrorNotification('Connection Lost', `Socket disconnected: ${reasonStr}`)
      }
    }
    
    socketService.on('serialport:open', handleSerialPortOpen)
    socketService.on('serialport:close', handleSerialPortClose)
    socketService.on('error', handleSocketError)
    socketService.on('disconnect', handleSocketDisconnect)
    
    return () => {
      socketService.off('serialport:open', handleSerialPortOpen)
      socketService.off('serialport:close', handleSerialPortClose)
      socketService.off('error', handleSocketError)
      socketService.off('disconnect', handleSocketDisconnect)
    }
  }, [isConnected, showErrorNotification])
  
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
      `}</style>
      {/* Header - persistent across all screens */}
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg">CNCjs</span>
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
        
        {/* Connection status & control */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-zinc-500'}`} />
            <span className="text-sm text-muted-foreground">
              {isConnected ? connectedPort : 'Not connected'}
            </span>
          </div>
          <Button 
            variant={isConnected ? "secondary" : "outline"} 
            size="sm" 
            className="h-8"
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
          </Button>
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
        </div>
        
        {/* Emergency Stop - always visible */}
        <Button 
          variant="destructive" 
          size="lg"
          className="ml-4 h-10 px-6 font-bold uppercase tracking-wide bg-red-600 hover:bg-red-700"
        >
          <Square className="w-5 h-5 mr-2" />
          E-Stop
        </Button>
      </header>
      
      {/* Setup control bar - screen-specific controls */}
      <div className="h-12 border-b border-border bg-muted/30 flex items-center px-4 gap-2">
        <span className="text-sm text-muted-foreground mr-2">Machine:</span>
        <Button variant="outline" size="sm" onClick={handleHome} disabled={!isConnected}>
          <Home className="w-4 h-4 mr-1" /> Home
        </Button>
        <Button variant="outline" size="sm" onClick={handleUnlock} disabled={!isConnected}>
          <Unlock className="w-4 h-4 mr-1" /> Unlock
        </Button>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={!isConnected}>
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </Button>
        
        <div className="w-px h-6 bg-border mx-2" />
        
        <span className="text-sm text-muted-foreground mr-2">Job:</span>
        <Button variant="outline" size="sm">
          <Play className="w-4 h-4 mr-1" /> Start
        </Button>
        <Button variant="outline" size="sm">
          <Pause className="w-4 h-4 mr-1" /> Pause
        </Button>
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
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeId ? (
                <DragOverlayPanel 
                  id={activeId} 
                  isCollapsed={collapsedPanels[activeId] ?? false} 
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

