import { useMemo, useEffect, useRef } from 'react'
import { Color } from 'three'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import { BufferGeometry, BufferAttribute, ArrowHelper, Vector3, LineBasicMaterial, Line, LineDashedMaterial, PlaneGeometry, EdgesGeometry, Group } from 'three'
import type { Vector3 as Vector3Type } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { useGetSettingsQuery, useGetExtensionsQuery } from '@/services/api'
import { machineToThree, type MachineLimits, type Coordinate } from '@/lib/coordinates'
import type { HomingCorner } from '@/lib/machineLimits'
import { processGCode } from '@/lib/gcodeVisualizer'

interface VisualizerSceneProps {
  gcode?: string | null
  limits?: MachineLimits
  view?: 'top' | 'front' | 'iso' | 'fit'
  viewKey?: number // Key to force re-trigger when same view is selected
  machinePosition?: { x: number; y: number; z: number }
  modelOffset?: Vector3Type // Offset to apply to model (for "Place Model" feature)
  processedLines?: number // Number of G-code lines that have been processed (for animation)
}

// Grid component - draws a grid on the z=0 plane, starting at origin and extending in positive X and Y
function WorkGrid({ xSize = 300, ySize = 300, spacing = 10 }: { xSize?: number; ySize?: number; spacing?: number }) {
  const geometry = useMemo(() => {
    const geo = new BufferGeometry()
    const positions: number[] = []
    
    // Calculate spacing to show exactly 10 lines per axis
    // For 10 lines, we need 11 positions (0 through 10), so spacing = size / 10
    const xSpacing = xSize / 10
    const ySpacing = ySize / 10
    
    // Grid starts at origin (0,0,0) and extends in positive X and Y directions
    const xMin = 0
    const xMax = xSize
    const yMin = 0
    const yMax = ySize
    
    // Draw 11 lines parallel to Y axis (lines along X direction) - creates 10 intervals
    for (let i = 0; i <= 10; i++) {
      const x = xMin + (i * xSpacing)
      positions.push(x, yMin, 0) // Start point at y=0
      positions.push(x, yMax, 0) // End point at y=yMax
    }
    
    // Draw 11 lines parallel to X axis (lines along Y direction) - creates 10 intervals
    for (let i = 0; i <= 10; i++) {
      const y = yMin + (i * ySpacing)
      positions.push(xMin, y, 0) // Start point at x=0
      positions.push(xMax, y, 0) // End point at x=xMax
    }
    
    geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
    return geo
  }, [xSize, ySize, spacing])
  
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#666666" opacity={0.3} transparent />
    </lineSegments>
  )
}

// X-axis arrows component - red arrow at y=0, normal line at y=ySize
function XAxisArrows({ xSize = 300, ySize = 300, arrowLength = 20 }: { xSize?: number; ySize?: number; arrowLength?: number }) {
  const scene = useThree((state) => state.scene)
  
  useEffect(() => {
    const color = 0xff0000 // Red
    
    // Arrow at y=0 (bottom edge) - pointing in positive X direction
    const direction = new Vector3(1, 0, 0)
    const origin1 = new Vector3(0, 0, 0)
    const arrow1 = new ArrowHelper(direction, origin1, xSize, color, arrowLength, arrowLength * 0.3)
    scene.add(arrow1)
    
    // Normal line at y=ySize (top edge) - no arrowhead, gray
    const lineGeometry = new BufferGeometry()
    const linePositions = new Float32Array([
      0, ySize, 0,  // Start
      xSize, ySize, 0  // End
    ])
    lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3))
    const lineMaterial = new LineBasicMaterial({ color: 0x888888 }) // Gray
    const line = new Line(lineGeometry, lineMaterial)
    scene.add(line)
    
    return () => {
      scene.remove(arrow1)
      scene.remove(line)
      arrow1.dispose()
      lineGeometry.dispose()
      lineMaterial.dispose()
    }
  }, [xSize, ySize, arrowLength, scene])
  
  return null
}

