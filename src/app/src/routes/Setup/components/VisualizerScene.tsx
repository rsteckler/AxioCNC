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

// Work envelope grid with RGB-colored edges and arrows
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
  
  // Color scheme: X=red, Y=green, Z=blue
  const xColor = '#ef4444' // Red
  const yColor = '#22c55e' // Green
  const zColor = '#3b82f6' // Blue
  
  // Arrow dimensions for edge arrows
  const edgeArrowHeadLength = Math.min(width, height) * 0.05
  const edgeArrowHeadWidth = Math.min(width, height) * 0.03
  const zArrowHeadLength = depth * 0.1
  const zArrowHeadWidth = depth * 0.05
  
  return (
    <group>
      {/* Grid on the bottom plane (zmin) - regular grid lines */}
      <Grid
        args={[width, height]}
        cellSize={cellSize}
        cellThickness={0.5}
        cellColor="#404040"
        sectionSize={sectionSize}
        sectionThickness={1}
        sectionColor="#606060"
        fadeDistance={Math.max(width, height) * 2}
        position={[centerX, zmin, centerY]}
      />
      
      {/* X-axis edge arrows - front and back edges pointing right (positive X) */}
      {useMemo(() => [
        // Front edge (at ymin) - arrow pointing right
        <primitive
          key="x-edge-front"
          object={new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0), // Direction: +X (right)
            new THREE.Vector3(xmin, zmin, ymin), // Origin at left edge
            width, // Full width
            xColor,
            edgeArrowHeadLength,
            edgeArrowHeadWidth
          )}
        />,
        // Back edge (at ymax) - arrow pointing right
        <primitive
          key="x-edge-back"
          object={new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0), // Direction: +X (right)
            new THREE.Vector3(xmin, zmin, ymax), // Origin at left edge
            width, // Full width
            xColor,
            edgeArrowHeadLength,
            edgeArrowHeadWidth
          )}
        />,
      ], [xmin, ymin, ymax, zmin, width, xColor, edgeArrowHeadLength, edgeArrowHeadWidth])}
      
      {/* Y-axis edge arrows - left and right edges pointing up/back (positive Y = +Z in Three.js) */}
      {useMemo(() => [
        // Left edge (at xmin) - arrow pointing up/back
        <primitive
          key="y-edge-left"
          object={new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1), // Direction: +Z in Three.js (which is +Y in machine)
            new THREE.Vector3(xmin, zmin, ymin), // Origin at front edge
            height, // Full height
            yColor,
            edgeArrowHeadLength,
            edgeArrowHeadWidth
          )}
        />,
        // Right edge (at xmax) - arrow pointing up/back
        <primitive
          key="y-edge-right"
          object={new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1), // Direction: +Z in Three.js (which is +Y in machine)
            new THREE.Vector3(xmax, zmin, ymin), // Origin at front edge
            height, // Full height
            yColor,
            edgeArrowHeadLength,
            edgeArrowHeadWidth
          )}
        />,
      ], [xmin, xmax, ymin, zmin, height, yColor, edgeArrowHeadLength, edgeArrowHeadWidth])}
      
      {/* Z-axis vertical edges - all four as arrows pointing up */}
      {useMemo(() => {
        const corners = [
          [xmin, ymin], // Front-left
          [xmax, ymin], // Front-right
          [xmin, ymax], // Back-left
          [xmax, ymax], // Back-right
        ]
        
        return corners.map(([x, y], idx) => (
          <primitive
            key={`z-edge-${idx}`}
            object={new THREE.ArrowHelper(
              new THREE.Vector3(0, 1, 0), // Direction: +Y in Three.js (which is +Z in machine)
              new THREE.Vector3(x, zmin, y), // Origin at bottom
              depth, // Full height
              zColor,
              zArrowHeadLength,
              zArrowHeadWidth
            )}
          />
        ))
      }, [xmin, xmax, ymin, ymax, zmin, depth, zColor, zArrowHeadLength, zArrowHeadWidth])}
      
      {/* Axis labels */}
      {/* X-axis label */}
      <Text
        position={[xmax + labelOffset, zmin + 1, centerY]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={20}
        color={xColor}
        anchorX="center"
        anchorY="middle"
      >
        X
      </Text>
      
      {/* Y-axis label (Y maps to Z in Three.js coordinates) */}
      <Text
        position={[centerX, zmin + 1, ymax + labelOffset]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={20}
        color={yColor}
        anchorX="center"
        anchorY="middle"
      >
        Y
      </Text>
      
      {/* Z-axis label (Z maps to Y in Three.js coordinates) */}
      <Text
        position={[centerX, zmax + labelOffset, centerY]}
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

export function VisualizerScene({ limits }: VisualizerSceneProps = {}) {
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
