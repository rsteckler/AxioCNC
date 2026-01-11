import React, { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, PerspectiveCamera, Text } from '@react-three/drei'
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
  
  // Grid cell size - use 10mm for cells, 50mm for sections
  const cellSize = 10
  const sectionSize = 50
  
  // Label offset from edges (in mm)
  const labelOffset = 15
  
  // Arrow length (in mm)
  const arrowLength = Math.min(width, height, depth) * 0.3
  
  // Color scheme: X=red, Y=green, Z=blue
  const xColor = '#ef4444' // Red
  const yColor = '#22c55e' // Green
  const zColor = '#3b82f6' // Blue
  
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
    color: yColor
  })
  edges.push({
    points: [[xmin, zmin, ymax], [xmax, zmin, ymax]], // Back edge (positive Y in machine)
    color: yColor
  })
  
  // Y-axis edges (left and right of bottom face - along X axis in machine coords)
  edges.push({
    points: [[xmin, zmin, ymin], [xmin, zmin, ymax]], // Left edge (negative X in machine)
    color: xColor
  })
  edges.push({
    points: [[xmax, zmin, ymin], [xmax, zmin, ymax]], // Right edge (positive X in machine)
    color: xColor
  })
  
  // Top face edges (at zmax)
  edges.push({
    points: [[xmin, zmax, ymin], [xmax, zmax, ymin]],
    color: yColor
  })
  edges.push({
    points: [[xmin, zmax, ymax], [xmax, zmax, ymax]],
    color: yColor
  })
  edges.push({
    points: [[xmin, zmax, ymin], [xmin, zmax, ymax]],
    color: xColor
  })
  edges.push({
    points: [[xmax, zmax, ymin], [xmax, zmax, ymax]],
    color: xColor
  })
  
  // Vertical edges (Z-axis edges)
  edges.push({
    points: [[xmin, zmin, ymin], [xmin, zmax, ymin]], // Front-left
    color: zColor
  })
  edges.push({
    points: [[xmax, zmin, ymin], [xmax, zmax, ymin]], // Front-right
    color: zColor
  })
  edges.push({
    points: [[xmin, zmin, ymax], [xmin, zmax, ymax]], // Back-left
    color: zColor
  })
  edges.push({
    points: [[xmax, zmin, ymax], [xmax, zmax, ymax]], // Back-right
    color: zColor
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
      
      {/* Axis arrows and labels - show positive direction */}
      {/* X-axis arrow and label */}
      <primitive object={useMemo(() => new THREE.ArrowHelper(
        new THREE.Vector3(1, 0, 0), // Direction: +X
        new THREE.Vector3(xmin, zmin, centerY), // Origin
        arrowLength,
        xColor,
        arrowLength * 0.15, // Head length
        arrowLength * 0.1  // Head width
      ), [xmin, zmin, centerY, arrowLength, xColor])} />
      <Text
        position={[xmin + arrowLength + labelOffset, zmin + 1, centerY]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={20}
        color={xColor}
        anchorX="center"
        anchorY="middle"
      >
        X
      </Text>
      
      {/* Y-axis arrow and label (Y maps to Z in Three.js coordinates) */}
      <primitive object={useMemo(() => new THREE.ArrowHelper(
        new THREE.Vector3(0, 0, 1), // Direction: +Z in Three.js (which is +Y in machine)
        new THREE.Vector3(centerX, zmin, ymin), // Origin
        arrowLength,
        yColor,
        arrowLength * 0.15,
        arrowLength * 0.1
      ), [centerX, zmin, ymin, arrowLength, yColor])} />
      <Text
        position={[centerX, zmin + 1, ymin + arrowLength + labelOffset]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={20}
        color={yColor}
        anchorX="center"
        anchorY="middle"
      >
        Y
      </Text>
      
      {/* Z-axis arrow and label (Z maps to Y in Three.js coordinates) */}
      <primitive object={useMemo(() => new THREE.ArrowHelper(
        new THREE.Vector3(0, 1, 0), // Direction: +Y in Three.js (which is +Z in machine)
        new THREE.Vector3(centerX, zmin, centerY), // Origin
        arrowLength,
        zColor,
        arrowLength * 0.15,
        arrowLength * 0.1
      ), [centerX, zmin, centerY, arrowLength, zColor])} />
      <Text
        position={[centerX, zmin + arrowLength + labelOffset, centerY]}
        fontSize={20}
        color={zColor}
        anchorX="center"
        anchorY="middle"
      >
        Z
      </Text>
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