// Y-axis arrows component - green arrow at x=0, normal line at x=xSize
function YAxisArrows({ xSize = 300, ySize = 300, arrowLength = 20 }: { xSize?: number; ySize?: number; arrowLength?: number }) {
  const scene = useThree((state) => state.scene)
  
  useEffect(() => {
    const color = 0x00ff00 // Green
    
    // Arrow at x=0 (left edge) - pointing in positive Y direction
    const direction = new Vector3(0, 1, 0)
    const origin1 = new Vector3(0, 0, 0)
    const arrow1 = new ArrowHelper(direction, origin1, ySize, color, arrowLength, arrowLength * 0.3)
    scene.add(arrow1)
    
    // Normal line at x=xSize (right edge) - no arrowhead, gray
    const lineGeometry = new BufferGeometry()
    const linePositions = new Float32Array([
      xSize, 0, 0,  // Start
      xSize, ySize, 0  // End
    ])
    lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3))
    const lineMaterial = new LineBasicMaterial({ color: 0x888888 }) // Gray
    const line = new Line(lineGeometry, lineMaterial)
    scene.add(line)
    
    return () => {
      scene.remove(arrow1)
      scene.remove(line)
      arrow1.dispose()
      lineGeometry.dispose()
      lineMaterial.dispose()
    }
  }, [xSize, ySize, arrowLength, scene])
  
  return null
}

// Z-axis arrows component - blue solid arrow at origin, gray dashed lines at other 3 corners
function ZAxisArrows({ length = 100, arrowLength = 20, gridSizeX = 300, gridSizeY = 300 }: { length?: number; arrowLength?: number; gridSizeX?: number; gridSizeY?: number }) {
  const scene = useThree((state) => state.scene)
  
  useEffect(() => {
    const color = 0x0000ff // Blue
    const grayColor = 0x888888 // Gray
    
    // Solid arrow at origin (0,0,0) - pointing in positive Z direction
    const direction = new Vector3(0, 0, 1)
    const origin = new Vector3(0, 0, 0)
    const arrow = new ArrowHelper(direction, origin, length, color, arrowLength, arrowLength * 0.3)
    scene.add(arrow)
    
    // Gray dashed lines at the other 3 corners (going up in Z direction)
    const corners = [
      new Vector3(gridSizeX, 0, 0),      // Corner at (xSize, 0, 0)
      new Vector3(0, gridSizeY, 0),      // Corner at (0, ySize, 0)
      new Vector3(gridSizeX, gridSizeY, 0) // Corner at (xSize, ySize, 0)
    ]
    
    const lines: Line[] = []
    corners.forEach((corner) => {
      const lineGeometry = new BufferGeometry()
      const linePositions = new Float32Array([
        corner.x, corner.y, 0,        // Start at corner
        corner.x, corner.y, length     // End at corner + Z
      ])
      lineGeometry.setAttribute('position', new BufferAttribute(linePositions, 3))
      lineGeometry.computeBoundingSphere()
      const lineMaterial = new LineDashedMaterial({ 
        color: grayColor,
        dashSize: 4,
        gapSize: 2
      })
      const line = new Line(lineGeometry, lineMaterial)
      line.computeLineDistances()
      scene.add(line)
      lines.push(line)
    })
    
    return () => {
      scene.remove(arrow)
      lines.forEach((line) => {
        scene.remove(line)
        line.geometry.dispose()
        ;(line.material as LineDashedMaterial).dispose()
      })
      arrow.dispose()
    }
  }, [length, arrowLength, gridSizeX, gridSizeY, scene])
  
  return null
}

// Rectangle outline connecting the four tops of the Z-axis lines
function ZTopRectangle({ length, gridSizeX, gridSizeY }: { length: number; gridSizeX: number; gridSizeY: number }) {
  const geometry = useMemo(() => {
    // Create a plane geometry for the rectangle outline
    // The rectangle is at z = length, from (0, 0) to (gridSizeX, gridSizeY) in XY plane
    const planeGeo = new PlaneGeometry(gridSizeX, gridSizeY)
    // Translate to z = length
    planeGeo.translate(gridSizeX / 2, gridSizeY / 2, length)
    // Get edges for outline only
    const edgesGeo = new EdgesGeometry(planeGeo)
    planeGeo.dispose() // Dispose of the plane geometry since we only need edges
    return edgesGeo
  }, [length, gridSizeX, gridSizeY])

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#888888" />
    </lineSegments>
  )
}

