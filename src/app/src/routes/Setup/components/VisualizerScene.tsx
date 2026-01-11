import React from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'

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
    </Canvas>
  )
}
