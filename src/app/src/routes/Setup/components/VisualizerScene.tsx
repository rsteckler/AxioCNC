import React, { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
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
  
  // Arrow dimensions for Z edges (full height)
  const zArrowHeadLength = depth * 0.1
  const zArrowHeadWidth = depth * 0.05
  
  return (
    <group>
      {/* Grid lines as arrows on the bottom plane (zmin) */}
      {/* X-axis grid lines - arrows pointing right (positive X) */}
      {useMemo(() => {
        const lines: JSX.Element[] = []
        for (let y = ymin; y <= ymax; y += cellSize) {
          const isSection = (y - ymin) % sectionSize === 0
          const arrowLength = width * 0.95 // Almost full width
          const arrowHeadLength = width * 0.05
          const arrowHeadWidth = width * 0.03
          const color = isSection ? xColor : '#404040'
          
          lines.push(
            <primitive
              key={`x-grid-${y}`}
              object={new THREE.ArrowHelper(
                new THREE.Vector3(1, 0, 0), // Direction: +X (right)
                new THREE.Vector3(xmin, zmin, y), // Origin at left edge
                arrowLength,
                color,
                arrowHeadLength,
                arrowHeadWidth
              )}
            />
          )
        }
        return lines
      }, [xmin, ymin, ymax, zmin, width, cellSize, sectionSize, xColor])}
      
      {/* Y-axis grid lines - arrows pointing up/back (positive Y = +Z in Three.js) */}
      {useMemo(() => {
        const lines: JSX.Element[] = []
        for (let x = xmin; x <= xmax; x += cellSize) {
          const isSection = (x - xmin) % sectionSize === 0
          const arrowLength = height * 0.95 // Almost full height
          const arrowHeadLength = height * 0.05
          const arrowHeadWidth = height * 0.03
          const color = isSection ? yColor : '#404040'
          
          lines.push(
            <primitive
              key={`y-grid-${x}`}
              object={new THREE.ArrowHelper(
                new THREE.Vector3(0, 0, 1), // Direction: +Z in Three.js (which is +Y in machine)
                new THREE.Vector3(x, zmin, ymin), // Origin at front edge
                arrowLength,
                color,
                arrowHeadLength,
                arrowHeadWidth
              )}
            />
          )
        }
        return lines
      }, [xmin, xmax, ymin, zmin, height, cellSize, sectionSize, yColor])}
      
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