// G-code toolpath visualization component
function GCodeToolpath({ gcode, offset, processedLines = 0 }: { gcode?: string | null; offset?: Vector3Type; processedLines?: number }) {
  const geometryRef = useRef<BufferGeometry | null>(null)
  const framesRef = useRef<Array<{ data: string; vertexIndex: number }>>([])
  const originalColorsRef = useRef<Float32Array | null>(null)
  const redColor = useMemo(() => new Color(1, 0, 0), []) // Red color for processed lines

  const geometry = useMemo(() => {
    console.log('[GCodeToolpath] Processing G-code:', { hasGcode: !!gcode, gcodeLength: gcode?.length })
    const result = processGCode(gcode)
    console.log('[GCodeToolpath] Process result:', { hasResult: !!result, hasGeometry: !!result?.geometry, framesCount: result?.frames?.length })
    if (!result?.geometry) {
      console.warn('[GCodeToolpath] No geometry from processGCode')
      geometryRef.current = null
      framesRef.current = []
      originalColorsRef.current = null
      return null
    }

    // Store frames and original colors for animation
    framesRef.current = result.frames
    const colorAttr = result.geometry.getAttribute('color') as BufferAttribute
    originalColorsRef.current = colorAttr ? (colorAttr.array as Float32Array).slice() : null

    // Apply offset if provided
    if (offset && (offset.x !== 0 || offset.y !== 0 || offset.z !== 0)) {
      const positionAttr = result.geometry.getAttribute('position') as BufferAttribute
      const positions = positionAttr.array as Float32Array
      const newPositions = new Float32Array(positions.length)

      for (let i = 0; i < positions.length; i += 3) {
        newPositions[i] = positions[i] + offset.x
        newPositions[i + 1] = positions[i + 1] + offset.y
        newPositions[i + 2] = positions[i + 2] + offset.z
      }

      const newGeometry = result.geometry.clone()
      newGeometry.setAttribute('position', new BufferAttribute(newPositions, 3))
      // Clone color attribute as well to ensure we can update it
      const colorAttr = result.geometry.getAttribute('color') as BufferAttribute
      if (colorAttr) {
        const colors = colorAttr.array as Float32Array
        const clonedColors = colors.slice()
        newGeometry.setAttribute('color', new BufferAttribute(clonedColors, 3))
        // Update originalColorsRef to point to the cloned colors
        originalColorsRef.current = new Float32Array(clonedColors)
      }
      geometryRef.current = newGeometry
      return newGeometry
    }

    geometryRef.current = result.geometry
    return result.geometry
  }, [gcode, offset])

  // Update colors based on processed lines
  useEffect(() => {
    if (!geometryRef.current || !originalColorsRef.current || framesRef.current.length === 0) {
      return
    }

    const geometry = geometryRef.current
    const originalColors = originalColorsRef.current
    const frames = framesRef.current
    const colorAttr = geometry.getAttribute('color') as BufferAttribute

    if (!colorAttr) {
      return
    }

    const colors = colorAttr.array as Float32Array

    // Reset all colors to original
    colors.set(originalColors)

    // Turn processed lines red
    // processedLines is the number of lines that have been received/processed
    for (let i = 0; i < Math.min(processedLines, frames.length); i++) {
      const frame = frames[i]
      const startVertexIndex = frame.vertexIndex
      // Find the end vertex index (next frame's vertexIndex, or end of geometry)
      const endVertexIndex = i < frames.length - 1 ? frames[i + 1].vertexIndex : colors.length / 3

      // Update colors for all vertices in this line segment
      for (let v = startVertexIndex; v < endVertexIndex; v++) {
        const colorIndex = v * 3
        colors[colorIndex] = redColor.r
        colors[colorIndex + 1] = redColor.g
        colors[colorIndex + 2] = redColor.b
      }
    }

    colorAttr.needsUpdate = true
  }, [processedLines, redColor])

  if (!geometry) {
    console.log('[GCodeToolpath] No geometry, returning null')
    return null
  }

  console.log('[GCodeToolpath] Rendering geometry with', geometry.attributes.position.count / 3, 'vertices')
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        vertexColors
        opacity={0.5}
        transparent
        linewidth={1}
      />
    </lineSegments>
  )
}

