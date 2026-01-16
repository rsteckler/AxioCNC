import colornames from 'colornames'
import Toolpath from 'gcode-toolpath'
import { BufferGeometry, BufferAttribute, Vector3, Color, ArcCurve } from 'three'

// Color definitions matching legacy implementation
const defaultColor = new Color(colornames('lightgrey') as string)
const motionColor = {
  'G0': new Color(colornames('green') as string),
  'G1': new Color(colornames('blue') as string),
  'G2': new Color(colornames('deepskyblue') as string),
  'G3': new Color(colornames('deepskyblue') as string)
}

export interface GCodeFrame {
  data: string
  vertexIndex: number
}

export interface GCodeGeometryResult {
  geometry: BufferGeometry
  frames: GCodeFrame[]
  boundingBox?: {
    min: Vector3
    max: Vector3
  }
  firstVertex?: Vector3 // First vertex position for offset calculations
}

/**
 * Process G-code string and generate Three.js BufferGeometry for visualization
 * 
 * @param gcode - G-code string to process
 * @returns Geometry data with frames for animation/stepping through the toolpath
 */
export function processGCode(gcode: string | null | undefined): GCodeGeometryResult | null {
  if (!gcode) {
    return null
  }

  const positions: number[] = []
  const colors: number[] = []
  const frames: GCodeFrame[] = []
  let initialPosition: Vector3 | undefined = undefined // Track the toolpath origin (v1 from first addLine call)

  // Create toolpath processor with callbacks
  const toolpath = new Toolpath({
    // Called for each line segment (G0, G1 moves)
    // Note: The toolpath library ensures continuity - v1 of current line = v2 of previous line
    // So we only push v2 (the endpoint), not v1 - matching legacy implementation
    addLine: (modal: { motion?: string }, v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }) => {
      const { motion } = modal
      const color = motion ? (motionColor[motion as keyof typeof motionColor] || defaultColor) : defaultColor
      
      // Capture the initial position from the first move's start point (v1)
      if (initialPosition === undefined) {
        initialPosition = new Vector3(v1.x, v1.y, v1.z)
      }
      
      // Only push the endpoint - matching legacy code exactly
      positions.push(v2.x, v2.y, v2.z)
      colors.push(color.r, color.g, color.b)
    },

    // Called for each arc curve (G2, G3 moves)
    addArcCurve: (
      modal: { motion?: string; plane?: string },
      v1: { x: number; y: number; z: number },
      v2: { x: number; y: number; z: number },
      v0: { x: number; y: number; z: number }
    ) => {
      const { motion, plane } = modal
      
      // Capture the initial position from the first arc's start point (v1) if not already set
      if (initialPosition === undefined) {
        initialPosition = new Vector3(v1.x, v1.y, v1.z)
      }
      const isClockwise = motion === 'G2'
      const radius = Math.sqrt(
        ((v1.x - v0.x) ** 2) + ((v1.y - v0.y) ** 2)
      )
      const startAngle = Math.atan2(v1.y - v0.y, v1.x - v0.x)
      let endAngle = Math.atan2(v2.y - v0.y, v2.x - v0.x)

      // Draw full circle if startAngle and endAngle are both zero
      if (startAngle === endAngle) {
        endAngle += (2 * Math.PI)
      }

      // Use THREE.ArcCurve to properly handle clockwise/counterclockwise arcs
      // This matches the legacy implementation exactly
      const arcCurve = new ArcCurve(
        v0.x, // aX
        v0.y, // aY
        radius, // aRadius
        startAngle, // aStartAngle
        endAngle, // aEndAngle
        isClockwise // isClockwise
      )
      const divisions = 30
      const points = arcCurve.getPoints(divisions)
      const color = motion ? (motionColor[motion as keyof typeof motionColor] || defaultColor) : defaultColor

      for (let i = 0; i < points.length; ++i) {
        const point = points[i]
        const z = v1.z + ((v2.z - v1.z) / points.length) * i

        if (plane === 'G17') { // XY-plane
          positions.push(point.x, point.y, z)
        } else if (plane === 'G18') { // ZX-plane
          positions.push(point.y, z, point.x)
        } else if (plane === 'G19') { // YZ-plane
          positions.push(z, point.x, point.y)
        } else {
          // Default to XY-plane if plane is not specified
          positions.push(point.x, point.y, z)
        }
        colors.push(color.r, color.g, color.b)
      }
    }
  })

  // Process G-code synchronously
  toolpath.loadFromStringSync(gcode, (line: string) => {
    frames.push({
      data: line,
      vertexIndex: Math.floor(positions.length / 3) // Current vertex count
    })
  })

  // Create BufferGeometry
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
  geometry.computeBoundingBox()

  // Calculate bounding box
  let boundingBox: { min: Vector3; max: Vector3 } | undefined
  if (geometry.boundingBox) {
    boundingBox = {
      min: geometry.boundingBox.min.clone(),
      max: geometry.boundingBox.max.clone()
    }
  } else if (positions.length > 0) {
    // Manual bounding box calculation if computeBoundingBox didn't set it
    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i])
      maxX = Math.max(maxX, positions[i])
      minY = Math.min(minY, positions[i + 1])
      maxY = Math.max(maxY, positions[i + 1])
      minZ = Math.min(minZ, positions[i + 2])
      maxZ = Math.max(maxZ, positions[i + 2])
    }
    boundingBox = {
      min: new Vector3(minX, minY, minZ),
      max: new Vector3(maxX, maxY, maxZ)
    }
  }

  return {
    geometry,
    frames,
    boundingBox,
    firstVertex: initialPosition // Return the toolpath origin (initial position)
  }
}
