import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'

interface MachineLimits {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
  zmin: number
  zmax: number
}

interface VisualizerSceneProps {
  gcode?: string | null
  limits?: MachineLimits
}

// Work envelope grid with RGB-colored edges
function WorkEnvelopeGrid({ limits }: { limits: MachineLimits }) {
  const { xmin, xmax, ymin, ymax, zmin, zmax } = limits
  
  // Calculate dimensions in mm (Three.js uses 1 unit = 1mm)
  const width = xmax - xmin
  const height = ymax - ymin
  const depth = zmax - zmin
  const centerX = (xmin + xmax) / 2
  const centerY = (ymin + ymax) / 2
  const centerZ = (zmin + zmax) / 2
  
  // Grid cell size - use 10mm for cells, 50mm for sections
  const cellSize = 10
  const sectionSize = 50
  
  // Color scheme: X=red, Y=green, Z=blue
  // Positive directions use full brightness, negative directions use darker shade
  const xColorPos = '#ef4444' // Red - positive X
  const xColorNeg = '#991b1b' // Dark red - negative X
  const yColorPos = '#22c55e' // Green - positive Y
  const yColorNeg = '#15803d' // Dark green - negative Y
  const zColorPos = '#3b82f6' // Blue - positive Z
  const zColorNeg = '#1e40af' // Dark blue - negative Z
  
  // Create boundary edges
  // For Three.js: Grid from drei creates horizontal grid on X-Z plane
  // So: Machine X -> Three.js X, Machine Y -> Three.js Z, Machine Z -> Three.js Y
  const edges: Array<{
    points: [number, number, number][]  // Three.js coordinates: [x, y, z]
    color: string
  }> = []
  
  // Bottom face edges (at zmin)
  // X-axis edges (front and back of bottom face - along Y axis in machine coords)
  edges.push({
    points: [[xmin, zmin, ymin], [xmax, zmin, ymin]], // Front edge (negative Y in machine)
    color: yColorNeg
  })
  edges.push({
    points: [[xmin, zmin, ymax], [xmax, zmin, ymax]], // Back edge (positive Y in machine)
    color: yColorPos
  })
  
  // Y-axis edges (left and right of bottom face - along X axis in machine coords)
  edges.push({
    points: [[xmin, zmin, ymin], [xmin, zmin, ymax]], // Left edge (negative X in machine)
    color: xColorNeg
  })
  edges.push({
    points: [[xmax, zmin, ymin], [xmax, zmin, ymax]], // Right edge (positive X in machine)
    color: xColorPos
  })
  
  // Top face edges (at zmax)
  edges.push({
    points: [[xmin, zmax, ymin], [xmax, zmax, ymin]],
    color: yColorNeg
  })
  edges.push({
    points: [[xmin, zmax, ymax], [xmax, zmax, ymax]],
    color: yColorPos
  })
  edges.push({
    points: [[xmin, zmax, ymin], [xmin, zmax, ymax]],
    color: xColorNeg
  })
  edges.push({
    points: [[xmax, zmax, ymin], [xmax, zmax, ymax]],
    color: xColorPos
  })
  
  // Vertical edges (Z-axis edges)
  edges.push({
    points: [[xmin, zmin, ymin], [xmin, zmax, ymin]], // Front-left
    color: zColorNeg
  })
  edges.push({
    points: [[xmax, zmin, ymin], [xmax, zmax, ymin]], // Front-right
    color: zColorNeg
  })
  edges.push({
    points: [[xmin, zmin, ymax], [xmin, zmax, ymax]], // Back-left
    color: zColorPos
  })
  edges.push({
    points: [[xmax, zmin, ymax], [xmax, zmax, ymax]], // Back-right
    color: zColorPos
  })
  
  return (
    <group>
      {/* Grid on the bottom plane (zmin) - drei Grid creates horizontal grid on X-Z plane
          Grid args=[width, height] creates a grid from -width/2 to +width/2 and -height/2 to +height/2
          Position at center so edges align with work envelope boundaries */}
      <Grid
        args={[width, height]}
        cellSize={cellSize}
        cellThickness={0.5}
        cellColor="#404040"
        sectionSize={sectionSize}
        sectionThickness={1}
        sectionColor="#606060"
        fadeDistance={Math.max(width, height) * 2}
        position={[centerX, zmin, centerY]} // Center at [centerX, zmin, centerY] so grid edges align with xmin/xmax and ymin/ymax
      />
      
      {/* Boundary edges */}
      {edges.map((edge, idx) => (
        <line key={idx}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={edge.points.length}
              array={new Float32Array(edge.points.flat())}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={edge.color} linewidth={2} />
        </line>
      ))}
    </group>
  )
}

export function VisualizerScene({ gcode, limits }: VisualizerSceneProps = {}) {
  // Default limits if not provided
  const defaultLimits: MachineLimits = {
    xmin: 0,
    xmax: 300,
    ymin: 0,
    ymax: 300,
    zmin: -50,
    zmax: 0,
  }
  
  const workLimits = limits || defaultLimits
  
  // Calculate camera position based on work envelope
  const { xmin, xmax, ymin, ymax, zmin, zmax } = workLimits
  const centerX = (xmin + xmax) / 2
  const centerY = (ymin + ymax) / 2
  const centerZ = (zmin + zmax) / 2
  const width = xmax - xmin
  const height = ymax - ymin
  const depth = zmax - zmin
  const maxDim = Math.max(width, height, depth)
  const cameraDistance = maxDim * 1.5
  
  return (
    <Canvas>
      <PerspectiveCamera 
        makeDefault 
        position={[centerX + cameraDistance * 0.7, centerZ + cameraDistance * 0.5, centerY + cameraDistance * 0.7]} 
        fov={50} 
      />
      <OrbitControls 
        enableDamping 
        dampingFactor={0.05}
        minDistance={maxDim * 0.5}
        maxDistance={maxDim * 3}
        target={[centerX, centerZ, centerY]}
      />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.8} />
      <directionalLight position={[-10, 10, -10]} intensity={0.3} />
      
      {/* Work envelope grid */}
      <WorkEnvelopeGrid limits={workLimits} />
    </Canvas>
  )
}