// Tool/Endmill indicator - cone tip pointing down toward grid, cylindrical shank above
function ToolIndicator({ position = [0, 0, 50] }: { position?: [number, number, number] }) {
  const tipHeight = 24  // Tripled from 8
  const tipRadius = 9   // Tripled from 3
  const shankHeight = 60  // Tripled from 20
  const shankRadius = 13.5  // Tripled from 4.5
  
  // Geometries are Y-up by default
  // Cone: rotate -90° around X so tip points down (-Z)
  // Cylinder: rotate 90° around X to align with Z axis
  const coneRotation: [number, number, number] = [-Math.PI / 2, 0, 0]
  const cylinderRotation: [number, number, number] = [Math.PI / 2, 0, 0]
  
  return (
    <group position={position}>
      {/* Cone tip - rotated so tip points down (-Z), positioned so tip is at group origin */}
      <mesh position={[0, 0, tipHeight / 2]} rotation={coneRotation}>
        <coneGeometry args={[tipRadius, tipHeight, 16]} />
        <meshStandardMaterial color="#b87333" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Cylindrical shank - connects to cone base at z=tipHeight */}
      <mesh position={[0, 0, tipHeight + shankHeight / 2]} rotation={cylinderRotation}>
        <cylinderGeometry args={[shankRadius, shankRadius, shankHeight, 16]} />
        <meshStandardMaterial color="#a0a0a0" metalness={0.7} roughness={0.4} />
      </mesh>
    </group>
  )
}

// Billboard Text component - faces camera with bottoms pointing down in camera view
// Scales with camera distance to maintain constant screen size
function BillboardText({ position, children, fontSize = 20, ...props }: React.ComponentProps<typeof Text>) {
  const groupRef = useRef<Group>(null)
  const { camera } = useThree()
  
  useFrame(() => {
    if (groupRef.current) {
      // Face camera
      groupRef.current.quaternion.copy(camera.quaternion)
      
      // Calculate distance from camera to text position
      const distance = camera.position.distanceTo(groupRef.current.position)
      
      // Scale proportionally with distance to maintain constant screen size
      // As camera moves farther, scale increases to keep text same size on screen
      // Base distance reference: use a reference distance (e.g., 100 units)
      // Scale = currentDistance / referenceDistance
      const referenceDistance = 100
      const scale = distance / referenceDistance
      
      // Scale the entire group (which contains the Text)
      groupRef.current.scale.setScalar(scale)
    }
  })
  
  return (
    <group ref={groupRef} position={position}>
      <Text fontSize={fontSize} {...props}>
        {children}
      </Text>
    </group>
  )
}

// Camera controller component that responds to view changes
function CameraController({ xSize, ySize, zSize, view, viewKey }: { xSize: number; ySize: number; zSize: number; view?: 'top' | 'front' | 'iso' | 'fit'; viewKey?: number }) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsImpl>(null)
  
  const gridCenterX = xSize / 2
  const gridCenterY = ySize / 2
  const gridCenterZ = zSize / 2
  const maxGridSize = Math.max(xSize, ySize, zSize)
  
  // Ensure camera.up is always Z-up for natural CNC machine orientation
  useEffect(() => {
    camera.up.set(0, 0, 1)
  }, [camera])

  useEffect(() => {
    if (!view || !controlsRef.current) return
    
    const controls = controlsRef.current
    
    // Always ensure Z is up for natural CNC machine orientation
    camera.up.set(0, 0, 1)
    
    if (view === 'top') {
      // Top view: camera looking down (Z-) at grid center
      // For top view, we temporarily use Y up, but revert to Z up after positioning
      const distance = maxGridSize * 1.2 // Distance to fill the scene
      camera.position.set(gridCenterX, gridCenterY, distance)
      camera.up.set(0, 0, 1) // Keep Z up for consistent orbiting
      controls.target.set(gridCenterX, gridCenterY, 0)
      controls.update()
    } else if (view === 'front') {
      // Front view: camera looking from front (negative Y) toward work envelope (positive Y)
      // This is the natural viewing direction for a CNC machine
      const distance = maxGridSize * 1.2 // Distance to fit work envelope
      camera.position.set(gridCenterX, -distance, gridCenterZ)
      camera.up.set(0, 0, 1) // Z up
      controls.target.set(gridCenterX, gridCenterY, gridCenterZ)
      controls.update()
    } else if (view === 'iso') {
      // Isometric view: camera looking from front-left, with X closer than Y
      // Positioned from front-left to show the work envelope naturally
      const distance = maxGridSize * 1.2 // Distance to fit work envelope (zoomed in from 1.5)
      camera.position.set(gridCenterX + distance * 0.7, gridCenterY - distance, distance)
      camera.up.set(0, 0, 1) // Z up
      controls.target.set(gridCenterX, gridCenterY, gridCenterZ)
      controls.update()
    } else if (view === 'fit') {
      // Fit view: keep current orientation, adjust camera distance to fit work envelope
      // Save current camera orientation (up vector)
      const currentUp = camera.up.clone()
      
      // Calculate bounding box of work envelope (from origin to xSize, ySize, zSize)
      const boxSize = Math.max(xSize, ySize, zSize)
      
      // Get current camera direction (normalized vector from target to camera)
      const currentDirection = new Vector3()
        .subVectors(camera.position, controls.target)
        .normalize()
      
      // Calculate distance needed based on FOV and bounding box size
      // Formula: distance = (boxSize / 2) / tan(fov / 2) + margin
      // Camera is PerspectiveCamera (we use PerspectiveCamera in the scene)
      const fov = 'fov' in camera ? camera.fov : 50 // Default to 50 if not available
      const fovRad = (fov * Math.PI) / 180
      const distance = (boxSize / 2) / Math.tan(fovRad / 2) * 1.2 // 1.2 for margin
      
      // Simple check: if distance is invalid or camera is too far, use iso view
      // Also check if camera direction makes sense (not pointing away from scene)
      const currentDistance = camera.position.distanceTo(controls.target)
      const isReasonable = distance > 0 && 
                          isFinite(distance) && 
                          currentDistance > 0 &&
                          distance < maxGridSize * 10 // Reasonable upper bound
      
      if (!isReasonable) {
        // Fall back to iso view if calculation failed or camera is in unreasonable position
        const isoDistance = maxGridSize * 1.2
        camera.position.set(gridCenterX + isoDistance * 0.7, gridCenterY - isoDistance, isoDistance)
        camera.up.set(0, 0, 1)
        controls.target.set(gridCenterX, gridCenterY, gridCenterZ)
      } else {
        // Keep current orientation, just adjust camera position along viewing direction
        // Move camera along current direction to the calculated distance
        const newPosition = new Vector3()
          .copy(controls.target)
          .add(currentDirection.multiplyScalar(distance))
        camera.position.copy(newPosition)
        // Restore original up vector (keep current orientation)
        camera.up.copy(currentUp)
        // Don't change controls.target - keep current target
      }
      controls.update()
    }
  }, [view, viewKey, camera, gridCenterX, gridCenterY, gridCenterZ, maxGridSize, xSize, ySize, zSize])
  
  return (
    <OrbitControls 
      ref={controlsRef} 
      enableDamping 
      dampingFactor={0.05} 
      target={[gridCenterX, gridCenterY, gridCenterZ]} 
      minDistance={1} 
      maxDistance={maxGridSize * 3}
      // Ensure Z is always up for natural CNC machine orientation
      // This makes orbiting feel more natural with the front of the work envelope as the natural viewing direction
    />
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function VisualizerScene({ gcode, limits: _limits, view, viewKey, machinePosition, modelOffset, processedLines }: VisualizerSceneProps = {}) {
  // Debug logging
  useEffect(() => {
    console.log('[VisualizerScene] Props received:', { 
      hasGcode: !!gcode, 
      gcodeLength: gcode?.length,
      hasModelOffset: !!modelOffset,
      modelOffset: modelOffset ? { x: modelOffset.x, y: modelOffset.y, z: modelOffset.z } : null
    })
  }, [gcode, modelOffset])
  
  // Get machine limits and homing corner from settings
  const { data: settings } = useGetSettingsQuery()
  const machineLimits = settings?.machine?.limits
  const homingCorner: HomingCorner = settings?.machine?.homingCorner ?? 'front-left'
  
  // Get debug mode from extensions
  const { data: extensionsData } = useGetExtensionsQuery({ key: 'advanced' })
  const debugMode = extensionsData && typeof extensionsData === 'object' && 'debugMode' in extensionsData 
    ? (extensionsData as { debugMode?: boolean }).debugMode ?? false
    : false
  
  // Calculate grid dimensions from machine limits (default to 300mm if not available)
  const xSize = machineLimits ? (machineLimits.xmax - machineLimits.xmin) : 300
  const ySize = machineLimits ? (machineLimits.ymax - machineLimits.ymin) : 300
  const zSize = machineLimits ? (machineLimits.zmax - machineLimits.zmin) : 100
  
  // Convert machine position to Three.js coordinates
  // Machine (0,0,0) is at the homing corner at max Z, Three.js (0,0,0) is at bottom-left-lowest
  const toolPosition = useMemo((): [number, number, number] => {
    if (!machinePosition || !machineLimits) {
      // Default to center of grid if no position available
      return [xSize / 2, ySize / 2, zSize / 2]
    }
    
    const machineCoord: Coordinate = {
      x: machinePosition.x,
      y: machinePosition.y,
      z: machinePosition.z
    }
    
    const threeCoord = machineToThree(machineCoord, machineLimits, homingCorner)
    return [threeCoord.x, threeCoord.y, threeCoord.z]
  }, [machinePosition, machineLimits, homingCorner, xSize, ySize, zSize])
  
  // Use the larger of X or Y for camera positioning
  const maxGridSize = Math.max(xSize, ySize)
  const cameraDistance = maxGridSize * 1.5 // Position camera far enough to see full grid
  
  // Machine position for display (default to 0,0,0 if not available)
  const displayMachinePos = machinePosition || { x: 0, y: 0, z: 0 }
  
  return (
    <div className="relative w-full h-full">
      <Canvas>
        {/* Camera setup - positioned to see the full grid */}
        <PerspectiveCamera
          makeDefault
          position={[cameraDistance * 0.7, cameraDistance * 0.7, cameraDistance * 0.7]}
          fov={50}
          near={0.1}
          far={10000}
          up={[0, 0, 1]}
        />
        
        {/* Camera controls */}
        <CameraController xSize={xSize} ySize={ySize} zSize={zSize} view={view} viewKey={viewKey} />
        
        {/* Lighting */}
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 10]} intensity={1.0} />
        <directionalLight position={[-10, -10, 5]} intensity={0.4} />
        
        {/* Grid on z=0 plane, using actual machine dimensions */}
        <WorkGrid xSize={xSize} ySize={ySize} spacing={10} />
        
        {/* X-axis arrows - red arrows along X edges pointing in positive direction */}
        <XAxisArrows xSize={xSize} ySize={ySize} arrowLength={20} />
        
        {/* Y-axis arrows - green arrows along Y edges pointing in positive direction */}
        <YAxisArrows xSize={xSize} ySize={ySize} arrowLength={20} />
        
        {/* Z-axis arrows - blue arrow at origin, blue lines at other 3 corners */}
        <ZAxisArrows length={zSize} arrowLength={20} gridSizeX={xSize} gridSizeY={ySize} />
        
        {/* Gray rectangle connecting the four tops of the Z-axis lines */}
        <ZTopRectangle length={zSize} gridSizeX={xSize} gridSizeY={ySize} />
        
        {/* X-axis label - at y=0 edge */}
        <BillboardText
          position={[xSize / 2, -15, 0]}
          fontSize={5}
          color="#ff0000"
          anchorX="center"
          anchorY="middle"
        >
          X
        </BillboardText>
        
        {/* Y-axis label - at x=0 edge */}
        <BillboardText
          position={[-15, ySize / 2, 0]}
          fontSize={5}
          color="#00ff00"
          anchorX="center"
          anchorY="middle"
        >
          Y
        </BillboardText>
        
        {/* Z-axis label - near the Z arrow at origin */}
        <BillboardText
          position={[-15, -15, zSize / 2]}
          fontSize={5}
          color="#0000ff"
          anchorX="center"
          anchorY="middle"
        >
          Z
        </BillboardText>
        
        {/* Origin marker - red dot at 0,0,0 */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[2, 16, 16]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
        
        {/* G-code toolpath visualization */}
        <GCodeToolpath gcode={gcode} offset={modelOffset} processedLines={processedLines} />
        
        {/* Tool/endmill indicator - positioned at current machine coordinates */}
        <ToolIndicator position={toolPosition} />
      </Canvas>
      
      {/* Position readout overlay - only show if debug mode is enabled */}
      {debugMode && (
        <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-mono rounded px-2 py-1.5 pointer-events-none">
          <div className="text-muted-foreground mb-1">Tool Position</div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-2 gap-y-0.5">
            <div className="text-muted-foreground"></div>
            <div className="text-red-400 text-center">X</div>
            <div className="text-green-400 text-center">Y</div>
            <div className="text-blue-400 text-center">Z</div>
            
            <div className="text-muted-foreground">Machine</div>
            <div className="text-right">{displayMachinePos.x.toFixed(2)}</div>
            <div className="text-right">{displayMachinePos.y.toFixed(2)}</div>
            <div className="text-right">{displayMachinePos.z.toFixed(2)}</div>
            
            <div className="text-muted-foreground">Three.js</div>
            <div className="text-right">{toolPosition[0].toFixed(2)}</div>
            <div className="text-right">{toolPosition[1].toFixed(2)}</div>
            <div className="text-right">{toolPosition[2].toFixed(2)}</div>
          </div>
        </div>
      )}
    </div>
  )
}
